use crate::auth::AuthManager;
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

#[derive(Clone)]
struct GatewayState {
    core_url: String,
    bearer: String,
    project: String,
    token: String,
    model: String,
    calls: Arc<AtomicUsize>,
    client: reqwest::Client,
}
pub struct Gateway {
    pub url: String,
    pub token: String,
    pub model: String,
    task: tokio::task::JoinHandle<()>,
}
impl Drop for Gateway {
    fn drop(&mut self) {
        self.task.abort();
    }
}
fn error(status: StatusCode, message: &str) -> Response {
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(Body::from(
            json!({"error":{"code":status.as_u16(),"message":message}}).to_string(),
        ))
        .unwrap_or_default()
}
async fn forward(
    State(state): State<GatewayState>,
    Path(path): Path<String>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    if headers.get("x-goog-api-key").and_then(|h| h.to_str().ok()) != Some(state.token.as_str()) {
        return error(StatusCode::UNAUTHORIZED, "Invalid investigation capability");
    }
    let Some((model, action)) = path
        .strip_prefix("v1beta/models/")
        .and_then(|p| p.split_once(':'))
    else {
        return error(StatusCode::BAD_REQUEST, "Unsupported model request");
    };
    if model != state.model
        || !matches!(
            action,
            "generateContent" | "streamGenerateContent" | "countTokens"
        )
    {
        return error(StatusCode::BAD_REQUEST, "Unsupported model request");
    }
    if state.calls.fetch_add(1, Ordering::SeqCst) >= 180 {
        return error(
            StatusCode::TOO_MANY_REQUESTS,
            "Investigation request budget exhausted",
        );
    }
    let response = match state
        .client
        .post(format!(
            "{}/v1/me/projects/{}/agent/{action}",
            state.core_url, state.project
        ))
        .bearer_auth(&state.bearer)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            return error(
                StatusCode::BAD_GATEWAY,
                "Vox could not reach the Gemini gateway",
            )
        }
    };
    let status = response.status();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    Response::builder()
        .status(status.as_u16())
        .header("content-type", content_type)
        .body(Body::from_stream(response.bytes_stream()))
        .unwrap_or_default()
}
pub async fn start(auth: &AuthManager, project: &str) -> Result<Gateway, String> {
    let session = auth
        .current_session()
        .ok_or("Sign in to investigate a project")?;
    let core_url = auth.config().api_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(190))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(format!("{core_url}/v1/me/projects/{project}/agent"))
        .bearer_auth(&session.vox_token)
        .send()
        .await
        .map_err(|_| "Could not connect to Vox's investigation gateway")?;
    if !response.status().is_success() {
        return Err(format!(
            "Vox investigation gateway is unavailable ({})",
            response.status()
        ));
    }
    let config: Value = response
        .json()
        .await
        .map_err(|_| "Invalid investigation gateway configuration")?;
    if config["available"] != true {
        return Err("Vox's Gemini connection is not configured".into());
    }
    let model = config["model"]
        .as_str()
        .filter(|s| {
            !s.is_empty()
                && s.len() <= 100
                && s.chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        })
        .ok_or("Invalid investigation model")?
        .to_string();
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    let state = GatewayState {
        core_url,
        bearer: session.vox_token,
        project: project.to_string(),
        token: token.clone(),
        model: model.clone(),
        calls: Arc::new(AtomicUsize::new(0)),
        client,
    };
    let app = Router::new()
        .route("/{*path}", post(forward))
        .layer(DefaultBodyLimit::max(2_000_000))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| "Could not start the local investigation gateway")?;
    let url = format!(
        "http://{}",
        listener.local_addr().map_err(|e| e.to_string())?
    );
    let task = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    Ok(Gateway {
        url,
        token,
        model,
        task,
    })
}
