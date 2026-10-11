use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot};

use sonora::config::{EchoCanceller, HighPassFilter, NoiseSuppression};
use sonora::{AudioProcessing, Config, StreamConfig as AudioStreamConfig};

use crate::codec::{resample_to_16k_mono, StreamResampler};

const AEC_FRAME: usize = 160;

struct ProcessingState {
    apm: AudioProcessing,
    render_resampler: StreamResampler,
    render_acc: VecDeque<f32>,
    capture_acc: VecDeque<f32>,
    errors: u64,
}

struct Aec {
    state: Mutex<ProcessingState>,
}

impl Aec {
    fn new() -> Result<Self, String> {
        let stream = AudioStreamConfig::new(16000, 1);
        let apm = AudioProcessing::builder()
            .config(Config {
                echo_canceller: Some(EchoCanceller::default()),
                high_pass_filter: Some(HighPassFilter::default()),
                noise_suppression: Some(NoiseSuppression::default()),
                ..Default::default()
            })
            .capture_config(stream)
            .render_config(stream)
            .build();
        eprintln!("VOICE_AUDIO_PROCESSING_READY engine=sonora sample_rate=16000 echo_cancellation=true noise_suppression=moderate high_pass=true");
        Ok(Self {
            state: Mutex::new(ProcessingState {
                apm,
                render_resampler: StreamResampler::new(),
                render_acc: VecDeque::new(),
                capture_acc: VecDeque::new(),
                errors: 0,
            }),
        })
    }

    fn render(&self, played: &[f32], rate: u32, channels: u16) {
        let mut state = self.state.lock().unwrap();
        let mono: Vec<f32> = played
            .chunks_exact(channels as usize)
            .map(|frame| frame.iter().sum::<f32>() / channels as f32)
            .collect();
        let samples = state.render_resampler.push(&mono, rate, 16000);
        state.render_acc.extend(samples);
        while state.render_acc.len() >= AEC_FRAME {
            let mut frame = [0.0; AEC_FRAME];
            for sample in &mut frame {
                *sample = state.render_acc.pop_front().unwrap();
            }
            let mut output = [0.0; AEC_FRAME];
            if let Err(error) = state.apm.process_render_f32(&[&frame], &mut [&mut output]) {
                state.record_error("render", error);
            }
        }
    }

    fn capture(&self, mic_16k: Vec<f32>) -> Vec<f32> {
        let mut state = self.state.lock().unwrap();
        state.capture_acc.extend(mic_16k);
        let mut out = Vec::with_capacity(state.capture_acc.len());
        while state.capture_acc.len() >= AEC_FRAME {
            let mut frame = [0.0; AEC_FRAME];
            for sample in &mut frame {
                *sample = state.capture_acc.pop_front().unwrap();
            }
            let mut output = [0.0; AEC_FRAME];
            if let Err(error) = state.apm.process_capture_f32(&[&frame], &mut [&mut output]) {
                state.record_error("capture", error);
                output.fill(0.0);
            }
            out.extend_from_slice(&output);
        }
        out
    }
}

impl ProcessingState {
    fn record_error(&mut self, stage: &str, error: sonora::Error) {
        self.errors += 1;
        if self.errors.is_power_of_two() {
            eprintln!(
                "VOICE_AUDIO_PROCESSING_FAILED stage={stage} count={} error={error:?}",
                self.errors
            );
        }
    }
}

pub struct AudioEngine {
    output_queue: Arc<Mutex<VecDeque<f32>>>,
    playback_epoch: Arc<AtomicU64>,
    playback_started_ms: Arc<AtomicU64>,
    stop_tx: Mutex<Option<oneshot::Sender<()>>>,
    out_rate: u32,
    out_channels: u16,
    resampler: Mutex<StreamResampler>,
}

pub enum MicSender {
    Legacy(mpsc::UnboundedSender<Vec<f32>>),
    Bounded(mpsc::Sender<Vec<f32>>, Arc<AtomicBool>),
}
impl From<mpsc::UnboundedSender<Vec<f32>>> for MicSender {
    fn from(sender: mpsc::UnboundedSender<Vec<f32>>) -> Self {
        Self::Legacy(sender)
    }
}
impl MicSender {
    fn send(&self, samples: Vec<f32>) {
        match self {
            Self::Legacy(sender) => {
                let _ = sender.send(samples);
            }
            Self::Bounded(sender, overflow) => {
                if let Err(mpsc::error::TrySendError::Full(_)) = sender.try_send(samples) {
                    overflow.store(true, Ordering::Relaxed);
                }
            }
        }
    }
}

