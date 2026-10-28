# Local meeting capture prototype

Developer evaluation for milestone 2. This is an isolated Rust CLI, not the shipping meeting UI or a production recorder. It keeps experimental CPAL/flexaudio dependencies out of the desktop app. It neither contacts Vox Core nor uses cloud speech services. Only `record` opens capture streams; setup, help and transcription never start a microphone recording.

## What is implemented

- Pinned `flexaudio 0.8.1`, with independent microphone and system-output streams on macOS/Windows.
- Optional microphone/output device selection, bounded buffers, source meters, explicit duration and Ctrl+C stop.
- Local PCM16/16kHz mono WAVs, checkpoints once a second, event log and final quality/error result; existing session directories are never reused.
- The CLI supervises capture in a worker process. Cancellation/deadlines request graceful stop, then terminate/reap a stuck worker after a three-second grace period. Parent disconnection also terminates the worker.
- On macOS a CPAL output stream writes digital silence to the selected output so loopback capture remains clocked when other apps are quiet; it does not replay recorded audio or change volume.
- Dropped sample-clock intervals are padded and counted, not compressed away. Stream stalls/device loss stop capture and produce a failed result; no silent mic-only continuation.
- Local `whisper.cpp` subprocess with source-labelled segment JSON, cancellation/timeout and no cloud fallback.
- Setup builds pinned Whisper v1.9.5 and verifies the multilingual base model's SHA-256. Downloads happen only during explicit setup; Whisper is built with CURL disabled.

## Developer setup

Prerequisites: Rust, Git, CMake, and native C/C++ compiler (Xcode command-line tools on Mac; Visual Studio C++ build tools on Windows). Python is used for this developer bootstrap only, not proposed as an end-user dependency.

From `vox-desktop/tools/meeting-prototype`:

```sh
python3 setup.py
cargo test --locked
cargo run --locked -- --help
```

On Windows use `py setup.py` if Python is installed through the launcher. The default is Metal on macOS and CPU on Windows. Explicit `--backend vulkan` / `--backend cuda` builds require the matching developer SDK/driver. Start with CPU when qualifying ordinary Windows laptops. Setup downloads ~148 MB of model weights plus pinned source/build dependencies into ignored `.runtime/`; `ready.json` records exact executable/model paths. It never reads recordings.

macOS system capture needs 14.4+ for this library. The recorder embeds microphone/system-audio usage descriptions. During CLI development permissions can be attributed to the terminal/IDE; grant Microphone and System Audio Recording only when intentionally testing capture. This does not prove permission behavior of the signed Vox app, which must be tested separately. Windows uses ordinary shared-mode loopback; recording a chosen output captures all apps playing through it, not only a meeting app. Select the actual communications output used by the call.

## Record and transcribe

Use a test call or synthetic audio, then intentionally start recording:

```sh
cargo run --locked -- devices
mkdir -p sessions
cargo run --locked -- record --seconds 30 --output sessions/test-01
```

On PowerShell use `New-Item -ItemType Directory -Force sessions` for the parent directory. Optional `--mic-device` / `--system-device` use the IDs printed by `devices`. The recording stops at the duration or Ctrl+C. A source failing during startup stops the other source too. Inspect `result.json`, `supervisor.json` and `events.jsonl`; `captured` means buffers were written, not that both sources contain audible speech. A zero peak can be genuine silence or a permission/routing problem. `partial` marks observed loss/clipping/advisories; normal final-chunk padding is logged without marking a recording partial. `supervisor.json` distinguishes deadline/user cancellation from forced termination. Failed recordings return a nonzero exit code and preserve available local files.

Paths below are Mac/CPU examples; use paths in `.runtime/ready.json`, with `build-metal/bin/whisper-cli` on a default Mac setup or `build-cpu/bin/Release/whisper-cli.exe` for Windows Visual Studio builds:

```sh
cargo run --locked -- transcribe --audio sessions/test-01/mic.wav --source mic --whisper .runtime/build-metal/bin/whisper-cli --model .runtime/ggml-base.bin --output sessions/test-01/mic-text
cargo run --locked -- transcribe --audio sessions/test-01/system.wav --source system --whisper .runtime/build-metal/bin/whisper-cli --model .runtime/ggml-base.bin --output sessions/test-01/system-text
```

To test inference without listening to the room, substitute `.runtime/whisper.cpp/samples/jfk.wav` and use a fresh output directory. Output is raw `whisper.json` plus normalized `transcript.json`. Segment times remain source-relative; no speaker identities are inferred. Transcription accepts existing 16kHz mono PCM16 WAVs only. Retrying uses a fresh output directory so previous results are preserved.

## Explicit prototype limits

- Audio/transcripts are ordinary local developer files, retained until manually deleted. Unix session directories/files use 0700/0600; Windows inherits the parent folder's ACL. Encryption, account isolation, automatic retention cleanup and hardened diagnostics belong to the durable-recorder milestone. Use test content here.
- Two sources currently have independent sample clocks. Start-request offsets and library arrival labels are diagnostic only. Hardware drift, wall-time discontinuities and accurate cross-source alignment are not solved. Do not combine the two transcript timelines as if synchronized.
- Echo cancellation is not connected yet. Speakers can duplicate remote speech on the mic track; test with headphones first, then measure speakerphone behavior before selecting the capture design.
- No pause/resume, diarization, VAD gate, automatic detection, live text, summarization, task creation or Tauri UI. Unvoiced input can produce Whisper hallucinations; final quality needs VAD and evaluation.
- Duration includes startup. Native APIs remain synchronous within the worker, but the supervising CLI requests stop at the deadline or Ctrl+C and kills/reaps an unresponsive worker after three seconds. A forced stop can leave incomplete WAV files and no final result; inspect `supervisor.json`. Hardware/OS teardown timing still needs packaged-app testing. A lost parent connection terminates the worker, preventing an orphan recorder.
- WAV headers are checkpointed, but crash recovery tooling is not implemented. Memory queues are bounded; the two-hour recording limit bounds file growth, but there is no free-disk preflight/quota yet. No background microphone activity occurs after the process ends.
- Local inference is not guaranteed real-time. Measure both tracks plus the actual meeting app on target hardware. Windows and signed-app capture require their own real-device evidence.

## Qualification checklist

Record OS/CPU/RAM, library/model pin, selected devices, permission state, duration, per-source frames/peak/loss, CPU/memory/thermal observations, recognition accuracy and transcription wall time. Test headphones, speakers, USB/Bluetooth switches, idle output, permission denial, Ctrl+C, network disconnected and failed local inference. Inspect runtime network activity to substantiate audio staying local; source/dependency inspection alone is not a network-trace result.

Dependencies: [flexaudio (MIT)](https://github.com/Studio-Sadola/flexaudio), [whisper.cpp (MIT)](https://github.com/ggml-org/whisper.cpp), [Whisper weights (MIT)](https://github.com/openai/whisper/blob/main/LICENSE). Preserve upstream license notices when packaging; audit the pinned transitive tree before shipping.
