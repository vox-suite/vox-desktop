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
    let session_started = Instant::now();
    voxlog!("=== voice session starting === platform=desktop v{}", env!("CARGO_PKG_VERSION"));

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

    let connect_started = Instant::now();
    let (ws_stream, _) = match connect_async(request).await {
        Ok(conn) => conn,
        Err(tokio_tungstenite::tungstenite::Error::Http(response))
            if response.status() == 401 =>
        {
            let msg = "Your session expired — please sign in again.".to_string();
            voxlog!("connect failed: 401 expired session after {}ms", connect_started.elapsed().as_millis());
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
        Err(e) => {
            let msg = format!("Failed to connect to Vox Core voice socket: {e}");
            voxlog!("connect failed after {}ms: {e}", connect_started.elapsed().as_millis());
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    voxlog!("connected to voice socket: ws_connect_ms={}", connect_started.elapsed().as_millis());

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // 2. Start audio capture (16kHz mono PCM) & playback engine
    let (mic_tx, mut mic_rx) = mpsc::unbounded_channel::<Vec<f32>>();

    let engine_started = Instant::now();
    let audio_engine = match AudioEngine::start(mic_tx, mic_level) {
        Ok(engine) => Arc::new(engine),
        Err(e) => {
            let msg = format!("Audio engine start failed: {e}");
            voxlog!("audio engine start failed: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    voxlog!(
        "audio engine started: engine_start_ms={} since_session_start_ms={}",
        engine_started.elapsed().as_millis(),
        session_started.elapsed().as_millis()
    );

    is_running.store(true, Ordering::SeqCst);
    let _ = ready_tx.send(Ok(()));
    let _ = app.emit("vox-voice-status", "active");

    let mut speech_buffer: Vec<f32> = Vec::with_capacity(16000 * 5); // 5 sec initial cap
    let mut is_in_speech = false;
    let mut last_speech_time = Instant::now();
    let speech_threshold = 0.015f32; // RMS voice activity threshold
    let silence_timeout = Duration::from_millis(650);
    let mut current_turn_id: Option<String> = None;

    const INTERRUPT_DEBOUNCE_CHUNKS: u32 = 4;
    let mut consecutive_loud_chunks: u32 = 0;
    const ECHO_THRESHOLD: f32 = 0.03;
    const ECHO_TAIL: Duration = Duration::from_millis(300);
    let mut last_playing_at = Instant::now() - ECHO_TAIL;

    let mut ping_interval = tokio::time::interval(Duration::from_secs(15));
    ping_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    // For jitter diagnostics: time between consecutive TTS audio frames
    // arriving from the server, and how many mic buffer sends racked up.
    let mut last_audio_frame_at: Option<Instant> = None;

    // Latency tracking. `turn_sent_at` is when the last utterance was handed to
    // the socket; the greeting is timed from session start.
    let mut turn_sent_at: Option<Instant> = None;
    let mut awaiting_first_audio = false;
    let mut greeting_pending = true;
    let mut awaiting_first_delta = false;
    let mut turn_frames: u32 = 0;
    let mut turn_bytes: usize = 0;
    let mut max_frame_gap_ms: u128 = 0;

    // Mic quality window, logged on every ping tick (~15s).
    let mut mic_chunks: u32 = 0;
    let mut mic_rms_sum: f32 = 0.0;
    let mut mic_rms_peak: f32 = 0.0;
    let mut mic_clipped_chunks: u32 = 0;
    let mut barge_ins: u32 = 0;
    let mut utterances: u32 = 0;
    let mut dropped_short: u32 = 0;

    loop {
        tokio::select! {
            _ = &mut stop_rx => {
                let _ = ws_sender.close().await;
                break;
            }
            _ = ping_interval.tick() => {
                let ping = serde_json::to_string(&VoiceClientMessage::Ping).unwrap_or_default();
                let _ = ws_sender.send(Message::text(ping)).await;

                voxlog!(
                    "MIC STATS ~15s: chunks={} rms_avg={:.4} rms_peak={:.4} clipped_chunks={} utterances={} dropped_short={} barge_ins={} queued_playback_ms={:.0}",
                    mic_chunks,
                    mic_rms_sum / mic_chunks.max(1) as f32,
                    mic_rms_peak,
                    mic_clipped_chunks,
                    utterances,
                    dropped_short,
                    barge_ins,
                    audio_engine.queued_playback_ms()
                );
                mic_chunks = 0;
                mic_rms_sum = 0.0;
                mic_rms_peak = 0.0;
                mic_clipped_chunks = 0;
                let (flush_url, flush_token) = (api_url.clone(), session.vox_token.clone());
                tokio::spawn(async move { crate::filelog::flush_remote(&flush_url, &flush_token).await });

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

                mic_chunks += 1;
                mic_rms_sum += rms;
                mic_rms_peak = mic_rms_peak.max(rms);
                if samples_16k.iter().any(|s| s.abs() >= 0.99) {
                    mic_clipped_chunks += 1;
                }

                let playing = audio_engine.is_playing();
                if playing {
                    last_playing_at = Instant::now();
                }
                let threshold = if last_playing_at.elapsed() < ECHO_TAIL { ECHO_THRESHOLD } else { speech_threshold };

                if rms >= threshold {
                    consecutive_loud_chunks += 1;

                    if consecutive_loud_chunks >= INTERRUPT_DEBOUNCE_CHUNKS && playing {
                        barge_ins += 1;
                        voxlog!("barge-in: user spoke over playback (rms={rms:.4}), interrupting");
                        audio_engine.clear_playback();
                        last_audio_frame_at = None;
                        let interrupt_msg = serde_json::to_string(&VoiceClientMessage::Interrupt).unwrap_or_default();
                        let _ = ws_sender.send(Message::text(interrupt_msg)).await;
                        let _ = app.emit("vox-voice-interrupted", ());
                    }

                    speech_buffer.extend_from_slice(&samples_16k);
                    last_speech_time = Instant::now();
                    is_in_speech = true;
                } else {
                    consecutive_loud_chunks = 0;
                    if is_in_speech {
                    speech_buffer.extend_from_slice(&samples_16k);
                    if last_speech_time.elapsed() >= silence_timeout {
                        is_in_speech = false;
                        let buffer_len = speech_buffer.len();

                        // Send if utterance is at least 350ms (5600 samples at 16kHz)
                        if buffer_len >= 5600 {
                            utterances += 1;
                            let utterance = std::mem::take(&mut speech_buffer);
                            let pcm_bytes = pcm_f32_to_i16_bytes(&utterance);
                            voxlog!(
                                "sending utterance: {} samples ({} ms), {} bytes",
                                utterance.len(),
                                utterance.len() * 1000 / 16000,
                                pcm_bytes.len()
                            );
                            let _ = ws_sender.send(Message::Binary(pcm_bytes.into())).await;
                            turn_sent_at = Some(Instant::now());
                            awaiting_first_audio = true;
                            awaiting_first_delta = true;
                            turn_frames = 0;
                            turn_bytes = 0;
                            max_frame_gap_ms = 0;

                            let turn_msg = VoiceClientMessage::Turn { conversation_id: None };
                            if let Ok(json) = serde_json::to_string(&turn_msg) {
                                let _ = ws_sender.send(Message::text(json)).await;
                            }
                        } else {
                            dropped_short += 1;
                            voxlog!("utterance too short ({} samples), dropped", buffer_len);
                            speech_buffer.clear();
                        }
                    }
                    }
                }
            }
            inbound = ws_receiver.next() => {
                match inbound {
                    Some(Ok(Message::Binary(bytes))) => {
                        // High-fidelity MP3 frame from ElevenLabs!
                        let gap_ms = last_audio_frame_at.map(|t| t.elapsed().as_millis());
                        if let Some(gap) = gap_ms {
                            max_frame_gap_ms = max_frame_gap_ms.max(gap);
                        }
                        turn_frames += 1;
                        turn_bytes += bytes.len();
                        if greeting_pending {
                            greeting_pending = false;
                            voxlog!("LATENCY greeting_first_audio_ms={} (since session start)", session_started.elapsed().as_millis());
                        } else if awaiting_first_audio {
                            awaiting_first_audio = false;
                            if let Some(t) = turn_sent_at {
                                voxlog!("LATENCY time_to_first_audio_ms={} (utterance sent -> first audio frame)", t.elapsed().as_millis());
                            }
                        }
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
                                    if let Some(t) = turn_sent_at {
                                        voxlog!("LATENCY transcript_ms={} (utterance sent -> transcript)", t.elapsed().as_millis());
                                    }
                                    voxlog!("user transcript: {text:?}");
                                }
                                VoiceServerMessage::TextDelta { turn_id, delta } => {
                                    if current_turn_id.as_deref() == Some(turn_id.as_str()) {
                                        if awaiting_first_delta {
                                            awaiting_first_delta = false;
                                            if let Some(t) = turn_sent_at {
                                                voxlog!("LATENCY first_text_delta_ms={} (utterance sent -> first text)", t.elapsed().as_millis());
                                            }
                                        }
                                        let _ = app.emit("vox-voice-delta", delta);
                                    }
                                }
                                VoiceServerMessage::Thinking { turn_id } => {
                                    current_turn_id = Some(turn_id);
                                    let _ = app.emit("vox-voice-thinking", ());
                                }
                                VoiceServerMessage::Done { turn_id } => {
                                    voxlog!(
                                        "turn done: {turn_id} frames={turn_frames} bytes={turn_bytes} max_frame_gap_ms={max_frame_gap_ms} total_ms={:?} underrun_samples_pending={}",
                                        turn_sent_at.map(|t| t.elapsed().as_millis()),
                                        audio_engine.take_underrun_samples()
                                    );
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
                    Some(Ok(Message::Close(frame))) => {
                        voxlog!("voice socket closed by server: {frame:?}");
                        break;
                    }
                    None => {
                        voxlog!("voice socket stream ended");
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
    voxlog!(
        "=== voice session ended === duration_ms={} utterances={utterances} barge_ins={barge_ins}",
        session_started.elapsed().as_millis()
    );
    crate::filelog::flush_remote(&api_url, &session.vox_token).await;
    Ok(())
}
