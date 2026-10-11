use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::process::Command;

pub const VERSION: &str = "v0.169.0";
pub trait CodeIndexEngine {
    fn database(&self, snapshot: &Path) -> PathBuf;
    fn executable(&self, root: &Path) -> PathBuf;
}
pub struct CodeGraph;
impl CodeIndexEngine for CodeGraph {
    fn database(&self, snapshot: &Path) -> PathBuf {
        snapshot.join(".code-graph/index.db")
    }
    fn executable(&self, root: &Path) -> PathBuf {
        root.join(format!(
            "code-graph-mcp-{VERSION}{}",
            std::env::consts::EXE_SUFFIX
        ))
    }
}
fn asset() -> Result<&'static str, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Ok("code-graph-mcp-darwin-arm64"),
        ("macos", "x86_64") => Ok("code-graph-mcp-darwin-x64"),
        ("linux", "aarch64") => Ok("code-graph-mcp-linux-arm64"),
        ("linux", "x86_64") => Ok("code-graph-mcp-linux-x64"),
        ("windows", "x86_64") => Ok("code-graph-mcp-win32-x64.exe"),
        _ => Err("Code indexing is not available for this platform".into()),
    }
}
pub async fn install(root: &Path) -> Result<(), String> {
    let engine = CodeGraph;
    let target = engine.executable(root);
    if target.is_file() {
        return Ok(());
    }
    tokio::fs::create_dir_all(root)
        .await
        .map_err(|e| e.to_string())?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let base = format!(
        "https://github.com/sdsrss/code-graph-mcp/releases/download/{VERSION}/{}",
        asset()?
    );
    let expected = client
        .get(format!("{base}.sha256"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let response = client
        .get(&base)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    if response.content_length().is_some_and(|n| n > 200_000_000) {
        return Err("Index engine download is too large".into());
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 200_000_000
        || expected.split_whitespace().next()
            != Some(format!("{:x}", Sha256::digest(&bytes)).as_str())
    {
        return Err("Index engine checksum failed".into());
    }
    let temp = target.with_extension("download");
    tokio::fs::write(&temp, &bytes)
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temp, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    tokio::fs::rename(temp, target)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
pub async fn index(root: &Path, snapshot: &Path) -> Result<(), String> {
    let binary = CodeGraph.executable(root);
    if !binary.is_file() {
        return Err("Install the local code indexer from Sources first".into());
    }
    let mut child = Command::new(binary)
        .arg("incremental-index")
        .arg("--no-embed")
        .arg("--json")
        .current_dir(snapshot)
        .env("CODE_GRAPH_NO_AUTO_UPDATE", "1")
        .env("CODE_GRAPH_NO_METRICS", "1")
        .kill_on_drop(true)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("Indexer has no output pipe")?;
    let stderr = child.stderr.take().ok_or("Indexer has no error pipe")?;
    let read = async move {
        use tokio::io::AsyncReadExt;
        let mut out = Vec::new();
        let mut err = Vec::new();
        let mut stdout = stdout.take(2_000_000);
        let mut stderr = stderr.take(2_000_000);
        let (a, b) = tokio::join!(stdout.read_to_end(&mut out), stderr.read_to_end(&mut err));
        a.map_err(|e| e.to_string())?;
        b.map_err(|e| e.to_string())?;
        Ok::<_, String>((out, err))
    };
    let result = tokio::time::timeout(Duration::from_secs(600), async {
        let (status, output) = tokio::join!(child.wait(), read);
        Ok::<_, String>((status.map_err(|e| e.to_string())?, output?))
    })
    .await;
    match result {
        Ok(Ok((status, (_, err)))) if !status.success() => Err(format!(
            "Indexing failed: {}",
            String::from_utf8_lossy(&err)
                .chars()
                .take(1500)
                .collect::<String>()
        )),
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(_) => {
            let _ = child.kill().await;
            Err("Indexing timed out. Try importing a smaller folder.".into())
        }
    }
}
