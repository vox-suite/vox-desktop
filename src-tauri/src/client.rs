/**
 * Real-time direct voice session between vox-desktop and vox-core.
 *
 * Streams raw 16kHz mono mic PCM straight to vox-core over WebSocket --
 * transcription happens server-side -- and plays back pristine 44.1kHz
 * ElevenLabs MP3 chunks.
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
use crate::session_store::StoredSession;
use crate::voxlog;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VoiceClientMessage {
    /// Marks the audio sent as preceding binary frames as one complete
    /// utterance, ready for the server to transcribe and respond to.
    Turn {
        #[serde(default)]
        conversation_id: Option<String>,
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
    UserTranscript {
        turn_id: String,
        text: String,
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

/// Converts 16kHz mono f32 samples (in [-1, 1]) to the 16-bit PCM little-
/// endian byte layout vox-core's voice socket expects for binary audio frames.
fn pcm_f32_to_i16_bytes(samples: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for &s in samples {
        let clamped = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
        bytes.extend_from_slice(&clamped.to_le_bytes());
    }
    bytes
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
    voxlog!("=== voice session starting ===");

    // 1. Connect directly to vox-core voice WebSocket endpoint
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
            voxlog!("connect failed: 401 expired session");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
        Err(e) => {
            let msg = format!("Failed to connect to Vox Core voice socket: {e}");
            voxlog!("connect failed: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    voxlog!("connected to voice socket");

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // 2. Start audio capture (16kHz mono PCM) & playback engine
    let (mic_tx, mut mic_rx) = mpsc::unbounded_channel::<Vec<f32>>();

    let audio_engine = match AudioEngine::start(mic_tx, mic_level) {
        Ok(engine) => Arc::new(engine),
        Err(e) => {
            let msg = format!("Audio engine start failed: {e}");
            voxlog!("audio engine start failed: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    voxlog!("audio engine started");

    is_running.store(true, Ordering::SeqCst);
    let _ = ready_tx.send(Ok(()));
    let _ = app.emit("vox-voice-status", "active");

    let mut speech_buffer: Vec<f32> = Vec::with_capacity(16000 * 5); // 5 sec initial cap
    let mut is_in_speech = false;
    let mut last_speech_time = Instant::now();
    let speech_threshold = 0.015f32; // RMS voice activity threshold
    let silence_timeout = Duration::from_millis(650);
    let mut current_turn_id: Option<String> = None;

    // Debounce for barge-in: without echo cancellation, Vox's own speaker output
    // leaking into the mic reads as speech above `speech_threshold`, which would
    // otherwise self-interrupt playback the instant it starts. Require a short
    // run of consecutive loud mic chunks (genuine speech is sustained; leaked
    // echo of a single word usually isn't) before treating it as a real interrupt.
    const INTERRUPT_DEBOUNCE_CHUNKS: u32 = 4;
    let mut consecutive_loud_chunks: u32 = 0;

    let mut ping_interval = tokio::time::interval(Duration::from_secs(15));
    ping_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    // For jitter diagnostics: time between consecutive TTS audio frames
    // arriving from the server, and how many mic buffer sends racked up.
    let mut last_audio_frame_at: Option<Instant> = None;

    loop {
        tokio::select! {
            _ = &mut stop_rx => {
                let _ = ws_sender.close().await;
                break;
            }
            _ = ping_interval.tick() => {
                let ping = serde_json::to_string(&VoiceClientMessage::Ping).unwrap_or_default();
                let _ = ws_sender.send(Message::text(ping)).await;

                let underruns = audio_engine.take_underrun_samples();
                if underruns > 0 {
                    voxlog!(
                        "AUDIO UNDERRUN: {} silence-filled samples in the last ~15s (queue starved -- glitch/jitter)",
                        underruns
                    );
                }
            }
            Some(samples_16k) = mic_rx.recv() => {
                let sum_sq: f32 = samples_16k.iter().map(|&s| s * s).sum();
                let rms = (sum_sq / samples_16k.len().max(1) as f32).sqrt();

                if rms >= speech_threshold {
                    consecutive_loud_chunks += 1;

                    // If user speaks while agent is playing speech, interrupt --
                    // but only once the mic has picked up sustained sound, not a
                    // single chunk (which is usually Vox's own output leaking
                    // back through the speakers rather than real speech).
                    if consecutive_loud_chunks >= INTERRUPT_DEBOUNCE_CHUNKS && audio_engine.is_playing() {
                        voxlog!("barge-in: user spoke over playback, interrupting");
                        audio_engine.clear_playback();
                        last_audio_frame_at = None;
                        let interrupt_msg = serde_json::to_string(&VoiceClientMessage::Interrupt).unwrap_or_default();
                        let _ = ws_sender.send(Message::text(interrupt_msg)).await;
                        let _ = app.emit("vox-voice-interrupted", ());
                    }

                    speech_buffer.extend_from_slice(&samples_16k);
                    last_speech_time = Instant::now();
                    is_in_speech = true;
                } else if is_in_speech {
                    consecutive_loud_chunks = 0;
                    speech_buffer.extend_from_slice(&samples_16k);
                    if last_speech_time.elapsed() >= silence_timeout {
                        is_in_speech = false;
                        let buffer_len = speech_buffer.len();

                        // Send if utterance is at least 350ms (5600 samples at 16kHz)
                        if buffer_len >= 5600 {
                            let utterance = std::mem::take(&mut speech_buffer);
                            let pcm_bytes = pcm_f32_to_i16_bytes(&utterance);
                            voxlog!(
                                "sending utterance: {} samples ({} ms), {} bytes",
                                utterance.len(),
                                utterance.len() * 1000 / 16000,
                                pcm_bytes.len()
                            );
                            let _ = ws_sender.send(Message::Binary(pcm_bytes.into())).await;

                            let turn_msg = VoiceClientMessage::Turn { conversation_id: None };
                            if let Ok(json) = serde_json::to_string(&turn_msg) {
                                let _ = ws_sender.send(Message::text(json)).await;
                            }
                        } else {
                            speech_buffer.clear();
                        }
                    }
                }
            }
            inbound = ws_receiver.next() => {
                match inbound {
                    Some(Ok(Message::Binary(bytes))) => {
                        // High-fidelity MP3 frame from ElevenLabs!
                        let gap_ms = last_audio_frame_at.map(|t| t.elapsed().as_millis());
                        last_audio_frame_at = Some(Instant::now());
                        let queue_ms_before = audio_engine.queued_playback_ms();
                        let decode_started = Instant::now();
                        audio_engine.enqueue_mp3_chunk(&bytes);
                        voxlog!(
                            "mp3 frame: {} bytes, gap_since_last={:?}ms, decode_took={}us, queued_before={:.0}ms queued_after={:.0}ms",
                            bytes.len(),
                            gap_ms,
                            decode_started.elapsed().as_micros(),
                            queue_ms_before,
                            audio_engine.queued_playback_ms()
                        );
                    }
                    Some(Ok(Message::Text(raw))) => {
                        if let Ok(msg) = serde_json::from_str::<VoiceServerMessage>(&raw) {
                            match msg {
                                VoiceServerMessage::UserTranscript { turn_id: _, text } => {
                                    let _ = app.emit("vox-voice-user-transcript", &text);
                                    voxlog!("user transcript: {text:?}");
                                }
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
                                    voxlog!("turn done: {turn_id}");
                                    let _ = app.emit("vox-voice-done", turn_id);
                                }
                                VoiceServerMessage::Interrupted => {
                                    current_turn_id = None;
                                    audio_engine.clear_playback();
                                    last_audio_frame_at = None;
                                    voxlog!("playback interrupted");
                                    let _ = app.emit("vox-voice-interrupted", ());
                                }
                                VoiceServerMessage::Connected { format, sample_rate } => {
                                    voxlog!("voice session connected: format={format}, sample_rate={sample_rate}");
                                    eprintln!("Voice session connected to Core: format={format}, sample_rate={sample_rate}");
                                }
                                VoiceServerMessage::Error { message } => {
                                    voxlog!("server error: {message}");
                                    eprintln!("Server error on voice stream: {message}");
                                    let _ = app.emit("vox-voice-error", message);
                                }
                                VoiceServerMessage::Pong => {}
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        voxlog!("voice socket closed by server");
                        break;
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        let _ = ws_sender.send(Message::Pong(payload)).await;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(err)) => {
                        voxlog!("websocket error: {err}");
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
    voxlog!("=== voice session ended ===");
    Ok(())
}
