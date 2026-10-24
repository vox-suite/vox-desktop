use super::types::*;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn registry(dir: &Path) -> Result<Vec<LocalSource>, String> {
    match fs::read(dir.join("sources.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
        Err(e) => Err(e.to_string()),
    }
}
pub fn save(dir: &Path, sources: &[LocalSource]) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = dir.join("sources.json.tmp");
    fs::write(
        &tmp,
        serde_json::to_vec(sources).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(tmp, dir.join("sources.json")).map_err(|e| e.to_string())
}
fn excluded(p: &Path) -> bool {
    p.components().any(|c| {
        let s = c.as_os_str().to_string_lossy().to_ascii_lowercase();
        matches!(
            s.as_str(),
            ".git"
                | ".code-graph"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | ".venv"
                | "venv"
                | "__pycache__"
                | ".next"
                | ".vox"
                | "vendor"
                | ".idea"
        ) || s.starts_with(".env")
            || s.ends_with(".pem")
            || s.ends_with(".key")
            || s.contains("credentials")
            || matches!(s.as_str(), "id_rsa" | "id_ed25519" | "secrets.json")
    })
}
pub fn readable(p: &Path) -> bool {
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(
        ext.as_str(),
        "rs" | "js"
            | "jsx"
            | "ts"
            | "tsx"
            | "py"
            | "c"
            | "h"
            | "cc"
            | "cpp"
            | "hpp"
            | "go"
            | "java"
            | "kt"
            | "kts"
            | "swift"
            | "rb"
            | "php"
            | "cs"
            | "dart"
            | "md"
            | "txt"
            | "toml"
            | "json"
            | "yaml"
            | "yml"
            | "csv"
            | "sql"
            | "html"
            | "css"
            | "sh"
            | "cmake"
            | "xml"
            | "proto"
    ) || matches!(
        p.file_name().and_then(|s| s.to_str()),
        Some("Dockerfile" | "Makefile" | "CMakeLists.txt" | ".gitignore")
    )
}
pub fn collect(source: &LocalSource) -> Result<(BTreeMap<String, PathBuf>, Vec<String>), String> {
    let root = PathBuf::from(&source.root);
    if !root.exists() {
        return Err(format!(
            "{} is unavailable on this device. Relink it in Sources.",
            source.label
        ));
    }
    let mut files = BTreeMap::new();
    let mut warnings = vec![];
    let mut total = 0u64;
    let paths: Vec<PathBuf> = if source.kind == "file" {
        vec![root.clone()]
    } else {
        let mut paths = vec![];
        for entry in ignore::WalkBuilder::new(&root)
            .hidden(false)
            .follow_links(false)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .require_git(false)
            .filter_entry(|e| !excluded(e.path()) || e.depth() == 0)
            .build()
        {
            match entry {
                Ok(e) if e.file_type().is_some_and(|t| t.is_file()) => paths.push(e.into_path()),
                Ok(_) => {}
                Err(e) => warnings.push(e.to_string()),
            }
            if paths.len() > 30000 {
                warnings.push("Folder traversal stopped at 30,000 files. Import smaller source folders for complete coverage.".into());
                break;
            }
        }
        paths
    };
    for path in paths {
        if excluded(path.strip_prefix(&root).unwrap_or(&path)) || !readable(&path) {
            continue;
        }
        let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if !meta.is_file() || meta.file_type().is_symlink() {
            continue;
        }
        if meta.len() > 1_000_000 {
            warnings.push(format!(
                "Skipped {} (larger than 1 MB)",
                path.file_name().unwrap_or_default().to_string_lossy()
            ));
            continue;
        }
        total += meta.len();
        if files.len() >= 15000 || total > 200_000_000 {
            warnings.push("Import reached the 15,000 file / 200 MB limit. Add smaller folders to cover the rest.".into());
            break;
        }
        let relative = if source.kind == "file" {
            path.file_name()
                .ok_or("File has no name")?
                .to_string_lossy()
                .into_owned()
        } else {
            path.strip_prefix(&root)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/")
        };
        files.insert(relative, path);
    }
    Ok((files, warnings))
}
pub fn snapshot(dir: &Path, source: &mut LocalSource) -> Result<Vec<String>, String> {
    let (files, mut warnings) = collect(source)?;
    let snapshot = dir.join(&source.id).join("snapshot");
    fs::create_dir_all(snapshot.join(".git")).map_err(|e| e.to_string())?;
    let mut hashes = BTreeMap::new();
    for (relative, path) in files {
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        if std::str::from_utf8(&bytes).is_err() {
            warnings.push(format!("Skipped {relative} (not UTF-8 text)"));
            continue;
        }
        let h = hash(&bytes);
        let dest = snapshot.join(&relative);
        if source.hashes.get(&relative) != Some(&h) || !dest.exists() {
            fs::create_dir_all(dest.parent().ok_or("Invalid source path")?)
                .map_err(|e| e.to_string())?;
            fs::write(dest, &bytes).map_err(|e| e.to_string())?;
        }
        hashes.insert(relative, h);
    }
    for old in source.hashes.keys().filter(|p| !hashes.contains_key(*p)) {
        let _ = fs::remove_file(snapshot.join(old));
    }
    source.hashes = hashes;
    Ok(warnings)
}
pub fn changed(source: &LocalSource) -> Result<Vec<String>, String> {
    let (files, _) = collect(source)?;
    let mut changes = BTreeSet::new();
    for (rel, path) in &files {
        let h = hash(&fs::read(path).map_err(|e| e.to_string())?);
        if source.hashes.get(rel) != Some(&h) {
            changes.insert(rel.clone());
        }
    }
    for rel in source.hashes.keys() {
        if !files.contains_key(rel) {
            changes.insert(rel.clone());
        }
    }
    Ok(changes.into_iter().collect())
}
pub fn read(source: &LocalSource, citation: &Citation) -> Result<String, String> {
    let text = file_text(source, citation)?;
    if citation.start_line == 0 || citation.end_line < citation.start_line {
        return Err("Invalid line range".into());
    }
    if citation.start_line as usize > text.lines().count() {
        return Err("Citation line is outside this source file".into());
    }
    Ok(text
        .lines()
        .skip(citation.start_line as usize - 1)
        .take((citation.end_line - citation.start_line + 1).min(400) as usize)
        .collect::<Vec<_>>()
        .join("\n")
        .chars()
        .take(32000)
        .collect())
}
pub fn file_text(source: &LocalSource, citation: &Citation) -> Result<String, String> {
    let relative = Path::new(&citation.path);
    if relative.is_absolute()
        || relative
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err("Invalid source reference".into());
    }
    if !source.hashes.contains_key(&citation.path) {
        return Err("This file is not part of the approved source".into());
    }
    let root = Path::new(&source.root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let path = if source.kind == "file" {
        root.clone()
    } else {
        root.join(relative)
            .canonicalize()
            .map_err(|e| e.to_string())?
    };
    if source.kind != "file" && !path.starts_with(&root) {
        return Err("Source reference is outside the selected folder".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() > 1_000_000 {
        return Err("Source exceeds the read limit".into());
    }
    if !citation.hash.is_empty() && hash(&bytes) != citation.hash {
        return Err("This citation is outdated. Refresh its source first.".into());
    }
    String::from_utf8(bytes).map_err(|_| "Source is not UTF-8 text".into())
}
