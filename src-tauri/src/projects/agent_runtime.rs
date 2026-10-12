use base64::Engine;
use sha2::{Digest, Sha256, Sha512};
use std::{path::PathBuf, time::Duration};
use tokio::process::Command;

pub const RELEASE: &str = "v0.63.0";
const NODE: &str = "22.23.3";
pub fn root() -> Result<PathBuf, String> {
    Ok(super::private_root()?.join("engines").join(format!(
        "gemini-{RELEASE}-node{NODE}-{}",
        std::env::consts::ARCH
    )))
}
pub fn installed() -> bool {
    root().is_ok_and(|r| r.join("node").is_file() && r.join("bundle/gemini.js").is_file())
}
async fn download(url: &str, max: usize) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| "Could not download the investigation runtime")?
        .error_for_status()
        .map_err(|_| "Investigation runtime download failed")?;
    if response.content_length().is_some_and(|n| n > max as u64) {
        return Err("Runtime download exceeds limit".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Runtime download failed")?
    {
        if bytes.len() + chunk.len() > max {
            return Err("Runtime download exceeds limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
struct Staging(PathBuf);
impl Drop for Staging {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
pub async fn install() -> Result<(PathBuf, PathBuf), String> {
    let target = root()?;
    if installed() {
        return Ok((target.join("node"), target.join("bundle/gemini.js")));
    }
    let (package,integrity)=match (std::env::consts::OS,std::env::consts::ARCH) {
        ("macos","aarch64")=>("node-bin-darwin-arm64","oHKQBp50K1UojB6zfsHLRWaDg4IyDHfCGF+J20lae2eETor4YuOOYkZIfri8FAKUl1mNNSA7hLR+UHDuYyQd0g=="),
        ("macos","x86_64")=>("node-darwin-x64","V6W/fNXsKFF0DMrBrpLNp9meU45Qbe6tQ3HlzrpdiPWW+zlbmTGou1LE8aGHOghVWXJFexvi7RDCQVQi1I1t8w=="),
        _=>return Err("The managed Gemini runtime is currently available on macOS".into())
    };
    let staging = target.with_extension(uuid::Uuid::new_v4().to_string());
    super::agent::secure_dir(&staging)?;
    let _cleanup = Staging(staging.clone());
    let outcome=async {
        let bytes=download(&format!("https://registry.npmjs.org/{package}/-/{package}-{NODE}.tgz"),100_000_000).await?;
        if base64::engine::general_purpose::STANDARD.encode(Sha512::digest(&bytes))!=integrity{return Err("Node runtime integrity check failed".into());}
        super::agent::write_private(&staging.join("node.tgz"),&bytes)?;
        let status=Command::new("/usr/bin/tar").arg("-xzf").arg(staging.join("node.tgz")).arg("-C").arg(&staging).args(["package/bin/node","package/LICENSE"]).status().await.map_err(|e|e.to_string())?;
        if !status.success(){return Err("Node runtime extraction failed".into());}
        tokio::fs::rename(staging.join("package/bin/node"),staging.join("node")).await.map_err(|e|e.to_string())?;
        tokio::fs::rename(staging.join("package/LICENSE"),staging.join("NODE-LICENSE")).await.map_err(|e|e.to_string())?;
        let bytes=download(&format!("https://github.com/google-gemini/gemini-cli/releases/download/{RELEASE}/gemini-cli-bundle.zip"),50_000_000).await?;
        if format!("{:x}",Sha256::digest(&bytes))!="c9d66e50a0fe098a32486360308e558c472809da276caf2aac2769d8f10571c2" {return Err("Gemini engine integrity check failed".into());}
        super::agent::write_private(&staging.join("engine.zip"),&bytes)?;
        let status=Command::new("/usr/bin/unzip").arg("-oq").arg(staging.join("engine.zip")).arg("-d").arg(staging.join("bundle")).status().await.map_err(|e|e.to_string())?;
        if !status.success()||!staging.join("bundle/gemini.js").is_file(){return Err("Gemini engine extraction failed".into());}
        super::agent::write_private(&staging.join("GEMINI-NOTICE"),include_bytes!("../../../docs/gemini-engine-notice.txt"))?;
        let _=tokio::fs::remove_file(staging.join("engine.zip")).await;let _=tokio::fs::remove_file(staging.join("node.tgz")).await;let _=tokio::fs::remove_dir_all(staging.join("package")).await;
        if target.exists(){tokio::fs::remove_dir_all(&target).await.map_err(|e|e.to_string())?;}
        tokio::fs::rename(&staging,&target).await.map_err(|e|e.to_string())?;
        Ok((target.join("node"),target.join("bundle/gemini.js")))
    }.await;
    let _ = tokio::fs::remove_dir_all(staging).await;
    outcome
}
