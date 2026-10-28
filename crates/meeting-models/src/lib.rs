//! Pinned speech weights only: no audio, transcript, account token, or executable input.
use anyhow::{ensure, Context, Result};
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tokio::io::AsyncWriteExt;

pub const MODEL_SIZE: u64 = 147_951_465;
pub const MODEL_NAME: &str = "Whisper Base multilingual";
#[derive(Clone)]
struct Artifact {
    filename: &'static str,
    size: u64,
    sha256: String,
    url: String,
}
fn base_model() -> Artifact {
    Artifact { filename: "ggml-base-5359861.bin", size: MODEL_SIZE,
      sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe".into(),
      url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin".into() }
}
pub fn verify_base(root: &Path) -> Result<Option<PathBuf>> {
    verify(root, &base_model())
}
fn verify(root: &Path, spec: &Artifact) -> Result<Option<PathBuf>> {
    let path = root.join(spec.filename);
    let meta = match std::fs::symlink_metadata(&path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    ensure!(
        meta.is_file() && !meta.file_type().is_symlink(),
        "Model must be a regular local file"
    );
    if meta.len() != spec.size {
        return Ok(None);
    }
    let mut file = File::open(&path)?;
    let mut hash = Sha256::new();
    std::io::copy(&mut file, &mut hash)?;
    Ok((format!("{:x}", hash.finalize()) == spec.sha256).then_some(path))
}
fn check_cancel(cancel: &AtomicBool) -> Result<()> {
    ensure!(
        !cancel.load(Ordering::SeqCst),
        "Model installation cancelled"
    );
    Ok(())
}
struct PartialFile(PathBuf);
impl Drop for PartialFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}
pub async fn install_base(
    root: &Path,
    cancel: &AtomicBool,
    progress: impl FnMut(u64, bool),
) -> Result<PathBuf> {
    install(root, &base_model(), cancel, progress).await
}
async fn install(
    root: &Path,
    spec: &Artifact,
    cancel: &AtomicBool,
    mut progress: impl FnMut(u64, bool),
) -> Result<PathBuf> {
    check_cancel(cancel)?;
    std::fs::create_dir_all(root)?;
    ensure!(
        !std::fs::symlink_metadata(root)?.file_type().is_symlink(),
        "Model directory cannot be a symlink"
    );
    let lock_path = root.join("install.lock");
    ensure!(!lock_path.is_symlink(), "Invalid model install lock");
    let lock = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(lock_path)?;
    lock.try_lock()
        .context("Another model installation is active")?;
    progress(0, true);
    let owned_root = root.to_owned();
    let owned_spec = spec.clone();
    let installed = tokio::task::spawn_blocking(move || verify(&owned_root, &owned_spec)).await??;
    check_cancel(cancel)?;
    if let Some(path) = installed {
        progress(spec.size, true);
        return Ok(path);
    }
    let partial = PartialFile(root.join("model.download"));
    match std::fs::remove_file(&partial.0) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.into()),
    }
    let mut options = std::fs::OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut out = tokio::fs::File::from_std(options.open(&partial.0)?);
    let http = reqwest::Client::builder()
        .https_only(spec.url.starts_with("https://"))
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(1800))
        .build()?;
    let operation = async {
        let response = http.get(&spec.url).send().await?.error_for_status()?;
        ensure!(
            response.status() == reqwest::StatusCode::OK,
            "Unexpected model download response"
        );
        if let Some(size) = response.content_length() {
            ensure!(size == spec.size, "Model download has an unexpected size");
        }
        let mut stream = response.bytes_stream();
        let mut count = 0u64;
        let mut hash = Sha256::new();
        progress(0, false);
        while let Some(chunk) = tokio::time::timeout(Duration::from_secs(60), stream.next()).await?
        {
            let chunk = chunk?;
            count = count
                .checked_add(chunk.len() as u64)
                .context("Model size overflow")?;
            ensure!(
                count <= spec.size,
                "Model download exceeds the expected size"
            );
            out.write_all(&chunk).await?;
            hash.update(&chunk);
            progress(count, false);
        }
        progress(count, true);
        ensure!(count == spec.size, "Model download was incomplete");
        ensure!(
            format!("{:x}", hash.finalize()) == spec.sha256,
            "Model checksum mismatch; please retry"
        );
        out.sync_all().await?;
        Result::<()>::Ok(())
    };
    let result = tokio::select! {
        result=operation=>result,
        _=async { while !cancel.load(Ordering::SeqCst) {tokio::time::sleep(Duration::from_millis(50)).await;} }=>Err(anyhow::anyhow!("Model installation cancelled")),
    };
    // Await any in-flight filesystem operation and close the OS handle before
    // deleting a partial file, which is especially important on Windows.
    drop(out.into_std().await);
    result?;
    check_cancel(cancel)?;
    let final_path = root.join(spec.filename);
    if final_path.exists() {
        std::fs::remove_file(&final_path)?;
    }
    std::fs::rename(&partial.0, &final_path)?;
    // Persist the rename on Unix. Windows uses the synced file and rename contract.
    #[cfg(unix)]
    File::open(root)?.sync_all()?;
    Ok(final_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    fn artifact(body: &[u8]) -> Artifact {
        Artifact {
            filename: "test.bin",
            size: body.len() as u64,
            sha256: format!("{:x}", Sha256::digest(body)),
            url: String::new(),
        }
    }
    #[test]
    fn same_size_corruption_is_not_ready() {
        let dir = tempfile::tempdir().unwrap();
        let spec = artifact(b"good");
        std::fs::write(dir.path().join(spec.filename), b"evil").unwrap();
        assert!(verify(dir.path(), &spec).unwrap().is_none());
        std::fs::write(dir.path().join(spec.filename), b"good").unwrap();
        assert!(verify(dir.path(), &spec).unwrap().is_some());
    }
    #[test]
    fn model_pins_match_the_existing_verified_prototype() {
        let spec = base_model();
        assert_eq!(spec.size, 147_951_465);
        assert_eq!(
            spec.sha256,
            "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"
        );
        assert!(spec
            .url
            .contains("5359861c739e955e79d9a303bcbc70fb988958b1"));
    }
    #[tokio::test]
    async fn cancelled_download_never_publishes_or_overwrites_a_model() {
        let dir = tempfile::tempdir().unwrap();
        let spec = artifact(b"good");
        let cancelled = AtomicBool::new(true);
        assert!(install(dir.path(), &spec, &cancelled, |_, _| {})
            .await
            .is_err());
        assert!(!dir.path().join(spec.filename).exists());
        assert!(!dir.path().join("model.download").exists());
        cancelled.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod download_tests {
    use super::*;
    fn serve(body: &[u8]) -> (String, std::thread::JoinHandle<()>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/model", listener.local_addr().unwrap());
        let body = body.to_vec();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 4096];
            let _ = stream.read(&mut request);
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .unwrap();
            let _ = stream.write_all(&body);
        });
        (url, server)
    }
    fn spec(body: &[u8], url: String) -> Artifact {
        Artifact {
            filename: "test.bin",
            size: body.len() as u64,
            sha256: format!("{:x}", Sha256::digest(body)),
            url,
        }
    }
    #[tokio::test]
    async fn download_is_published_only_after_checksum_and_size_verification() {
        let dir = tempfile::tempdir().unwrap();
        let (url, server) = serve(b"good");
        let spec = spec(b"good", url);
        let mut ticks = vec![];
        let path = install(dir.path(), &spec, &AtomicBool::new(false), |n, v| {
            ticks.push((n, v))
        })
        .await
        .unwrap();
        server.join().unwrap();
        assert_eq!(std::fs::read(path).unwrap(), b"good");
        assert_eq!(ticks.last(), Some(&(4, true)));
        assert!(!dir.path().join("model.download").exists());
    }
    #[tokio::test]
    async fn corrupt_network_content_never_becomes_a_ready_model() {
        let dir = tempfile::tempdir().unwrap();
        let (url, server) = serve(b"evil");
        let spec = spec(b"good", url);
        assert!(
            install(dir.path(), &spec, &AtomicBool::new(false), |_, _| {})
                .await
                .unwrap_err()
                .to_string()
                .contains("checksum")
        );
        server.join().unwrap();
        assert!(!dir.path().join(spec.filename).exists());
        assert!(!dir.path().join("model.download").exists());
    }
    #[tokio::test]
    async fn cancellation_after_receiving_bytes_does_not_publish() {
        let dir = tempfile::tempdir().unwrap();
        let (url, server) = serve(b"good");
        let spec = spec(b"good", url);
        let cancel = AtomicBool::new(false);
        assert!(install(dir.path(), &spec, &cancel, |n, _| {
            if n > 0 {
                cancel.store(true, Ordering::SeqCst);
            }
        })
        .await
        .is_err());
        server.join().unwrap();
        assert!(!dir.path().join(spec.filename).exists());
        assert!(!dir.path().join("model.download").exists());
    }
    #[tokio::test]
    async fn a_verified_existing_model_is_reused_without_network() {
        let dir = tempfile::tempdir().unwrap();
        let spec = spec(b"good", "invalid-url".into());
        std::fs::write(dir.path().join(spec.filename), b"good").unwrap();
        assert!(
            install(dir.path(), &spec, &AtomicBool::new(false), |_, _| {})
                .await
                .is_ok()
        );
    }
    #[tokio::test]
    async fn install_lock_excludes_a_second_installer() {
        let dir = tempfile::tempdir().unwrap();
        let lock = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(false)
            .open(dir.path().join("install.lock"))
            .unwrap();
        lock.lock().unwrap();
        let spec = spec(b"good", "invalid-url".into());
        assert!(
            install(dir.path(), &spec, &AtomicBool::new(false), |_, _| {})
                .await
                .unwrap_err()
                .to_string()
                .contains("Another")
        );
    }
}

#[cfg(test)]
mod interruption_tests {
    use super::*;
    #[tokio::test]
    async fn cancellation_interrupts_a_stalled_http_response_and_cleans_partial() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/model", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut buf = [0; 2048];
            let _ = socket.read(&mut buf);
            let _ = socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\ng");
            std::thread::sleep(Duration::from_millis(500));
        });
        let dir = tempfile::tempdir().unwrap();
        let cancel = AtomicBool::new(false);
        let spec = Artifact {
            filename: "test.bin",
            size: 4,
            sha256: format!("{:x}", Sha256::digest(b"good")),
            url,
        };
        let start = std::time::Instant::now();
        assert!(install(dir.path(), &spec, &cancel, |n, _| {
            if n > 0 {
                cancel.store(true, Ordering::SeqCst);
            }
        })
        .await
        .unwrap_err()
        .to_string()
        .contains("cancelled"));
        assert!(start.elapsed() < Duration::from_millis(400));
        assert!(!dir.path().join("model.download").exists());
        assert!(!dir.path().join(spec.filename).exists());
        server.join().unwrap();
    }
}
