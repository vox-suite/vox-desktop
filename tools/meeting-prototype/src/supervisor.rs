use anyhow::Result;
use serde::Serialize;
use std::{
    io::Write,
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

#[derive(Debug, Serialize)]
pub struct WorkerOutcome {
    pub worker_pid: u32,
    pub success: bool,
    pub forced: bool,
    pub reason: Option<String>,
    pub exit_code: Option<i32>,
}

struct OwnedWorker(Child);
impl Drop for OwnedWorker {
    fn drop(&mut self) {
        // Errors in the supervisor must never abandon a recording process.
        if !matches!(self.0.try_wait(), Ok(Some(_))) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
}

/// Bound native capture startup and teardown as well as the recording loop.
pub fn supervise(
    command: Command,
    cancelled: &AtomicBool,
    duration: Duration,
    grace: Duration,
) -> Result<WorkerOutcome> {
    supervise_with_checkpoint(command, cancelled, duration, grace, || Ok(()))
}

pub fn supervise_with_checkpoint(
    mut command: Command,
    cancelled: &AtomicBool,
    duration: Duration,
    grace: Duration,
    mut checkpoint: impl FnMut() -> Result<()>,
) -> Result<WorkerOutcome> {
    let mut worker = OwnedWorker(command.stdin(Stdio::piped()).spawn()?);
    let pid = worker.0.id();
    let deadline = Instant::now() + duration;
    let mut stop_requested: Option<(Instant, &'static str)> = None;
    let mut next_checkpoint = Instant::now();
    loop {
        if let Some(status) = worker.0.try_wait()? {
            return Ok(WorkerOutcome {
                worker_pid: pid,
                success: status.success(),
                forced: false,
                reason: stop_requested.map(|(_, why)| why.into()),
                exit_code: status.code(),
            });
        }
        if Instant::now() >= next_checkpoint {
            checkpoint()?;
            next_checkpoint = Instant::now() + Duration::from_secs(1);
        }
        if stop_requested.is_none()
            && (cancelled.load(Ordering::Relaxed) || Instant::now() >= deadline)
        {
            let reason = if cancelled.load(Ordering::Relaxed) {
                "cancelled"
            } else {
                "deadline"
            };
            stop_requested = Some((Instant::now(), reason));
            // The worker's control thread sets its cancellation flag. A blocked
            // native API need not respond, so process termination follows below.
            if let Some(input) = worker.0.stdin.as_mut() {
                let _ = input.write_all(b"stop\n");
            }
        }
        if let Some((requested, reason)) = stop_requested {
            if requested.elapsed() >= grace {
                worker.0.kill()?;
                let status = worker.0.wait()?;
                return Ok(WorkerOutcome {
                    worker_pid: pid,
                    success: false,
                    forced: true,
                    reason: Some(reason.into()),
                    exit_code: status.code(),
                });
            }
        }
        std::thread::sleep(Duration::from_millis(25));
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn kills_and_reaps_a_worker_that_ignores_its_deadline() {
        let mut command = std::process::Command::new("/bin/sh");
        command.args(["-c", "exec sleep 20"]);
        let began = std::time::Instant::now();
        let result = supervise(
            command,
            &std::sync::atomic::AtomicBool::new(false),
            std::time::Duration::from_millis(100),
            std::time::Duration::from_millis(100),
        )
        .unwrap();
        assert!(result.forced);
        assert!(!result.success);
        assert_eq!(result.reason.as_deref(), Some("deadline"));
        assert!(began.elapsed() < std::time::Duration::from_secs(3));
    }

    #[test]
    fn cancellation_stops_worker_and_existing_failure_is_preserved() {
        let mut command = std::process::Command::new("/bin/sh");
        command.args(["-c", "exec sleep 20"]);
        let result = supervise(
            command,
            &std::sync::atomic::AtomicBool::new(true),
            std::time::Duration::from_secs(20),
            std::time::Duration::from_millis(100),
        )
        .unwrap();
        assert!(result.forced);
        assert_eq!(result.reason.as_deref(), Some("cancelled"));
        let mut command = std::process::Command::new("/bin/sh");
        command.args(["-c", "exit 7"]);
        let result = supervise(
            command,
            &std::sync::atomic::AtomicBool::new(false),
            std::time::Duration::from_secs(5),
            std::time::Duration::from_millis(100),
        )
        .unwrap();
        assert!(!result.forced);
        assert_eq!(result.exit_code, Some(7));
    }
}
