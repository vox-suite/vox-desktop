use base64::Engine;
/**
* Local PTY-backed shell session driven by commands received over the
* device's real-time connection to Vox Core.
*/
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const DONE_MARKER: &str = "__VOX_CMD_DONE__";
const MAX_WAIT: Duration = Duration::from_secs(30 * 60);
const POLL_INTERVAL: Duration = Duration::from_millis(100);

struct PtySession {
    writer: Box<dyn Write + Send>,
    output: Arc<Mutex<Vec<u8>>>,
    _master: Box<dyn MasterPty + Send>,
    _child: Box<dyn Child + Send + Sync>,
}

type Session = Arc<Mutex<Option<PtySession>>>;

#[derive(Clone, Default)]
pub struct TerminalManager(Session, Arc<Mutex<Option<AppHandle>>>);

#[cfg(windows)]
fn shell_command() -> CommandBuilder {
    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.arg("-NoLogo");
    if let Ok(home) = std::env::var("USERPROFILE") {
        cmd.cwd(home);
    }
    cmd
}

#[cfg(not(windows))]
fn shell_command() -> CommandBuilder {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(shell);
    cmd.arg("-l");
    cmd.env("TERM", "xterm-256color");
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }
    cmd
}

#[cfg(windows)]
fn done_marker_command() -> String {
    format!("Write-Host \"`n{DONE_MARKER}:$(if ($?) {{0}} else {{1}})\"\r")
}

#[cfg(not(windows))]
fn done_marker_command() -> String {
    format!("printf '\\n{DONE_MARKER}:%d\\n' $?\n")
}

impl TerminalManager {
    pub fn set_app_handle(&self, app: AppHandle) {
        if let Ok(mut guard) = self.1.lock() {
            *guard = Some(app);
        }
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), String> {
        let guard = self.0.lock().map_err(|e| e.to_string())?;
        let session = guard.as_ref().ok_or("no terminal session is open")?;
        session
            ._master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    /// Opens a shell session if one isn't already running. Idempotent.
    pub fn open_shell(&self) -> Result<(), String> {
        let mut guard = self.0.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Ok(());
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 40,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let child = pair
            .slave
            .spawn_command(shell_command())
            .map_err(|e| e.to_string())?;
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let output = Arc::new(Mutex::new(Vec::new()));
        let output_writer = output.clone();
        let session_slot = self.0.clone();
        let app = self.1.lock().ok().and_then(|a| a.clone());
        std::thread::spawn(move || {
            let mut chunk = [0u8; 4096];
            loop {
                match reader.read(&mut chunk) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if let Some(app) = &app {
                            let _ = app.emit(
                                "terminal-data",
                                base64::engine::general_purpose::STANDARD.encode(&chunk[..n]),
                            );
                        }
                        if let Ok(mut buf) = output_writer.lock() {
                            buf.extend_from_slice(&chunk[..n]);
                            if buf.len() > 262144 {
                                let extra = buf.len() - 262144;
                                buf.drain(..extra);
                            }
                        }
                    }
                }
            }
            if let Ok(mut slot) = session_slot.lock() {
                slot.take();
            }
            if let Some(app) = &app {
                let _ = app.emit("terminal-exit", ());
            }
        });

