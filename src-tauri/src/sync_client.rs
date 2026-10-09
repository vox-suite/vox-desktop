use crate::auth::AuthManager;
use base64::Engine as _;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::State;

const DEFAULT_TIMEOUT_MS: u64 = 8_000;
const MAX_TIMEOUT_MS: u64 = 200_000;

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(reqwest::Client::new)
}

async fn core_request(
    auth: &AuthManager,
    method: reqwest::Method,
    path: &str,
    query: &[(String, String)],
    body: Option<Value>,
    raw_body_base64: Option<String>,
    timeout: Duration,
) -> Result<Value, String> {
    let session = auth.current_session().ok_or("Not signed in")?;
    let config = auth.config();
    let url = format!("{}{}", config.api_url.trim_end_matches('/'), path);
    let mut req = http_client()
        .request(method, &url)
        .header("authorization", format!("Bearer {}", session.vox_token))
        .timeout(timeout)
        .query(query);
    if let Some(encoded) = raw_body_base64 {
        if path != "/v1/connectors/google/takeout/upload" || encoded.len() > 140_000_000 {
            return Err("invalid binary upload".into());
        }
        let bytes = base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|_| "invalid upload encoding")?;
        if bytes.len() > 100 * 1024 * 1024 { return Err("upload exceeds 100 MiB".into()); }
        req = req.header("content-type","application/octet-stream").body(bytes);
    } else if let Some(body) = body {
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

fn valid_path(path: &str) -> bool {
    path.starts_with("/v1/")
        && !path.contains("..")
        && !path.contains("//")
        && !path.contains(['?', '#', '\\'])
}

#[tauri::command]
pub async fn core_http(
    method: String,
    path: String,
    query: Option<Vec<(String, String)>>,
    body: Option<Value>,
    raw_body_base64: Option<String>,
    timeout_ms: Option<u64>,
    auth: State<'_, AuthManager>,
) -> Result<Value, String> {
    let method = match method.to_ascii_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "PATCH" => reqwest::Method::PATCH,
        "DELETE" => reqwest::Method::DELETE,
        _ => return Err("unsupported method".to_string()),
    };
    if !valid_path(&path) {
        return Err("invalid path".to_string());
    }
    let timeout =
        Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).min(MAX_TIMEOUT_MS));
    core_request(
        &auth,
        method,
        &path,
        query.as_deref().unwrap_or(&[]),
        body,
        raw_body_base64,
        timeout,
    )
    .await
}
