use super::{agent, agent_runtime};
use crate::auth::AuthManager;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::State;

pub const TYPES: [&str; 5] = [
    "architecture",
    "workflow",
    "sequence",
    "dataflow",
    "lifecycle",
];
static INSTALL: Mutex<()> = Mutex::new(());
const ARCHIVE: &[u8] = include_bytes!("../../resources/archify-runtime.tar.gz");

fn root() -> Result<PathBuf, String> {
    let _lock = INSTALL.lock().map_err(|_| "Diagram runtime is busy")?;
    let fingerprint = format!("{:x}", Sha256::digest(ARCHIVE));
    let root = super::private_root()?.join(format!(
        "engines/archify-3.0.1-58ab0b98-{}",
        &fingerprint[..16]
    ));
    if root.join("ready").is_file() {
        return Ok(root);
    }
    agent::secure_dir(&root)?;
    let archive = root.join("runtime.tar.gz");
    agent::write_private(&archive, ARCHIVE)?;
    let status = Command::new("/usr/bin/tar")
        .args(["-xzf"])
        .arg(&archive)
        .arg("-C")
        .arg(&root)
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Could not prepare the diagram runtime".into());
    }
    std::fs::remove_file(archive).map_err(|e| e.to_string())?;
    agent::write_private(
        &root.join("ready"),
        b"58ab0b98d2d0def8e49dced705c7b566936723ec",
    )?;
    Ok(root)
}
fn run(mode: &str, arg: &Path) -> Result<Value, String> {
    let root = root()?;
    let node = agent_runtime::root()?.join("node");
    if !node.is_file() {
        return Err("The managed diagram runtime is not installed".into());
    }
    let result = Command::new(node)
        .arg(root.join("vox-render.mjs"))
        .arg(mode)
        .arg(arg)
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .output()
        .map_err(|e| e.to_string())?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr)
            .chars()
            .take(6000)
            .collect());
    }
    if result.stdout.len() > 2_000_000 {
        return Err("Rendered diagram exceeds limit".into());
    }
    serde_json::from_slice(&result.stdout).map_err(|_| "Invalid renderer response".into())
}
pub fn schema(kind: &str) -> Result<Value, String> {
    if !TYPES.contains(&kind) {
        return Err("Choose one of the available diagram capabilities".into());
    }
    run("schema", Path::new(kind))
}
// Drafts are streamed mid-write: keep only required keys (optional ones like mainPath or cards can
// reference elements not written yet) and give required arrays not reached yet an empty value.
fn fill_draft(diagram: &mut Value) -> Result<(), String> {
    static SCHEMAS: Mutex<Option<std::collections::HashMap<String, Value>>> = Mutex::new(None);
    let kind = diagram["diagram_type"]
        .as_str()
        .ok_or("Draft has no diagram type")?
        .to_string();
    let cached = SCHEMAS
        .lock()
        .map_err(|_| "Schema cache poisoned")?
        .get_or_insert_with(Default::default)
        .get(&kind)
        .cloned();
    let schema = match cached {
        Some(schema) => schema,
        None => {
            let schema = schema(&kind)?["schema"].take();
            SCHEMAS
                .lock()
                .map_err(|_| "Schema cache poisoned")?
                .get_or_insert_with(Default::default)
                .insert(kind, schema.clone());
            schema
        }
    };
    let object = diagram.as_object_mut().ok_or("Draft is not an object")?;
    let required: Vec<&str> = schema["required"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|k| k.as_str())
        .collect();
    object.retain(|key, _| required.contains(&key.as_str()));
    for key in required {
        if schema["properties"][key]["type"] == "array" && !object.contains_key(key) {
            object.insert(key.to_string(), Value::Array(vec![]));
        }
    }
    Ok(())
}
pub fn render(diagram: &Value, directory: &Path) -> Result<Value, String> {
    let bytes = serde_json::to_vec(diagram).map_err(|e| e.to_string())?;
    if bytes.len() > 100_000 {
        return Err("Diagram exceeds 100 KB".into());
    }
    agent::secure_dir(directory)?;
    let input = directory.join("diagram-input.json");
    agent::write_private(&input, &bytes)?;
    run("render", &input)
}
struct Temporary(PathBuf);
impl Drop for Temporary {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn account(auth: &AuthManager) -> Result<String, String> {
    auth.current_session()
        .map(|s| s.user_id)
        .ok_or("Sign in to view project diagrams".into())
}
#[tauri::command]
pub async fn project_render_diagram(
    mut diagram: Value,
    draft: Option<bool>,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let owner = account(&auth)?;
    agent_runtime::install().await?;
    let directory = super::private_root()?
        .join("diagram-renders")
        .join(uuid::Uuid::new_v4().to_string());
    let result = tokio::task::spawn_blocking(move || {
        let _cleanup = Temporary(directory.clone());
        if draft == Some(true) {
            fill_draft(&mut diagram)?;
        }
        render(&diagram, &directory)
    })
    .await
    .map_err(|_| "Diagram rendering interrupted")??;
    if account(&auth)? != owner {
        return Err("Account changed during rendering".into());
    }
    Ok(result)
}
#[tauri::command]
pub async fn project_export_diagram(
    flow: Value,
    format: String,
    auth: State<'_, AuthManager>,
) -> Result<(), String> {
    let owner = account(&auth)?;
    if !matches!(format.as_str(), "html" | "svg" | "json") {
        return Err("Unsupported export format".into());
    }
    let diagram = flow
        .get("diagram")
        .ok_or("This diagram has no portable representation")?
        .clone();
    agent_runtime::install().await?;
    let directory = super::private_root()?
        .join("diagram-renders")
        .join(uuid::Uuid::new_v4().to_string());
    let result = tokio::task::spawn_blocking(move || {
        let _cleanup = Temporary(directory.clone());
        let rendered = render(&diagram, &directory)?;
        let bytes = match format.as_str() {
            "json" => serde_json::to_vec_pretty(&flow).map_err(|e| e.to_string())?,
            "html" => std::fs::read(directory.join("artifact.html")).map_err(|e| e.to_string())?,
            _ => {
                let svg = rendered["svg"].as_str().ok_or("Missing diagram SVG")?;
                let css = rendered["css"]
                    .as_str()
                    .ok_or("Missing diagram stylesheet")?
                    .replace(":host", ":root");
                let start = svg.find('>').ok_or("Invalid SVG")?;
                format!(
                    "{} xmlns=\"http://www.w3.org/2000/svg\"><style>{}</style>{}",
                    &svg[..start],
                    css,
                    &svg[start + 1..]
                )
                .into_bytes()
            }
        };
        Ok::<_, String>((format, bytes))
    })
    .await
    .map_err(|_| "Diagram export interrupted")??;
    if account(&auth)? != owner {
        return Err("Account changed during export".into());
    }
    let (format, bytes) = result;
    let destination = rfd::AsyncFileDialog::new()
        .set_file_name(format!("vox-diagram.{format}"))
        .add_filter("Diagram", &[format.as_str()])
        .save_file()
        .await;
    if let Some(file) = destination {
        if account(&auth)? != owner {
            return Err("Account changed during export".into());
        }
        file.write(&bytes).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
