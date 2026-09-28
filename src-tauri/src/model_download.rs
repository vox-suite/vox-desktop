use futures_util::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub done: bool,
    pub error: Option<String>,
}

pub fn models_dir() -> PathBuf {
    let dir = crate::device_link::vox_config_dir().join("models");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub async fn download_model_file(
    app: &AppHandle,
    url: &str,
    dest_path: PathBuf,
    progress_event: &'static str,
) -> Result<(), String> {
    if dest_path.exists() {
        return Ok(());
    }

    let mut tmp_name = dest_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    tmp_name.push_str(".part");
    let tmp_path = dest_path.with_file_name(tmp_name);

    let client = reqwest::Client::new();
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("model download failed: {}", resp.status()));
    }
    let total = resp.content_length();

    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if last_emit.elapsed().as_millis() > 200 {
            let _ = app.emit(
                progress_event,
                DownloadProgress {
                    downloaded_bytes: downloaded,
                    total_bytes: total,
                    done: false,
                    error: None,
                },
            );
            last_emit = std::time::Instant::now();
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);
    tokio::fs::rename(&tmp_path, &dest_path)
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        progress_event,
        DownloadProgress {
            downloaded_bytes: downloaded,
            total_bytes: total,
            done: true,
            error: None,
        },
    );
    Ok(())
}
