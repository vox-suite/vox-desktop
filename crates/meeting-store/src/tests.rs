use super::*;
use uuid::Uuid;

fn segment() -> Segment {
    Segment {
        start_ms: 0,
        end_ms: 1000,
        text: "Send the proposal".into(),
    }
}

#[test]
fn transcript_survives_restart_is_idempotent_and_preserves_manual_notes() {
    let temp = tempfile::tempdir().unwrap();
    let owner = Uuid::new_v4();
    let id = Uuid::new_v4();
    let mut store = Store::open(temp.path(), owner).unwrap();
    store.create(id, "Weekly meeting", 100).unwrap();
    let first = store
        .save_transcript(id, 0, Source::Mic, &[segment()], 200)
        .unwrap();
    assert_eq!(first.revision, 1);
    store.save_notes(id, 1, "My notes", 300).unwrap();
    // A retry of the same canonical transcript does not overwrite notes or add revisions.
    assert_eq!(
        store
            .save_transcript(id, 0, Source::Mic, &[segment()], 400)
            .unwrap()
            .revision,
        2
    );
    drop(store);
    let store = Store::open(temp.path(), owner).unwrap();
    let meeting = store.get(id).unwrap();
    assert_eq!(meeting.notes, "My notes");
    assert_eq!(meeting.tracks[0].segments[0].text, "Send the proposal");
    assert!(!meeting.tracks[0].segments[0].id.is_empty());
    assert_eq!(store.list(0, 20).unwrap().len(), 1);
}

#[test]
fn account_isolation_and_stale_edits_are_enforced() {
    let temp = tempfile::tempdir().unwrap();
    let id = Uuid::new_v4();
    let mut a = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    a.create(id, "Private", 100).unwrap();
    let b = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    assert!(b.get(id).is_err());
    assert!(b.list(0, 20).unwrap().is_empty());
    a.save_notes(id, 0, "Keep", 200).unwrap();
    assert!(a.save_notes(id, 0, "Stale", 300).is_err());
    assert!(a
        .save_transcript(id, 0, Source::Mic, &[segment()], 300)
        .is_err());
    assert_eq!(a.get(id).unwrap().notes, "Keep");
}

#[test]
fn expired_recordings_are_recovered_without_interrupting_live_leases() {
    let temp = tempfile::tempdir().unwrap();
    let owner = Uuid::new_v4();
    let id = Uuid::new_v4();
    let token = Uuid::new_v4();
    let mut a = Store::open(temp.path(), owner).unwrap();
    a.create(id, "Recording", 100).unwrap();
    a.begin_recording(id, token, 100).unwrap();
    let mut b = Store::open(temp.path(), owner).unwrap();
    assert!(b.recover_expired(200).unwrap().is_empty());
    assert!(b.checkpoint(id, Uuid::new_v4(), 16000, 16000, 300).is_err());
    a.checkpoint(id, token, 16000, 16000, 400).unwrap();
    assert!(
        b.recover_expired(40_000).unwrap().is_empty(),
        "OS lock protects a live recorder even past its lease"
    );
    drop(a);
    assert_eq!(b.recover_expired(40_000).unwrap(), vec![id]);
    assert_eq!(b.get(id).unwrap().state, MeetingState::Interrupted);
    assert!(b.checkpoint(id, token, 32000, 32000, 40_001).is_err());
    assert_eq!(b.get(id).unwrap().mic_frames, 16000);
}

#[test]
fn invalid_transcripts_are_atomic_and_deleted_meetings_do_not_reappear() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
    let id = Uuid::new_v4();
    store.create(id, "Meeting", 1).unwrap();
    let bad = Segment {
        start_ms: 50,
        end_ms: 10,
        text: "bad".into(),
    };
    assert!(store
        .save_transcript(id, 0, Source::System, &[bad], 2)
        .is_err());
    assert_eq!(store.get(id).unwrap().revision, 0);
    store.delete(id, 0, 3).unwrap();
    assert!(store.get(id).is_err());
    assert!(store.create(id, "Meeting", 4).is_err());
    assert!(store
        .save_transcript(id, 0, Source::Mic, &[segment()], 5)
        .is_err());
}

#[test]
fn repairs_trailing_complete_samples_after_a_crash() {
    use std::io::Write;
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("mic.wav");
    let mut header = vec![];
    header.extend(b"RIFF");
    header.extend(36u32.to_le_bytes());
    header.extend(b"WAVEfmt ");
    header.extend(16u32.to_le_bytes());
    header.extend(1u16.to_le_bytes());
    header.extend(1u16.to_le_bytes());
    header.extend(16000u32.to_le_bytes());
    header.extend(32000u32.to_le_bytes());
    header.extend(2u16.to_le_bytes());
    header.extend(16u16.to_le_bytes());
    header.extend(b"data");
    header.extend(0u32.to_le_bytes());
    let mut file = std::fs::File::create(&path).unwrap();
    file.write_all(&header).unwrap();
    file.write_all(&[1, 0, 2, 0, 9]).unwrap();
    drop(file);
    assert_eq!(repair_checkpointed_wav(&path).unwrap(), 2);
    let data = std::fs::read(&path).unwrap();
    assert_eq!(data.len(), 48);
    assert_eq!(u32::from_le_bytes(data[40..44].try_into().unwrap()), 4);
    std::fs::write(&path, b"not a wav").unwrap();
    assert!(repair_checkpointed_wav(&path).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), b"not a wav");
}

#[test]
fn recovery_retries_missing_audio_and_persists_repaired_frame_counts() {
    let temp = tempfile::tempdir().unwrap();
    let owner = Uuid::new_v4();
    let id = Uuid::new_v4();
    let mut store = Store::open(temp.path(), owner).unwrap();
    store.create(id, "Interrupted", 100).unwrap();
    store.begin_recording(id, Uuid::new_v4(), 100).unwrap();
    drop(store);
    let mut store = Store::open(temp.path(), owner).unwrap();
    let first = store.recover_interrupted(40_000).unwrap();
    assert_eq!(first.len(), 1);
    assert!(first[0].tracks[0].error.is_some());
    let path = store.recording_path(id);
    std::fs::create_dir(&path).unwrap();
    let mut header = vec![];
    header.extend(b"RIFF");
    header.extend(36u32.to_le_bytes());
    header.extend(b"WAVEfmt ");
    header.extend(16u32.to_le_bytes());
    header.extend(1u16.to_le_bytes());
    header.extend(1u16.to_le_bytes());
    header.extend(16000u32.to_le_bytes());
    header.extend(32000u32.to_le_bytes());
    header.extend(2u16.to_le_bytes());
    header.extend(16u16.to_le_bytes());
    header.extend(b"data");
    header.extend(0u32.to_le_bytes());
    header.extend([1, 0, 2, 0]);
    std::fs::write(path.join("mic.wav"), &header).unwrap();
    std::fs::write(path.join("system.wav"), &header).unwrap();
    drop(store);
    let mut store = Store::open(temp.path(), owner).unwrap();
    let second = store.recover_interrupted(40_100).unwrap();
    assert_eq!(second[0].tracks[0].recovered_frames, Some(2));
    assert_eq!(store.get(id).unwrap().mic_frames, 2);
    assert_eq!(store.get(id).unwrap().system_frames, 2);
}
