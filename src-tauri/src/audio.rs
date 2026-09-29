use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot};

use webrtc_audio_processing::config::EchoCanceller;
use webrtc_audio_processing::{Config, Processor};

use crate::codec::{StreamResampler, resample_to_16k_mono};

const AEC_FRAME: usize = 160;

struct Aec {
    apm: Processor,
    render_acc: Mutex<Vec<f32>>,
    capture_acc: Mutex<Vec<f32>>,
}

impl Aec {
    fn new() -> Result<Self, String> {
        let apm = Processor::new(16000).map_err(|e| format!("Failed to init echo canceller: {e}"))?;
        apm.set_config(Config {
            echo_canceller: Some(EchoCanceller::default()),
            ..Default::default()
        });
        Ok(Self {
            apm,
            render_acc: Mutex::new(Vec::new()),
            capture_acc: Mutex::new(Vec::new()),
        })
    }

    fn render(&self, played: &[f32], rate: u32, channels: u16) {
        let mut acc = self.render_acc.lock().unwrap();
        acc.extend(resample_to_16k_mono(played, rate, channels));
        while acc.len() >= AEC_FRAME {
            let frame: Vec<f32> = acc.drain(..AEC_FRAME).collect();
            let _ = self.apm.analyze_render_frame([&frame]);
        }
    }

    fn capture(&self, mic_16k: Vec<f32>) -> Vec<f32> {
        let mut acc = self.capture_acc.lock().unwrap();
        acc.extend(mic_16k);
        let mut out = Vec::with_capacity(acc.len());
        while acc.len() >= AEC_FRAME {
            let mut frame: Vec<f32> = acc.drain(..AEC_FRAME).collect();
            let _ = self.apm.process_capture_frame([&mut frame[..]]);
            out.extend(frame);
        }
        out
    }
}

/// Feeds `minimp3::Decoder` from a growable shared byte queue instead of a
/// fixed buffer, so one `Decoder` instance can be reused across many
/// WebSocket chunks: `Decoder::next_frame` keeps any bytes it couldn't yet
/// assemble into a full frame in its own internal ring buffer between
/// calls, which is what lets an MP3 frame split across two chunks decode
/// correctly instead of losing its tail every time.
struct QueueReader {
    queue: Arc<Mutex<VecDeque<u8>>>,
}

impl std::io::Read for QueueReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let mut queue = self.queue.lock().unwrap();
        let n = buf.len().min(queue.len());
        for slot in buf.iter_mut().take(n) {
            *slot = queue.pop_front().unwrap();
        }
        Ok(n)
    }
}

fn new_mp3_decoder(queue: &Arc<Mutex<VecDeque<u8>>>) -> minimp3::Decoder<QueueReader> {
    minimp3::Decoder::new(QueueReader {
        queue: Arc::clone(queue),
    })
}

pub struct AudioEngine {
    output_queue: Arc<Mutex<VecDeque<f32>>>,
    playback_epoch: Arc<AtomicU64>,
    stop_tx: Mutex<Option<oneshot::Sender<()>>>,
    out_rate: u32,
    out_channels: u16,
    mp3_queue: Arc<Mutex<VecDeque<u8>>>,
    mp3_decoder: Mutex<minimp3::Decoder<QueueReader>>,
    resampler: Mutex<StreamResampler>,
    /// Samples the output callback had to fill with silence because the
    /// queue ran dry -- audible as a click/gap. Incremented on the
    /// real-time audio thread (a cheap atomic add only, never file I/O
    /// there), read/reset from `take_underrun_samples`.
    underrun_samples: Arc<AtomicU64>,
}

