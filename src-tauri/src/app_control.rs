use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

#[derive(Default)]
pub struct AppControlState {
    context: Mutex<Option<(Instant, Value)>>,
    device: Mutex<Option<String>>,
    pending: Mutex<HashMap<String, oneshot::Sender<Value>>>,
}
impl AppControlState {
    pub fn device_id(&self) -> Option<String> {
        self.device.lock().ok().and_then(|d| d.clone())
    }
    pub fn set_device(&self, id: Option<String>) {
        *self.device.lock().unwrap() = id;
        if self.device_id().is_none() {
            self.pending.lock().unwrap().clear();
        }
    }
}
#[tauri::command]
pub fn set_app_context(state: State<'_, AppControlState>, context: Value) -> Result<(), String> {
    if !context.is_object() || context.to_string().len() > 16384 {
        return Err("Invalid context".into());
    }
    *state.context.lock().map_err(|_| "Context unavailable")? = Some((Instant::now(), context));
    Ok(())
}
#[tauri::command]
pub fn complete_app_command(state: State<'_, AppControlState>, request_id: String, result: Value) {
    if let Some(tx) = state.pending.lock().unwrap().remove(&request_id) {
        let _ = tx.send(result);
    }
}
pub async fn handle(app: &AppHandle, frame: Value) -> Value {
    let id = frame["id"].as_str().unwrap_or("").to_owned();
    let state = app.state::<AppControlState>();
    if frame["type"] == "app_context" {
        let context = state.context.lock().unwrap().clone();
        return match context {
            Some((at, context)) if at.elapsed() < Duration::from_secs(30) => {
                json!({"id":id,"ok":true,"context":context})
            }
            _ => json!({"id":id,"ok":false,"error":"context_unavailable"}),
        };
    }
    let command = &frame["command"];
    let valid = command["expiresAt"]
        .as_str()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .is_some_and(|at| at > chrono::Utc::now());
    if !valid {
        return json!({"id":id,"ok":false,"error":"expired"});
    }
    let (tx, rx) = oneshot::channel();
    {
        let mut pending = state.pending.lock().unwrap();
        if pending.len() >= 32 {
            return json!({"id":id,"ok":false,"error":"busy"});
        }
        pending.insert(id.clone(), tx);
    }
    if app
        .emit("vox-app-command", json!({"requestId":id,"command":command}))
        .is_err()
    {
        state.pending.lock().unwrap().remove(&id);
        return json!({"id":id,"ok":false,"error":"ui_unavailable"});
    }
    let result = tokio::time::timeout(Duration::from_secs(25), rx).await;
    state.pending.lock().unwrap().remove(&id);
    match result {
        Ok(Ok(mut value)) => {
            value["id"] = json!(id);
            value
        }
        _ => json!({"id":id,"ok":false,"error":"ui_acknowledgment_unknown"}),
    }
}
