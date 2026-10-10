use futures_util::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

#[derive(Deserialize)]
struct Manifest {
    files: Vec<ManifestFile>,
}

#[derive(Deserialize)]
struct ManifestFile {
    path: String,
    sha256: String,
    size: u64,
}

pub async fn sync(
    base: &str,
    dir: &Path,
    on_total: impl FnOnce(u64),
    mut on_progress: impl FnMut(u64),
) -> Result<(), String> {
    let http = reqwest::Client::new();
    let manifest: Manifest = http
        .get(format!("{base}/manifest.json"))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("manifest: {e}"))?
        .json()
        .await
        .map_err(|e| format!("manifest: {e}"))?;

    let mut missing = Vec::new();
    for file in &manifest.files {
        let target = safe_join(dir, &file.path)?;
        if !is_current(&target, file.size) {
            missing.push((file, target));
        }
    }
    on_total(missing.iter().map(|(f, _)| f.size).sum());

    let mut done = 0u64;
    for (file, target) in missing {
        done = fetch(&http, base, file, &target, done, &mut on_progress).await?;
    }
    Ok(())
}

fn is_current(path: &Path, size: u64) -> bool {
    std::fs::metadata(path).is_ok_and(|m| m.len() == size)
}

fn safe_join(dir: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = Path::new(rel);
    if rel.is_absolute()
        || rel
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(format!("unsafe manifest path: {}", rel.display()));
    }
    Ok(dir.join(rel))
}

async fn fetch(
    http: &reqwest::Client,
    base: &str,
    file: &ManifestFile,
    target: &Path,
    mut done: u64,
    on_progress: &mut impl FnMut(u64),
) -> Result<u64, String> {
    if let Some(parent) = target.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let part = target.with_extension("part");
    let mut resume = tokio::fs::metadata(&part).await.map(|m| m.len()).unwrap_or(0);
    if resume > file.size {
        resume = 0;
    }

    let mut request = http.get(format!("{base}/{}", file.path));
    if resume > 0 {
        request = request.header("Range", format!("bytes={resume}-"));
    }
    let response = request
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("{}: {e}", file.path))?;
    if resume > 0 && response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        resume = 0;
    }

    let mut out = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(resume > 0)
        .truncate(resume == 0)
        .open(&part)
        .await
        .map_err(|e| e.to_string())?;
    done += resume;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("{}: {e}", file.path))?;
        out.write_all(&chunk).await.map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        on_progress(done);
    }
    out.flush().await.map_err(|e| e.to_string())?;
    drop(out);

    let digest = hash_file(&part).await?;
    if !digest.eq_ignore_ascii_case(&file.sha256) {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(format!("{}: checksum mismatch", file.path));
    }
    tokio::fs::rename(&part, target)
        .await
        .map_err(|e| e.to_string())?;
    on_progress(done);
    Ok(done)
}

async fn hash_file(path: &Path) -> Result<String, String> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
        Ok(format!("{:x}", hasher.finalize()))
    })
    .await
    .map_err(|e| e.to_string())?
}
