#!/usr/bin/env python3
"""Run the managed Gemini CLI against a copied investigation, without saving a project diagram.

Uses the existing signed-in Vox session and the same project gateway, prompt,
MCP executable, and renderer as the app. Run artifacts stay under ~/.vox/projects.
Never prints or copies credentials into artifacts. No project API writes occur.
"""
import argparse
import http.server
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid


def last_fenced_diagram(text):
    """Mirror of agent.rs last_fenced_diagram."""
    end = text.rfind("```")
    start = text.rfind("```json", 0, end) if end >= 0 else -1
    if start < 0:
        return None
    try:
        value = json.loads(text[start + 7:end].strip())
    except ValueError:
        return None
    if isinstance(value, dict) and isinstance(value.get("diagram"), dict):
        value = value["diagram"]
    return value if isinstance(value, dict) and isinstance(value.get("diagram_type"), str) else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Existing investigation manifest.json to copy")
    parser.add_argument("--review-only", type=Path, help="Review an existing local diagram.json without generating")
    parser.add_argument("--question", help="Override the original request")
    parser.add_argument("--new", action="store_true", help="Evaluate a fresh diagram instead of the original base")
    parser.add_argument("--api-url", default="https://api.callvox.in")
    parser.add_argument("--timeout", type=int, default=1200)
    args = parser.parse_args()
    os.umask(0o077)
    desktop = Path(__file__).resolve().parents[1]
    private_root = Path.home() / ".vox/projects"
    manifest = json.loads(args.manifest.read_text())
    project = Path(manifest["project_dir"]).resolve()
    if not project.is_relative_to(private_root.resolve()):
        raise SystemExit("Use an existing local Vox project manifest")
    if args.question:
        manifest["question"] = args.question
    if args.new:
        manifest["base"] = None
    session = json.loads((Path.home() / "Library/Application Support/com.voxagent.desktop/session.json").read_text())
    if project.parent.name != session["user_id"]:
        raise SystemExit("The source project does not belong to the signed-in account")
    api = args.api_url.rstrip("/") + "/v1/me/projects/" + project.name + "/agent"
    headers = {"Authorization": "Bearer " + session["vox_token"], "Content-Type": "application/json"}
    try:
        with urllib.request.urlopen(urllib.request.Request(api, headers=headers), timeout=30) as response:
            config = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Gateway preflight failed: HTTP {error.code}") from None
    if not config.get("available"):
        raise SystemExit("The project's Gemini gateway is unavailable")
    model = config["model"]
    review_prompt = (desktop / "src-tauri/src/projects/agent_review.rs").read_text().split('pub const PROMPT: &str = r#"', 1)[1].split('"#;', 1)[0]

    def review_candidate(flow):
        seen, excerpts = set(), []
        total_bytes = 0
        for item in flow["nodes"] + flow["edges"]:
            for citation in item["citations"]:
                ref = f"{citation['source_id']}:{citation['path']}:{citation['start_line']}-{citation['end_line']}"
                if ref in seen:
                    continue
                seen.add(ref)
                source = next(s for s in manifest["sources"] if s["id"] == citation["source_id"])
                root = Path(source["root"]).resolve()
                path = root if source["kind"] == "file" else (root / citation["path"]).resolve()
                if source["kind"] != "file" and not path.is_relative_to(root):
                    raise RuntimeError("Source escaped its approved root")
                data = path.read_bytes()
                if hashlib.sha256(data).hexdigest() != citation["hash"]:
                    raise RuntimeError("Source changed before semantic review")
                text = "\n".join(data.decode().splitlines()[citation["start_line"] - 1:citation["end_line"]])
                total_bytes += len(text.encode())
                if total_bytes > 180000:
                    raise RuntimeError("Source evidence exceeds semantic review budget")
                excerpts.append({"source_ref": f"evidence-{len(excerpts)}", "citation": citation, "text": text})
        context = {"original_request": manifest["question"], "previous_diagram": (manifest.get("base") or {}).get("diagram"), "candidate": flow, "sources": excerpts}
        body = {"systemInstruction": {"parts": [{"text": review_prompt}]}, "contents": [{"role": "user", "parts": [{"text": json.dumps(context)}]}], "generationConfig": {"responseMimeType": "application/json"}}
        feedback = ""
        for attempt in range(2):
            body["contents"][0]["parts"] = [{"text": json.dumps(context)}, {"text": "Review validation feedback: " + feedback}]
            request = urllib.request.Request(api + "/generateContent", data=json.dumps(body).encode(), headers=headers)
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.load(response)
            text = "".join(p.get("text", "") for p in payload["candidates"][0]["content"]["parts"])
            try:
                review = json.loads(text.removeprefix("```json").removesuffix("```").strip())
                if review.get("verdict") not in ("pass", "repair") or not isinstance(review.get("findings"), list):
                    raise ValueError("Invalid semantic review")
                if (review["verdict"] == "pass") != (len(review["findings"]) == 0):
                    raise ValueError("Semantic verdict contradicts findings")
                checks = review.get("relationship_checks", [])
                if len(checks) != len(flow["edges"]) or {c.get("index") for c in checks} != set(range(len(flow["edges"]))):
                    raise ValueError("Check every relationship exactly once")
                for check in checks:
                    index = check["index"]
                    if not check.get("reason"):
                        raise ValueError("Every check needs reasoning")
                    if check.get("supported") is False and review["verdict"] == "repair":
                        continue
                    if check.get("supported") is not True:
                        raise ValueError("Cannot pass unsupported relationships")
                    excerpt = next((e for e in excerpts if e["source_ref"] == check.get("source_ref")), None)
                    if not excerpt:
                        raise ValueError(f"Relationship {index}: use an exact supplied evidence-N source_ref")
                    quote = check.get("source_quote", "")
                    if len(quote.strip()) < 12 or " ".join(quote.split()) not in " ".join(excerpt["text"].split()):
                        raise ValueError(f"Relationship {index}: source_quote must be a verbatim substring, without ellipses or invented code")
                    edge = flow["edges"][index]
                    if excerpt["citation"] not in edge["citations"]:
                        raise ValueError(f"Relationship {index}: use evidence attached to that relationship")
                    if flow["diagram"]["diagram_type"] != "architecture":
                        if quote.lstrip().startswith("use "):
                            raise ValueError(f"Relationship {index}: an import is not runtime interaction evidence; mark unsupported and request the invocation")
                        has_code = any(c["path"].endswith((".rs", ".ts", ".tsx", ".js", ".py", ".go", ".kt", ".java", ".swift")) for c in edge["citations"])
                        if has_code and excerpt["citation"]["path"].endswith(".md"):
                            raise ValueError(f"Relationship {index}: an overview document cannot establish runtime caller and receiver; mark unsupported and request implementation evidence")
                return review
            except (ValueError, KeyError, TypeError) as error:
                feedback = str(error)
        raise RuntimeError("Could not substantiate independent review: " + feedback)

    if args.review_only:
        print(json.dumps(review_candidate(json.loads(args.review_only.read_text())), indent=2), flush=True)
        return
    token = secrets.token_hex(32)

    class Gateway(http.server.BaseHTTPRequestHandler):
        calls = 0
        def log_message(self, *_):
            pass
        def do_POST(self):
            action = self.path.split("?", 1)[0].removeprefix("/v1beta/models/" + model + ":")
            if self.headers.get("x-goog-api-key") != token or action not in ("generateContent", "streamGenerateContent", "countTokens"):
                self.send_error(403)
                return
            Gateway.calls += 1
            if Gateway.calls > 180:
                self.send_error(429)
                return
            size = int(self.headers.get("Content-Length", "0"))
            if size > 2_000_000:
                self.send_error(413)
                return
            request = urllib.request.Request(api + "/" + action, data=self.rfile.read(size), headers=headers)
            try:
                response = urllib.request.urlopen(request, timeout=90)
            except urllib.error.HTTPError as error:
                response = error
            except Exception:
                self.send_error(502)
                return
            with response:
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                self.end_headers()
                while chunk := response.read(8192):
                    self.wfile.write(chunk)
                    self.wfile.flush()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Gateway)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    run = project / "investigations" / ("quality-eval-" + str(uuid.uuid4()))
    workspace = run / "workspace"
    workspace.mkdir(parents=True)
    (run / "manifest.json").write_text(json.dumps(manifest))
    home = run / "gemini-home"
    (home / ".gemini").mkdir(parents=True)
    host = desktop / "target/debug/vox-desktop"
    runtime = private_root / "engines/gemini-v0.63.0-node22.23.3-aarch64"
    settings = {"security":{"auth":{"selectedType":"gemini-api-key"}},"advanced":{"autoConfigureMemory":False},"telemetry":{"enabled":False},"context":{"fileName":"VOX_NO_PROJECT_INSTRUCTIONS.md"},"model":{"maxSessionTurns":80,"disableLoopDetection":True},"mcpServers":{"vox-sources":{"command":str(host),"args":["--vox-project-tools",str(run)],"trust":True,"timeout":60000}}}
    (home / ".gemini/settings.json").write_text(json.dumps(settings))
    policy = run / "policy.toml"
    policy.write_text('[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 800\n\n[[rule]]\ntoolName = "*"\nmcpName = "vox-sources"\ndecision = "allow"\npriority = 900\n')
    prompt = (desktop / "src-tauri/src/projects/agent.rs").read_text().split('const PROMPT: &str = r#"',1)[1].split('"#;',1)[0]
    command = [str(runtime / "node"),str(runtime / "bundle/gemini.js"),"--skip-trust","--model",model,"--prompt",prompt,"--output-format","stream-json","--approval-mode","default","--allowed-mcp-server-names","vox-sources","--admin-policy",str(policy)]
    env = {"HOME":str(Path.home()),"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","GEMINI_CLI_HOME":str(home),"NO_COLOR":"1","GEMINI_CLI_IDE_SERVER_PORT":"","GOOGLE_GEMINI_BASE_URL":f"http://127.0.0.1:{server.server_port}","GEMINI_API_KEY":token}
    request = manifest["question"] + "\n" + ("A diagram is open on the canvas. Call current_diagram before deciding what to change." if manifest.get("base") else "No diagram is open.")
    print(json.dumps({"run":str(run),"model":model,"question":manifest["question"]}), flush=True)
    try:
        deadline = time.monotonic() + args.timeout
        repair_feedback = ""
        semantic_accepted = False
        for attempt in range(3):
            if attempt == 1:
                command.extend(["--resume", "latest"])
                command[command.index("--prompt") + 1] = "Continue the original request using retained tool state. Finish preview, evidence review, and submission tools. A JSON-only answer is incomplete. Preserve the accepted investigation unless evidence requires correction. Use valid JSON tool arguments, not a textual imitation of a tool call."
            if attempt:
                request = "Continue this same investigation. The previous turn ended without an accepted draft. Tool state and citations are retained. Complete record_investigation if needed, preview_diagram, review_diagram and submit_diagram. Correct tool errors; do not finish with only fenced JSON. Stop only after submit_diagram returns accepted:true."
                request += " Independent source review findings to repair: " + repair_feedback
            with (run / "events.jsonl").open("a") as out, (run / "stderr.log").open("a") as err:
                proc = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err, text=True, cwd=workspace, env=env)
                timer = threading.Timer(max(1, deadline - time.monotonic()), proc.kill)
                timer.start()
                proc.stdin.write(request)
                proc.stdin.close()
                reply = ""
                for line in proc.stdout:
                    out.write(line)
                    try:
                        event = json.loads(line)
                    except ValueError:
                        continue
                    if event.get("type") == "message" and event.get("role") == "assistant":
                        reply += event.get("content", "")
                        diagram = last_fenced_diagram(reply)
                        if diagram is not None:
                            (run / "streamed-diagram.json").write_text(json.dumps(diagram))
                result = subprocess.CompletedProcess(command, proc.wait())
                timer.cancel()
                if time.monotonic() >= deadline:
                    raise subprocess.TimeoutExpired(command, args.timeout)
            if result.returncode:
                break
            if (run / "diagram.json").exists():
                review = review_candidate(json.loads((run / "diagram.json").read_text()))
                (run / f"semantic-review-{attempt}.json").write_text(json.dumps(review, indent=2))
                if review["verdict"] == "pass":
                    semantic_accepted = True
                    break
                repair_feedback = json.dumps(review)
                (run / "diagram.json").rename(run / f"rejected-diagram-{attempt}.json")
                state = json.loads((run / "tool-state.json").read_text())
                state["quality"]["preview"] = state["quality"]["reviewed"] = None
                (run / "tool-state.json").write_text(json.dumps(state))
            print(json.dumps({"completion_retry": attempt + 1}), flush=True)
        accepted = semantic_accepted and (run / "diagram.json").exists()
        print(json.dumps({"exit_code":result.returncode,"accepted":accepted,"gateway_calls":Gateway.calls,"run":str(run)}), flush=True)
        if not accepted:
            raise SystemExit(1)
    except subprocess.TimeoutExpired:
        raise SystemExit("Generation exceeded its evaluation timeout; inspect the private run artifacts") from None
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
