//! Local-only meeting text library. Account identity comes from AuthManager,
//! never from a renderer-supplied owner/path. No network/audio-upload client.
use crate::auth::AuthManager;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use vox_meeting_store::{now_ms, Meeting, MeetingSummary, Segment, Source, Store};

pub(crate) async fn access<T: Send + 'static>(
    app: AppHandle,
    auth: &AuthManager,
    action: impl FnOnce(&mut Store) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, String> {
    access_bound(app, auth, None, action).await
}
pub(crate) async fn access_for_owner<T: Send + 'static>(
    app: AppHandle,
    auth: &AuthManager,
    owner: String,
    action: impl FnOnce(&mut Store) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, String> {
    access_bound(app, auth, Some(owner), action).await
}
async fn access_bound<T: Send + 'static>(
    app: AppHandle,
    auth: &AuthManager,
    expected: Option<String>,
    action: impl FnOnce(&mut Store) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, String> {
    let owner = auth
        .current_session()
        .ok_or("Sign in to access local meeting notes")?
        .user_id;
    if expected.as_ref().is_some_and(|expected| expected != &owner) {
        return Err("Account changed; reopen the meeting".into());
    }
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
    let handle = app.clone();
    access(app, &auth, move |s| {
        for id in s.cleanup_pending_audio(now_ms()?)? {
            crate::meeting_recording::audio_cleanup_completed(&handle, id);
        }
        s.list(offset, limit)
    })
    .await
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

#[tauri::command]
pub async fn meeting_import_transcript(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    expected_revision: i64,
) -> Result<Option<Meeting>, String> {
    let owner = auth.current_session().ok_or("Sign in first")?.user_id;
    let file = rfd::AsyncFileDialog::new()
        .set_title("Import a Vox transcript")
        .add_filter("Vox transcript", &["json"])
        .pick_file()
        .await;
    let Some(file) = file else { return Ok(None) };
    if auth.current_session().as_ref().map(|s| s.user_id.as_str()) != Some(owner.as_str()) {
        return Err("Account changed; import cancelled".into());
    }
    access(app, &auth, move |store| {
        use std::io::Read;
        let mut bytes = Vec::new();
        std::fs::File::open(file.path())?
            .take(vox_meeting_store::MAX_IMPORT_BYTES + 1)
            .read_to_end(&mut bytes)?;
        let (source, segments) = vox_meeting_store::parse_transcript_import(&bytes)?;
        store
            .save_transcript(id, expected_revision, source, &segments, now_ms()?)
            .map(Some)
    })
    .await
}

#[tauri::command]
pub async fn meeting_export_text(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
) -> Result<bool, String> {
    let owner = auth.current_session().ok_or("Sign in first")?.user_id;
    let saved = access(app.clone(), &auth, move |store| store.get(id)).await?;
    let file = rfd::AsyncFileDialog::new()
        .set_title("Export meeting notes")
        .set_file_name("meeting-notes.txt")
        .add_filter("Text document", &["txt"])
        .save_file()
        .await;
    let Some(file) = file else { return Ok(false) };
    if auth.current_session().as_ref().map(|s| s.user_id.as_str()) != Some(owner.as_str()) {
        return Err("Account changed; export cancelled".into());
    }
    let text = vox_meeting_store::export_text(&saved);
    tauri::async_runtime::spawn_blocking(move || -> std::io::Result<()> {
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut output = options.open(file.path())?;
        output.write_all(text.as_bytes())?;
        output.sync_all()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn meeting_cleanup_audio(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
) -> Result<Meeting, String> {
    let handle = app.clone();
    access(app, &auth, move |s| {
        let pending = s.get(id)?.audio_cleanup_pending;
        let meeting = s.cleanup_audio(id, now_ms()?)?;
        if pending {
            crate::meeting_recording::audio_cleanup_completed(&handle, id);
        }
        Ok(meeting)
    })
    .await
}
