//! Installs fixed speech weights only. No recording path or transcript enters this module.
use crate::auth::AuthManager;
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Manager, State};

#[derive(Clone, Serialize)]
pub struct ModelStatus {
    pub phase: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub ready: bool,
    pub engine: Option<String>,
    pub error: Option<String>,
}
impl Default for ModelStatus {
    fn default() -> Self {
        Self {
            phase: "uninitialized".into(),
            downloaded_bytes: 0,
            total_bytes: vox_meeting_models::MODEL_SIZE,
            ready: false,
            engine: None,
            error: None,
        }
    }
}
#[derive(Default)]
struct Inner {
    status: ModelStatus,
    generation: u64,
    cancel: Option<(String, Arc<AtomicBool>)>,
}
#[derive(Default)]
pub struct MeetingModelsState(Mutex<Inner>);
impl MeetingModelsState {
    pub fn cancel(&self) {
        if let Ok(mut inner) = self.0.lock() {
            if let Some((_, cancel)) = &inner.cancel {
                cancel.store(true, Ordering::SeqCst);
                inner.status.phase = "cancelling".into();
            }
        }
    }
    pub fn busy(&self) -> bool {
        self.0
            .lock()
            .map(|i| {
                matches!(
                    i.status.phase.as_str(),
                    "checking" | "downloading" | "verifying" | "cancelling"
                )
            })
            .unwrap_or(true)
    }
    pub fn invalidate(&self) {
        if let Ok(mut inner) = self.0.lock() {
            inner.generation += 1;
            inner.status = ModelStatus::default();
        }
    }
}
pub fn model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("meeting-models"))
}
fn update(app: &AppHandle, generation: u64, change: impl FnOnce(&mut Inner)) {
    if let Ok(mut inner) = app.state::<MeetingModelsState>().0.lock() {
        if inner.generation == generation {
            change(&mut inner);
        }
    }
}
#[tauri::command]
pub async fn meeting_model_status(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, MeetingModelsState>,
) -> Result<ModelStatus, String> {
    auth.current_session().ok_or("Sign in first")?;
    let mut inner = state.0.lock().map_err(|_| "Speech setup unavailable")?;
    if inner.status.phase == "uninitialized" {
        inner.generation += 1;
        let generation = inner.generation;
        inner.status.phase = "checking".into();
        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let owned = handle.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                crate::meeting_recording::selected_engine(&owned)
            })
            .await;
            update(&handle, generation, |i| match result {
                Ok(Ok(engine)) => {
                    i.status.ready = true;
                    i.status.engine = Some(engine.into());
                    i.status.phase = "ready".into();
                    i.status.downloaded_bytes = i.status.total_bytes;
                }
                Ok(Err(_)) => {
                    i.status.phase = "missing".into();
                }
                Err(e) => {
                    i.status.phase = "failed".into();
                    i.status.error = Some(e.to_string());
                }
            });
        });
    }
    Ok(inner.status.clone())
}
#[tauri::command]
pub async fn meeting_model_install(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    state: State<'_, MeetingModelsState>,
) -> Result<(), String> {
    let owner = auth.current_session().ok_or("Sign in first")?.user_id;
    let root = model_dir(&app)?;
    let (generation, cancel) = {
        let mut inner = state.0.lock().map_err(|_| "Speech setup unavailable")?;
        if matches!(
            inner.status.phase.as_str(),
            "checking" | "downloading" | "verifying" | "cancelling"
        ) {
            return Err("Speech setup is already running".into());
        }
        inner.generation += 1;
        let generation = inner.generation;
        let cancel = Arc::new(AtomicBool::new(false));
        inner.status = ModelStatus {
            phase: "checking".into(),
            ..Default::default()
        };
        inner.cancel = Some((owner.clone(), cancel.clone()));
        (generation, cancel)
    };
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let watcher_handle = handle.clone();
        let watcher_stop = cancel.clone();
        let done = Arc::new(AtomicBool::new(false));
        let watcher_done = done.clone();
        let watcher = tauri::async_runtime::spawn(async move {
            while !watcher_done.load(Ordering::SeqCst) {
                if watcher_handle
                    .state::<AuthManager>()
                    .current_session()
                    .as_ref()
                    .map(|s| &s.user_id)
                    != Some(&owner)
                {
                    watcher_stop.store(true, Ordering::SeqCst);
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        });
        let mut emitted = std::time::Instant::now() - std::time::Duration::from_secs(1);
        let result = vox_meeting_models::install_base(&root, &cancel, |received, verifying| {
            if verifying || emitted.elapsed() > std::time::Duration::from_millis(150) {
                update(&handle, generation, |i| {
                    i.status.downloaded_bytes = received;
                    if i.status.phase != "cancelling" {
                        i.status.phase = if verifying {
                            "verifying"
                        } else {
                            "downloading"
                        }
                        .into();
                    }
                });
                emitted = std::time::Instant::now();
            }
        })
        .await;
        done.store(true, Ordering::SeqCst);
        let _ = watcher.await;
        let result = result.and_then(|_| {
            anyhow::ensure!(
                !cancel.load(Ordering::SeqCst),
                "Model installation cancelled"
            );
            crate::meeting_recording::activate_managed_engine(&handle).map_err(anyhow::Error::msg)
        });
        update(&handle, generation, |i| {
            i.cancel = None;
            match result {
                Ok(()) => {
                    i.status.phase = "ready".into();
                    i.status.ready = true;
                    i.status.engine = Some("bundled".into());
                    i.status.downloaded_bytes = i.status.total_bytes;
                }
                Err(error) => {
                    i.status.phase = if cancel.load(Ordering::SeqCst) {
                        "cancelled"
                    } else {
                        "failed"
                    }
                    .into();
                    i.status.ready = false;
                    i.status.error = if cancel.load(Ordering::SeqCst) {
                        None
                    } else {
                        Some(error.to_string())
                    };
                }
            }
        });
    });
    Ok(())
}
#[tauri::command]
pub fn meeting_model_cancel(
    auth: State<'_, AuthManager>,
    state: State<'_, MeetingModelsState>,
) -> Result<(), String> {
    let owner = auth.current_session().ok_or("Sign in first")?.user_id;
    let inner = state.0.lock().map_err(|_| "Speech setup unavailable")?;
    if inner.cancel.as_ref().is_some_and(|(o, _)| o != &owner) {
        return Err("Another account started this installation".into());
    }
    drop(inner);
    state.cancel();
    Ok(())
}
