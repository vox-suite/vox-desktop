# Project investigations

Vox runs the pinned Gemini CLI v0.63.0 JavaScript engine with a managed Node.js 22.23.3 runtime on macOS. Both downloads have pinned integrity checks. No global Gemini CLI or Node installation is required. The engine and its retained license notices live in the private Vox engine cache.

The default model connection is Vox Core. A project-owned API gateway forwards only generateContent, streamGenerateContent and countTokens requests to the configured Gemini model. The provider key stays on Core. The desktop opens a loopback gateway protected by a random capability, supplies that capability to the CLI as GEMINI_API_KEY, and forwards authorized requests using the Vox session. The listener and capability disappear when the investigation ends. Core bounds request size and model-call rate. VOX_PROJECT_AGENT_MODEL can override the investigation model; otherwise Core uses its configured Gemini model.

A user can optionally supply a Gemini API key through the project connection dialog. It is stored in the macOS keychain per Vox account and passed only to the engine process. Removing the key restores the default Vox connection. Personal Gemini CLI OAuth is not used.

The engine has a deny-by-default tool policy. Its only enabled tools are provided by the Vox read-only sources MCP adapter: list_sources, list_files, search_symbols, graph_calls, search_text, read_source, diagram_capabilities, diagram_schema, preview_diagram and submit_diagram. It has no shell, edit or web-search tools. The adapter queries the existing Code Graph SQLite index and reads only paths approved in the source registry. File contents and repository instructions are untrusted data.

read_source checks path containment, indexed membership, current file hash and line bounds. It issues per-investigation citation IDs. submit_diagram validates the diagram against its schema, accepts only issued citation IDs and checks IDs, bounds and source freshness. Citations are attached by the agent to whichever elements and relationships the sources establish; Vox does not require them on every element or define what an element or relationship means. The desktop rechecks references before returning the result. A text-only answer is a failure, not a successful empty canvas.

The frontend checks for changed sources and refreshes their indexes before investigation. Native progress streams through a Tauri channel. The user can stop the investigation; leaving the project cancels it. The native process group and loopback gateway are closed at completion or cancellation. A successful diagram is persisted through normal project revision and ownership checks, so it reopens on the canvas and can be used as context for a follow-up investigation. Each follow-up must gather new evidence rather than reusing old citation IDs.

The managed runtime currently supports Apple Silicon and Intel macOS. Other desktop platforms report the missing runtime explicitly. Existing Core text-ideation endpoints remain for other clients, but desktop tracing no longer uses the single-call excerpt path.

## Diagram construction and presentation

The prompt is generic: it gives the agent the intent (explain the user's question truthfully and completely from their sources, whatever kind of material they are) and leaves every diagram decision to the agent, including the representation, what elements and connections stand for, grouping and layout. diagram_capabilities exposes each representation and its building blocks; diagram_schema provides the complete schema and a syntax example. Examples are not project evidence. preview_diagram compiles the candidate and returns repairable schema and composition feedback. gaps lists only what the answer needs that the sources do not contain. Structural validation and citation freshness do not establish that every interpretation is semantically correct.

Vox embeds the pinned Archify 3.0.1 renderers, schemas, templates and font notices. They run with managed Node in a private directory, without provider credentials, repository access, remote images or brand downloads. The original typed IR and normalized source evidence persist together through Core. Older diagrams saved without a typed IR are not displayed.

New diagrams display a sanitized SVG in an isolated Shadow DOM with pan, zoom and source inspection. The canvas retains the Plans background and Archify's representation-specific colors and shapes. Export supports standalone interactive HTML, SVG and JSON with the flow's source references. Hosted gallery publishing is not included.
