# Vox desktop meeting recording — proposed design and delivery plan

Date: 2026-10-28. Status: revised proposal; no implementation or dependency adoption. This revision supersedes the earlier cloud-audio/transcription proposal. User requirements: Granola-style local recording; no audio on Vox servers; evaluate local speech models; store transcript with attached summary; extract personal to-dos into the same generic task system used by direct requests. Remaining defaults are recommendations.

## Outcome and scope

A user starts a recording in Vox on macOS or Windows. Vox captures their microphone and computer audio, keeps a timestamped transcript, and produces an editable meeting note with a summary, decisions, open questions, and personal tasks. Works without a meeting bot. Microphone-only mode covers in-person conversations. Initial scope is audio, not screen/video recording.

Recommended first release: explicit start/pause/resume/stop, two input meters, device selection, typed notes during the meeting, background recording with a persistent menu bar/tray indicator, recoverable local capture, and notes after stopping. Run local speech recognition during capture when the device can keep up, with a local final pass after stopping. Live text can remain provisional; slower machines may complete transcription after the meeting. Initially suspend Talk to Vox while recording and show the reason; one session owns the microphone. System-output mode includes unrelated apps and notifications on that output; explain this at start. Selected-app capture is later work. Automatic meeting detection and calendar title/participant lookup are subsequent work; detection should suggest recording rather than silently start it.

## Existing Vox foundations verified locally

- `src-tauri/src/audio.rs`: CPAL microphone capture, Sonora AEC/noise suppression, bounded delivery option, and resampling. Its render reference is Vox playback, not arbitrary meeting-app playback. It also opens an output stream, so it is not a drop-in meeting recorder.
- `src-tauri/Cargo.toml`: CPAL 0.15, Sonora, Rubato, Tokio, Rusqlite, Reqwest and Tauri 2 already present.
- `src-tauri/src/bridge_voice/mod.rs`: authenticated desktop conversational voice bootstrap/transport. Reuse infrastructure where appropriate, not conversation turn-taking, tools, or spoken replies.
- `../vox-core/src/stt/assemblyai.rs`: batch utterance transcription currently returns text, not meeting-length word timestamps, channel identities, or diarization. Do not use it for meeting audio under the new local-only requirement. Reuse text-processing infrastructure separately.
- `src-tauri/Info.plist`: microphone description exists; system-audio description must be added for a Core Audio tap implementation.

## Platform approach

Use native capture in the Rust host, not webview display-capture APIs.

macOS: prefer audio-only Core Audio taps plus a microphone stream. Apple documents taps from macOS 14.2 and requires `NSAudioCaptureUsageDescription` and a system-audio grant, alongside microphone permission. Library floors can be higher: flexaudio currently requires macOS 14.4 for system/process capture. Propose 14.4+ for the initial feature if flexaudio wins. ScreenCaptureKit through Rust bindings is an alternative when older supported versions matter; that changes the permission experience. Do not silently switch capture mechanisms after permission denial.

Windows: WASAPI shared-mode render-endpoint loopback plus microphone input. Explicitly track the selected output, since meeting apps can use a communications device different from the default. Propose Windows 11 for initial validation. If Windows 10 support is needed, validate endpoint loopback separately: Microsoft documents process-loopback sample support from build 20348, not ordinary Windows 10 22H2 build 19045. Avoid promising per-app capture on all Windows 10 systems.

## Open-source shortlist

