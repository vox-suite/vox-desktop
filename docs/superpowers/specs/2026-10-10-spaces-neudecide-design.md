# Spaces voice-to-action interface

## Agreed intent

Make voice and typed input the default Spaces interaction. Spoken commands go directly through local NeuDecide to tool calls. The canvas provides the response: pending actions become skeleton cards or overlays, then resolve into persisted changes. There is no speech playback or required transcription. Recording automatically stops and submits at 28 seconds.

Initial delivery targets the native Vox desktop application. Browser preview retains typed chat and explicitly reports native voice availability; Android integration is a separate follow-up.

## Existing foundations

Desktop has CPAL microphone capture, 16 kHz resampling, ONNX Runtime, a platform abstraction, a floating Spaces composer, and live graph subscriptions. Its existing local voice subsystem uses Whistle/Needle and NeuTTS and is not NeuDecide. Core has graph mutation tools and a durable Spaces workflow. Existing HTTP routes support chat and node patches; a dedicated validated action dispatcher is needed for the complete voice action set.

## Local inference

Add a dedicated native NeuDecide module with model readiness, loading, inference, and cancellation interfaces. Reuse ONNX Runtime and audio utilities without starting the existing speech playback pipeline. Port the upstream audio preprocessing, tokenizer, three-graph inference, decoder cache, and output parser to Rust, verifying parity against the upstream Python reference on the same fixtures before claiming native inference works.

Pin the model revision and verify downloaded artifact digests. Store model assets in the application's model cache. First-use setup presents progress and actionable errors. Hugging Face currently requires acceptance of repository access conditions; do not embed a personal access token or silently bypass the gate. Support an approved distributable asset source or a user-provided local model directory. Unavailable weights must produce an explicit setup state, never simulated inference or a silent alternate model.

Inference is offline after assets are available. Persisted graph operations and research continue to require the authenticated Core service. Do not describe the entire Spaces workflow as offline.

## Recording lifecycle

Use explicit click-to-start recording, a live input-level waveform, elapsed time, submit/stop, and cancel. At 28 seconds automatically stop capture and submit once. Native capture caps normalized mono audio at 448,000 samples (16,000 × 28); UI timing is a second guard. Reject silent/non-speech input before inference with voice-activity detection because NeuDecide can emit calls on noise. Cap memory use and release the microphone on cancellation, navigation, permission failure, and window teardown. Freeze space and node context for each recording; a changed context invalidates the pending submission. Ignore late inference results after cancellation.

## Tool contract

Pass short JSON-schema manifests at inference time, respecting the documented 1,536-token tool budget and recommendation of at most ten tools. Never silently truncate a manifest. The model emits only tool names and arguments. Vox injects the authenticated user, space, request ID, and selected-node context.

Initial action vocabulary:

- `add_node`: kind, title, optional short body.
- `update_selected_node`: optional title and body; available only with a selected editable node.
- `remove_selected_node`: available only with a selected editable node.
- `connect_selected_node`: destination from a bounded enum of visible node aliases.
- `arrange_canvas`: deterministic layout, with no model-generated coordinates.
- `start_research`: short query routed to the existing Spaces workflow.
- `continue_plan`: continue the current workflow.
- `stop_work`: stop ongoing Spaces work.
- `no_action`: explicitly decline an applicable action.

Resolve destination aliases from the frozen context rather than asking the model to reproduce UUIDs. Hide tools that do not apply. Schema-validate the complete returned call list before execution. Reject unknown names, unsupported fields, invalid aliases, and truncated output. Execute valid calls in order and stop on the first failure; report partial completion accurately. Deduplicate retries using a request ID and call index. Treat ambiguous or empty output as no mutation with an inline retry/typed-input message.

## Core execution

Add an authenticated Spaces actions endpoint. Check ownership, editable space state, node membership, argument limits, and expected node versions. Reuse repository/workflow operations; preserve dependency invalidation when prerequisites change. A local model result is input to authorization, never authorization itself. Return per-action results and IDs for durable jobs. Research/continue actions must attach to the current space and workflow rather than creating unrelated plans. Arrange operations persist positions through the same validated boundary.

Record action summaries and outcomes rather than inventing a transcript. Maintain accurate source provenance on generated research nodes. Emit correlated action started/completed/failed events and retain recoverable action status so reconnects reconcile pending UI. Idempotency must survive API process restarts.

## Default interface and feedback

Retain the current dotted canvas, square node cards, and straight connectors. Make a unified voice/text composer the default entry point on the Spaces landing and active workspace. Do not auto-activate the microphone. Typed text keeps the existing chat/planning path and shares the action feedback UI; NeuDecide is an audio model, not a text-chat replacement.

During inference show a compact deciding indicator only. Once a validated action is known, create a transient skeleton for node additions/research or an overlay on the affected node for edits. Skeletons are client presentation state, not fabricated persisted nodes. Correlate each placeholder with request/action IDs and replace it only when the backend confirms the result. Long-running planning/research uses actual job state. Cancel, failure, timeout, and reconnect must reconcile or clear placeholders without deleting completed changes.

Show concise inline status for completion and errors, including partial results and retry. Keep conversation history expandable. Respect reduced motion and provide accessible labels/status announcements. Disable mutations for committed or dropped spaces.

For first-use voice on the landing, expose a bounded `create_space` action with a short intent in a separate small manifest. The backend creates the space through the existing workflow route; show a pending workspace presentation until its ID is confirmed, then navigate to it. Do not send audio to Core.

## Verification and acceptance

- Compare native NeuDecide calls with the upstream reference using identical PCM and schemas, including free-form titles and editing content.
- Demonstrate real microphone audio creating and editing persisted nodes, with raw audio remaining local and no speech output.
- Verify 28-second cutoff, sample cap, stop/timer races, cancellation, context changes, microphone permission errors, and silent input.
- Verify ownership, space-state constraints, membership, stale versions, invalid schemas, duplicate requests, and partial failures at the action boundary.
- Verify skeleton-to-result transitions, long-running research, failure/retry, and reconnection without stale placeholders or duplicate nodes.
- Run desktop TypeScript/build checks, native Rust checks, and relevant Core checks. Inspect the actual running desktop interface for landing, recording, deciding, executing, and failed states.
- Report source checks, test fixtures, native UI validation, backend persistence, and deployment separately. Do not claim default voice is ready until model assets and real audio inference have been validated.

## Delivery boundaries

Implement in sequence: verified native inference and recording; authenticated action execution; unified composer and correlated canvas feedback; end-to-end validation. Preserve unrelated local edits in desktop and Core. No push, deployment, or mobile delivery is implied.

## Upstream references

- https://huggingface.co/neuphonic/neudecide
- https://github.com/neuphonic/neudecide

The upstream model currently documents English-only input, 30-second input and 128-token output limits, no calibrated confidence score, and weaker free-form argument extraction. The 28-second product limit stays within its input budget. Real command accuracy is an acceptance criterion, not assumed from upstream benchmarks.
