//! Local-only meeting text library. Account identity comes from AuthManager,
//! never from a renderer-supplied owner/path. No network/audio-upload client.
use crate::auth::AuthManager;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use vox_meeting_store::{now_ms, Meeting, MeetingSummary, Segment, Source, Store};

async fn access<T: Send + 'static>(
    app: AppHandle,
    auth: &AuthManager,
    action: impl FnOnce(&mut Store) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, String> {
    let owner = auth
        .current_session()
        .ok_or("Sign in to access local meeting notes")?
        .user_id;
    let account = Uuid::parse_str(&owner).map_err(|_| "Invalid account identity")?;
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("meeting-library");
    let value = tauri::async_runtime::spawn_blocking(move || {
        let mut store = Store::open(&root, account)?;
        action(&mut store)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    if auth.current_session().as_ref().map(|s| s.user_id.as_str()) != Some(owner.as_str()) {
        return Err("Account changed; reopen the meeting library".into());
    }
    Ok(value)
}

#[tauri::command]
pub async fn meeting_list(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    offset: u32,
    limit: u32,
) -> Result<Vec<MeetingSummary>, String> {
    access(app, &auth, move |s| s.list(offset, limit)).await
}
#[tauri::command]
pub async fn meeting_get(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
) -> Result<Meeting, String> {
    access(app, &auth, move |s| s.get(id)).await
}
#[tauri::command]
pub async fn meeting_create(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    title: String,
) -> Result<Meeting, String> {
    access(app, &auth, move |s| {
        s.create(Uuid::new_v4(), &title, now_ms()?)
    })
    .await
}
#[tauri::command]
pub async fn meeting_save_transcript(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    expected_revision: i64,
    source: Source,
    segments: Vec<Segment>,
) -> Result<Meeting, String> {
    access(app, &auth, move |s| {
        s.save_transcript(id, expected_revision, source, &segments, now_ms()?)
    })
    .await
}
#[tauri::command]
pub async fn meeting_save_notes(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    expected_revision: i64,
    notes: String,
) -> Result<Meeting, String> {
    access(app, &auth, move |s| {
        s.save_notes(id, expected_revision, &notes, now_ms()?)
    })
    .await
}
#[tauri::command]
pub async fn meeting_delete(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    expected_revision: i64,
) -> Result<(), String> {
    access(app, &auth, move |s| {
        s.delete(id, expected_revision, now_ms()?)
    })
    .await
}
#[tauri::command]
pub async fn meeting_recover_interrupted(
    app: AppHandle,
    auth: State<'_, AuthManager>,
) -> Result<Vec<vox_meeting_store::RecoveryReport>, String> {
    access(app, &auth, move |s| s.recover_interrupted(now_ms()?)).await
}
