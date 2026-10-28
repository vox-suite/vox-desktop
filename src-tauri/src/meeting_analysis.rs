//! Explicit cloud TEXT analysis and human-approved task promotion. No audio access.
use crate::{
    auth::AuthManager,
    meetings::{access, access_for_owner},
};
use tauri::{AppHandle, State};
use uuid::Uuid;
use vox_meeting_store::{now_ms, Meeting};
use vox_shared::meetings::{request_hash, AnalysisResponse};
async fn post(
    auth: &AuthManager,
    token: &str,
    path: &str,
    body: &serde_json::Value,
) -> Result<(u16, serde_json::Value), String> {
    use futures_util::StreamExt;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|_| "Vox connection unavailable")?;
    let response = client
        .post(format!(
            "{}{}",
            auth.state().api_url.trim_end_matches('/'),
            path
        ))
        .bearer_auth(token)
        .json(body)
        .send()
        .await
        .map_err(|_| {
            "Could not reach Vox. Saved meeting data is unchanged; retry when connected."
        })?;
    let status = response.status().as_u16();
    if response.content_length().is_some_and(|n| n > 512_000) {
        return Err("Vox returned an oversized response".into());
    }
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "Vox response was interrupted; retry")?;
        if bytes.len() + chunk.len() > 512_000 {
            return Err("Vox returned an oversized response".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let value = serde_json::from_slice(&bytes).map_err(|_| "Vox returned an invalid response")?;
    Ok((status, value))
}
fn error(status: u16, value: &serde_json::Value) -> String {
    if status == 404 {
        return "This server version does not support meeting processing yet".into();
    }
    value
        .get("error")
        .and_then(|v| v.as_str())
        .filter(|s| s.len() <= 1000)
        .unwrap_or("Vox could not complete this request. Saved meeting data is unchanged.")
        .into()
}
#[tauri::command]
pub async fn meeting_analyze(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    my_names: Vec<String>,
    timezone: String,
    force: bool,
) -> Result<Meeting, String> {
    auth.refresh_if_expiring().await?;
    let session = auth
        .current_session()
        .ok_or("Sign in before generating a summary")?;
    let owner = session.user_id.clone();
    let (input, cached) = access_for_owner(app.clone(), &auth, owner.clone(), move |store| {
        let input = store.analysis_request(id, my_names, timezone)?;
        let meeting = store.get(id)?;
        let cached = !force
            && meeting
                .analysis
                .as_ref()
                .is_some_and(|a| !a.stale && a.input_hash == request_hash(&input));
        Ok((input, if cached { Some(meeting) } else { None }))
    })
    .await?;
    if let Some(meeting) = cached {
        return Ok(meeting);
    }
    let (status, value) = post(
        &auth,
        &session.vox_token,
        "/v1/meetings/analyze",
        &serde_json::to_value(&input).map_err(|e| e.to_string())?,
    )
    .await?;
    if status != 200 {
        return Err(error(status, &value));
    }
    let response: AnalysisResponse =
        serde_json::from_value(value).map_err(|_| "Vox returned an invalid meeting analysis")?;
    access_for_owner(app, &auth, owner, move |store| {
        store.save_analysis(id, &input, response, now_ms()?)
    })
    .await
}
#[tauri::command]
pub async fn meeting_promote_action(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    key: String,
) -> Result<Meeting, String> {
    auth.refresh_if_expiring().await?;
    let session = auth
        .current_session()
        .ok_or("Sign in before adding a task")?;
    let owner = session.user_id.clone();
    let task_key = key.clone();
    let body = access_for_owner(app.clone(), &auth, owner.clone(), move |store| {
        store.prepare_action(id, &task_key)
    })
    .await?;
    let Some(body) = body else {
        return access_for_owner(app, &auth, owner, move |store| store.get(id)).await;
    };
    let (status, value) = post(&auth, &session.vox_token, "/v1/personal-tasks", &body).await?;
    let span = if status == 410 {
        None
    } else {
        if status != 200 && status != 201 {
            return Err(error(status, &value));
        }
        Some(
            value
                .pointer("/task/id")
                .and_then(|v| v.as_str())
                .and_then(|id| Uuid::parse_str(id).ok())
                .ok_or("Task response was invalid; retry the saved approval")?,
        )
    };
    access_for_owner(app, &auth, owner, move |store| {
        store.finish_action(id, &key, span)
    })
    .await
}
#[tauri::command]
pub async fn meeting_dismiss_action(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    id: Uuid,
    key: String,
) -> Result<Meeting, String> {
    access(app, &auth, move |store| store.dismiss_action(id, &key)).await
}
