/**
 * Append-only debug log at ~/Documents/log.txt, for diagnosing voice call
 * issues (audio timing, network jitter) without an attached dev console.
 */
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

static LOG_FILE: Mutex<Option<std::fs::File>> = Mutex::new(None);
static REMOTE_QUEUE: Mutex<Vec<(String, String)>> = Mutex::new(Vec::new());
const REMOTE_QUEUE_MAX: usize = 500;
const REMOTE_BATCH: usize = 200;

fn log_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Documents").join("log.txt")
}

pub fn log(line: &str) {
    if let Ok(mut queue) = REMOTE_QUEUE.lock() {
        queue.push((chrono::Utc::now().to_rfc3339(), line.to_string()));
        if queue.len() > REMOTE_QUEUE_MAX {
            let excess = queue.len() - REMOTE_QUEUE_MAX;
            queue.drain(..excess);
        }
    }
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

/// Uploads queued voice log lines to vox-core's `/v1/logs/batches`. Failed
/// uploads put the lines back so the next flush retries them.
pub async fn flush_remote(api_url: &str, token: &str) {
    let lines: Vec<(String, String)> = {
        let Ok(mut queue) = REMOTE_QUEUE.lock() else {
            return;
        };
        let take = queue.len().min(REMOTE_BATCH);
        queue.drain(..take).collect()
    };
    if lines.is_empty() {
        return;
    }
    let device_id = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "desktop".to_string());
    let body = serde_json::json!({
        "platform": "desktop",
        "app_version": env!("CARGO_PKG_VERSION"),
        "device_id": device_id,
        "lines": lines
            .iter()
            .map(|(ts, message)| serde_json::json!({
                "ts": ts, "level": "I", "tag": "voice", "message": message,
            }))
            .collect::<Vec<_>>(),
    });
    let url = format!("{}/v1/logs/batches", api_url.trim_end_matches('/'));
    let sent = reqwest::Client::new()
        .post(url)
        .bearer_auth(token)
        .timeout(std::time::Duration::from_secs(5))
        .json(&body)
        .send()
        .await
        .is_ok_and(|resp| resp.status().is_success());
    if !sent {
        if let Ok(mut queue) = REMOTE_QUEUE.lock() {
            let mut restored = lines;
            restored.append(&mut queue);
            restored.truncate(REMOTE_QUEUE_MAX);
            *queue = restored;
        }
    }
}
