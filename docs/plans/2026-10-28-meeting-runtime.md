# Desktop local recording runtime

Continue the saved meeting plan with a shared recorder crate, supervised subprocess entry point in the desktop binary, authenticated start/status/stop commands, and visible global controls. The capture subprocess exits if its parent disappears; native stop is bounded. One shared microphone lease excludes Talk to Vox. Stop on logout/account change and request stop on application exit. Preserve the previous local lease/checkpoint/recovery contract.

Ruling: first UI slice uses default input/output, explicit start/stop, two-hour limit, and local post-stop transcription with an explicitly selected whisper.cpp executable/model. No automatic download, pause, live ASR, device picker, tray/background mode, echo cancellation, or accurate cross-source synchronization is claimed. Keep the main window visible during capture rather than silently hiding it. Those broader product requirements remain follow-up work.

Steps:
1. Extract the existing tested recorder without retaining duplicate implementations. Prove microphone ownership release/exclusion.
2. Add native worker entry point and account-scoped runtime. Expose local model selection/readiness and retryable two-track transcription.
3. Add global status/start-stop and Meetings transcription controls, keeping all audio and transcript processing native/local.
4. Run focused Rust/controller/browser/build checks and fresh review. Publish the tested slice under the user's standing commit/push authorization.

Ledger: baseline 0153f11; working tree clean before task. Existing strict desktop Clippy/whole-workspace rustfmt failures are outside this slice.

Ledger: shared recorder extracted without duplicate source; microphone lease regression observed red then green. File-lock exclusion, stale-status, background detail refresh, and repeated-quit regressions observed failing and then passing. Browser recording completion initially reset the selected tab; draft-safe background refresh fixed it. Fresh review found recovery-state/detail-refresh/quit issues; all addressed. Native compile and linked binary passed; local public-sample Whisper smoke passed. Windows cross-check is blocked by missing MinGW C compiler; no Windows runtime claim. See crates/meeting-recorder/README.md for the evidence boundary and outstanding product work.
