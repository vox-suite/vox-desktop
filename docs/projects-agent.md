# Project investigations

Vox runs the pinned Gemini CLI v0.63.0 JavaScript engine with a managed Node.js 22.23.3 runtime on macOS. Both downloads have pinned integrity checks. No global Gemini CLI or Node installation is required. The engine and its retained license notices live in the private Vox engine cache.

The default model connection is Vox Core. A project-owned API gateway forwards only generateContent, streamGenerateContent and countTokens requests to the configured Gemini model. The provider key stays on Core. The desktop opens a loopback gateway protected by a random capability, supplies that capability to the CLI as GEMINI_API_KEY, and forwards authorized requests using the Vox session. The listener and capability disappear when the investigation ends. Core bounds request size and model-call rate. VOX_PROJECT_AGENT_MODEL can override the investigation model; otherwise Core uses its configured Gemini model.

A user can optionally supply a Gemini API key through the project connection dialog. It is stored in the macOS keychain per Vox account and passed only to the engine process. Removing the key restores the default Vox connection. Personal Gemini CLI OAuth is not used.

The engine has a deny-by-default tool policy. Its only enabled tools are provided by the Vox read-only Code Graph MCP adapter: list_sources, list_files, search_symbols, graph_calls, search_text, read_source and submit_diagram. It has no shell, edit or web-search tools. The adapter queries the existing Code Graph SQLite index and reads only paths approved in the source registry. File contents and repository instructions are untrusted data.

read_source checks path containment, indexed membership, current file hash and line bounds. It issues per-investigation citation IDs. submit_diagram accepts only issued references, requires citations on every node and observed connection, and checks shape, IDs, bounds and source freshness. Uncertain connections must be inferred. The desktop rechecks references before returning the result. A text-only answer is a failure, not a successful empty canvas.

The frontend checks for changed sources and refreshes their indexes before investigation. Native progress streams through a Tauri channel. The user can stop the investigation; leaving the project cancels it. The native process group and loopback gateway are closed at completion or cancellation. A successful diagram is persisted through normal project revision and ownership checks, so it reopens on the canvas and can be used as context for a follow-up investigation. Each follow-up must gather new evidence rather than reusing old citation IDs.

The managed runtime currently supports Apple Silicon and Intel macOS. Other desktop platforms report the missing runtime explicitly. Existing Core text-ideation endpoints remain for other clients, but desktop tracing no longer uses the single-call excerpt path.
