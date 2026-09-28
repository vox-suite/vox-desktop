/**
* Device self-registration and the persistent real-time connection to Vox
* Core, used to receive live terminal commands during a phone call.
*\n* Remote control is opt-in: it stays off until the user turns it on in the
* app, and while off this Mac never opens the socket, so the agent cannot
* reach it. Every command received is appended to a local log.
*/
use crate::auth::AuthManager;
use crate::terminal::TerminalManager;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::watch;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

const RETRY_DELAY: Duration = Duration::from_secs(5);

const LINK_DISCONNECTED: u8 = 0;
const LINK_CONNECTING: u8 = 1;
const LINK_CONNECTED: u8 = 2;
const LINK_DISABLED: u8 = 3;

/// Live status of the desktop's socket to Vox Core — whether the Vox agent
/// running on the server currently has a channel to control this machine.
#[derive(Default)]
pub struct DeviceLinkState(AtomicU8);

#[derive(Debug, Serialize)]
pub struct DeviceLinkStatus {
    status: &'static str,
}

fn link_status_str(phase: u8) -> &'static str {
    match phase {
        LINK_CONNECTING => "connecting",
        LINK_CONNECTED => "connected",
        LINK_DISABLED => "disabled",
        _ => "disconnected",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalEvent {
    pub id: String,
    pub timestamp: String,
    pub kind: String, // "system" | "command" | "output" | "status" | "success" | "error"
    pub text: String,
}

#[derive(Default, Clone)]
pub struct EventLog(pub std::sync::Arc<std::sync::Mutex<Vec<LocalEvent>>>);

pub fn emit_local_event(app: &AppHandle, kind: &str, text: &str) {
    let now = chrono::Local::now().format("%H:%M:%S").to_string();
    let event = LocalEvent {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: now,
        kind: kind.to_string(),
        text: text.to_string(),
    };
    if let Some(state) = app.try_state::<EventLog>() {
        if let Ok(mut buf) = state.0.lock() {
            buf.push(event.clone());
            if buf.len() > 300 {
                buf.remove(0);
            }
        }
    }
    let _ = app.emit("local-agent-event", &event);
}

#[tauri::command]
pub fn get_local_events(state: State<'_, EventLog>) -> Vec<LocalEvent> {
    let mut events = state.0.lock().map(|g| g.clone()).unwrap_or_default();
    if events.is_empty() {
        let log_path = vox_config_dir().join("remote-commands.log");
        if let Ok(content) = std::fs::read_to_string(&log_path) {
            for line in content.lines().rev().take(20).collect::<Vec<_>>().into_iter().rev() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    events.push(LocalEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                        kind: "command".to_string(),
                        text: trimmed.to_string(),
                    });
                }
            }
        }
    }
    events
}

/// Lets the local UI exercise a GUI action without waiting on a Core-sent
/// frame — same code path `gui_action` frames use, just invoked directly.
#[tauri::command]
pub fn run_gui_action_locally(command: String) -> Result<Value, String> {
    vox_desktop_control::execute(&command).map(|outcome| match outcome {
        vox_desktop_control::GuiOutcome::Done(msg) => json!({ "ok": true, "output": msg }),
        vox_desktop_control::GuiOutcome::NeedsFallback(candidates) => {
            json!({ "ok": false, "needs_llm_fallback": true, "candidates": candidates })
        }
    })
}

#[tauri::command]
pub fn get_device_link_status(state: State<'_, DeviceLinkState>) -> DeviceLinkStatus {
    DeviceLinkStatus {
        status: link_status_str(state.0.load(Ordering::SeqCst)),
    }
}

/// The user's consent for the agent to run commands on this Mac. Off by
/// default; persisted as a marker file next to the device identifier.
pub struct RemoteControl(watch::Sender<bool>);

impl RemoteControl {
    pub fn load() -> Self {
        Self(watch::Sender::new(remote_control_path().exists()))
    }
}

