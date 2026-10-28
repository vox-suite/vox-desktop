# Meeting summaries and reviewed tasks

The Summary tab offers explicit **Generate with cloud text**. It sends only saved transcript segments, meeting time/timezone, and the optional names the user supplied. Audio capture and speech recognition remain local; no audio is accepted by the summary API. Opening a meeting never starts an upload. Handwritten notes are separate and excluded from analysis.

Core authenticates `/v1/meetings/analyze`, uses the existing configured text model without tools or content telemetry, validates cited evidence, bounds input/output and time, and records model usage. The endpoint does not store transcripts or summaries in the application database. A provider processes the submitted text; this option is not an offline summary model.

SQLite schema 3 attaches the result and transcript fingerprint to the account-local meeting. Changed transcripts mark old summaries stale and prevent approving new candidates. Generating fails visibly rather than truncating over 100,000 bytes of transcript IDs/text (also limited to 5,000 segments and two hours of source-relative timestamps). The previous summary remains on failure. Capture source labels do not identify speakers; names help suggestions, and uncertain ownership remains visible.

Every suggested task requires **Add to my tasks**. Before sending, the exact approved task request and stable evidence key are saved locally. Retry sends the same body and request ID through the canonical personal-task API. Pending approvals remain available even if a later summary omits them. Confirmed tasks appear in Timeline as human to-dos; adding one does not run an agent or schedule a reminder. Dismissal and saved receipts persist across unchanged evidence. A deleted server task's 410 receipt prevents recreation. There is no automatic background retry.

Deleting a meeting deletes its local summary and approval receipts. Already-created Timeline tasks remain. A generated summary is read-only; Your notes stays editable.

## Verification (2026-10-29)

Shared protocol tests cover citations, exact quotes, unsupported audio fields, owner uncertainty, distinct evidence times, and control-character task titles. The local store suite covers restart persistence, immutable approved bodies, repeated responses, deleted-task tombstones, dismissal, stale transcripts, notes, account isolation, and audio cleanup. Browser fixtures cover explicit generation, evidence, cloud failure preservation, pending retry after omitted suggestions, immutable deadlines, regeneration without duplicate tasks, unsaved drafts, and narrow layout. Native macOS source checks and the production frontend build pass.

This is source/local-fixture evidence. Live provider responses, deployed API compatibility, packaged desktop behavior, and Windows device capture are not verified here. Fully local LLM summaries and hierarchical processing of longer transcripts remain future work. Full desktop strict Clippy is currently blocked by existing warnings outside this slice; the meeting store passes strict Clippy.