impl AudioEngine {
    pub fn start(
        mic_tx: mpsc::UnboundedSender<Vec<f32>>,
        mic_level: Arc<AtomicU32>,
    ) -> Result<Self, String> {
        let output_queue = Arc::new(Mutex::new(VecDeque::<f32>::new()));
        let playback_epoch = Arc::new(AtomicU64::new(0));
        let underrun_samples = Arc::new(AtomicU64::new(0));

        let aec = Arc::new(Aec::new()?);
        let queue_clone = Arc::clone(&output_queue);
        let underrun_clone = Arc::clone(&underrun_samples);

        let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<(u32, u16), String>>();
        let (thread_stop_tx, thread_stop_rx) = oneshot::channel::<()>();

        std::thread::spawn(move || {
            let host = cpal::default_host();

            let input_device = match host.default_input_device() {
                Some(d) => d,
                None => {
                    let _ = ready_tx.send(Err("No audio input device available".to_string()));
                    return;
                }
            };

            let output_device = match host.default_output_device() {
                Some(d) => d,
                None => {
                    let _ = ready_tx.send(Err("No audio output device available".to_string()));
                    return;
                }
            };

            let in_default_config = match input_device.default_input_config() {
                Ok(c) => c,
                Err(e) => {
                    let _ = ready_tx.send(Err(format!("Failed to get default input config: {e}")));
                    return;
                }
            };

            let out_default_config = match output_device.default_output_config() {
                Ok(c) => c,
                Err(e) => {
                    let _ = ready_tx.send(Err(format!("Failed to get default output config: {e}")));
                    return;
                }
            };

            let in_rate = in_default_config.sample_rate().0;
            let in_channels = in_default_config.channels();
            let in_config = StreamConfig {
                channels: in_channels,
                sample_rate: cpal::SampleRate(in_rate),
                buffer_size: cpal::BufferSize::Default,
            };

            let out_rate = out_default_config.sample_rate().0;
            let out_channels = out_default_config.channels();
            let out_config = StreamConfig {
                channels: out_channels,
                sample_rate: cpal::SampleRate(out_rate),
                buffer_size: cpal::BufferSize::Default,
            };

            let mic_level_f32 = Arc::clone(&mic_level);
            let mic_level_i16 = Arc::clone(&mic_level);
            let aec_in_f32 = Arc::clone(&aec);
            let aec_in_i16 = Arc::clone(&aec);

            let input_stream = match in_default_config.sample_format() {
                SampleFormat::F32 => input_device.build_input_stream(
                    &in_config,
                    move |data: &[f32], _| {
                        let sum_sq: f32 = data.iter().map(|&s| s * s).sum();
                        let rms = (sum_sq / data.len().max(1) as f32).sqrt();
                        mic_level_f32.store(rms.to_bits(), Ordering::Relaxed);

                        let samples_16k = aec_in_f32.capture(resample_to_16k_mono(data, in_rate, in_channels));
                        if !samples_16k.is_empty() {
                            let _ = mic_tx.send(samples_16k);
                        }
                    },
                    |err| eprintln!("Input audio stream error: {err}"),
                    None,
                ),
                SampleFormat::I16 => input_device.build_input_stream(
                    &in_config,
                    move |data: &[i16], _| {
                        let f32_samples: Vec<f32> =
                            data.iter().map(|&s| s as f32 / 32768.0).collect();
                        let sum_sq: f32 = f32_samples.iter().map(|&s| s * s).sum();
                        let rms = (sum_sq / f32_samples.len().max(1) as f32).sqrt();
                        mic_level_i16.store(rms.to_bits(), Ordering::Relaxed);

                        let samples_16k = aec_in_i16.capture(resample_to_16k_mono(&f32_samples, in_rate, in_channels));
                        if !samples_16k.is_empty() {
                            let _ = mic_tx.send(samples_16k);
                        }
                    },
                    |err| eprintln!("Input audio stream error: {err}"),
                    None,
                ),
                sample_format => {
                    let _ = ready_tx.send(Err(format!(
                        "Unsupported input sample format: {sample_format:?}"
                    )));
                    return;
                }
            };

            let input_stream = match input_stream {
                Ok(s) => s,
                Err(e) => {
                    let _ = ready_tx.send(Err(format!("Failed to build input stream: {e}")));
                    return;
                }
            };

            let output_stream = match out_default_config.sample_format() {
                SampleFormat::F32 => {
                    let queue = Arc::clone(&queue_clone);
                    let underrun = Arc::clone(&underrun_clone);
                    let aec_out = Arc::clone(&aec);
                    output_device.build_output_stream(
                        &out_config,
                        move |data: &mut [f32], _| {
                            drain_output_f32(data, &queue, &underrun);
                            aec_out.render(data, out_rate, out_channels);
                        },
                        |err| eprintln!("Output audio stream error: {err}"),
                        None,
                    )
                }
                SampleFormat::I16 => {
                    let queue = Arc::clone(&queue_clone);
                    let underrun = Arc::clone(&underrun_clone);
                    let aec_out = Arc::clone(&aec);
                    output_device.build_output_stream(
                        &out_config,
                        move |data: &mut [i16], _| {
                            drain_output_i16(data, &queue, &underrun);
                            let played: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                            aec_out.render(&played, out_rate, out_channels);
                        },
                        |err| eprintln!("Output audio stream error: {err}"),
                        None,
                    )
                }
                sample_format => {
                    let _ = ready_tx.send(Err(format!(
                        "Unsupported output sample format: {sample_format:?}"
                    )));
                    return;
                }
            };

            let output_stream = match output_stream {
                Ok(s) => s,
                Err(e) => {
                    let _ = ready_tx.send(Err(format!("Failed to build output stream: {e}")));
                    return;
                }
            };

            if let Err(e) = input_stream.play() {
                let _ = ready_tx.send(Err(format!("Failed to play input stream: {e}")));
                return;
            }
            if let Err(e) = output_stream.play() {
                let _ = ready_tx.send(Err(format!("Failed to play output stream: {e}")));
                return;
            }

            let _ = ready_tx.send(Ok((out_rate, out_channels)));

            let _streams = (input_stream, output_stream);
            let _ = thread_stop_rx.blocking_recv();
        });

        let (out_rate, out_channels) = ready_rx
            .recv()
            .map_err(|e| format!("Audio engine initialization channel closed: {e}"))??;

        let mp3_queue = Arc::new(Mutex::new(VecDeque::<u8>::new()));
        let mp3_decoder = Mutex::new(new_mp3_decoder(&mp3_queue));

        Ok(Self {
            output_queue,
            playback_epoch,
            stop_tx: Mutex::new(Some(thread_stop_tx)),
            out_rate,
            out_channels,
            mp3_queue,
            mp3_decoder,
            resampler: Mutex::new(StreamResampler::new()),
            underrun_samples,
        })
    }