| Library | License | Benefit | Qualification |
| --- | --- | --- | --- |
| [flexaudio](https://github.com/Studio-Sadola/flexaudio) | MIT | Unified Rust mic, loopback and process capture; events, buffering, normalization | First evaluation candidate. Small adoption footprint; changing pre-1.0 API. Current main reports 0.8.1; no latest GitHub release returned. Pin an evaluated published version or revision. macOS 14.4+ floor. |
| [wasapi-rs](https://github.com/HEnquist/wasapi-rs) | MIT | Windows loopback, process-recording example, device notifications | Strong Windows adapter alternative; does not provide the complete session/persistence layer. Check Rust-version requirements. |
| [screencapturekit-rs](https://github.com/doom-fish/screencapturekit-rs) | MIT OR Apache-2.0 | Rust ScreenCaptureKit bindings and system audio | macOS alternative; system audio from 13+, integrated microphone requires 15+, so separate mic capture remains useful. |
| [AudioTee](https://github.com/makeusabrew/audiotee) | MIT | Small Swift Core Audio tap implementation with PCM output | macOS 14.2+ alternative; sidecar signing, lifetime and packaging need work. README warns API instability. |
| [CPAL](https://github.com/RustAudio/cpal) | Existing dependency | Keep current mic foundation | Vox's current microphone path alone does not capture other apps. |

Recommendation: evaluate flexaudio's system-only stream alongside existing microphone processing, with independent source tracks. Do not use a premixed convenience source until it is proven to preserve the required channel identities. Its secondary output is another representation of audio, not evidence of separated mic/system tracks. Its documented arrival timestamps are not a media clock: alignment and device drift still belong to Vox. Audit the pinned dependency tree and third-party notices before adoption.

Screenpipe current `LICENSE.md` requires a commercial agreement for commercial embedding and competing products. Exclude current code from default adoption; older MIT revisions require their own provenance/dependency audit. This is not a recommendation to vendor an old revision.

## Local models and integration

Use specialized local automatic speech recognition (ASR) for audio → text; a general-purpose LLM is not required for that step. Model runtime, model weights, speech-activity detection and speaker diarization are separate dependencies.

| Candidate | License / platform | Decision |
| --- | --- | --- |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT runtime; macOS/Windows; CPU, Metal/Core ML on Apple, CUDA/Vulkan options | Recommended initial cross-platform baseline. Benchmark multilingual small versus higher-quality larger variants, including quantization. Whisper streaming examples are sliding-window inference, not a finished meeting pipeline. |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | Apache-2.0 runtime; macOS/Windows; C and Rust APIs | Benchmark against Whisper using an exact model/export. Supports streaming/non-streaming ASR, VAD and diarization families; model weights have separate terms. Published model list includes Parakeet TDT v2 int8 for English. |
| [NVIDIA Parakeet TDT v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) | CC-BY-4.0 weights; English plus European languages | Strong candidate for supported languages. Hindi is absent from its 25-language list. Validate an exact compatible ONNX/runtime export; do not assume all NeMo models load in every runtime. |
| [FluidAudio](https://github.com/FluidInference/FluidAudio) | Apache-2.0 runtime; Apple platform optimization | Optional Apple-specific acceleration, not the common Windows solution. Adds a Swift integration path. Check individual weights independently. |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | MIT runtime; macOS/Windows; Metal, CPU, CUDA/Vulkan options | Optional local text summarization/extraction. Still an LLM, just on-device. A compatible instruction model and its weight license need separate selection. |

Package a pinned native worker with Vox, using a narrow versioned IPC protocol over pipes rather than exposing a public local server. C APIs are an alternative if the integration spike favors them. Do not require end users to install Python, CUDA developer tools, Ollama or a separate application. Do not adopt the archived tazz4843/whisper-rs repository without checking an actively maintained successor and native-version compatibility.

Add model management: initial opt-in download, exact hashes/versions, resumable download, disk-space checks, cancellation, corrupted-cache repair, remove/change model, and offline readiness indicator. Audio processing must work offline after assets are installed. Recording start must clearly say whether transcription is ready or audio will be queued locally; missing weights must never trigger cloud ASR.

Choose defaults after benchmarking a representative Apple Silicon Mac, Intel Mac if supported, ordinary Windows CPU-only laptop, and Windows GPU machine. Measure both source tracks plus the meeting app concurrently, sustained real-time factor, latency, memory, battery/thermal load and accuracy for accents, names, English/Hindi/code-switching if required. Lower-power devices should queue local final transcription rather than silently upload. As upstream reference only, whisper.cpp lists unquantized small at 466 MiB disk/~852 MB memory, medium at 1.5 GiB/~2.1 GB; total Vox/OS/two-track usage is larger and must be measured. Model size is not a RAM requirement for the full product.

## Architecture and privacy boundary

Mic + system audio → native bounded capture → time alignment/resampling/AEC → local chunks and manifest → local VAD/ASR → timestamped transcript → text-only summary/extraction → attached note and shared personal tasks.

**No audio upload path:** no audio in Vox APIs, object storage, third-party speech services, model-provider inputs, telemetry, logs, support bundles or crash attachments. The server accepts meeting text/metadata only. No silent cloud transcription fallback. Keep recovery audio on the device, encrypted with keys outside the files; delete it after local finalization and transcript persistence succeeds by default. An explicit local retention setting can retain it for replay/reprocessing. Cloud summary failure must not force audio retention after a durable final transcript exists. Disk-full and unrecoverable-key cases must be visible. Crash recovery prompts before restarting capture; it does not silently resume listening.

Keep capture callbacks free of disk/network work. Preserve independent source tracks with sequence, frame count, capture clock and explicit gap markers; correct device drift rather than aligning callback arrival times. Feed aligned system playback to mic AEC and test that it removes echo without deleting the local speaker. Pause records neither track and timeline mappings must preserve its boundary. Close/minimize behavior must keep the recording indicator visible; explicit quit must stop or offer background operation clearly.

State recording and processing independently: capture preparing/recording/paused/stopped/interrupted; local transcription pending/running/ready/failed; text sync and summarization separately pending/running/ready/failed. Capture continues during network loss. Checkpoint local ASR work; merge overlapping chunk text once and retain final/provisional revisions. Speaker labels across chunks require reconciliation, not an assumption that Speaker A means the same person in every job. Silence must not become fabricated speech. When one source fails, explicitly show partial capture and the recording gap.

Partition recordings, transcripts, worker jobs, encryption keys and pending outboxes by account. Logout/account switching stops capture and prevents prior-account data syncing as the new account. Account deletion cleans associated local data under an explicit policy. Text storage proposal: save transcript, note and pending tasks locally in SQLite first; sync only text/metadata through Vox Core into the existing authenticated store for cross-device access. This text-sync default is a recommendation, not a claim that the user requested all data to remain local. In cloud-summary mode the transcript leaves the device as text; label that plainly. Fully local summary mode uses llama.cpp and sends no transcript to a cloud model; text sync is a separate setting. Do not market optional cloud-text processing/sync as fully local data handling.

## Transcript, summary and generic tasks

Persist a meeting record with local ID, owner, title, times, processing state and recording mode. Transcript segments have stable IDs, source, start/end, text, finality, speaker label and uncertainty when available. Attach summary revisions to the meeting and transcript version, with decisions, personal actions, open questions and evidence segment IDs. Preserve user edits during regeneration; keep the transcript if summary generation fails. Long transcripts use bounded chunk extraction plus final synthesis, with evidence IDs carried through. Retrying the same transcript/model/prompt revision must not create another summary or duplicate tasks.

For minimum engineering/cost, first offer local ASR plus one cloud text-processing job for summary and task extraction using Vox's existing model integration. Also define the same structured-output interface for a local llama.cpp backend. A quantized instruction model is a benchmark candidate, not a promised quality level. Record latency and token usage; cache by transcript revision. Local ASR removes per-minute speech API costs, but downloads, device compute, text storage and any cloud LLM still have costs.

### One canonical personal-task model

Verified existing foundations: `../vox-core/src/domain/spans.rs` already supports title, notes, due date, status, source, metadata, versioning and manual-human execution. `../vox-core/src/agents/tools/event_actions.rs::RecordTask` records planned timeline to-dos. Conversely `../vox-core/src/durable_tasks/mod.rs::start` starts agent execution and must not be called just to save a human to-do. Space tasks are workflow execution state, not the personal to-do store.

Build a shared personal-task service on existing timeline spans, rather than a meeting-only task table. Both direct requests (voice/chat/manual creation) and meeting extraction call it. Extend as needed with source links and pending-review metadata; do not force an event ID on direct requests. Proposed interface: `create_personal_task(user_context, title, notes, due_at?, source_links[], idempotency_key)` plus list/update/complete/cancel. Source links identify meeting ID, transcript segment IDs and originating request; manual tasks need no meeting. Use user-supplied deadlines with timezone, leave unknown dates unset, and keep status independent of meeting-processing state. A scheduled reminder or autonomous delegation is a separate explicit operation linked to the task.

Meeting → transcript + attached summary + task links; direct request → same canonical task. All appear in the existing Timeline task experience and can also be filtered by source meeting. Scope idempotency to owner plus originating request/extraction identity: retries reuse keys; distinct intentional requests use distinct keys. Persist dismissal/deletion tombstones across regeneration. Local outbox IDs map to canonical server IDs, with idempotent sync and version conflicts handled without overwriting manual edits. Reprocessing must compare extraction identities and existing task links, not simply titles; a user-deleted/dismissed task must not reappear on retry. Meeting deletion should ask whether linked tasks should remain; retained tasks lose deleted evidence excerpts as required.

### Extracting tasks meant for the user

Return structured candidates with title, assignee identity/unknown, due date/unknown, supporting segment IDs, and assignment evidence. Separate commitments from suggestions, negations and discussion. Treat microphone/system as source labels, not proof of identity: microphones can capture several local people, remote speakers can assign tasks to the user, and “we should” is not a personal commitment. Use explicit names/aliases, participant mapping where available and user correction; do not require voice biometrics.

Recommended behavior: automatically save clearly assigned personal tasks as ordinary planned to-dos with a visible “Added from this meeting” list and undo; route ambiguous ownership into review. Make this a recording preference so users can choose review-all. Direct explicit “create a task” requests save immediately through the same service. Transcript contents are untrusted data: structured extraction cannot invoke arbitrary tools or authorize emails, reminders or agent execution. Validate returned evidence IDs and owners before bounded task persistence.

## Delivery sequence and acceptance

1. **Local capture + model evaluation:** retain the capture-library shortlist; test flexaudio against native alternatives, benchmark whisper.cpp versus an exact sherpa-onnx model on actual Mac and Windows devices. Deliver dependency/weight licenses, pins, hardware matrix, quality/thermal measurements and language coverage. Source review alone does not pass.
2. **Generic task service:** wrap timeline spans in the common personal-task contract; route direct task creation through it without starting an agent. Test untimed tasks, explicit deadlines/timezones, ownership, repeat requests, completion and offline sync/conflicts. Deliver a reusable vertical slice independent of meetings.
3. **Durable local recorder + ASR:** add `src-tauri/src/meeting_recording/{capture,session,storage,transcription,models}.rs` and a packaged model worker; register commands in the existing Tauri entry point. Add model download/readiness and local persistence. Test two-track alignment/AEC, pause/repeated stop, overflow, disk-full, worker crash, missing/corrupt models, restart recovery and offline finalization. No audio endpoints or audio upload jobs.
4. **Meeting text storage + summary/extraction:** add text-only meeting endpoints, ownership-scoped text schema and local outbox; attach summary revisions and task evidence links. Reuse existing text model integration behind a cloud/local backend interface. Test long-meeting synthesis, ambiguous/other-person tasks, negation, prompt injection, bad evidence IDs, regeneration without duplicate tasks and manual-edit preservation.
5. **Desktop experience + local summary option:** add recording controls, dual meters, menu bar/tray indicator, meeting detail with transcript/summary/my tasks, edit/export/delete, and model settings. Benchmark a local instruction model via llama.cpp before enabling it on supported device profiles. Failure stays visible and never silently switches to cloud. Network trace must show no audio egress; fully local mode must record/transcribe/summarize/extract without network after model installation.
6. **Packaged release validation:** signed/notarized Mac and packaged Windows on real hardware: permission denial/revocation, Bluetooth reconnect, meeting-specific output device, sleep/wake, background recording, quit/crash, 60–120-minute calls, offline task creation followed by sync, privacy deletion and diagnostics inspection, including worker crash dumps containing audio buffers. Add opt-in meeting detection/calendar enrichment/selected-app capture later.

## Decisions still to validate

The no-server-audio/local-recording requirement is fixed. Recommended initial model baseline is whisper.cpp; sherpa-onnx/Parakeet must earn selection on language/quality/hardware measurements. Text-only cloud summary and text sync are proposed defaults; an entirely local model backend remains in the design. Confirm actual language targets, Windows 10/Intel Mac support, and auto-create versus review-all task preference before freezing execution details.

## Implementation progress

Milestone 2 developer prototype is in `tools/meeting-prototype/`: isolated flexaudio capture CLI, pinned local Whisper setup/transcription, and focused tests. See `tools/meeting-prototype/VERIFICATION.md` for evidence and outstanding device checks. This is not yet a shipping desktop UI or a qualified cross-platform recorder; it leaves generic task implementation unchanged.

## Primary references

- https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps
- https://learn.microsoft.com/windows/win32/coreaudio/loopback-recording
- https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/
- https://github.com/ggml-org/whisper.cpp
- https://github.com/k2-fsa/sherpa-onnx
- https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- https://github.com/ggml-org/llama.cpp
- https://github.com/FluidInference/FluidAudio
- Library links above and https://github.com/screenpipe/screenpipe/blob/main/LICENSE.md

Evidence boundary: local source inspection and live upstream documentation/repository review only. No library/model was installed or built, and no cross-platform capture, offline/privacy, transcription-quality, or performance test was performed.

2026-10-28 follow-up: prototype committed/pushed to main as `372ec704df0ee18edbe022d0ba94fb30bef6ed98`, remote hash verified. The next backend slice is implemented in `crates/meeting-store`, `src-tauri/src/meetings.rs` and the managed recorder CLI: account-scoped SQLite transcript/notes storage, optimistic edits, capture leases/OS locks, retryable interrupted-WAV repair and authenticated desktop commands. See `crates/meeting-store/README.md` for tests/live evidence and remaining UI/privacy-hardening work. This does not mark the full meeting UI, encrypted recorder or summarization/task milestone complete.
