//! Dispatch before Tauri/single-instance setup so capture stays in a disposable process.
use anyhow::{ensure, Context, Result};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
pub fn dispatch() -> Option<Result<()>> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    #[cfg(feature = "embedded")]
    if args.first().and_then(|a| a.to_str()) == Some("meeting-transcribe-worker") {
        return Some((|| {
            ensure!(args.len() == 5, "Invalid transcription worker arguments");
            let stopped = parent_control();
            let segments = crate::embedded::transcribe(
                PathBuf::from(&args[1]).as_path(),
                PathBuf::from(&args[2]).as_path(),
                args[4].to_str().context("Invalid source")?,
                stopped,
            )?;
            crate::capture::write_json(
                &PathBuf::from(&args[3]).with_extension("json"),
                &serde_json::to_value(segments)?,
            )
        })());
    }
    if args.first().and_then(|a| a.to_str()) != Some("record") {
        return None;
    }
    Some((|| {
        ensure!(
            args.len() == 6
                && args[1] == "--output"
                && args[3] == "--seconds"
                && args[5] == "--capture-worker",
            "invalid capture worker arguments"
        );
        let output = PathBuf::from(&args[2]);
        let seconds: u64 = args[4].to_str().context("invalid duration")?.parse()?;
        ensure!(
            (1..=7200).contains(&seconds),
            "recording limit is two hours"
        );
        let stopped = parent_control();
        crate::capture::record(&output, Duration::from_secs(seconds), None, None, &stopped)
    })())
}

fn parent_control() -> Arc<AtomicBool> {
    let stopped = Arc::new(AtomicBool::new(false));
    let control = stopped.clone();
    std::thread::spawn(move || {
        use std::io::Read;
        let mut byte = [0];
        let mut input = std::io::stdin().lock();
        loop {
            match input.read(&mut byte) {
                Ok(0) | Err(_) => std::process::exit(1),
                Ok(_) => control.store(true, Ordering::Relaxed),
            }
        }
    });
    stopped
}