fn remote_control_path() -> PathBuf {
    vox_config_dir().join("remote_control_enabled")
}

#[tauri::command]
pub fn get_remote_control(state: State<'_, RemoteControl>) -> bool {
    *state.0.borrow()
}

#[tauri::command]
pub fn set_remote_control(state: State<'_, RemoteControl>, enabled: bool) -> Result<bool, String> {
    let path = remote_control_path();
    if enabled {
        std::fs::write(&path, b"").map_err(|e| e.to_string())?;
    } else if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    state.0.send_replace(enabled);
    Ok(enabled)
}

/// Appends one line per remote command so the user can see what ran here.
fn log_remote_command(command: &str, outcome: &str) {
    use std::io::Write;
    let line = format!(
        "{} {outcome}: {}\n",
        chrono::Utc::now().to_rfc3339(),
        command.replace('\n', " ")
    );
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(vox_config_dir().join("remote-commands.log"))
    {
        let _ = file.write_all(line.as_bytes());
    }
}

#[derive(Debug, Deserialize)]
struct RegisterDeviceResponse {
    id: String,
}

pub(crate) fn vox_config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(home).join(".config").join("vox");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn device_identifier_path() -> PathBuf {
    vox_config_dir().join("device_identifier")
}

/// A stable id for this install, persisted locally (mirrors how tasks are
/// cached under the same `~/.config/vox` directory).
fn local_device_identifier() -> String {
    let path = device_identifier_path();
    if let Ok(existing) = std::fs::read_to_string(&path) {
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    let _ = std::fs::write(&path, &id);
    id
}

fn device_label() -> String {
    std::process::Command::new("scutil")
        .args(["--get", "ComputerName"])
        .output()
        .ok()
        .and_then(|out| {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if name.is_empty() {
                None
            } else {
                Some(name)
            }
        })
        .unwrap_or_else(|| "Mac".to_string())
}

async fn register_device(
    api_url: &str,
    vox_token: &str,
    device_identifier: &str,
    execution_consent: bool,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/v1/devices", api_url.trim_end_matches('/'));
    let body = json!({
        "device_identifier": device_identifier,
        "platform": format!("macos-{}", std::env::consts::ARCH),
        "label": device_label(),
        "execution_consent": execution_consent,
    });
    let resp = client
        .post(&url)
        .header("authorization", format!("Bearer {vox_token}"))
        .json(&body)
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("device registration failed: {}", resp.status()));
    }
    resp.json::<RegisterDeviceResponse>()
        .await
        .map(|r| r.id)
        .map_err(|e| e.to_string())
}

fn socket_url(api_url: &str, device_id: &str) -> String {
    let clean = api_url.trim_end_matches('/');
    let base = if let Some(rest) = clean.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = clean.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        format!("ws://{clean}")
    };
    format!("{base}/v1/devices/{device_id}/socket")
}

/// The set of frame `type`s Vox Core is allowed to send over the device
/// socket. The wire format is still a bare JSON string — this only makes the
/// desktop side's handling of it type-safe instead of stringly-typed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FrameType {
    OpenShell,
    RunCommand,
    GuiAction,
}

impl std::str::FromStr for FrameType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "open_shell" => Ok(Self::OpenShell),
            "run_command" => Ok(Self::RunCommand),
            "gui_action" => Ok(Self::GuiAction),
            _ => Err(()),
        }
    }
}

