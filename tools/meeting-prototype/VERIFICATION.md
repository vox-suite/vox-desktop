# Prototype verification — 2026-10-28

Scope: developer milestone 2. This follow-up includes actual local microphone/system capture on this Mac, using public speech playback as the controlled stimulus. Test recordings/transcripts remain in ignored local session directories; raw microphone text is not included here.

## Current result

The basic Mac recording → local transcription path passes, including idle output and network-denied operation. This is not a qualified Windows or production meeting recorder. Echo cancellation, cross-source clock alignment and long-session behavior remain open.

## Checks passed

- Host: macOS 27.2 / arm64, Rust 1.98.0. `flexaudio 0.8.1`; macOS silent-output keepalive uses CPAL 0.16.0. Main desktop dependencies/lockfile unchanged.
- `cargo test --locked --all-targets`: **12 passed, 0 failed**. Includes synthetic dual-source normalization, timestamp/gap/overwrite handling, worker failure/timeout, startup cancellation, final-padding classification, and forced process termination/reaping.
- Native `cargo build --locked`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo fmt --check`: passed.
- Cross-target checks/lint: **x86_64-pc-windows-msvc and x86_64-pc-windows-gnu passed**. These compile/type/lint checks ran on macOS; they are not linked Windows executables or runtime/device tests.
- Local Whisper commit `d1be6fde11ac6e0407606b4e42fe72d34add8037` (v1.9.5), Metal backend, CURL disabled; multilingual base weights verified by SHA-256. Pins/paths are in ignored `.runtime/ready.json`.
- Device enumeration found the MacBook microphone and speakers. Actual capture wrote independently readable 16kHz mono PCM16 WAVs from both devices.

## Live Mac evidence

| Test | Outcome | Local evidence |
| --- | --- | --- |
| Public speech through speakers, 20-second capture | Both tracks contain the public sample; no dropped sample frames | `sessions/verify-live-mac-02/` |
| Network denied during capture and both transcriptions | Passed; public sample recognized in both sources | `sessions/verify-live-mac-03-offline/` |
| Quiet system output, six seconds, network denied | Passed after keepalive fix; both sources continue producing buffers | `sessions/verify-idle-keepalive-mac/` |
| Four seconds idle → public speech → idle, 20 seconds, network denied | **Captured**, zero missing frames and zero quality issues on both tracks | `sessions/verify-idle-speech-idle-offline/` |
| Ctrl+C during active output | Clean stop, worker exited; about 0.59 seconds after signal | `sessions/verify-cancel-mac-03/` |
| Ctrl+C while output is idle, after keepalive fix | Clean stop, worker exited; about 0.63 seconds after signal | `sessions/verify-cancel-idle-final/` |
| Parent process killed during recording | Worker detected EOF and exited in about 0.07 seconds; no orphan capture process | `sessions/verify-parent-exit-final/` |
| Invalid microphone ID | Nonzero exit and explicit device-not-found failure; no fallback device selected | `sessions/verify-invalid-device/` |

Network denial used macOS `sandbox-exec` with `(version 1)(allow default)(deny network*)` around the recorder and, separately, each local transcription command. Public playback used local `afplay`. This enforces network denial for those processes; it is not a packet-capture audit of the whole machine or a shipping Vox build.

The final idle/speech/idle run produced 19.78 seconds of microphone samples and 19.84 seconds of system samples. Independent startup/sample clocks are not synchronized: these numbers do not establish drift-free alignment. Whisper recognized the expected public passage from both files; inference took 320 ms (mic) / 310 ms (system) in these short warmed runs. These are not meeting-length, multilingual, or low-end-machine benchmarks.

## Failures found and corrected

1. **Native startup can exceed duration/cancellation.** The first live attempt spent roughly 50 seconds in startup despite a 15-second requested duration. A stack sample showed the macOS backend waiting on Core Audio `AudioDeviceCreateIOProcIDWithBlock`; microphone buffering continued. The CLI now supervises a separate capture process, requests graceful stop at cancellation/deadline, and kills/reaps it after three seconds if needed. Synthetic stuck-worker tests verify the bound; real Ctrl+C and parent-death checks verify process cleanup. Forced shutdown can leave incomplete local files.
2. **Quiet output caused StreamStalled and aborted recording.** Reproduced on the live Mac with no playback. A macOS output keepalive now writes zeros to the selected output, retaining loopback callbacks through silence without replaying captured speech or changing volume. Quiet-only and idle/speech/idle tests now pass. Device/permission errors still fail visibly.
3. **Ordinary final padding incorrectly marked recordings partial.** The library pads its final chunk. Padding is still logged, but PADDED-only chunks during final drain no longer count as quality loss. Mid-recording padding still does; a regression test covers both.
4. **Windows-only lint warnings.** Removed conditional mutability and non-Drop cleanup warnings. Both Windows target checks now pass with warnings denied.

The supervisor records `reason` separately; `result.json` uses `stop_requested` rather than falsely labelling a deadline-triggered stop as a user action.

## Remaining limits

- No Windows host/VM was available: actual Windows capture, linking/packaging, driver behavior and GPU inference remain unverified.
- Speaker playback was recognized on both sources, demonstrating expected echo duplication without AEC. Headphones and an aligned AEC reference need their own acceptance tests.
- No 60–120-minute soak, precise hardware clock alignment, Bluetooth/device-switch tests, permission-revocation test, Hindi/code-switching quality study, battery/thermal benchmark, or signed Vox-app permission test.
- Prototype audio is local plaintext with private Unix directory/file permissions; encryption, retention, account isolation, recovery UI, VAD/diarization, summaries, tasks and desktop UI are later milestones.

No recording process remained after the completed live tests. Do not present this evidence as completion of the full meeting feature.
