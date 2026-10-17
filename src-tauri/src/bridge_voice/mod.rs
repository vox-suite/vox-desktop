mod codec;
use crate::{
    app_control::AppControlState,
    audio::{AudioEngine, MicSender},
    auth::AuthManager,
    session_store::StoredSession,
};
use cpal::traits::{DeviceTrait, HostTrait};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Default)]
pub struct BridgeVoiceState {
    muted: AtomicBool,
    microphone: Mutex<Option<String>>,
    microphone_switch:
        Mutex<Option<mpsc::Sender<(Option<String>, oneshot::Sender<Result<(), String>>)>>>,
    text: Mutex<Option<mpsc::Sender<String>>>,
}
#[tauri::command]
pub fn list_microphones() -> Result<Vec<String>, String> {
    let devices = cpal::default_host()
        .input_devices()
        .map_err(|e| e.to_string())?;
    Ok(devices.filter_map(|device| device.name().ok()).collect())
}

#[tauri::command]
pub async fn select_microphone(
    state: State<'_, BridgeVoiceState>,
    name: Option<String>,
) -> Result<(), String> {
    if let Some(ref name) = name {
        if !list_microphones()?.contains(name) {
            return Err("Microphone is no longer available".into());
        }
    }
    let sender = state
        .microphone_switch
        .lock()
        .map_err(|_| "Voice unavailable")?
        .clone();
    if let Some(sender) = sender {
        let (reply, response) = oneshot::channel();
        sender
            .send((name.clone(), reply))
            .await
            .map_err(|_| "Session ended")?;
        response.await.map_err(|_| "Session ended")??;
    }
    *state.microphone.lock().map_err(|_| "Voice unavailable")? = name;
    Ok(())
}

