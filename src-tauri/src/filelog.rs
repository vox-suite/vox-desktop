/**
 * Append-only debug log at ~/Documents/log.txt, for diagnosing voice call
 * issues (audio timing, network jitter) without an attached dev console.
 */
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

static LOG_FILE: Mutex<Option<std::fs::File>> = Mutex::new(None);

fn log_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Documents").join("log.txt")
}

pub fn log(line: &str) {
    let Ok(mut guard) = LOG_FILE.lock() else {
        return;
    };
    if guard.is_none() {
        *guard = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path())
            .ok();
    }
    if let Some(file) = guard.as_mut() {
        let ts = chrono::Local::now().format("%H:%M:%S%.3f");
        let _ = writeln!(file, "[{ts}] {line}");
        let _ = file.flush();
    }
}

/// Logs a formatted line to `~/Documents/log.txt`. Do not call from a
/// real-time audio callback (cpal's output/input stream closures) -- file
/// I/O there can itself cause the glitches this log exists to diagnose.
#[macro_export]
macro_rules! voxlog {
    ($($arg:tt)*) => {
        $crate::filelog::log(&format!($($arg)*))
    };
}