impl AudioEngine {
    pub fn start_with_device(
        mic_tx: impl Into<MicSender>,
        mic_level: Arc<AtomicU32>,
        device_name: Option<String>,
    ) -> Result<Self, String> {
        let mic_tx = mic_tx.into();
        let output_queue = Arc::new(Mutex::new(VecDeque::<f32>::new()));
        let playback_epoch = Arc::new(AtomicU64::new(0));
        let playback_started_ms = Arc::new(AtomicU64::new(u64::MAX));
        let playback_clock = std::time::Instant::now();
        let thread_playback_started_ms = playback_started_ms.clone();

        let aec = Arc::new(Aec::new()?);
        let queue_clone = Arc::clone(&output_queue);

        let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<(u32, u16), String>>();
        let (thread_stop_tx, thread_stop_rx) = oneshot::channel::<()>();

        std::thread::spawn(move || {
            let host = cpal::default_host();

            let selected = match device_name {
                Some(name) => host.input_devices().ok().and_then(|mut devices| {
                    devices.find(|device| device.name().ok().as_deref() == Some(name.as_str()))
                }),
                None => host.default_input_device(),
            };
            let input_device = match selected {
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

                        let samples_16k =
                            aec_in_f32.capture(resample_to_16k_mono(data, in_rate, in_channels));
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

                        let samples_16k = aec_in_i16.capture(resample_to_16k_mono(
                            &f32_samples,
                            in_rate,
                            in_channels,
                        ));
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
                    let aec_out = Arc::clone(&aec);
                    let played_at = thread_playback_started_ms.clone();
                    output_device.build_output_stream(
                        &out_config,
                        move |data: &mut [f32], _| {
                            drain_output_f32(data, &queue, &played_at, playback_clock);
                            aec_out.render(data, out_rate, out_channels);
                        },
                        |err| eprintln!("Output audio stream error: {err}"),
                        None,
                    )
                }
                SampleFormat::I16 => {
                    let queue = Arc::clone(&queue_clone);
                    let aec_out = Arc::clone(&aec);
                    let played_at = thread_playback_started_ms.clone();
                    output_device.build_output_stream(
                        &out_config,
                        move |data: &mut [i16], _| {
                            drain_output_i16(data, &queue, &played_at, playback_clock);
                            let played: Vec<f32> =
                                data.iter().map(|&s| s as f32 / 32768.0).collect();
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

        Ok(Self {
            output_queue,
            playback_epoch,
            playback_started_ms,
            stop_tx: Mutex::new(Some(thread_stop_tx)),
            out_rate,
            out_channels,
            resampler: Mutex::new(StreamResampler::new()),
        })
    }

    pub fn reset_playback_measurement(&self) {
        let _queue = self.output_queue.lock().unwrap();
        self.playback_started_ms.store(u64::MAX, Ordering::Relaxed);
    }

    pub fn playback_started_after_ms(&self) -> Option<u64> {
        let value = self.playback_started_ms.load(Ordering::Relaxed);
        (value != u64::MAX).then_some(value)
    }

    pub fn playback_epoch(&self) -> u64 {
        self.playback_epoch.load(Ordering::SeqCst)
    }

    /// Queues mono f32 PCM for playback; dropped if `epoch` is stale (the
    /// playback was cleared after the audio was requested).
    pub fn enqueue_pcm(&self, pcm_samples: &[f32], src_rate: u32, epoch: u64) {
        if pcm_samples.is_empty() {
            return;
        }

        let resampled = self
            .resampler
            .lock()
            .unwrap()
            .push(pcm_samples, src_rate, self.out_rate);
        let mut output_samples =
            Vec::with_capacity(resampled.len() * self.out_channels.max(1) as usize);
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

    pub fn clear_playback(&self) {
        self.playback_epoch.fetch_add(1, Ordering::SeqCst);
        let mut queue = self.output_queue.lock().unwrap();
        queue.clear();
        self.playback_started_ms.store(u64::MAX, Ordering::Relaxed);
        drop(queue);
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

fn drain_output_f32(data: &mut [f32], queue: &Mutex<VecDeque<f32>>, played_at: &AtomicU64, clock: std::time::Instant) {
    let mut queue = queue.lock().unwrap();
    if !queue.is_empty() {
        let _ = played_at.compare_exchange(u64::MAX, clock.elapsed().as_millis() as u64, Ordering::Relaxed, Ordering::Relaxed);
    }
    for sample in data {
        *sample = queue.pop_front().unwrap_or(0.0);
    }
}

fn drain_output_i16(data: &mut [i16], queue: &Mutex<VecDeque<f32>>, played_at: &AtomicU64, clock: std::time::Instant) {
    let mut queue = queue.lock().unwrap();
    if !queue.is_empty() {
        let _ = played_at.compare_exchange(u64::MAX, clock.elapsed().as_millis() as u64, Ordering::Relaxed, Ordering::Relaxed);
    }
    for sample in data {
        *sample = (queue.pop_front().unwrap_or(0.0).clamp(-1.0, 1.0) * 32767.0) as i16;
    }
}

#[cfg(test)]
mod bounded_capture_tests {
    use super::*;
    #[test]
    fn output_preserves_pcm_and_pads_exhausted_queue_with_silence() {
        let queue = Mutex::new(VecDeque::from([0.25, -0.5]));
        let mut output = [1.0; 4];
        drain_output_f32(&mut output, &queue, &AtomicU64::new(u64::MAX), std::time::Instant::now());
        assert_eq!(output, [0.25, -0.5, 0.0, 0.0]);
        assert!(queue.lock().unwrap().is_empty());
    }

    #[test]
    fn integer_output_clamps_pcm_and_pads_with_silence() {
        let queue = Mutex::new(VecDeque::from([2.0, -2.0]));
        let mut output = [1; 3];
        drain_output_i16(&mut output, &queue, &AtomicU64::new(u64::MAX), std::time::Instant::now());
        assert_eq!(output, [32767, -32767, 0]);
    }

    #[test]
    fn full_capture_queue_marks_overflow_without_growing() {
        let (tx, mut rx) = mpsc::channel(1);
        let overflow = Arc::new(AtomicBool::new(false));
        let sender = MicSender::Bounded(tx, overflow.clone());
        sender.send(vec![0.1; 160]);
        sender.send(vec![0.2; 160]);
        assert!(overflow.load(Ordering::Relaxed));
        assert_eq!(rx.try_recv().unwrap(), vec![0.1; 160]);
        assert!(rx.try_recv().is_err());
    }
}