#[tauri::command]
pub fn set_call_muted(state: State<'_, BridgeVoiceState>, muted: bool) {
    state.muted.store(muted, Ordering::SeqCst);
}
#[tauri::command]
pub async fn send_desktop_text(
    state: State<'_, BridgeVoiceState>,
    text: String,
) -> Result<(), String> {
    if text.trim().is_empty() || text.len() > 8192 {
        return Err("Enter a shorter message".into());
    }
    let sender = state
        .text
        .lock()
        .map_err(|_| "Voice unavailable")?
        .clone()
        .ok_or("Start Talk to Vox before sending a message")?;
    sender.send(text).await.map_err(|_| "Session ended".into())
}
#[derive(Deserialize)]
struct Bootstrap {
    session_id: String,
    ticket: String,
}
#[allow(clippy::too_many_arguments)]
pub async fn run_session_loop(
    app: AppHandle,
    api_url: String,
    session: StoredSession,
    is_running: Arc<AtomicBool>,
    ready_tx: oneshot::Sender<Result<(), String>>,
    mut stop_rx: oneshot::Receiver<()>,
    mic_level: Arc<AtomicU32>,
    vox_playing: Arc<AtomicBool>,
) -> Result<(), String> {
    let session_started = std::time::Instant::now();
    let mut ready = Some(ready_tx);
    let result=async {
        let device_id=app.state::<AppControlState>().device_id();
        let bootstrap:reqwest::Response=reqwest::Client::new().post(format!("{}/v1/me/desktop-voice/sessions",api_url.trim_end_matches('/'))).bearer_auth(&session.vox_token).json(&json!({"device_id":device_id})).timeout(Duration::from_secs(10)).send().await.map_err(|_|"Vox could not start a voice session")?;
        if !bootstrap.status().is_success(){return Err(format!("Vox voice unavailable ({})",bootstrap.status()));}
        let bootstrap:Bootstrap=bootstrap.json().await.map_err(|_|"Invalid voice session")?;
        let bootstrap_received_ms=session_started.elapsed().as_millis() as u64;
        let bridge=app.state::<AuthManager>().config().bridge_url.trim_end_matches('/').to_owned();
        let url=format!("{}/bridge/desktop/voice",bridge.replacen("https://","wss://",1).replacen("http://","ws://",1));
        let(socket,_)=tokio::time::timeout(Duration::from_secs(10),connect_async(url)).await.map_err(|_|"Voice connection timed out")?.map_err(|_|"Could not connect to Vox Bridge")?;
        let socket_connected_ms=session_started.elapsed().as_millis() as u64;
        let(mut sender,mut receiver)=socket.split();
        send_frame(&mut sender,Message::Text(json!({"type":"start","ticket":bootstrap.ticket,"client_metrics":true}).to_string().into())).await.map_err(|_|"Voice connection closed")?;
        let first=tokio::time::timeout(Duration::from_secs(15),receiver.next()).await.map_err(|_|"Voice session timed out")?;
        match first {Some(Ok(Message::Text(raw)))=>{let frame:Value=serde_json::from_str(&raw).map_err(|_|"Invalid voice handshake")?;if frame["type"]!="connected" || frame["audio_format"]!="mulaw" || frame["sample_rate"]!=8000 || frame["input_mode"]!="stream"{return Err("Voice session rejected".into());}},_=>return Err("Voice session rejected".into())}
        if app.state::<AuthManager>().current_session().as_ref().map(|s|&s.user_id)!=Some(&session.user_id){return Err("Signed out".into());}
        let(mic_tx,mut mic_rx)=mpsc::channel(32);
        let capture_overflow=Arc::new(AtomicBool::new(false));
        let selected_microphone=app.state::<BridgeVoiceState>().microphone.lock().unwrap().clone();
        let mut audio_started_ms = session_started.elapsed().as_millis() as u64;
        let mut engine=AudioEngine::start_with_device(MicSender::Bounded(mic_tx.clone(),capture_overflow.clone()),mic_level.clone(),selected_microphone).map_err(|e|format!("Microphone unavailable: {e}"))?;
        let (microphone_tx, mut microphone_rx)=mpsc::channel::<(Option<String>, oneshot::Sender<Result<(), String>>)>(1);
        *app.state::<BridgeVoiceState>().microphone_switch.lock().unwrap()=Some(microphone_tx);
        let(text_tx,mut text_rx)=mpsc::channel(8);
        {let state=app.state::<BridgeVoiceState>();state.muted.store(false,Ordering::SeqCst);*state.text.lock().unwrap()=Some(text_tx);}
        is_running.store(true,Ordering::SeqCst);
        let _=app.emit("vox-voice-status","active");
        let _=app.emit("vox-voice-session",&bootstrap.session_id);
        if let Some(tx)=ready.take(){let _=tx.send(Ok(()));}
        for (stage,elapsed_ms) in [("bootstrap_received",bootstrap_received_ms),("socket_connected",socket_connected_ms),("microphone_ready",session_started.elapsed().as_millis() as u64)] {
            send_frame(&mut sender,Message::Text(json!({"type":"client_metric","stage":stage,"elapsed_ms":elapsed_ms,"generation":0,"buffered_ms":0}).to_string().into())).await?;
        }
        send_frame(&mut sender,Message::Text(json!({"type":"client_metric","stage":"session_ready","elapsed_ms":session_started.elapsed().as_millis() as u64,"generation":0,"buffered_ms":0}).to_string().into())).await?;
        let mut generation = 1u64;
        let mut received_audio = false;
        let mut reported_playback = false;
        let mut auth_tick=tokio::time::interval(Duration::from_secs(1));
        let mut tick=tokio::time::interval(Duration::from_millis(20));
        let mut input=VecDeque::<f32>::new();let mut frames=VecDeque::<u8>::new();let mut marks=VecDeque::<String>::new();
        loop {
            tokio::select! {
                _=auth_tick.tick()=>{if app.state::<AuthManager>().current_session().as_ref().map(|s|&s.user_id)!=Some(&session.user_id){break;}},
                _=&mut stop_rx=>{let _=send_frame(&mut sender,Message::Text(json!({"type":"stop"}).to_string().into())).await;break;},
                selection=microphone_rx.recv()=>{
                    if let Some((name, reply))=selection {
                        let switched_at_ms=session_started.elapsed().as_millis() as u64;
                        let result=AudioEngine::start_with_device(MicSender::Bounded(mic_tx.clone(),capture_overflow.clone()),mic_level.clone(),name);
                        while mic_rx.try_recv().is_ok() {}
                        capture_overflow.store(false,Ordering::Relaxed);
                        match result {
                            Ok(next)=>{engine=next;audio_started_ms=switched_at_ms;reported_playback=false;input.clear();frames.clear();while mic_rx.try_recv().is_ok() {} mic_level.store(0f32.to_bits(),Ordering::Relaxed);let _=reply.send(Ok(()));},
                            Err(error)=>{let _=reply.send(Err(error));}
                        }
                    }
                },
                samples=mic_rx.recv()=>{
                    let Some(samples)=samples else{break};
                    if capture_overflow.load(Ordering::Relaxed){return Err("Voice input stalled; reconnect".into());}
                    if app.state::<BridgeVoiceState>().muted.load(Ordering::SeqCst){input.clear();frames.clear();continue;}
                    if frames.len()>8000 || input.len()+samples.len()>16000 {return Err("Voice input stalled; reconnect".into());}
                    input.extend(samples);
                    while input.len()>=2{let a=input.pop_front().unwrap();let b=input.pop_front().unwrap();frames.push_back(codec::encode((a+b)*0.5));}
                    while frames.len()>=160 {let bytes:Vec<u8>=frames.drain(..160).collect();send_frame(&mut sender,Message::Binary(bytes.into())).await.map_err(|_|"Voice disconnected")?;}
                },
                text=text_rx.recv()=>{if let Some(text)=text{send_frame(&mut sender,Message::Text(json!({"type":"text","text":text}).to_string().into())).await.map_err(|_|"Voice disconnected")?;}},
                frame=receiver.next()=>match frame {
                    Some(Ok(Message::Binary(bytes)))=>{
                        if bytes.len()>8192 || engine.queued_playback_ms()>10_000.0{return Err("Voice playback stalled; reconnect".into());}
                        let first_received_ms = (!received_audio).then(|| session_started.elapsed().as_millis() as u64);
                        received_audio = true;
                        let pcm:Vec<f32>=bytes.iter().map(|&b|codec::decode(b)).collect();engine.enqueue_pcm(&pcm,8000,engine.playback_epoch());
                        if let Some(elapsed_ms) = first_received_ms {
                            send_frame(&mut sender,Message::Text(json!({"type":"client_metric","stage":"first_audio_received","elapsed_ms":elapsed_ms,"generation":generation,"buffered_ms":engine.queued_playback_ms() as u64}).to_string().into())).await?;
                        }
                    },
                    Some(Ok(Message::Text(raw)))=>{
                        let frame:Value=serde_json::from_str(&raw).map_err(|_|"Invalid voice message")?;
                        match frame["type"].as_str(){Some("audio_start")=>{let next=frame["generation"].as_u64().unwrap_or(generation);if next!=generation{engine.reset_playback_measurement();reported_playback=false;}generation=next;received_audio=false;},Some("clear")=>{engine.clear_playback();marks.clear();generation=frame["generation"].as_u64().unwrap_or(generation);received_audio=false;reported_playback=false;},Some("mark")=>{if let Some(name)=frame["name"].as_str(){marks.push_back(name.into());}},Some("error")=>return Err("Voice session failed".into()),_=>{}}
                    },
                    Some(Ok(Message::Ping(bytes)))=>{send_frame(&mut sender,Message::Pong(bytes)).await.map_err(|_|"Voice disconnected")?;},
                    Some(Ok(Message::Close(_)))|None=>break,Some(Err(_))=>return Err("Voice disconnected".into()),_=>{}
                },
                _=tick.tick()=>{
                    if !reported_playback {
                        if let Some(elapsed) = engine.playback_started_after_ms() {
                            reported_playback = true;
                            send_frame(&mut sender,Message::Text(json!({"type":"client_metric","stage":"first_playback_started","elapsed_ms":audio_started_ms+elapsed,"generation":generation,"buffered_ms":engine.queued_playback_ms() as u64}).to_string().into())).await?;
                        }
                    }
                    let playing=engine.is_playing();vox_playing.store(playing,Ordering::Relaxed);
                    if !playing {while let Some(name)=marks.pop_front(){send_frame(&mut sender,Message::Text(json!({"type":"playback_finished","name":name}).to_string().into())).await.map_err(|_|"Voice disconnected")?;}}
                }
            }
        }
        engine.clear_playback();let _=tokio::time::timeout(Duration::from_secs(1),sender.close()).await;Ok(())
    }.await;
    is_running.store(false, Ordering::SeqCst);
    vox_playing.store(false, Ordering::SeqCst);
    *app.state::<BridgeVoiceState>().text.lock().unwrap() = None;
    *app.state::<BridgeVoiceState>()
        .microphone_switch
        .lock()
        .unwrap() = None;
    if let Some(tx) = ready.take() {
        let _ = tx.send(result.clone());
    }
    let _ = app.emit("vox-voice-status", "ended");
    if let Err(error) = &result {
        let _ = app.emit("vox-voice-error", error);
    }
    result
}

async fn send_frame<S>(sender: &mut S, message: Message) -> Result<(), String>
where
    S: futures_util::Sink<Message> + Unpin,
{
    tokio::time::timeout(Duration::from_secs(1), sender.send(message))
        .await
        .map_err(|_| "Voice connection stalled".to_string())?
        .map_err(|_| "Voice disconnected".to_string())
}