async fn handle_frame(app: &AppHandle, terminal: &TerminalManager, frame: Value) -> Value {
    let id = frame.get("id").cloned().unwrap_or(Value::Null);
    let kind = frame.get("type").and_then(Value::as_str).unwrap_or("");

    let Ok(frame_type) = kind.parse::<FrameType>() else {
        eprintln!("Vox device link: unrecognized frame type: {kind:?}");
        return json!({ "id": id, "ok": false, "error": format!("unrecognized frame type: {kind}") });
    };

    match frame_type {
        FrameType::OpenShell => {
            emit_local_event(app, "system", "Vox requested interactive terminal shell");
            let terminal = terminal.clone();
            let result = tokio::task::spawn_blocking(move || terminal.open_shell()).await;
            match result {
                Ok(Ok(())) => {
                    emit_local_event(app, "status", "Terminal session ready on MacBook");
                    json!({ "id": id, "ok": true })
                }
                Ok(Err(err)) => {
                    emit_local_event(app, "error", &format!("Failed to open shell: {err}"));
                    json!({ "id": id, "ok": false, "error": err })
                }
                Err(err) => {
                    emit_local_event(app, "error", &format!("Shell spawn error: {err}"));
                    json!({ "id": id, "ok": false, "error": err.to_string() })
                }
            }
        }
        FrameType::RunCommand => {
            let command = frame
                .get("command")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            emit_local_event(app, "command", &format!("$ {command}"));
            emit_local_event(app, "system", "Executing on MacBook...");
            let terminal = terminal.clone();
            let logged = command.clone();
            let app_clone = app.clone();
            let result = tokio::task::spawn_blocking(move || terminal.run_command(&command)).await;
            let response = match result {
                Ok(Ok((output, exit_code))) => {
                    for line in output.lines() {
                        let trimmed = line.trim_end();
                        if !trimmed.is_empty() {
                            emit_local_event(&app_clone, "output", trimmed);
                        }
                    }
                    emit_local_event(&app_clone, "success", "Vox reading command output");
                    json!({ "id": id, "ok": true, "output": output, "exit_code": exit_code })
                }
                Ok(Err(err)) => {
                    emit_local_event(&app_clone, "error", &format!("Command failed: {err}"));
                    json!({ "id": id, "ok": false, "error": err })
                }
                Err(err) => {
                    emit_local_event(&app_clone, "error", &format!("Execution error: {err}"));
                    json!({ "id": id, "ok": false, "error": err.to_string() })
                }
            };
            let outcome = if response["ok"] == true { "ran" } else { "failed" };
            log_remote_command(&logged, outcome);
            response
        }
        FrameType::GuiAction => {
            let command = frame
                .get("command")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            emit_local_event(app, "command", &format!("gui: {command}"));
            let logged = command.clone();
            let app_clone = app.clone();
            let result = tokio::task::spawn_blocking(move || vox_desktop_control::execute(&command)).await;
            let response = match result {
                Ok(Ok(vox_desktop_control::GuiOutcome::Done(outcome))) => {
                    emit_local_event(&app_clone, "success", &outcome);
                    json!({ "id": id, "ok": true, "output": outcome })
                }
                Ok(Ok(vox_desktop_control::GuiOutcome::NeedsFallback(candidates))) => {
                    emit_local_event(
                        &app_clone,
                        "system",
                        &format!("no local match, {} on-screen candidates need a model decision", candidates.len()),
                    );
                    json!({ "id": id, "ok": false, "needs_llm_fallback": true, "candidates": candidates })
                }
                Ok(Err(err)) => {
                    emit_local_event(&app_clone, "error", &format!("GUI action failed: {err}"));
                    json!({ "id": id, "ok": false, "error": err })
                }
                Err(err) => {
                    emit_local_event(&app_clone, "error", &format!("GUI execution error: {err}"));
                    json!({ "id": id, "ok": false, "error": err.to_string() })
                }
            };
            let outcome = if response["ok"] == true { "ran" } else { "failed" };
            log_remote_command(&format!("gui: {logged}"), outcome);
            response
        }
    }
}

