use anyhow::{ensure, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Segment {
    pub source: String,
    /// Source-relative times; cross-track alignment is not yet calibrated.
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
}

#[derive(Deserialize)]
struct WhisperOutput {
    transcription: Vec<WhisperSegment>,
}
#[derive(Deserialize)]
struct WhisperSegment {
    offsets: Offsets,
    text: String,
}
#[derive(Deserialize)]
struct Offsets {
    from: u64,
    to: u64,
}

pub fn parse_whisper(input: &str, source: &str) -> Result<Vec<Segment>> {
    ensure!(matches!(source, "mic" | "system"), "unknown audio source");
    let output: WhisperOutput = serde_json::from_str(input).context("invalid Whisper JSON")?;
    output
        .transcription
        .into_iter()
        .map(|s| {
            ensure!(
                s.offsets.to >= s.offsets.from,
                "reversed transcript timestamps"
            );
            Ok(Segment {
                source: source.into(),
                start_ms: s.offsets.from,
                end_ms: s.offsets.to,
                text: s.text.trim().into(),
            })
        })
        .collect()
}

/// Invokes only a local executable and model. No service/provider fallback.
pub fn transcribe(
    binary: &Path,
    model: &Path,
    audio: &Path,
    prefix: &Path,
    source: &str,
    cancelled: &AtomicBool,
    timeout: Duration,
) -> Result<Vec<Segment>> {
    ensure!(
        !cancelled.load(Ordering::Relaxed),
        "local transcription cancelled"
    );
    ensure!(matches!(source, "mic" | "system"), "unknown audio source");
    ensure!(
        model.is_file(),
        "local model missing; run the setup script first"
    );
    ensure!(audio.is_file(), "audio file missing");
    ensure!(
        !prefix.with_extension("json").exists(),
        "transcript output already exists; choose a new output prefix"
    );
    let started = Instant::now();
    // Resolve exactly the selected executable, including a bare local filename.
    let binary = binary.canonicalize().context("local whisper-cli missing")?;
    let mut child = Command::new(binary)
        .args(["-m"])
        .arg(model)
        .arg("-f")
        .arg(audio)
        .args(["-l", "auto", "-oj", "-np", "-of"])
        .arg(prefix)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("could not start local whisper-cli")?;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if !cancelled.load(Ordering::Relaxed) && started.elapsed() < timeout => {
                std::thread::sleep(Duration::from_millis(100));
            }
            result => {
                let _ = child.kill();
                let _ = child.wait();
                if let Err(error) = result {
                    return Err(error.into());
                }
                anyhow::bail!("local transcription cancelled or timed out; audio remains local");
            }
        }
    };
    ensure!(
        status.success(),
        "local whisper-cli failed ({status}); no cloud fallback was used"
    );
    let json = std::fs::read_to_string(prefix.with_extension("json"))?;
    parse_whisper(&json, source)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn already_cancelled_transcription_never_starts_a_worker() {
        let temp = tempfile::tempdir().unwrap();
        let model = temp.path().join("model.bin");
        let audio = temp.path().join("audio.wav");
        std::fs::write(&model, b"model").unwrap();
        std::fs::write(&audio, b"audio").unwrap();
        let error = transcribe(
            &temp.path().join("no-worker"),
            &model,
            &audio,
            &temp.path().join("out"),
            "mic",
            &AtomicBool::new(true),
            Duration::from_secs(1),
        )
        .unwrap_err();
        assert!(error.to_string().contains("cancelled"), "{error}");
    }

    #[cfg(unix)]
    #[test]
    fn local_worker_failure_and_timeout_preserve_audio() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let model = temp.path().join("model.bin");
        let audio = temp.path().join("audio.wav");
        let worker = temp.path().join("fake whisper");
        std::fs::write(&model, b"model").unwrap();
        std::fs::write(&audio, b"keep audio local").unwrap();
        std::fs::write(&worker, "#!/bin/sh\nexit 7\n").unwrap();
        std::fs::set_permissions(&worker, std::fs::Permissions::from_mode(0o700)).unwrap();
        let run = |timeout| {
            transcribe(
                &worker,
                &model,
                &audio,
                &temp.path().join("out"),
                "system",
                &AtomicBool::new(false),
                timeout,
            )
        };
        let error = run(Duration::from_secs(5)).unwrap_err();
        assert!(error.to_string().contains("failed"), "{error:#}");
        std::fs::write(&worker, "#!/bin/sh\nexec sleep 10\n").unwrap();
        let started = Instant::now();
        assert!(run(Duration::from_millis(150))
            .unwrap_err()
            .to_string()
            .contains("timed out"));
        assert!(started.elapsed() < Duration::from_secs(3));
        assert_eq!(std::fs::read(&audio).unwrap(), b"keep audio local");
        assert!(!temp.path().join("out.json").exists());
    }

    #[test]
    fn keeps_source_labels_and_source_relative_timestamps() {
        let input = r#"{"transcription":[{"offsets":{"from":100,"to":1200},"text":" Hello."}]}"#;
        let segments = parse_whisper(input, "system").unwrap();
        assert_eq!(segments[0].source, "system");
        assert_eq!(segments[0].start_ms, 100);
        assert_eq!(segments[0].end_ms, 1200);
        assert_eq!(segments[0].text, "Hello.");
    }

    #[test]
    fn rejects_missing_or_reversed_timestamps() {
        assert!(parse_whisper(r#"{"transcription":[{"text":"hello"}]}"#, "mic").is_err());
        assert!(parse_whisper(
            r#"{"transcription":[{"offsets":{"from":200,"to":100},"text":"hello"}]}"#,
            "mic"
        )
        .is_err());
    }
}
