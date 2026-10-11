use crate::auth::AuthManager;
use std::{fs, io::Write, path::PathBuf};
use tauri::State;

const MAX_VALUE_BYTES: usize = 25 * 1024 * 1024;

fn root() -> Option<PathBuf> {
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE"))?;
    Some(PathBuf::from(home).join(".vox").join("cache"))
}

fn user_dir(user_id: &str) -> Option<PathBuf> {
    if user_id.is_empty()
        || user_id.len() > 64
        || !user_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some(root()?.join(user_id))
}

fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 64
        && key
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

fn current_dir(auth: &AuthManager) -> Option<PathBuf> {
    user_dir(&auth.current_session()?.user_id)
}

#[cfg(unix)]
fn restrict(path: &std::path::Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(mode));
}

#[cfg(not(unix))]
fn restrict(_path: &std::path::Path, _mode: u32) {}

pub fn clear_user(user_id: &str) {
    if let Some(dir) = user_dir(user_id) {
        let _ = fs::remove_dir_all(dir);
    }
}

#[tauri::command]
pub fn cache_read(key: String, auth: State<'_, AuthManager>) -> Result<Option<String>, String> {
    if !valid_key(&key) {
        return Err("invalid cache key".into());
    }
    let Some(dir) = current_dir(&auth) else {
        return Ok(None);
    };
    match fs::read_to_string(dir.join(format!("{key}.json"))) {
        Ok(text) => Ok(Some(text)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn cache_write(key: String, value: String, auth: State<'_, AuthManager>) -> Result<(), String> {
    if !valid_key(&key) {
        return Err("invalid cache key".into());
    }
    if value.len() > MAX_VALUE_BYTES {
        return Err("cache value too large".into());
    }
    let Some(dir) = current_dir(&auth) else {
        return Ok(());
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    if let Some(parent) = dir.parent() {
        restrict(parent, 0o700);
        if let Some(vox) = parent.parent() {
            restrict(vox, 0o700);
        }
    }
    restrict(&dir, 0o700);
    let target = dir.join(format!("{key}.json"));
    let temp = dir.join(format!("{key}.json.tmp"));
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    file.write_all(value.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    restrict(&temp, 0o600);
    fs::rename(&temp, &target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cache_clear(auth: State<'_, AuthManager>) -> Result<(), String> {
    if let Some(dir) = current_dir(&auth) {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(())
}
