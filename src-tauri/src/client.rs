/**
 * Real-time direct voice session between vox-desktop and vox-core.
 *
 * Runs local Whisper STT on mic audio, directly streams transcribed user turns
 * to vox-core over WebSocket, and plays back pristine 44.1kHz ElevenLabs MP3 chunks.
 */
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

use crate::audio::AudioEngine;
use crate::local_stt::get_stt_engine;
use crate::session_store::StoredSession;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VoiceClientMessage {
    Turn {
        text: String,
        #[serde(default)]
        conversation_id: Option<String>,
        #[serde(default)]
        interrupted: bool,
    },
    Interrupt,
    Ping,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VoiceServerMessage {
    Connected {
        format: String,
        sample_rate: u32,
    },
    Thinking {
        turn_id: String,
    },
    TextDelta {
        turn_id: String,
        delta: String,
    },
    Done {
        turn_id: String,
    },
    Interrupted,
    Error {
        message: String,
    },
    Pong,
}

pub async fn run_session_loop(
    app: AppHandle,
    api_url: String,
    session: StoredSession,
    is_running: Arc<AtomicBool>,
    ready_tx: oneshot::Sender<Result<(), String>>,
    mut stop_rx: oneshot::Receiver<()>,
    mic_level: Arc<AtomicU32>,
) -> Result<(), String> {
    // 1. Ensure local Whisper STT model is present, downloading if needed
    if !crate::local_stt::is_stt_model_downloaded() {
        crate::device_link::emit_local_event(&app, "status", "Downloading speech model (~75MB)...");
        if let Err(e) = crate::local_stt::download_stt_model(app.clone()).await {
            let msg = format!("Failed to download speech recognition model: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    }

    let stt = match tokio::task::spawn_blocking(get_stt_engine).await {
        Ok(Ok(engine)) => engine,
        Ok(Err(e)) => {
            let msg = format!("Local STT initialization failed: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
        Err(e) => {
            let msg = format!("Local STT initialization task panicked: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };

    // 2. Connect directly to vox-core voice WebSocket endpoint
    let clean_api = api_url.trim_end_matches('/');
    let ws_base = if let Some(rest) = clean_api.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = clean_api.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        format!("ws://{clean_api}")
    };

    let ws_url = format!("{ws_base}/v1/me/voice/socket");
    let mut request = match ws_url.into_client_request() {
        Ok(req) => req,
        Err(e) => {
            let msg = format!("Invalid voice socket URL: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };

    let auth_header = match HeaderValue::from_str(&format!("Bearer {}", session.vox_token)) {
        Ok(h) => h,
        Err(e) => {
            let msg = format!("Invalid auth header: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    request.headers_mut().insert("authorization", auth_header);

    let (ws_stream, _) = match connect_async(request).await {
        Ok(conn) => conn,
        Err(tokio_tungstenite::tungstenite::Error::Http(response))
            if response.status() == 401 =>
        {
            let msg = "Your session expired — please sign in again.".to_string();
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
        Err(e) => {
            let msg = format!("Failed to connect to Vox Core voice socket: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // 3. Start audio capture (16kHz mono PCM for Whisper) & playback engine
    let (mic_tx, mut mic_rx) = mpsc::unbounded_channel::<Vec<f32>>();

    let audio_engine = match AudioEngine::start(mic_tx, mic_level) {
        Ok(engine) => Arc::new(engine),
        Err(e) => {
            let msg = format!("Audio engine start failed: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };

    is_running.store(true, Ordering::SeqCst);
    let _ = ready_tx.send(Ok(()));
    let _ = app.emit("vox-voice-status", "active");

    let mut speech_buffer: Vec<f32> = Vec::with_capacity(16000 * 5); // 5 sec initial cap
    let mut is_in_speech = false;
    let mut last_speech_time = Instant::now();
    let speech_threshold = 0.015f32; // RMS voice activity threshold
    let silence_timeout = Duration::from_millis(650);
    let mut current_turn_id: Option<String> = None;

    let mut ping_interval = tokio::time::interval(Duration::from_secs(15));
    ping_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    let (transcript_tx, mut transcript_rx) = mpsc::unbounded_channel::<String>();

    loop {
        tokio::select! {
            _ = &mut stop_rx => {
                let _ = ws_sender.close().await;
                break;
            }
            _ = ping_interval.tick() => {
                let ping = serde_json::to_string(&VoiceClientMessage::Ping).unwrap_or_default();
                let _ = ws_sender.send(Message::text(ping)).await;
            }
            Some(samples_16k) = mic_rx.recv() => {
                let sum_sq: f32 = samples_16k.iter().map(|&s| s * s).sum();
                let rms = (sum_sq / samples_16k.len().max(1) as f32).sqrt();

                if rms >= speech_threshold {
                    // If user speaks while agent is playing speech, interrupt instantly!
                    if audio_engine.is_playing() {
                        audio_engine.clear_playback();
                        let interrupt_msg = serde_json::to_string(&VoiceClientMessage::Interrupt).unwrap_or_default();
                        let _ = ws_sender.send(Message::text(interrupt_msg)).await;
                        let _ = app.emit("vox-voice-interrupted", ());
                    }

                    speech_buffer.extend_from_slice(&samples_16k);
                    last_speech_time = Instant::now();
                    is_in_speech = true;
                } else if is_in_speech {
                    speech_buffer.extend_from_slice(&samples_16k);
                    if last_speech_time.elapsed() >= silence_timeout {
                        is_in_speech = false;
                        let buffer_len = speech_buffer.len();

                        // Transcribe if utterance is at least 350ms (5600 samples at 16kHz)
                        if buffer_len >= 5600 {
                            let buffer_to_transcribe = std::mem::take(&mut speech_buffer);
                            let stt_clone = stt.clone();
                            let transcript_tx = transcript_tx.clone();
                            let app_clone = app.clone();

                            // Transcribe off the select loop entirely so ending the call,
                            // pings, and inbound server frames aren't stalled by it.
                            tokio::spawn(async move {
                                let transcribed = tokio::task::spawn_blocking(move || {
                                    stt_clone.transcribe(&buffer_to_transcribe)
                                }).await;

                                match transcribed {
                                    Ok(Ok(text)) => {
                                        let trimmed = text.trim();
                                        if !trimmed.is_empty() {
                                            let _ = app_clone.emit("vox-voice-user-transcript", trimmed);
                                            let _ = transcript_tx.send(trimmed.to_string());
                                        }
                                    }
                                    Ok(Err(e)) => {
                                        eprintln!("Whisper transcription failed: {e}");
                                    }
                                    Err(join_err) => {
                                        eprintln!("Whisper transcription task panicked: {join_err}");
                                        let _ = app_clone.emit(
                                            "vox-voice-error",
                                            "Speech recognition failed unexpectedly",
                                        );
                                    }
                                }
                            });
                        } else {
                            speech_buffer.clear();
                        }
                    }
                }
            }
            Some(text) = transcript_rx.recv() => {
                let turn_msg = VoiceClientMessage::Turn {
                    text,
                    conversation_id: None,
                    interrupted: false,
                };
                if let Ok(json) = serde_json::to_string(&turn_msg) {
                    let _ = ws_sender.send(Message::text(json)).await;
                }
            }
            inbound = ws_receiver.next() => {
                match inbound {
                    Some(Ok(Message::Binary(bytes))) => {
                        // High-fidelity MP3 frame from ElevenLabs!
                        audio_engine.enqueue_mp3_chunk(&bytes);
                    }
                    Some(Ok(Message::Text(raw))) => {
                        if let Ok(msg) = serde_json::from_str::<VoiceServerMessage>(&raw) {
                            match msg {
                                VoiceServerMessage::TextDelta { turn_id, delta } => {
                                    if current_turn_id.as_deref() == Some(turn_id.as_str()) {
                                        let _ = app.emit("vox-voice-delta", delta);
                                    }
                                }
                                VoiceServerMessage::Thinking { turn_id } => {
                                    current_turn_id = Some(turn_id);
                                    let _ = app.emit("vox-voice-thinking", ());
                                }
                                VoiceServerMessage::Done { turn_id } => {
                                    let _ = app.emit("vox-voice-done", turn_id);
                                }
                                VoiceServerMessage::Interrupted => {
                                    current_turn_id = None;
                                    audio_engine.clear_playback();
                                    let _ = app.emit("vox-voice-interrupted", ());
                                }
                                VoiceServerMessage::Connected { format, sample_rate } => {
                                    eprintln!("Voice session connected to Core: format={format}, sample_rate={sample_rate}");
                                }
                                VoiceServerMessage::Error { message } => {
                                    eprintln!("Server error on voice stream: {message}");
                                    let _ = app.emit("vox-voice-error", message);
                                }
                                VoiceServerMessage::Pong => {}
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        let _ = ws_sender.send(Message::Pong(payload)).await;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(err)) => {
                        eprintln!("WebSocket error on voice session: {err}");
                        break;
                    }
                }
            }
        }
    }

    audio_engine.clear_playback();
    is_running.store(false, Ordering::SeqCst);
    let _ = app.emit("vox-voice-status", "idle");
    Ok(())
}
