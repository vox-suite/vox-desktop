# Global live voice and desktop control

## Approved product direction

One persistent Talk to Vox CTA starts a live, bidirectional session using exactly the phone-call voice pipeline. Vox speaks back and supports interruptions. The session remains active until ended; remove the former 28-second recording limit. The same agent tools work from a phone call and from desktop voice, including remote control of the connected Vox desktop UI.

This supersedes `2026-10-10-spaces-neudecide-design.md`. NeuDecide, local inference, and a separate desktop speech-to-text/LLM/text-to-speech pipeline are excluded from this feature.

## Current source findings

Phone calls use Bridge's shared `spawn_playback_session` / `run_voice_session_with_playback` orchestration. Desktop currently connects directly to Core `/v1/me/voice/socket` and may activate its local Whistle/Needle/NeuTTS path. That existing desktop route does not satisfy exact phone-pipeline reuse. Core's live socket sends account-scoped updates to desktop; it is not yet an acknowledged, device-addressed app-command channel.

## Shared phone and desktop pipeline

Add an authenticated desktop transport adapter in Bridge that feeds the same shared session constructor, provider configuration, turn detection, interruption handling, agent execution, TTS streaming, and playback lifecycle used by Twilio. Only transport authentication, framing, audio conversion, and playback acknowledgments differ. Normalize audio to the formats supported by that common path; do not copy the session loop into Core or the desktop client. Desktop microphone capture and playback stay native. End, mute, reconnect, and interruption explicitly clean up resources and stale playback.

Preserve phone behavior and provider settings. Do not create a parallel desktop voice policy or select local models for this session. Leave unrelated existing clients on their current route until separately migrated.

## Desktop application shell

Split the root into a flexible main region and a full-width bottom taskbar. Split the main region into sidebar and page content. Pages include Spaces, Timeline, Pulse, and Connectors. The taskbar owns Talk to Vox, current context, voice connection/listening/speaking/action status, mute/end controls during calls, typed input, and a quieter Terminal CTA. Terminal opens a panel above the taskbar without losing the current page. No automatic microphone activation.

Retain Spaces' dotted canvas and card/connector language. Voice is global; page-specific conversation history may remain expandable, but the primary voice CTA is the taskbar.

## Context and targeting

The desktop publishes a bounded structured snapshot: authenticated device ID, connection generation, page, active space/pulse, selected node/item, Timeline filters, timezone, capabilities, and monotonically increasing context revision. Publish changes during the session, not only at its start. Core supplies authoritative user identity; the model cannot choose a different owner.

Desktop-started sessions bind to that device. Phone sessions can discover the user's currently connected controllable desktops; use the sole available desktop or ask which device when more than one is eligible. Require fresh presence and context. Do not guess an unavailable desktop's state. Connection loss is distinct from successful server-side data changes.

## Agent tools

Expose structured application tools through the common Core agent registry, so phone and desktop sessions share behavior:

- Read connected desktop context and capabilities.
- Navigate to a supported page or identified Space/Pulse.
- Search/filter Timeline spending with day, week, or explicit start/end dates and optional merchant/category filters.
- Select an available item and inspect its structured details.
- Create and modify Spaces, nodes, connections, and workflow tasks through authenticated Core operations.
- Create/update Pulse definitions through existing validated services and open their UI.
- Open or close the desktop terminal panel. Shell execution is not part of this tool.

Use application functions rather than screen-coordinate clicking. Resolve relative dates using the user's timezone and existing week conventions; use explicit timezone-aware boundaries and display the applied range. Preserve unknown coverage rather than reporting missing data as zero. Resolve names to real IDs. Ambiguous references produce spoken clarification before mutation.

## Command delivery and results

Core validates ownership and tool schemas, targets a specific registered desktop connection, and sends a typed command with command ID, originating session/turn, expiry, expected context revision, and arguments. The desktop checks supported command type and relevant target context before applying it, then acknowledges with success/failure and resulting context. Commands depending on selection reject stale context; explicit navigation commands may change pages as intended.

Extend the live transport or add a dedicated authenticated channel with device-addressed routing and a return acknowledgment path. Existing account broadcasts alone are insufficient. Deduplicate commands, reject expired commands, and ensure reconnect never replays stale UI actions. Acknowledgments reconcile request status; a timeout is unknown/failed delivery, not proof nothing executed. No automatic retry of mutations without durable idempotency.

Separate Core data mutations from desktop presentation. Creating a Space can succeed while opening its UI fails; return and speak those outcomes accurately. Never report a desktop action completed before acknowledgment. Remote phone control works while the signed-in desktop is connected; do not promise waking or launching an offline app.

## Visible and spoken feedback

The taskbar shows actual voice and tool lifecycle states. Destination pages show loading for queries, skeletons for pending additions/research, and overlays for affected nodes. Correlate transient UI with action IDs; reconcile on failure, cancellation, reconnect, and completion. Durable workflows use their real task states. Keep feedback visible even when the originating voice session is a phone call.

Vox can briefly explain progress and summarize verified results, using the shared phone response pipeline. Interrupting speech cancels stale response/audio according to that pipeline; it must not silently undo already committed data operations. UI status must reflect work still running after an interruption. Support accessible status announcements and reduced motion.

## Verification

Verify shared session constructor/provider parity in source, then native desktop audio, barge-in, playback acknowledgments, mute/end, reconnection, and sustained conversation. Verify phone-to-desktop navigation and Timeline date searches with a real call separately from simulated commands.

Test cross-account rejection, device targeting, offline/stale context, expired commands, duplicate delivery, delayed acknowledgments, partial data/UI success, and multiple-desktop selection. Exercise Spaces and Pulse with persisted results and correlated loading transitions. Inspect the running taskbar/page/terminal layout, not only screenshots of mocked states.

Run relevant Bridge/Core/native Rust and desktop TypeScript checks. Report local tests, native runtime checks, deployed transport availability, and real phone control as separate evidence. Preserve unrelated working changes. No push or deployment is implied by writing this spec.

## Execution sequence

1. Shared Bridge desktop audio adapter and native client migration.
2. Authenticated desktop presence/context and acknowledged command channel.
3. Common agent tools for navigation and Timeline spending filters.
4. Global taskbar/shell and action feedback.
5. Spaces/Pulse actions and end-to-end desktop/phone verification.

The exact shared voice path and acknowledgment boundary are requirements. Implementation planning must enumerate transport formats, registration/authentication, router contracts, and existing mutation services from source before coding.