    pub fn enqueue_mp3_chunk(&self, mp3_bytes: &[u8]) {
        if mp3_bytes.is_empty() {
            return;
        }
        let epoch = self.playback_epoch.load(Ordering::SeqCst);
        self.mp3_queue.lock().unwrap().extend(mp3_bytes.iter().copied());

        let mut pcm_samples: Vec<f32> = Vec::new();
        let mut src_rate = 44100;
        let mut decoder = self.mp3_decoder.lock().unwrap();

        loop {
            match decoder.next_frame() {
                Ok(frame) => {
                    src_rate = frame.sample_rate as u32;
                    let channels = frame.channels.max(1);
                    let samples_per_channel = frame.data.len() / channels;
                    if channels == 1 {
                        pcm_samples.extend(frame.data.iter().map(|&s| s as f32 / 32768.0));
                    } else {
                        for i in 0..samples_per_channel {
                            let mut sum = 0.0f32;
                            for c in 0..channels {
                                sum += frame.data[i * channels + c] as f32 / 32768.0;
                            }
                            pcm_samples.push(sum / channels as f32);
                        }
                    }
                }
                Err(minimp3::Error::Eof) | Err(minimp3::Error::InsufficientData) => break,
                Err(minimp3::Error::SkippedData) => continue,
                Err(err) => {
                    eprintln!("MP3 decoding warning: {err}");
                    break;
                }
            }
        }
        drop(decoder);

        if pcm_samples.is_empty() {
            return;
        }

        let resampled = self
            .resampler
            .lock()
            .unwrap()
            .push(&pcm_samples, src_rate, self.out_rate);
        let mut output_samples = Vec::with_capacity(resampled.len() * self.out_channels.max(1) as usize);
        for &s in &resampled {
            for _ in 0..self.out_channels.max(1) {
                output_samples.push(s);
            }
        }

        let mut queue = self.output_queue.lock().unwrap();
        if self.playback_epoch.load(Ordering::SeqCst) != epoch {
            return;
        }
        queue.extend(output_samples);
    }

    pub fn is_playing(&self) -> bool {
        self.output_queue
            .lock()
            .map(|q| !q.is_empty())
            .unwrap_or(false)
    }

    /// How much buffered audio is left to play, in milliseconds. Dropping
    /// near zero between server frames is what an underrun/glitch looks
    /// like before it happens.
    pub fn queued_playback_ms(&self) -> f64 {
        let frames = self.output_queue.lock().map(|q| q.len()).unwrap_or(0) as f64
            / self.out_channels.max(1) as f64;
        frames * 1000.0 / self.out_rate.max(1) as f64
    }

    /// Returns the number of output samples filled with silence since the
    /// last call (an underrun/glitch), resetting the counter.
    pub fn take_underrun_samples(&self) -> u64 {
        self.underrun_samples.swap(0, Ordering::Relaxed)
    }

    pub fn clear_playback(&self) {
        self.playback_epoch.fetch_add(1, Ordering::SeqCst);
        let mut queue = self.output_queue.lock().unwrap();
        queue.clear();
        drop(queue);
        self.mp3_queue.lock().unwrap().clear();
        *self.mp3_decoder.lock().unwrap() = new_mp3_decoder(&self.mp3_queue);
        self.resampler.lock().unwrap().reset();
    }
}

impl Drop for AudioEngine {
    fn drop(&mut self) {
        if let Ok(mut lock) = self.stop_tx.lock() {
            if let Some(tx) = lock.take() {
                let _ = tx.send(());
            }
        }
    }
}

fn drain_output_f32(data: &mut [f32], queue: &Mutex<VecDeque<f32>>, underrun_samples: &AtomicU64) {
    let mut queue = queue.lock().unwrap();
    let had_audio = !queue.is_empty();
    let mut missed = 0u64;
    for sample in data.iter_mut() {
        *sample = match queue.pop_front() {
            Some(val) => val,
            None => {
                missed += 1;
                0.0
            }
        };
    }
    // Only a dry-out that follows real audio is an underrun; padding silence
    // while idle is normal and must not be counted.
    if missed > 0 && had_audio {
        underrun_samples.fetch_add(missed, Ordering::Relaxed);
    }
}

fn drain_output_i16(data: &mut [i16], queue: &Mutex<VecDeque<f32>>, underrun_samples: &AtomicU64) {
    let mut queue = queue.lock().unwrap();
    let had_audio = !queue.is_empty();
    let mut missed = 0u64;
    for sample in data.iter_mut() {
        *sample = match queue.pop_front() {
            Some(val) => (val.clamp(-1.0, 1.0) * 32767.0) as i16,
            None => {
                missed += 1;
                0
            }
        };
    }
    // Only a dry-out that follows real audio is an underrun; padding silence
    // while idle is normal and must not be counted.
    if missed > 0 && had_audio {
        underrun_samples.fetch_add(missed, Ordering::Relaxed);
    }
}
