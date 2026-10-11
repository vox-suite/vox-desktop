pub mod download;
mod fetch;

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub(crate) fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("VOX_LOCAL_MODELS_DIR") {
        return Ok(PathBuf::from(dir));
    }
    app.path()
        .app_data_dir()
        .map(|d| d.join("models"))
        .map_err(|e| e.to_string())
}
