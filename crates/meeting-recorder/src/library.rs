use crate::{capture, supervisor};
use anyhow::{ensure, Result};
use std::{path::Path, process::Command, sync::atomic::AtomicBool, time::Duration};
use uuid::Uuid;
use vox_meeting_store::{now_ms, Meeting, MeetingState, Source, Store};

pub fn record(
    root: &Path,
    owner: Uuid,
    title: &str,
    seconds: u64,
    stopped: &AtomicBool,
) -> Result<Meeting> {
    let mut store = Store::open(root, owner)?;
    let id = Uuid::new_v4();
    store.create(id, title, now_ms()?)?;
    record_existing(root, owner, id, seconds, stopped)
}

pub fn record_existing(
    root: &Path,
    owner: Uuid,
    id: Uuid,
    seconds: u64,
    stopped: &AtomicBool,
) -> Result<Meeting> {
    let mut store = Store::open(root, owner)?;
    let token = Uuid::new_v4();
    let mut command = Command::new(std::env::current_exe()?);
    store.begin_recording(id, token, now_ms()?)?;
    let output = store.recording_path(id);
    command
        .arg("record")
        .arg("--output")
        .arg(&output)
        .arg("--seconds")
        .arg(seconds.to_string())
        .arg("--capture-worker");
    let mut mic = 0;
    let mut system = 0;
    let result = supervisor::supervise_with_checkpoint(
        command,
        stopped,
        Duration::from_secs(seconds),
        Duration::from_secs(3),
        || {
            mic = mic.max(frames(&output.join("mic.wav")));
            system = system.max(frames(&output.join("system.wav")));
            store.checkpoint(id, token, mic, system, now_ms()?)
        },
    );
    finalize(&mut store, id, token, &output, result)
}

fn finalize(
    store: &mut Store,
    id: Uuid,
    token: Uuid,
    output: &Path,
    result: Result<supervisor::WorkerOutcome>,
) -> Result<Meeting> {
    let (mut state, mut primary) = match &result {
        Ok(outcome) if outcome.forced => (MeetingState::Interrupted, None),
        Ok(outcome) if outcome.success => (MeetingState::Captured, None),
        Ok(_) => (MeetingState::Interrupted, None),
        Err(error) => (
            MeetingState::Interrupted,
            Some(anyhow::anyhow!(error.to_string())),
        ),
    };
    let metadata = (|| -> Result<()> {
        if let Ok(outcome) = &result {
            if outcome.success {
                let saved: serde_json::Value =
                    serde_json::from_slice(&std::fs::read(output.join("result.json"))?)?;
                state = match saved["state"].as_str() {
                    Some("partial") => MeetingState::Partial,
                    Some("captured") => MeetingState::Captured,
                    _ => anyhow::bail!("invalid final capture state"),
                };
            }
            capture::write_json(
                &output.join("supervisor.json"),
                &serde_json::to_value(outcome)?,
            )?;
        }
        store.checkpoint(
            id,
            token,
            frames(&output.join("mic.wav")),
            frames(&output.join("system.wav")),
            now_ms()?,
        )?;
        Ok(())
    })();
    if let Err(error) = metadata {
        state = MeetingState::Interrupted;
        primary.get_or_insert(error);
    }
    let meeting = store.finish_recording(id, token, state, now_ms()?);
    if let Some(error) = primary {
        let _ = meeting;
        return Err(error);
    }
    meeting
}

fn frames(path: &Path) -> u64 {
    hound::WavReader::open(path)
        .map(|reader| reader.duration() as u64)
        .unwrap_or(0)
}

pub fn import(store: &mut Store, id: Uuid, expected: i64, path: &Path) -> Result<Meeting> {
    ensure!(
        std::fs::metadata(path)?.len() <= 8_000_000,
        "transcript file too large"
    );
    #[derive(serde::Deserialize)]
    struct Input {
        source: Source,
        segments: Vec<vox_meeting_store::Segment>,
    }
    let input: Input = serde_json::from_slice(&std::fs::read(path)?)?;
    store.save_transcript(id, expected, input.source, &input.segments, now_ms()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn failed_worker_start_finalizes_interrupted_instead_of_recording() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
        let id = Uuid::new_v4();
        let token = Uuid::new_v4();
        store.create(id, "Failed start", now_ms().unwrap()).unwrap();
        store.begin_recording(id, token, now_ms().unwrap()).unwrap();
        let output = store.recording_path(id);
        assert!(finalize(
            &mut store,
            id,
            token,
            &output,
            Err(anyhow::anyhow!("spawn failed"))
        )
        .is_err());
        assert_eq!(store.get(id).unwrap().state, MeetingState::Interrupted);
    }
    #[test]
    fn malformed_final_metadata_does_not_leave_a_dead_recording() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
        let id = Uuid::new_v4();
        let token = Uuid::new_v4();
        store.create(id, "Bad metadata", now_ms().unwrap()).unwrap();
        store.begin_recording(id, token, now_ms().unwrap()).unwrap();
        let output = store.recording_path(id);
        capture::create_private_directory(&output).unwrap();
        std::fs::write(output.join("result.json"), b"broken").unwrap();
        let outcome = supervisor::WorkerOutcome {
            worker_pid: 1,
            success: true,
            forced: false,
            reason: None,
            exit_code: Some(0),
        };
        assert!(finalize(&mut store, id, token, &output, Ok(outcome)).is_err());
        assert_eq!(store.get(id).unwrap().state, MeetingState::Interrupted);
    }
}

#[cfg(test)]
mod recovery_state_tests {
    use super::*;
    #[test]
    fn nonzero_worker_exit_keeps_recording_recoverable() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
        let id = Uuid::new_v4();
        let token = Uuid::new_v4();
        store.create(id, "Device lost", now_ms().unwrap()).unwrap();
        store.begin_recording(id, token, now_ms().unwrap()).unwrap();
        let output = store.recording_path(id);
        capture::create_private_directory(&output).unwrap();
        let outcome = supervisor::WorkerOutcome {
            worker_pid: 1,
            success: false,
            forced: false,
            reason: None,
            exit_code: Some(1),
        };
        let saved = finalize(&mut store, id, token, &output, Ok(outcome)).unwrap();
        assert_eq!(saved.state, MeetingState::Interrupted);
    }
}