        *guard = Some(PtySession {
            writer,
            output,
            _master: pair.master,
            _child: child,
        });
        Ok(())
    }

    pub fn close(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut session) = guard.take() {
                let _ = session._child.kill();
            }
        }
    }
    pub fn snapshot(&self) -> Result<String, String> {
        let guard = self.0.lock().map_err(|e| e.to_string())?;
        let session = guard.as_ref().ok_or("no terminal session is open")?;
        let bytes = session.output.lock().map_err(|e| e.to_string())?;
        Ok(strip_ansi(&String::from_utf8_lossy(&bytes)))
    }
    pub fn write_input(&self, input: &str) -> Result<(), String> {
        if input.len() > 8192 {
            return Err("terminal input too large".into());
        }
        let mut guard = self.0.lock().map_err(|e| e.to_string())?;
        let session = guard.as_mut().ok_or("no terminal session is open")?;
        session
            .writer
            .write_all(input.as_bytes())
            .map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())
    }

    /// Blocking: call from a dedicated thread (e.g. `spawn_blocking`), never
    /// from an async task directly.
    pub fn run_command(&self, command: &str) -> Result<(String, Option<i32>), String> {
        let output = {
            let mut guard = self.0.lock().map_err(|e| e.to_string())?;
            if guard.is_none() {
                drop(guard);
                self.open_shell()?;
                guard = self.0.lock().map_err(|e| e.to_string())?;
            }
            let session = guard.as_mut().ok_or("no terminal session is open")?;
            if let Ok(mut buf) = session.output.lock() {
                buf.clear();
            }
            session
                .writer
                .write_all(command.as_bytes())
                .map_err(|e| e.to_string())?;
            session
                .writer
                .write_all(if cfg!(windows) { b"\r" } else { b"\n" })
                .map_err(|e| e.to_string())?;
            session
                .writer
                .write_all(done_marker_command().as_bytes())
                .map_err(|e| e.to_string())?;
            session.writer.flush().map_err(|e| e.to_string())?;
            session.output.clone()
        };

        let start = Instant::now();
        let exit_code = loop {
            std::thread::sleep(POLL_INTERVAL);
            let code = output.lock().ok().and_then(|buf| find_exit_code(&buf));
            if code.is_some() {
                break code;
            }
            if start.elapsed() >= MAX_WAIT {
                break None;
            }
        };

        let bytes = output.lock().map(|buf| buf.clone()).unwrap_or_default();
        let text = strip_ansi(&String::from_utf8_lossy(&bytes));
        Ok((strip_done_marker(&text), exit_code))
    }
}

fn find_exit_code(buf: &[u8]) -> Option<i32> {
    let text = String::from_utf8_lossy(buf);
    let prefix = format!("{DONE_MARKER}:");
    let after = &text[text.rfind(&prefix)? + prefix.len()..];
    let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() || after.len() == digits.len() {
        return None;
    }
    digits.parse().ok()
}

fn strip_done_marker(text: &str) -> String {
    text.lines()
        .filter(|line| !line.contains(DONE_MARKER))
        .map(|line| format!("{line}\n"))
        .collect()
}

/// Strips common ANSI escape sequences so command output reads cleanly as
/// plain text (it gets spoken back and/or sent to an LLM, not rendered).
fn strip_ansi(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            match chars.peek() {
                Some('[') => {
                    chars.next();
                    for next in chars.by_ref() {
                        if next.is_ascii_alphabetic() {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    while let Some(next) = chars.next() {
                        if next == '\u{7}' {
                            break;
                        }
                        if next == '\u{1b}' && chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
                _ => {}
            }
            continue;
        }
        output.push(c);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::strip_ansi;

    #[test]
    fn strips_color_codes_and_keeps_text() {
        let input = "\u{1b}[32mok\u{1b}[0m: \u{1b}[1mdone\u{1b}[0m\n";
        assert_eq!(strip_ansi(input), "ok: done\n");
    }
}

#[tauri::command]
pub async fn terminal_open(state: tauri::State<'_, TerminalManager>) -> Result<(), String> {
    let terminal = state.inner().clone();
    tokio::task::spawn_blocking(move || terminal.open_shell())
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn terminal_output(state: tauri::State<'_, TerminalManager>) -> Result<String, String> {
    state.snapshot()
}
#[tauri::command]
pub fn terminal_input(
    state: tauri::State<'_, TerminalManager>,
    input: String,
) -> Result<(), String> {
    state.write_input(&input)
}
#[tauri::command]
pub fn terminal_resize(
    state: tauri::State<'_, TerminalManager>,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.resize(rows, cols)
}
