pub mod agent;
mod agent_gateway;
mod agent_runtime;
mod agent_tools;
pub mod diagram;
mod engine;
mod graph;
mod sources;
mod types;

use crate::auth::AuthManager;
use engine::{CodeGraph, CodeIndexEngine};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{Arc, OnceLock},
};
use tauri::State;
use types::*;

fn gate() -> Arc<tokio::sync::Semaphore> {
    static GATE: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
    GATE.get_or_init(|| Arc::new(tokio::sync::Semaphore::new(1)))
        .clone()
}
fn root() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or("Home directory unavailable")?;
    Ok(PathBuf::from(home).join(".vox/projects"))
}
fn dir(auth: &AuthManager, project_id: &str) -> Result<PathBuf, String> {
    let user = auth
        .current_session()
        .ok_or("Sign in to use project sources")?
        .user_id;
    let user = uuid::Uuid::parse_str(&user).map_err(|_| "Invalid account")?;
    let project = uuid::Uuid::parse_str(project_id).map_err(|_| "Invalid project")?;
    Ok(root()?.join(user.to_string()).join(project.to_string()))
}
fn source(dir: &std::path::Path, id: &str) -> Result<LocalSource, String> {
    sources::registry(dir)?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or("This source is not available on this device. Relink it in Sources.".into())
}
fn private_root() -> Result<PathBuf, String> {
    let root = root()?;
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    Ok(root)
}

