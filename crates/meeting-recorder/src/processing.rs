//! Complete the durable two-source transcript before removing temporary audio.
use anyhow::{ensure, Result};
use std::{
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};
use uuid::Uuid;
use vox_meeting_store::{now_ms, MeetingState, Segment, Source, Store};
pub fn transcribe_meeting(
    root: &Path,
    account: Uuid,
    id: Uuid,
    stopped: &AtomicBool,
    mut infer: impl FnMut(Source, &Path, &Path) -> Result<Vec<Segment>>,
) -> Result<()> {
    let mut store = Store::open(root, account)?;
    let audio_lock = store.lock_recording_files(id)?;
    let meeting = store.get(id)?;
    ensure!(
        matches!(
            meeting.state,
            MeetingState::Captured
                | MeetingState::Partial
                | MeetingState::Interrupted
                | MeetingState::TranscriptReady
        ),
        "Stop and recover the recording first"
    );
    ensure!(
        meeting.audio_available && !meeting.audio_cleanup_pending,
        "Audio has already been removed or cleanup is pending"
    );
    ensure!(
        meeting.mic_frames > 0 || meeting.system_frames > 0,
        "No recoverable audio; check interrupted recordings first"
    );
    let output = store.recording_path(id);
    let mut expected = meeting.revision;
    for (source, frames) in [
        (Source::Mic, meeting.mic_frames),
        (Source::System, meeting.system_frames),
    ] {
        if frames == 0 {
            continue;
        }
        ensure!(
            !stopped.load(Ordering::SeqCst),
            "Local transcription cancelled; audio retained"
        );
        let prefix = output.join(format!("asr-{}", Uuid::new_v4()));
        let segments = infer(
            source,
            &output.join(format!("{}.wav", source.as_str())),
            &prefix,
        )?;
        let _ = std::fs::remove_file(prefix.with_extension("json"));
        ensure!(
            !stopped.load(Ordering::SeqCst),
            "Local transcription cancelled; audio retained"
        );
        expected = store.save_processed_transcript(id, expected, source, &segments, now_ms()?)?;
    }
    ensure!(
        !stopped.load(Ordering::SeqCst),
        "Local transcription cancelled; audio retained"
    );
    store.queue_audio_cleanup(id, expected, &audio_lock, now_ms()?)?;
    drop(audio_lock);
    store.cleanup_audio(id, now_ms()?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use vox_meeting_store::{now_ms, MeetingState, Store};
    fn setup() -> (tempfile::TempDir, uuid::Uuid, uuid::Uuid) {
        let temp = tempfile::tempdir().unwrap();
        let owner = uuid::Uuid::new_v4();
        let id = uuid::Uuid::new_v4();
        let token = uuid::Uuid::new_v4();
        let mut store = Store::open(temp.path(), owner).unwrap();
        store
            .create(id, "Public fixture", now_ms().unwrap())
            .unwrap();
        store.begin_recording(id, token, now_ms().unwrap()).unwrap();
        std::fs::create_dir(store.recording_path(id)).unwrap();
        for name in ["mic", "system"] {
            let mut writer = crate::track::TrackWriter::create(
                &store.recording_path(id).join(format!("{name}.wav")),
            )
            .unwrap();
            writer.append(0, &vec![0.1; 160]).unwrap();
            writer.finish().unwrap();
        }
        store
            .checkpoint(id, token, 160, 160, now_ms().unwrap())
            .unwrap();
        store
            .finish_recording(id, token, MeetingState::Captured, now_ms().unwrap())
            .unwrap();
        (temp, owner, id)
    }
    #[test]
    fn second_source_failure_keeps_both_audio_files_and_first_transcript() {
        let (temp, owner, id) = setup();
        let mut calls = 0;
        assert!(transcribe_meeting(
            temp.path(),
            owner,
            id,
            &std::sync::atomic::AtomicBool::new(false),
            |_, _, _| {
                calls += 1;
                if calls == 2 {
                    anyhow::bail!("Inference failed");
                }
                Ok(vec![])
            }
        )
        .is_err());
        let store = Store::open(temp.path(), owner).unwrap();
        assert!(store.recording_path(id).join("mic.wav").exists());
        assert!(store.recording_path(id).join("system.wav").exists());
        assert_eq!(store.get(id).unwrap().tracks.len(), 1);
        assert!(!store.get(id).unwrap().audio_cleanup_pending);
    }
    #[test]
    fn successful_two_source_processing_deletes_audio_and_keeps_transcripts() {
        let (temp, owner, id) = setup();
        transcribe_meeting(
            temp.path(),
            owner,
            id,
            &std::sync::atomic::AtomicBool::new(false),
            |_, _, _| Ok(vec![]),
        )
        .unwrap();
        let store = Store::open(temp.path(), owner).unwrap();
        assert!(!store.recording_path(id).exists());
        assert_eq!(store.get(id).unwrap().tracks.len(), 2);
    }
}

#[cfg(test)]
mod cancellation_tests {
    use super::*;
    #[test]
    fn cancellation_before_inference_never_discards_a_recording() {
        let temp = tempfile::tempdir().unwrap();
        let owner = Uuid::new_v4();
        let id = Uuid::new_v4();
        let token = Uuid::new_v4();
        let mut store = Store::open(temp.path(), owner).unwrap();
        store.create(id, "Cancelled", now_ms().unwrap()).unwrap();
        store.begin_recording(id, token, now_ms().unwrap()).unwrap();
        std::fs::create_dir(store.recording_path(id)).unwrap();
        let mut writer =
            crate::track::TrackWriter::create(&store.recording_path(id).join("mic.wav")).unwrap();
        writer.append(0, &[0.1; 160]).unwrap();
        writer.finish().unwrap();
        store
            .checkpoint(id, token, 160, 0, now_ms().unwrap())
            .unwrap();
        store
            .finish_recording(id, token, MeetingState::Captured, now_ms().unwrap())
            .unwrap();
        let stop = AtomicBool::new(true);
        assert!(
            transcribe_meeting(temp.path(), owner, id, &stop, |_, _, _| panic!(
                "Cancelled work must not infer"
            ))
            .is_err()
        );
        assert!(store.recording_path(id).join("mic.wav").exists());
        assert!(!store.get(id).unwrap().audio_cleanup_pending);
    }
}
