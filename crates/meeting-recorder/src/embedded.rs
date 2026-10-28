//! Bundled CPU speech runtime. No network client or external engine process.
use crate::transcript::Segment;
use anyhow::{ensure, Context, Result};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
const CHUNK_SAMPLES: usize = 16_000 * 60;
pub fn transcribe(
    model: &Path,
    audio: &Path,
    source: &str,
    stopped: Arc<AtomicBool>,
) -> Result<Vec<Segment>> {
    ensure!(
        !stopped.load(Ordering::SeqCst),
        "Local transcription cancelled"
    );
    ensure!(matches!(source, "mic" | "system"), "Unknown audio source");
    let mut reader = hound::WavReader::open(audio)?;
    let spec = reader.spec();
    ensure!(
        spec.channels == 1
            && spec.sample_rate == 16_000
            && spec.bits_per_sample == 16
            && spec.sample_format == hound::SampleFormat::Int,
        "Expected 16kHz mono PCM16 audio"
    );
    ensure!(
        reader.duration() > 0 && reader.duration() as u64 <= 16_000 * 7200,
        "Audio must be between one sample and two hours"
    );
    let mut options = WhisperContextParameters::default();
    options.use_gpu(false);
    let context = WhisperContext::new_with_params(
        model.to_str().context("Unsupported model path encoding")?,
        options,
    )
    .context("Could not load the installed speech model")?;
    let mut state = context.create_state()?;
    let mut samples = reader.samples::<i16>();
    let mut offset = 0u64;
    let mut result = vec![];
    loop {
        ensure!(
            !stopped.load(Ordering::SeqCst),
            "Local transcription cancelled"
        );
        let pcm: Vec<i16> = samples
            .by_ref()
            .take(CHUNK_SAMPLES)
            .collect::<std::result::Result<_, _>>()?;
        if pcm.is_empty() {
            break;
        }
        let length = pcm.len() as u64 * 1000 / 16_000;
        // Exact digital silence has no speech; do not fabricate text for it.
        if pcm.iter().any(|&s| s != 0) {
            let floats: Vec<f32> = pcm.iter().map(|&s| s as f32 / 32768.0).collect();
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_language(Some("auto"));
            params.set_no_context(true);
            params.set_print_realtime(false);
            params.set_print_progress(false);
            params.set_print_special(false);
            params.set_print_timestamps(false);
            params.set_n_threads(
                std::thread::available_parallelism()
                    .map(|n| n.get().min(4))
                    .unwrap_or(2) as i32,
            );
            state.full(params, &floats)?;
            ensure!(
                !stopped.load(Ordering::SeqCst),
                "Local transcription cancelled"
            );
            for segment in state.as_iter() {
                let text = segment.to_str_lossy()?.trim().to_owned();
                if text.is_empty() {
                    continue;
                }
                let start = (segment.start_timestamp().max(0) as u64 * 10).min(length);
                let end = (segment.end_timestamp().max(0) as u64 * 10).min(length);
                ensure!(end >= start, "Invalid model timestamps");
                result.push(Segment {
                    source: source.into(),
                    start_ms: offset + start,
                    end_ms: offset + end,
                    text,
                });
            }
        }
        offset += length;
    }
    Ok(result)
}

/// Runs the bundled engine in a disposable desktop worker with parent-EOF shutdown.
pub fn supervised(
    binary: &Path,
    model: &Path,
    audio: &Path,
    prefix: &Path,
    source: &str,
    stopped: &AtomicBool,
    timeout: std::time::Duration,
) -> Result<Vec<Segment>> {
    ensure!(
        !stopped.load(Ordering::SeqCst),
        "Local transcription cancelled"
    );
    ensure!(
        !prefix.with_extension("json").exists(),
        "Transcript output already exists"
    );
    let mut command = std::process::Command::new(binary);
    command
        .arg("meeting-transcribe-worker")
        .arg(model)
        .arg(audio)
        .arg(prefix)
        .arg(source)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let outcome =
        crate::supervisor::supervise(command, stopped, timeout, std::time::Duration::from_secs(3))?;
    ensure!(
        outcome.success && !outcome.forced && !stopped.load(Ordering::SeqCst),
        "Local transcription stopped or failed; audio remains on this computer"
    );
    let path = prefix.with_extension("json");
    ensure!(
        std::fs::metadata(&path)?.len() <= 8_000_000,
        "Local transcript output is too large"
    );
    Ok(serde_json::from_slice(&std::fs::read(path)?)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_pcm_is_rejected_before_model_loading() {
        let temp = tempfile::tempdir().unwrap();
        let wav = temp.path().join("stereo.wav");
        let mut out = hound::WavWriter::create(
            &wav,
            hound::WavSpec {
                channels: 2,
                sample_rate: 44100,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            },
        )
        .unwrap();
        out.write_sample(0i16).unwrap();
        out.write_sample(0i16).unwrap();
        out.finalize().unwrap();
        let error = transcribe(
            &temp.path().join("missing-model"),
            &wav,
            "mic",
            std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        )
        .unwrap_err();
        assert!(error.to_string().contains("16kHz mono PCM16"));
    }
    #[test]
    fn cancelled_inference_does_not_load_model_or_audio() {
        let stopped = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
        assert!(transcribe(
            std::path::Path::new("missing-model"),
            std::path::Path::new("missing-audio"),
            "mic",
            stopped
        )
        .unwrap_err()
        .to_string()
        .contains("cancelled"));
    }
}
