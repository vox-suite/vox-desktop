use anyhow::{ensure, Result};
use clap::{Parser, Subcommand};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use vox_meeting_prototype::{capture, supervisor, transcript};

#[derive(Parser)]
#[command(about = "Local-only Vox capture experiment. Records ONLY after the record command.")]
struct Args {
    #[command(subcommand)]
    command: Action,
}

#[derive(Subcommand)]
enum Action {
    /// Enumerate microphone and playback devices; never starts a recording.
    Devices,
    /// Record separate microphone/system WAVs locally. Ctrl+C stops both.
    Record {
        /// New directory; existing directories are never reused.
        #[arg(long)]
        output: PathBuf,
        #[arg(long, default_value_t = 30, value_parser = clap::value_parser!(u64).range(1..=7200))]
        seconds: u64,
        #[arg(long)]
        mic_device: Option<String>,
        #[arg(long)]
        system_device: Option<String>,
        #[arg(long, hide = true)]
        capture_worker: bool,
    },
    /// Transcribe an existing 16kHz mono WAV using local whisper.cpp only.
    Transcribe {
        #[arg(long)]
        audio: PathBuf,
        #[arg(long)]
        whisper: PathBuf,
        #[arg(long)]
        model: PathBuf,
        /// New output directory containing raw Whisper JSON and normalized segments.
        #[arg(long)]
        output: PathBuf,
        #[arg(long, default_value = "mic", value_parser = ["mic", "system"])]
        source: String,
        #[arg(long, default_value_t = 1800, value_parser = clap::value_parser!(u64).range(1..=7200))]
        timeout_seconds: u64,
    },
}

fn main() -> Result<()> {
    let args = Args::parse();
    let stopped = Arc::new(AtomicBool::new(false));
    let signal = stopped.clone();
    ctrlc::set_handler(move || {
        signal.store(true, Ordering::Relaxed);
    })?;
    match args.command {
        Action::Devices => {
            for device in flexaudio::devices()? {
                println!(
                    "{}\t{}\tdefault={}\tid={}\t{}",
                    if device.is_loopback { "system" } else { "mic" },
                    device.name,
                    device.is_default,
                    device.id,
                    if device.format_available {
                        "format available"
                    } else {
                        "format unknown"
                    }
                );
            }
        }
        Action::Record {
            output,
            seconds,
            mic_device,
            system_device,
            capture_worker,
        } => {
            if !capture_worker {
                ensure!(!output.exists(), "choose a new recording output directory");
                let mut worker = std::process::Command::new(std::env::current_exe()?);
                worker
                    .args(std::env::args_os().skip(1))
                    .arg("--capture-worker");
                let result = supervisor::supervise(
                    worker,
                    &stopped,
                    Duration::from_secs(seconds),
                    Duration::from_secs(3),
                )?;
                // Never write into an unrelated pre-existing directory on startup failure.
                let session = std::fs::read(output.join("session.json"))
                    .ok()
                    .and_then(|data| serde_json::from_slice::<serde_json::Value>(&data).ok());
                if session.as_ref().and_then(|s| s["worker_pid"].as_u64())
                    == Some(result.worker_pid as u64)
                {
                    capture::write_json(
                        &output.join("supervisor.json"),
                        &serde_json::to_value(&result)?,
                    )?;
                }
                ensure!(
                    !result.forced,
                    "capture worker terminated after {}; local files may be incomplete",
                    result.reason.as_deref().unwrap_or("interruption")
                );
                ensure!(
                    result.success,
                    "capture worker failed; inspect local result.json"
                );
                return Ok(());
            }
            let control = stopped.clone();
            std::thread::spawn(move || {
                use std::io::Read;
                let mut byte = [0];
                let mut input = std::io::stdin().lock();
                loop {
                    match input.read(&mut byte) {
                        Ok(0) | Err(_) => {
                            // The supervising process disappeared. Do not leave a
                            // microphone alive behind a blocked native startup call.
                            eprintln!(
                                "Recording supervisor disconnected; terminating capture worker."
                            );
                            std::process::exit(1);
                        }
                        Ok(_) => control.store(true, Ordering::Relaxed),
                    }
                }
            });
            capture::record(
                &output,
                Duration::from_secs(seconds),
                mic_device,
                system_device,
                &stopped,
            )?;
        }
        Action::Transcribe {
            audio,
            whisper,
            model,
            output,
            source,
            timeout_seconds,
        } => {
            ensure!(
                audio.is_file() && model.is_file() && whisper.is_file(),
                "audio, model and whisper executable must exist locally"
            );
            let reader = hound::WavReader::open(&audio)?;
            ensure!(
                reader.spec().sample_rate == 16000
                    && reader.spec().channels == 1
                    && reader.spec().bits_per_sample == 16
                    && reader.spec().sample_format == hound::SampleFormat::Int,
                "expected 16kHz mono PCM16 WAV"
            );
            capture::create_private_directory(&output)?;
            let started = Instant::now();
            let segments = transcript::transcribe(
                &whisper,
                &model,
                &audio,
                &output.join("whisper"),
                &source,
                &stopped,
                Duration::from_secs(timeout_seconds),
            )?;
            capture::write_json(
                &output.join("transcript.json"),
                &serde_json::json!({
                    "schema_version": 1, "source": source, "timeline_basis": "source_relative",
                "cross_source_alignment_verified": false,
                "model": model.file_name().and_then(|name| name.to_str()),
                "inference_wall_ms": started.elapsed().as_millis(),
                "audio_duration_ms": reader.duration() as u64 * 1000 / 16000,
                    "segments": segments,
                }),
            )?;
            println!(
                "Saved {} segments locally to {}",
                segments.len(),
                output.join("transcript.json").display()
            );
        }
    }
    Ok(())
}