async fn connect_and_serve(
    app: &AppHandle,
    api_url: &str,
    vox_token: &str,
    device_id: &str,
    terminal: &TerminalManager,
    link: &DeviceLinkState,
    consent: &mut watch::Receiver<bool>,
) -> Result<(), String> {
    emit_local_event(app, "system", "Connecting to Vox Core bridge...");
    let url = socket_url(api_url, device_id);
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("invalid device socket url: {e}"))?;
    let header_value = HeaderValue::from_str(&format!("Bearer {vox_token}"))
        .map_err(|e| format!("invalid auth header: {e}"))?;
    request.headers_mut().insert("authorization", header_value);

    let (ws_stream, _) = connect_async(request)
        .await
        .map_err(|e| format!("device socket connect failed: {e}"))?;
    link.0.store(LINK_CONNECTED, Ordering::SeqCst);
    emit_local_event(app, "status", "Device bridge connected — remote control ready");
    let (mut sender, mut receiver) = ws_stream.split();

    loop {
        let message = tokio::select! {
            message = receiver.next() => message,
            // Turning remote control off closes the link immediately.
            _ = async { consent.wait_for(|enabled| !enabled).await.map(drop) } => {
                let _ = sender.close().await;
                emit_local_event(app, "status", "Remote control disabled by user");
                return Ok(());
            }
        };
        let Some(message) = message else { break };
        let message = message.map_err(|e| e.to_string())?;
        let Message::Text(text) = message else {
            continue;
        };
        let Ok(frame) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let response = handle_frame(app, terminal, frame).await;
        if sender
            .send(Message::Text(response.to_string().into()))
            .await
            .is_err()
        {
            break;
        }
    }

    emit_local_event(app, "status", "Device bridge socket disconnected");
    Ok(())
}

/// Runs forever: while signed in with remote control enabled, registers this
/// device (an idempotent upsert, so a different signed-in account or a
/// consent change is picked up) and keeps a live socket to Core open so it
/// can receive terminal commands. Reconnects on any drop.
// ponytail: fixed retry delay, no exponential backoff — add if reconnect
// storms against a struggling Core ever become a real problem.
pub async fn run_supervisor(app: AppHandle) {
    let terminal = TerminalManager::default();
    let device_identifier = local_device_identifier();
    let mut remote_control = app.state::<RemoteControl>().0.subscribe();

    loop {
        let link = app.state::<DeviceLinkState>();
        let auth = app.state::<AuthManager>();
        if let Err(err) = auth.refresh_if_expiring().await {
            eprintln!("Vox session refresh failed: {err}");
        }
        let Some(session) = auth.current_session() else {
            link.0.store(LINK_DISCONNECTED, Ordering::SeqCst);
            tokio::time::sleep(RETRY_DELAY).await;
            continue;
        };
        let api_url = auth.config().api_url.clone();

        let remote_enabled = *remote_control.borrow_and_update();
        if !remote_enabled {
            link.0.store(LINK_DISABLED, Ordering::SeqCst);
            // Tell Core consent is withdrawn, then wait for it to be re-enabled.
            let _ = register_device(&api_url, &session.vox_token, &device_identifier, false).await;
            emit_local_event(&app, "status", "Device bridge currently disabled");
            let _ = remote_control.wait_for(|enabled| *enabled).await;
            continue;
        }

        link.0.store(LINK_CONNECTING, Ordering::SeqCst);
        let device_id = match register_device(
            &api_url,
            &session.vox_token,
            &device_identifier,
            remote_enabled,
        )
        .await
        {
            Ok(id) => id,
            Err(err) => {
                eprintln!("Vox device registration failed: {err}");
                link.0.store(LINK_DISCONNECTED, Ordering::SeqCst);
                tokio::time::sleep(RETRY_DELAY).await;
                continue;
            }
        };

        if let Err(err) = connect_and_serve(
            &app,
            &api_url,
            &session.vox_token,
            &device_id,
            &terminal,
            link.inner(),
            &mut remote_control,
        )
        .await
        {
            eprintln!("Vox device socket disconnected: {err}");
        }
        link.0.store(LINK_DISCONNECTED, Ordering::SeqCst);
        let still_enabled = *remote_control.borrow();
        if still_enabled {
            tokio::time::sleep(RETRY_DELAY).await;
        }
    }
}
