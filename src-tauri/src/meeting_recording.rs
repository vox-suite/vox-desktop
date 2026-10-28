//! Local capture/ASR lifecycle. This module has no network client.
use crate::auth::AuthManager;
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use vox_meeting_recorder::{library, ownership::AudioOwnership, transcript};
use vox_meeting_store::{now_ms, Meeting, MeetingState, Segment, Source, Store};

#[derive(Clone, Serialize, Default)]
pub struct Status {
    pub id: Option<Uuid>,
    pub phase: String,
    pub started_ms: i64,
    pub error: Option<String>,
    pub mic_frames: u64,
    pub system_frames: u64,
}
struct Job {
    owner: String,
    stop: Arc<AtomicBool>,
    status: Status,
}
#[derive(Default)]
pub struct RecordingState(Mutex<Option<Job>>, AtomicBool, AtomicBool);
impl RecordingState {
    pub fn must_wait_for_shutdown(&self) -> bool {
        self.busy() && !self.2.load(Ordering::SeqCst)
    }
    pub fn allow_exit(&self) {
        self.2.store(true, Ordering::SeqCst);
    }
    pub fn begin_shutdown(&self) -> bool {
        self.busy() && !self.1.swap(true, Ordering::SeqCst)
    }
    pub fn stop(&self) {
        if let Ok(job) = self.0.lock() {
            if let Some(job) = job.as_ref() {
                job.stop.store(true, Ordering::SeqCst);
            }
        }
    }
    pub fn busy(&self) -> bool {
        self.0
            .lock()
            .map(|j| {
                j.as_ref().is_some_and(|j| {
                    matches!(
                        j.status.phase.as_str(),
                        "recording" | "stopping" | "transcribing"
                    )
                })
            })
            .unwrap_or(true)
    }
}
fn owner(auth: &AuthManager) -> Result<String, String> {
    auth.current_session()
        .map(|s| s.user_id)
        .ok_or("Sign in first".into())
}
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("meeting-library"))
}
fn finish(app: &AppHandle, id: Uuid, phase: &str, error: Option<String>) {
    if let Ok(mut job) = app.state::<RecordingState>().0.lock() {
        if let Some(job) = job.as_mut().filter(|j| j.status.id == Some(id)) {
            job.status.phase = phase.into();
            job.status.error = error;
        }
    }
}
#[tauri::command]
pub async fn meeting_recording_status(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, RecordingState>,
) -> Result<Status, String> {
    let owner = owner(&auth)?;
    let mut status = {
        let job = state.0.lock().map_err(|_| "Recording unavailable")?;
        let Some(job) = job.as_ref().filter(|j| j.owner == owner) else {
            return Ok(Status::default());
        };
        job.status.clone()
    };
    // Status reads checkpointed counts; audio never passes through the renderer.
    if let Some(id) = status.id {
        if let Ok(store) = Store::open(
            &root(&app)?,
            Uuid::parse_str(&owner).map_err(|e| e.to_string())?,
        ) {
            if let Ok(meeting) = store.get(id) {
                status.mic_frames = meeting.mic_frames;
                status.system_frames = meeting.system_frames;
            }
        }
    }
    Ok(status)
}
#[tauri::command]
pub async fn meeting_recording_start(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    title: String,
) -> Result<Meeting, String> {
    let owner = owner(&auth)?;
    let account = Uuid::parse_str(&owner).map_err(|e| e.to_string())?;
    let lease = app.state::<AudioOwnership>().acquire()?;
    let root = root(&app)?;
    let recording_state = app.state::<RecordingState>();
    let mut job = recording_state
        .0
        .lock()
        .map_err(|_| "Recording unavailable")?;
    if job.as_ref().is_some_and(|j| {
        matches!(
            j.status.phase.as_str(),
            "recording" | "stopping" | "transcribing"
        )
    }) {
        return Err("Finish the current local audio operation first".into());
    }
    let mut store = Store::open(&root, account).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4();
    let started = now_ms().map_err(|e| e.to_string())?;
    let meeting = store
        .create(id, &title, started)
        .map_err(|e| e.to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    *job = Some(Job {
        owner: owner.clone(),
        stop: stop.clone(),
        status: Status {
            id: Some(id),
            phase: "recording".into(),
            started_ms: started,
            ..Default::default()
        },
    });
    drop(job);
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        // Recheck auth independently of renderer lifecycle and polling.
        let worker_stop = stop.clone();
        let task = tauri::async_runtime::spawn_blocking(move || {
            let _lease = lease;
            library::record_existing(&root, account, id, 7200, &worker_stop)
        });
        tokio::pin!(task);
        let result = loop {
            tokio::select! {
                result = &mut task => break result,
                _ = tokio::time::sleep(Duration::from_millis(200)) => {
                    if handle.state::<AuthManager>().current_session().as_ref().map(|s| &s.user_id) != Some(&owner) { stop.store(true, Ordering::SeqCst); }
                }
            }
        };
        let error = match result {
            Ok(Ok(m)) if matches!(m.state, MeetingState::Captured | MeetingState::Partial) => None,
            Ok(Ok(_)) => Some(
                "Recording ended incompletely. Recover local audio before transcription.".into(),
            ),
            Ok(Err(e)) => Some(e.to_string()),
            Err(e) => Some(e.to_string()),
        };
        finish(
            &handle,
            id,
            if error.is_some() {
                "failed"
            } else {
                "captured"
            },
            error,
        );
    });
    Ok(meeting)
}
#[tauri::command]
pub fn meeting_recording_stop(
    auth: State<'_, AuthManager>,
    state: State<'_, RecordingState>,
) -> Result<(), String> {
    let owner = owner(&auth)?;
    let mut job = state.0.lock().map_err(|_| "Recording unavailable")?;
    if let Some(job) = job.as_mut().filter(|j| j.owner == owner) {
        job.stop.store(true, Ordering::SeqCst);
        if job.status.phase == "recording" {
            job.status.phase = "stopping".into();
        }
    }
    Ok(())
}

