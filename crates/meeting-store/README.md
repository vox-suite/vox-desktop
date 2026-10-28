# Local meeting storage

Shared Rust storage used by Vox's Tauri backend and the developer meeting recorder. This slice adds persistent meeting text and process-crash recovery. It does not add the meeting UI, summaries, personal-task extraction, encryption, or cloud synchronization.

## Storage contract

- One private account directory per UUID under the supplied library root; the desktop chooses `<app_data_dir>/meeting-library` and derives the UUID from AuthManager. Renderer calls cannot supply an account or filesystem path.
- SQLite WAL with FULL synchronization, schema-version guard, foreign keys and a five-second busy timeout. Unix account directories are 0700 and database files start at 0600. Windows inherits the containing folder ACL.
- Meetings retain title, capture state, timestamps, optimistic revision, manual notes and per-source checkpointed sample counts. Microphone/system transcripts remain distinct, source-relative tracks; accurate cross-source clock alignment is explicitly false.
- Segment IDs include meeting/source/transcript revision. Repeating the same canonical transcript is a no-op even when manual notes were edited afterward. Different stale edits fail instead of overwriting newer data.
- List calls are paginated (1–100) and omit transcript/note payloads. Detail reads use a consistent SQLite read transaction.
- Deletion removes transcript rows and that meeting's managed recording directory, and keeps a content-free tombstone so a delayed retry cannot recreate the deleted ID. This is logical deletion/file removal, not a forensic secure-erase guarantee for plaintext SQLite pages/backups.

## Managed capture and recovery

The recorder creates the meeting before starting the worker and stores audio under `<account>/recordings/<meeting UUID>/`. It holds an OS file lock, refreshes a 30-second lease and saves monotonically increasing checkpoint counts approximately once per second. A lost lease terminates the supervised worker; metadata/spawn/finalization errors attempt to persist interrupted/failed state before returning the primary error.

Recovery requires an expired lease and a free OS lock; a live recorder is never reclaimed just because a wall-clock lease expired. Recovery marks interrupted sessions, repairs complete PCM16 samples from the recorder's canonical WAV files, saves recovered counts, and never resumes capture. Already-interrupted sessions remain retryable when files were missing, the app crashed mid-recovery, or a previous repair failed. At most 100 interrupted sessions are processed per invocation, oldest update first.

WAV repair accepts only the recorder's RIFF / PCM16 / mono / 16kHz / 44-byte-header format, rejects symlinks and files over two hours, fixes RIFF/data lengths and truncates an incomplete final sample. This preserves process-crash-recoverable bytes already written; it does not recover audio still in a process buffer or establish power-loss durability of every audio sample. Encryption, retention policy and fully synchronized encrypted chunk writing remain production-hardening work.

The store requires Rust 1.89+ for standard-library OS file locks. The implementation is portable Rust/SQLite, but new storage/recovery code still needs Windows hardware and packaged-build verification; earlier Windows checks in the prototype report predate this dependency.

## Desktop commands

`meeting_create`, `meeting_list`, `meeting_get`, `meeting_save_transcript`, `meeting_save_notes`, `meeting_delete`, `meeting_recover_interrupted`.

They run filesystem/SQLite work off the UI thread, use the authenticated account and reject a result if the account changed while work was running. No command contacts Vox Core or sends audio/text to a model service. The shipping desktop recorder/UI is not connected yet; the CLI below exercises the shared backend.

## Developer workflow

From `tools/meeting-prototype`, choose a dedicated library root and a test UUID:

```sh
cargo run --locked -- record-meeting --library .runtime/library --account 00000000-0000-4000-8000-000000000001 --title "Test meeting" --seconds 15
cargo run --locked -- meetings --library .runtime/library --account 00000000-0000-4000-8000-000000000001 list
```

`record-meeting` returns the persistent meeting UUID/revision. Use the existing local `transcribe` command on each managed WAV, then:

```sh
cargo run --locked -- meetings --library .runtime/library --account 00000000-0000-4000-8000-000000000001 import MEETING_UUID --expected-revision 2 --transcript PATH_TO_TRANSCRIPT_JSON
cargo run --locked -- meetings --library .runtime/library --account 00000000-0000-4000-8000-000000000001 get MEETING_UUID
cargo run --locked -- meetings --library .runtime/library --account 00000000-0000-4000-8000-000000000001 recover
```

Use the returned current revision for the next import or note edit; do not assume revision 2 after an interrupted or edited session. `notes` accepts `--expected-revision` and `--text`; `delete` also requires the expected revision. `create --title` makes a text-only meeting for explicit transcript import. A CLI account UUID is an explicit developer selection, not a replacement for desktop authentication.

## Verification — 2026-10-28

- Six store tests pass: restart persistence/idempotent transcript writes/manual-note preservation, account isolation/stale-edit rejection, lease/OS-lock protection, deletion tombstones and atomic validation, WAV repair, and missing-file recovery retry with repaired counts persisted.
- Two managed-recorder failure tests pass: worker spawn failure and malformed final metadata both leave interrupted state rather than a dead recording. The original twelve recorder/transcription tests still pass.
- Mac native desktop `cargo check`, store/prototype clippy with warnings denied, formatting and diff checks pass.
- Live Mac, network denied: 16-second managed recording through speakers, local transcription of both managed WAVs, transcript import, SQLite reopen/read, manual-note edit, idempotent re-import, stale-edit rejection and another-account isolation passed.
- Real managed-parent SIGKILL: after lease expiry, recovery repaired 31,680 microphone frames and 31,360 system frames, persisted interrupted state/counts and did not restart the microphone. Evidence stays in ignored `tools/meeting-prototype/.runtime/library-*` fixtures.
- A fresh correctness review found and verified fixes for retryable recovery and early finalization errors. No remaining material blocker was reported for this backend slice.

Main commands: `cargo test -p vox-meeting-store --locked`, `cargo clippy -p vox-meeting-store --all-targets --locked -- -D warnings`, `cargo check -p vox-desktop --locked`, and prototype tests via its own manifest.
