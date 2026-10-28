use super::*;
fn wav(path: &std::path::Path, frames: u32) {
    let mut data = vec![];
    data.extend(b"RIFF");
    data.extend((36 + frames * 2).to_le_bytes());
    data.extend(b"WAVEfmt ");
    data.extend(16u32.to_le_bytes());
    data.extend(1u16.to_le_bytes());
    data.extend(1u16.to_le_bytes());
    data.extend(16000u32.to_le_bytes());
    data.extend(32000u32.to_le_bytes());
    data.extend(2u16.to_le_bytes());
    data.extend(16u16.to_le_bytes());
    data.extend(b"data");
    data.extend((frames * 2).to_le_bytes());
    data.resize(44 + frames as usize * 2, 0);
    std::fs::write(path, data).unwrap();
}
fn captured(store: &mut Store) -> (Uuid, i64) {
    let id = Uuid::new_v4();
    let token = Uuid::new_v4();
    store.create(id, "Temporary recording", 100).unwrap();
    store.begin_recording(id, token, 101).unwrap();
    std::fs::create_dir(store.recording_path(id)).unwrap();
    wav(&store.recording_path(id).join("mic.wav"), 160);
    wav(&store.recording_path(id).join("system.wav"), 160);
    store.checkpoint(id, token, 160, 160, 102).unwrap();
    let m = store
        .finish_recording(id, token, MeetingState::Captured, 103)
        .unwrap();
    (id, m.revision)
}
fn save(store: &mut Store, id: Uuid, rev: i64, source: Source) -> i64 {
    store
        .save_transcript(
            id,
            rev,
            source,
            &[Segment {
                start_ms: 0,
                end_ms: 10,
                text: "Public test speech".into(),
            }],
            200,
        )
        .unwrap()
        .revision
}
#[test]
fn audio_is_deleted_only_after_both_transcripts_are_saved() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    let guard = store.lock_recording_files(id).unwrap();
    let rev = save(&mut store, id, rev, Source::Mic);
    assert!(store.queue_audio_cleanup(id, rev, &guard, 201).is_err());
    assert!(store.recording_path(id).exists());
    let rev = save(&mut store, id, rev, Source::System);
    store.queue_audio_cleanup(id, rev, &guard, 202).unwrap();
    drop(guard);
    store.cleanup_audio(id, 203).unwrap();
    let m = store.get(id).unwrap();
    assert!(!m.audio_available);
    assert!(!m.audio_cleanup_pending);
    assert_eq!(m.tracks.len(), 2);
    assert_eq!(m.mic_frames, 160);
    assert!(!store.recording_path(id).exists());
}
#[test]
fn restart_retries_durable_cleanup_intent_and_preserves_notes() {
    let temp = tempfile::tempdir().unwrap();
    let owner = Uuid::new_v4();
    let mut store = Store::open(temp.path(), owner).unwrap();
    let (id, rev) = captured(&mut store);
    let rev = save(&mut store, id, rev, Source::Mic);
    let rev = save(&mut store, id, rev, Source::System);
    let m = store.save_notes(id, rev, "Keep these notes", 201).unwrap();
    let guard = store.lock_recording_files(id).unwrap();
    store
        .queue_audio_cleanup(id, m.revision, &guard, 202)
        .unwrap();
    drop(guard);
    drop(store);
    let mut reopened = Store::open(temp.path(), owner).unwrap();
    assert!(reopened.get(id).unwrap().audio_cleanup_pending);
    reopened.cleanup_pending_audio(203).unwrap();
    assert_eq!(reopened.get(id).unwrap().notes, "Keep these notes");
    assert!(!reopened.recording_path(id).exists());
    reopened.cleanup_pending_audio(204).unwrap();
}
#[test]
fn stale_revision_and_uncheckpointed_audio_never_trigger_deletion() {
    use std::io::Write;
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    let rev = save(&mut store, id, rev, Source::Mic);
    let rev = save(&mut store, id, rev, Source::System);
    let guard = store.lock_recording_files(id).unwrap();
    store.save_notes(id, rev, "Newer note", 201).unwrap();
    assert!(store.queue_audio_cleanup(id, rev, &guard, 202).is_err());
    let rev = store.get(id).unwrap().revision;
    std::fs::OpenOptions::new()
        .append(true)
        .open(store.recording_path(id).join("mic.wav"))
        .unwrap()
        .write_all(&[1, 2])
        .unwrap();
    assert!(store.queue_audio_cleanup(id, rev, &guard, 203).is_err());
    assert!(!store.get(id).unwrap().audio_cleanup_pending);
    assert!(store.recording_path(id).exists());
}

