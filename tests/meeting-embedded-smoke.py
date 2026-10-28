#!/usr/bin/env python3
"""Explicit local smoke: never opens capture devices; requires caller-supplied public audio/model."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser()
parser.add_argument("--binary", type=Path, required=True)
parser.add_argument("--model", type=Path, required=True)
parser.add_argument("--audio", type=Path, required=True)
args = parser.parse_args()
profile = "(version 1)(allow default)(deny network*)"
# Prove that the profile denies sockets, rather than merely trusting its label.
probe = subprocess.run(["/usr/bin/sandbox-exec", "-p", profile, "/usr/bin/python3", "-c",
    "import socket,errno; s=socket.socket();\ntry: s.connect(('127.0.0.1',9))\nexcept OSError as e: raise SystemExit(0 if e.errno==errno.EPERM else 2)\nraise SystemExit(3)"], capture_output=True)
assert probe.returncode == 0, f"Network denial probe failed: {probe.stderr.decode()}"
with tempfile.TemporaryDirectory(prefix="vox-bundled-speech-") as temp:
    prefix = Path(temp) / "transcript"
    command = ["/usr/bin/sandbox-exec", "-p", profile, str(args.binary.resolve()),
        "meeting-transcribe-worker", str(args.model.resolve()), str(args.audio.resolve()), str(prefix), "mic"]
    start = time.monotonic()
    with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as worker:
        # Keep the supervising stdin pipe open; EOF intentionally terminates this worker.
        try:
            worker.wait(timeout=120)
        except subprocess.TimeoutExpired:
            worker.kill()
            worker.wait()
            raise
        assert worker.returncode == 0, f"Bundled inference failed: {worker.returncode}"
    data = json.loads(prefix.with_suffix(".json").read_text())
    assert data and all(s["source"] == "mic" and s["end_ms"] >= s["start_ms"] for s in data)
    text = " ".join(s["text"] for s in data).lower()
    assert "country" in text and "americans" in text, "Expected the public JFK sample"
    print(json.dumps({"network": "denied and probed", "segments": len(data), "inference_wall_seconds": round(time.monotonic()-start, 2)}))
    prefix.with_suffix(".json").unlink()
    start = time.monotonic()
    with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as worker:
        worker.stdin.close()
        try:
            worker.wait(timeout=5)
        except subprocess.TimeoutExpired:
            worker.kill()
            worker.wait()
            raise
        assert worker.returncode != 0, "Worker must stop when parent pipe closes"
    assert not prefix.with_suffix(".json").exists()
    print(f"PASS parent EOF stops bundled worker in {time.monotonic()-start:.2f}s")
