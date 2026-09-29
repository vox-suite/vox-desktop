use crate::auth::AuthManager;
use serde_json::Value;
use std::time::Duration;
use tauri::State;

async fn core_request(
    auth: &AuthManager,
    method: reqwest::Method,
    path: &str,
    query: &[(&str, String)],
    body: Option<Value>,
) -> Result<Value, String> {
    let session = auth.current_session().ok_or("Not signed in")?;
    let config = auth.config();
    let url = format!("{}{}", config.api_url.trim_end_matches('/'), path);
    let mut req = reqwest::Client::new()
        .request(method, &url)
        .header("authorization", format!("Bearer {}", session.vox_token))
        .timeout(Duration::from_millis(8000))
        .query(query);
    if let Some(body) = body {
        req = req.json(&body);
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        auth.handle_unauthorized();
    }
    if !status.is_success() {
        return Err(format!("{path} failed: {status}"));
    }
    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(Value::Null);
    }
    resp.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_spans(
    from: Option<String>,
    to: Option<String>,
    collection_id: Option<String>,
    status: Option<String>,
    unscheduled: Option<bool>,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let mut body = serde_json::Map::new();
    for (key, value) in [
        ("from", from),
        ("to", to),
        ("collection_id", collection_id),
        ("status", status),
    ] {
        if let Some(value) = value.filter(|v| !v.is_empty()) {
            body.insert(key.to_string(), Value::String(value));
        }
    }
    if let Some(unscheduled) = unscheduled {
        body.insert("unscheduled".to_string(), Value::Bool(unscheduled));
    }
    core_request(&auth, reqwest::Method::POST, "/v1/spans/list", &[], Some(Value::Object(body))).await
}

#[tauri::command]
pub async fn create_span(payload: Value, auth: State<'_, AuthManager>) -> Result<Value, String> {
    core_request(&auth, reqwest::Method::POST, "/v1/spans", &[], Some(payload)).await
}

#[tauri::command]
pub async fn update_span(
    id: String,
    patch: Value,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let path = format!("/v1/spans/{id}/update");
    core_request(&auth, reqwest::Method::POST, &path, &[], Some(patch)).await
}

#[tauri::command]
pub async fn delete_span(id: String, auth: State<'_, AuthManager>) -> Result<(), String> {
    let path = format!("/v1/spans/{id}/delete");
    core_request(&auth, reqwest::Method::POST, &path, &[], None)
        .await
        .map(|_| ())
}

#[tauri::command]
pub async fn get_collections(auth: State<'_, AuthManager>) -> Result<Value, String> {
    core_request(&auth, reqwest::Method::POST, "/v1/collections/list", &[], Some(serde_json::json!({}))).await
}

#[tauri::command]
pub async fn create_collection(
    payload: Value,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    core_request(&auth, reqwest::Method::POST, "/v1/collections", &[], Some(payload)).await
}

#[tauri::command]
pub async fn update_collection(
    id: String,
    patch: Value,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let path = format!("/v1/collections/{id}/update");
    core_request(&auth, reqwest::Method::POST, &path, &[], Some(patch)).await
}

#[tauri::command]
pub async fn archive_collection(id: String, auth: State<'_, AuthManager>) -> Result<(), String> {
    let path = format!("/v1/collections/{id}/archive");
    core_request(&auth, reqwest::Method::POST, &path, &[], None)
        .await
        .map(|_| ())
}

#[tauri::command]
pub async fn set_span_collection(
    collection_id: String,
    span_id: String,
    member: bool,
    auth: State<'_, AuthManager>,
) -> Result<(), String> {
    let action = if member { "add" } else { "remove" };
    let path = format!("/v1/collections/{collection_id}/spans/{span_id}/{action}");
    core_request(&auth, reqwest::Method::POST, &path, &[], None).await.map(|_| ())
}

#[tauri::command]
pub async fn list_schemas(auth: State<'_, AuthManager>) -> Result<Value, String> {
    core_request(&auth, reqwest::Method::GET, "/v1/me/schemas", &[], None).await
}

#[tauri::command]
pub async fn suggest_charts(
    schema_ids: Vec<String>,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let payload = serde_json::json!({ "schema_ids": schema_ids });
    core_request(&auth, reqwest::Method::POST, "/v1/me/charts/suggest", &[], Some(payload)).await
}

#[tauri::command]
pub async fn create_chart_board(
    name: String,
    charts: Value,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let payload = serde_json::json!({
        "name": name,
        "charts": charts,
    });
    core_request(&auth, reqwest::Method::POST, "/v1/me/charts/boards", &[], Some(payload)).await
}

#[tauri::command]
pub async fn list_chart_boards(auth: State<'_, AuthManager>) -> Result<Value, String> {
    core_request(&auth, reqwest::Method::GET, "/v1/me/charts/boards", &[], None).await
}

#[tauri::command]
pub async fn get_chart_board(
    id: String,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let path = format!("/v1/me/charts/boards/{id}");
    core_request(&auth, reqwest::Method::GET, &path, &[], None).await
}

#[tauri::command]
pub async fn get_chart_board_data(
    id: String,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let path = format!("/v1/me/charts/boards/{id}/data");
    core_request(&auth, reqwest::Method::GET, &path, &[], None).await
}

#[tauri::command]
pub async fn list_spaces(auth: State<'_, AuthManager>) -> Result<Value, String> {
    core_request(&auth, reqwest::Method::GET, "/v1/me/spaces", &[], None).await
}

#[tauri::command]
pub async fn get_space(id: String, auth: State<'_, AuthManager>) -> Result<Value, String> {
    let path = format!("/v1/me/spaces/{id}");
    core_request(&auth, reqwest::Method::GET, &path, &[], None).await
}

#[tauri::command]
pub async fn create_space(
    title: String,
    intent: String,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let body = serde_json::json!({ "title": title, "intent": intent });
    core_request(&auth, reqwest::Method::POST, "/v1/me/spaces", &[], Some(body)).await
}

#[tauri::command]
pub async fn drop_space(id: String, auth: State<'_, AuthManager>) -> Result<Value, String> {
    let path = format!("/v1/me/spaces/{id}");
    core_request(&auth, reqwest::Method::DELETE, &path, &[], None).await
}

#[tauri::command]
pub async fn send_space_chat(
    id: String,
    message: String,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let path = format!("/v1/me/spaces/{id}/chat");
    let body = serde_json::json!({ "message": message });
    core_request(&auth, reqwest::Method::POST, &path, &[], Some(body)).await
}

#[tauri::command]
pub async fn commit_space(id: String, auth: State<'_, AuthManager>) -> Result<Value, String> {
    let path = format!("/v1/me/spaces/{id}/commit");
    core_request(&auth, reqwest::Method::POST, &path, &[], None).await
}