#[test]
fn transcript_import_alone_never_authorizes_audio_removal() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    let rev = save(&mut store, id, rev, Source::Mic);
    save(&mut store, id, rev, Source::System);
    store.cleanup_audio(id, 300).unwrap();
    assert!(store.recording_path(id).exists());
    assert!(store.get(id).unwrap().audio_available);
}
#[test]
fn strict_processing_does_not_absorb_new_edits_on_an_idempotent_save() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    let rev = save(&mut store, id, rev, Source::Mic);
    store.save_notes(id, rev, "Concurrent edit", 201).unwrap();
    let segment = Segment {
        start_ms: 0,
        end_ms: 10,
        text: "Public test speech".into(),
    };
    assert!(store
        .save_processed_transcript(id, rev, Source::Mic, &[segment], 202)
        .is_err());
    assert!(store.recording_path(id).exists());
}
#[test]
fn schema_one_migrates_without_marking_old_transcripts_for_cleanup() {
    let temp = tempfile::tempdir().unwrap();
    let owner = Uuid::new_v4();
    let mut store = Store::open(temp.path(), owner).unwrap();
    let (id, rev) = captured(&mut store);
    save(&mut store, id, rev, Source::Mic);
    drop(store);
    let conn =
        Connection::open(temp.path().join(owner.to_string()).join("meetings.sqlite3")).unwrap();
    conn.execute_batch("ALTER TABLE meetings DROP COLUMN audio_cleanup_pending; ALTER TABLE meetings DROP COLUMN audio_deleted; PRAGMA user_version=1;").unwrap();
    drop(conn);
    let mut store = Store::open(temp.path(), owner).unwrap();
    let m = store.get(id).unwrap();
    assert!(m.audio_available);
    assert!(!m.audio_cleanup_pending);
    assert_eq!(m.tracks.len(), 1);
    store.cleanup_pending_audio(301).unwrap();
    assert!(store.recording_path(id).exists());
}
#[test]
fn cleanup_does_not_turn_completed_interrupted_recordings_into_recovery_errors() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    store
        .conn
        .execute(
            "UPDATE meetings SET state='interrupted' WHERE id=?1",
            [id.to_string()],
        )
        .unwrap();
    let rev = save(&mut store, id, rev, Source::Mic);
    let rev = save(&mut store, id, rev, Source::System);
    let guard = store.lock_recording_files(id).unwrap();
    store.queue_audio_cleanup(id, rev, &guard, 201).unwrap();
    drop(guard);
    store.cleanup_audio(id, 202).unwrap();
    assert_eq!(store.get(id).unwrap().state, MeetingState::Interrupted);
    assert!(store.recover_interrupted(203).unwrap().is_empty());
}
#[cfg(unix)]
#[test]
fn failed_cleanup_retains_intent_and_never_follows_a_directory_symlink() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    let rev = save(&mut store, id, rev, Source::Mic);
    let rev = save(&mut store, id, rev, Source::System);
    let guard = store.lock_recording_files(id).unwrap();
    store.queue_audio_cleanup(id, rev, &guard, 201).unwrap();
    drop(guard);
    let path = store.recording_path(id);
    let backup = path.with_extension("saved");
    std::fs::rename(&path, &backup).unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(outside.path().join("keep"), b"keep").unwrap();
    std::os::unix::fs::symlink(outside.path(), &path).unwrap();
    assert!(store.cleanup_audio(id, 202).is_err());
    assert!(store.get(id).unwrap().audio_cleanup_pending);
    assert!(outside.path().join("keep").exists());
    std::fs::remove_file(&path).unwrap();
    std::fs::rename(backup, &path).unwrap();
    store.cleanup_audio(id, 203).unwrap();
    assert!(!store.get(id).unwrap().audio_cleanup_pending);
}

#[test]
fn processing_save_does_not_adopt_a_revision_changed_after_its_write() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let (id, rev) = captured(&mut store);
    // Deterministically model another write occurring after the ASR row update,
    // before the caller can read the post-save meeting again.
    store.conn.execute_batch("CREATE TRIGGER concurrent_edit AFTER INSERT ON transcripts BEGIN UPDATE meetings SET revision=revision+1,notes='Concurrent note' WHERE id=NEW.meeting_id; END;").unwrap();
    let committed = store
        .save_processed_transcript(id, rev, Source::Mic, &[], 201)
        .unwrap();
    assert_eq!(committed, rev + 1);
    let guard = store.lock_recording_files(id).unwrap();
    assert!(store
        .queue_audio_cleanup(id, committed, &guard, 202)
        .is_err());
    assert!(store.recording_path(id).exists());
    assert_eq!(store.get(id).unwrap().notes, "Concurrent note");
}