#[tauri::command]
pub fn project_engine_status() -> Result<Value, String> {
    let root = private_root()?.join("engines");
    Ok(
        json!({"engine":"code-graph-mcp","version":engine::VERSION,"installed":CodeGraph.executable(&root).is_file()}),
    )
}
#[tauri::command]
pub async fn project_install_engine(auth: State<'_, AuthManager>) -> Result<(), String> {
    if auth.current_session().is_none() {
        return Err("Sign in first".into());
    }
    let _permit = gate().acquire_owned().await.map_err(|e| e.to_string())?;
    engine::install(&private_root()?.join("engines")).await
}
#[tauri::command]
pub async fn project_pick_sources(
    project_id: String,
    kind: String,
    source_id: Option<String>,
    auth: State<'_, AuthManager>,
) -> Result<Vec<LocalSource>, String> {
    let dir = dir(&auth, &project_id)?;
    let paths = if kind == "folder" {
        rfd::AsyncFileDialog::new()
            .set_title("Choose project folders")
            .pick_folders()
            .await
            .map(|files| {
                files
                    .into_iter()
                    .map(|f| f.path().to_path_buf())
                    .collect::<Vec<_>>()
            })
    } else if kind == "file" {
        rfd::AsyncFileDialog::new()
            .set_title("Choose up to five text or code files")
            .pick_files()
            .await
            .map(|files| {
                files
                    .into_iter()
                    .map(|f| f.path().to_path_buf())
                    .collect::<Vec<_>>()
            })
    } else {
        return Err("Invalid source type".into());
    };
    let Some(paths) = paths else {
        return sources::registry(&dir);
    };
    let _permit = gate().acquire_owned().await.map_err(|e| e.to_string())?;
    let mut sources = sources::registry(&dir)?;
    if source_id.is_some() && paths.len() != 1 {
        return Err("Choose exactly one source to relink".into());
    }
    for path in paths {
        if std::fs::symlink_metadata(&path)
            .map_err(|e| e.to_string())?
            .file_type()
            .is_symlink()
        {
            return Err("Choose a real file or folder, not a symlink".into());
        }
        let root = path
            .canonicalize()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .into_owned();
        if sources
            .iter()
            .any(|s| s.root == root && Some(&s.id) != source_id.as_ref())
        {
            continue;
        }
        if kind == "file"
            && (!sources::readable(&path)
                || sources
                    .iter()
                    .filter(|s| s.kind == "file" && Some(&s.id) != source_id.as_ref())
                    .count()
                    >= 5)
        {
            return Err("Choose up to five supported text or code files. PDF and binary documents require conversion to text.".into());
        }
        if sources.len() >= 30 && !sources.iter().any(|s| Some(&s.id) == source_id.as_ref()) {
            return Err("A project can have up to 30 sources".into());
        }
        let id = if let Some(id) = &source_id {
            uuid::Uuid::parse_str(id)
                .map_err(|_| "Invalid source")?
                .to_string()
        } else {
            uuid::Uuid::new_v4().to_string()
        };
        sources.retain(|s| s.id != id);
        sources.push(LocalSource {
            id,
            label: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            kind: kind.clone(),
            root,
            hashes: Default::default(),
        });
    }
    sources::save(&dir, &sources)?;
    Ok(sources)
}
#[tauri::command]
pub fn project_local_sources(
    project_id: String,
    auth: State<'_, AuthManager>,
) -> Result<Vec<LocalSource>, String> {
    sources::registry(&dir(&auth, &project_id)?)
}
#[tauri::command]
pub async fn project_index_source(
    project_id: String,
    source_id: String,
    auth: State<'_, AuthManager>,
) -> Result<IndexResult, String> {
    let dir = dir(&auth, &project_id)?;
    let engine_root = private_root()?.join("engines");
    let _permit = gate().acquire_owned().await.map_err(|e| e.to_string())?;
    let snapshot_dir = dir.clone();
    let id = source_id.clone();
    let (s, warnings) = tokio::task::spawn_blocking(move || {
        let mut s = source(&snapshot_dir, &id)?;
        let warnings = sources::snapshot(&snapshot_dir, &mut s)?;
        Ok::<_, String>((s, warnings))
    })
    .await
    .map_err(|e| e.to_string())??;
    engine::index(&engine_root, &dir.join(&s.id).join("snapshot")).await?;
    tokio::task::spawn_blocking(move || {
        let result = graph::summary(&dir, &s, warnings)?;
        let mut all = sources::registry(&dir)?;
        if let Some(old) = all.iter_mut().find(|old| old.id == s.id) {
            *old = s;
        }
        sources::save(&dir, &all)?;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn project_graph(
    project_id: String,
    source_id: String,
    path: String,
    search: String,
    offset: i64,
    auth: State<'_, AuthManager>,
) -> Result<GraphPage, String> {
    let dir = dir(&auth, &project_id)?;
    tokio::task::spawn_blocking(move || {
        graph::page(&dir, &source(&dir, &source_id)?, &path, &search, offset)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn project_read_source(
    project_id: String,
    citation: Citation,
    auth: State<'_, AuthManager>,
) -> Result<String, String> {
    let dir = dir(&auth, &project_id)?;
    tokio::task::spawn_blocking(move || {
        sources::read(&source(&dir, &citation.source_id)?, &citation)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn project_check_sources(
    project_id: String,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let dir = dir(&auth, &project_id)?;
    let _permit = gate().acquire_owned().await.map_err(|e| e.to_string())?;
    tokio::task::spawn_blocking(move || {
        let all = sources::registry(&dir)?;
        let mut changes = serde_json::Map::new();
        for s in all {
            match sources::changed(&s) {
                Ok(files) => {
                    changes.insert(s.id, json!({"files":files}));
                }
                Err(e) => {
                    changes.insert(s.id, json!({"unavailable":e}));
                }
            }
        }
        Ok(Value::Object(changes))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn project_remove_source(
    project_id: String,
    source_id: String,
    auth: State<'_, AuthManager>,
) -> Result<(), String> {
    let dir = dir(&auth, &project_id)?;
    let _permit = gate().acquire_owned().await.map_err(|e| e.to_string())?;
    let mut all = sources::registry(&dir)?;
    let id = uuid::Uuid::parse_str(&source_id)
        .map_err(|_| "Invalid source")?
        .to_string();
    all.retain(|s| s.id != id);
    sources::save(&dir, &all)?;
    let path = dir.join(id);
    if path.exists() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