#[derive(serde::Deserialize, Serialize)]
struct ModelConfig {
    binary: PathBuf,
    model: PathBuf,
}
fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("meeting-model.json"))
}
fn config(app: &AppHandle) -> Result<ModelConfig, String> {
    let c: ModelConfig = serde_json::from_slice(
        &std::fs::read(config_path(app)?)
            .map_err(|_| "Choose a local whisper.cpp executable and model first")?,
    )
    .map_err(|_| "Choose the local model again")?;
    if !c.binary.is_file() || !c.model.is_file() {
        return Err("Local speech model or executable is missing".into());
    }
    Ok(c)
}
#[tauri::command]
pub fn meeting_model_ready(app: AppHandle) -> bool {
    config(&app).is_ok()
}
#[tauri::command]
pub async fn meeting_model_choose(
    app: AppHandle,
    auth: State<'_, AuthManager>,
) -> Result<bool, String> {
    let initial = owner(&auth)?;
    let Some(binary) = rfd::AsyncFileDialog::new()
        .set_title("Choose a trusted local whisper-cli executable")
        .pick_file()
        .await
    else {
        return Ok(false);
    };
    let Some(model) = rfd::AsyncFileDialog::new()
        .set_title("Choose a whisper.cpp GGML model")
        .add_filter("GGML model", &["bin"])
        .pick_file()
        .await
    else {
        return Ok(false);
    };
    if owner(&auth)? != initial {
        return Err("Account changed; selection cancelled".into());
    }
    let c = ModelConfig {
        binary: binary.path().canonicalize().map_err(|e| e.to_string())?,
        model: model.path().canonicalize().map_err(|e| e.to_string())?,
    };
    let bytes = serde_json::to_vec(&c).map_err(|e| e.to_string())?;
    let path = config_path(&app)?;
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
pub async fn meeting_transcribe(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
) -> Result<(), String> {
    let owner = owner(&auth)?;
    let account = Uuid::parse_str(&owner).map_err(|e| e.to_string())?;
    let root = root(&app)?;
    let c = config(&app)?;
    let stop = Arc::new(AtomicBool::new(false));
    {
        let state = app.state::<RecordingState>();
        let mut job = state.0.lock().map_err(|_| "Recording unavailable")?;
        if job.as_ref().is_some_and(|j| {
            matches!(
                j.status.phase.as_str(),
                "recording" | "stopping" | "transcribing"
            )
        }) {
            return Err("Finish the current local audio operation first".into());
        }
        *job = Some(Job {
            owner: owner.clone(),
            stop: stop.clone(),
            status: Status {
                id: Some(id),
                phase: "transcribing".into(),
                started_ms: now_ms().map_err(|e| e.to_string())?,
                ..Default::default()
            },
        });
    }
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let worker_stop = stop.clone();
        let task = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<()> {
            let mut store = Store::open(&root, account)?;
            let _audio_lock = store.lock_recording_files(id)?;
            let m = store.get(id)?;
            anyhow::ensure!(
                matches!(
                    m.state,
                    MeetingState::Captured
                        | MeetingState::Partial
                        | MeetingState::Interrupted
                        | MeetingState::TranscriptReady
                ),
                "Stop and recover the recording first"
            );
            anyhow::ensure!(
                m.mic_frames > 0 || m.system_frames > 0,
                "No recoverable audio; check interrupted recordings first"
            );
            let output = store.recording_path(id);
            for (source, name, frames) in [
                (Source::Mic, "mic", m.mic_frames),
                (Source::System, "system", m.system_frames),
            ] {
                if frames == 0 {
                    continue;
                }
                anyhow::ensure!(
                    !worker_stop.load(Ordering::SeqCst),
                    "Local transcription cancelled"
                );
                let expected_revision = store.get(id)?.revision;
                let prefix = output.join(format!("asr-{}", Uuid::new_v4()));
                let segments = transcript::transcribe(
                    &c.binary,
                    &c.model,
                    &output.join(format!("{name}.wav")),
                    &prefix,
                    name,
                    &worker_stop,
                    Duration::from_secs(7200),
                )?;
                let _ = std::fs::remove_file(prefix.with_extension("json"));
                anyhow::ensure!(
                    !worker_stop.load(Ordering::SeqCst),
                    "Local transcription cancelled"
                );
                let segments: Vec<_> = segments
                    .into_iter()
                    .map(|s| Segment {
                        start_ms: s.start_ms,
                        end_ms: s.end_ms,
                        text: s.text,
                    })
                    .collect();
                // A concurrent note edit invalidates the revision; do not overwrite it.
                store.save_transcript(id, expected_revision, source, &segments, now_ms()?)?;
            }
            Ok(())
        });
        tokio::pin!(task);
        let result = loop {
            tokio::select! {
                result = &mut task => break result,
                _ = tokio::time::sleep(Duration::from_millis(200)) => {
                    if handle.state::<AuthManager>().current_session().as_ref().map(|s| &s.user_id) != Some(&owner) { stop.store(true, Ordering::SeqCst); }
                }
            }
        };
        let error = match result {
            Ok(Ok(())) => None,
            Ok(Err(e)) => Some(e.to_string()),
            Err(e) => Some(e.to_string()),
        };
        finish(
            &handle,
            id,
            if error.is_some() { "failed" } else { "ready" },
            error,
        );
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_quit_requests_wait_for_the_same_cleanup() {
        let state = RecordingState::default();
        *state.0.lock().unwrap() = Some(Job {
            owner: Uuid::new_v4().to_string(),
            stop: Arc::new(AtomicBool::new(false)),
            status: Status {
                phase: "transcribing".into(),
                ..Default::default()
            },
        });
        assert!(state.must_wait_for_shutdown());
        assert!(state.begin_shutdown());
        state.stop();
        assert!(!state.begin_shutdown());
        assert!(state.must_wait_for_shutdown());
        assert!(state
            .0
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .stop
            .load(Ordering::SeqCst));
        state.allow_exit();
        assert!(!state.must_wait_for_shutdown());
    }
}
