use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

const REQUIRED: &[&str] = &[
    "whistle.cact",
    "needle3.cact",
    "neutts-2e-Q4_0.gguf",
    "neucodec-decoder.onnx",
    "speakers/emily.codes",
    "speakers/emily.txt",
];

#[derive(Clone, Default, Serialize)]
pub struct ModelsStatus {
    pub ready: bool,
    pub configured: bool,
    pub downloading: bool,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct ModelsState(Mutex<ModelsStatus>);

fn base_url() -> Option<String> {
    std::env::var("VOX_MODELS_BASE_URL")
        .ok()
        .or_else(|| option_env!("VOX_MODELS_BASE_URL").map(str::to_string))
        .map(|u| u.trim_end_matches('/').to_string())
        .filter(|u| !u.is_empty())
}

fn all_present(dir: &Path) -> bool {
    REQUIRED
        .iter()
        .all(|f| std::fs::metadata(dir.join(f)).is_ok_and(|m| m.len() > 0))
}

fn snapshot(app: &AppHandle) -> ModelsStatus {
    let state = app.state::<ModelsState>();
    let mut status = state.0.lock().unwrap();
    if let Ok(dir) = super::models_dir(app) {
        status.ready = all_present(&dir);
    }
    status.configured = base_url().is_some();
    status.clone()
}

fn update(app: &AppHandle, f: impl FnOnce(&mut ModelsStatus)) {
    {
        let state = app.state::<ModelsState>();
        f(&mut state.0.lock().unwrap());
    }
    let _ = app.emit("vox-models-progress", snapshot(app));
}

#[tauri::command]
pub fn local_models_status(app: AppHandle) -> ModelsStatus {
    snapshot(&app)
}

#[tauri::command]
pub fn download_local_models(app: AppHandle, state: State<'_, ModelsState>) -> Result<(), String> {
    if state.0.lock().unwrap().downloading {
        return Ok(());
    }
    let base = base_url().ok_or("VOX_MODELS_BASE_URL is not configured")?;
    let dir = super::models_dir(&app)?;
    update(&app, |s| {
        s.downloading = true;
        s.error = None;
        s.downloaded_bytes = 0;
        s.total_bytes = 0;
    });
    tauri::async_runtime::spawn(async move {
        let result = run(&app, &base, &dir).await;
        update(&app, |s| {
            s.downloading = false;
            if result.is_ok() {
                s.downloaded_bytes = s.total_bytes;
            }
            s.error = result.err();
        });
    });
    Ok(())
}

pub fn auto_start(app: &AppHandle) {
    let status = snapshot(app);
    if !status.ready && status.configured {
        let _ = download_local_models(app.clone(), app.state::<ModelsState>());
    }
}

async fn run(app: &AppHandle, base: &str, dir: &Path) -> Result<(), String> {
    let mut last_emit = Instant::now();
    super::fetch::sync(
        base,
        dir,
        |total| update(app, |s| s.total_bytes = total),
        |done| {
            if last_emit.elapsed() > Duration::from_millis(250) {
                last_emit = Instant::now();
                update(app, |s| s.downloaded_bytes = done);
            }
        },
    )
    .await
}
