use super::{
    engine::{CodeGraph, CodeIndexEngine},
    sources,
    types::*,
};
use rusqlite::{Connection, OpenFlags, params};
use serde_json::json;
use std::{collections::BTreeMap, path::Path};

fn open(dir: &Path, source: &LocalSource) -> Result<Connection, String> {
    Connection::open_with_flags(
        CodeGraph.database(&dir.join(&source.id).join("snapshot")),
        OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|e| format!("Local index is unavailable. Refresh this source. {e}"))
}
fn relative(path: String, dir: &Path, source: &LocalSource) -> String {
    path.strip_prefix(&format!(
        "{}/",
        dir.join(&source.id).join("snapshot").to_string_lossy()
    ))
    .unwrap_or(&path)
    .to_string()
}
pub fn page(
    dir: &Path,
    source: &LocalSource,
    path: &str,
    search: &str,
    offset: i64,
) -> Result<GraphPage, String> {
    let db = open(dir, source)?;
    let offset = offset.max(0);
    let search = search.chars().take(200).collect::<String>();
    let pattern = format!(
        "%{}%",
        search
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    );
    let mut stmt=db.prepare("SELECT n.id,n.name,n.type,f.path,n.start_line,n.end_line,n.signature FROM nodes n JOIN files f ON f.id=n.file_id WHERE (n.name LIKE ?1 ESCAPE '\\' OR f.path LIKE ?1 ESCAPE '\\') ORDER BY f.path,n.start_line,n.id").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map(params![pattern], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, u32>(4)?,
                r.get::<_, u32>(5)?,
                r.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut symbols = vec![];
    let mut total = 0i64;
    for row in rows {
        let (id, name, kind, file, start, end, signature) = row.map_err(|e| e.to_string())?;
        let file = relative(file, dir, source);
        if !source.hashes.contains_key(&file)
            || (!path.is_empty() && file != path && !file.starts_with(&format!("{path}/")))
        {
            continue;
        }
        if total >= offset && symbols.len() < 80 {
            symbols.push(Symbol {
                id,
                name,
                kind,
                signature,
                citation: Citation {
                    source_id: source.id.clone(),
                    hash: source.hashes.get(&file).cloned().unwrap_or_default(),
                    path: file,
                    start_line: start.max(1),
                    end_line: end.max(start).max(1),
                },
            });
        }
        total += 1;
    }
    let mut relations = vec![];
    if !symbols.is_empty() {
        let ids = symbols
            .iter()
            .map(|s| s.id.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT source_id,target_id,relation,confidence FROM edges WHERE source_id IN ({ids}) AND target_id IN ({ids}) LIMIT 400"
        );
        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
        for row in stmt
            .query_map([], |r| {
                Ok(Relation {
                    from: r.get(0)?,
                    to: r.get(1)?,
                    kind: r.get(2)?,
                    confidence: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
        {
            relations.push(row.map_err(|e| e.to_string())?);
        }
    }
    let files = source
        .hashes
        .keys()
        .filter(|f| {
            (path.is_empty() || f.starts_with(path))
                && (search.is_empty() || f.to_lowercase().contains(&search.to_lowercase()))
        })
        .take(500)
        .cloned()
        .collect();
    let next_offset = if offset + 80 < total {
        Some(offset + 80)
    } else {
        None
    };
    Ok(GraphPage {
        symbols,
        relations,
        files,
        total,
        next_offset,
    })
}
pub fn summary(
    dir: &Path,
    source: &LocalSource,
    warnings: Vec<String>,
) -> Result<IndexResult, String> {
    let db = open(dir, source)?;
    let symbols: i64 = db
        .query_row("SELECT count(*) FROM nodes", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let mut groups: BTreeMap<String, Vec<&String>> = BTreeMap::new();
    for file in source.hashes.keys() {
        let parts = file.split('/').collect::<Vec<_>>();
        let key = if parts.len() > 2 {
            parts[..2].join("/")
        } else if parts.len() > 1 {
            parts[0].into()
        } else {
            "Root files".into()
        };
        groups.entry(key).or_default().push(file);
    }
    let now = chrono::Utc::now().to_rfc3339();
    let mut nodes = vec![];
    for (name, files) in groups.into_iter().take(60) {
        let citations=files.iter().take(8).map(|file|json!({"source_id":source.id,"path":file,"start_line":1,"end_line":1,"hash":source.hashes.get(*file)})).collect::<Vec<_>>();
        let body = format!(
            "{} contains {} indexed text files. Files include: {}. Open this component to inspect symbols and relationships. This is extracted structure; behavior has not been inferred.",
            source.label,
            files.len(),
            files
                .iter()
                .take(10)
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        );
        nodes.push(json!({"id":uuid::Uuid::new_v4().to_string(),"kind":"component","title":format!("{} / {}",source.label,name),"body":body,"origin":"extracted","stale":false,"citations":citations,"history":[],"updated_at":now}));
    }
    let fingerprint =
        sources::hash(&serde_json::to_vec(&source.hashes).map_err(|e| e.to_string())?);
    Ok(IndexResult {
        source: json!({"id":source.id,"label":source.label,"kind":source.kind,"files":source.hashes.len(),"symbols":symbols,"fingerprint":fingerprint,"indexed_at":now}),
        nodes,
        warnings,
    })
}

pub fn retrieve(dir: &Path, source: &LocalSource, query: &str) -> Result<Vec<Citation>, String> {
    let db = open(dir, source)?;
    let words = query
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|w| {
            w.len() > 2
                && !matches!(
                    w.to_ascii_lowercase().as_str(),
                    "the"
                        | "and"
                        | "how"
                        | "does"
                        | "this"
                        | "that"
                        | "with"
                        | "what"
                        | "can"
                        | "for"
                        | "from"
                        | "our"
                        | "project"
                        | "please"
                        | "works"
                        | "work"
                        | "pipeline"
                        | "explain"
                )
        })
        .take(12)
        .map(|w| format!("\"{}\"", w.replace('"', "")))
        .collect::<Vec<_>>();
    if words.is_empty() {
        return Ok(vec![]);
    }
    let mut stmt=db.prepare("SELECT n.id,f.path,n.start_line,n.end_line FROM nodes_fts JOIN nodes n ON n.id=nodes_fts.rowid JOIN files f ON f.id=n.file_id WHERE nodes_fts MATCH ?1 AND f.path NOT LIKE '%/tests/%' AND f.path NOT LIKE '%/test/%' ORDER BY CASE WHEN n.type IN ('function','method') AND n.is_test=0 THEN 0 ELSE 1 END, rank LIMIT 16").map_err(|e|e.to_string())?;
    let mut citations = vec![];
    let mut seeds = vec![];
    for row in stmt
        .query_map(params![words.join(" OR ")], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, u32>(2)?,
                r.get::<_, u32>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
    {
        let (id, file, start, end) = row.map_err(|e| e.to_string())?;
        seeds.push(id);
        let path = relative(file, dir, source);
        if let Some(hash) = source.hashes.get(&path) {
            citations.push(Citation {
                source_id: source.id.clone(),
                path,
                start_line: start.saturating_sub(8).max(1),
                end_line: end
                    .max(start.saturating_add(100))
                    .min(start.saturating_add(199)),
                hash: hash.clone(),
            });
        }
    }
    if !seeds.is_empty() {
        let ids = seeds
            .iter()
            .map(i64::to_string)
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT DISTINCT f.path,n.start_line,n.end_line FROM edges e JOIN nodes n ON n.id = CASE WHEN e.source_id IN ({ids}) THEN e.target_id ELSE e.source_id END JOIN files f ON f.id=n.file_id WHERE e.source_id IN ({ids}) OR e.target_id IN ({ids}) LIMIT 20"
        );
        let mut related = db.prepare(&sql).map_err(|e| e.to_string())?;
        for row in related
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, u32>(1)?,
                    r.get::<_, u32>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?
        {
            let (file, start, end) = row.map_err(|e| e.to_string())?;
            let path = relative(file, dir, source);
            if let Some(hash) = source.hashes.get(&path) {
                if !citations
                    .iter()
                    .any(|c| c.path == path && c.start_line == start.max(1))
                {
                    citations.push(Citation {
                        source_id: source.id.clone(),
                        path,
                        start_line: start.saturating_sub(8).max(1),
                        end_line: end
                            .max(start.saturating_add(100))
                            .min(start.saturating_add(199)),
                        hash: hash.clone(),
                    });
                }
            }
        }
    }
    Ok(citations)
}
pub fn brief(source: &LocalSource) -> Vec<Citation> {
    let mut paths = source
        .hashes
        .keys()
        .filter(|p| {
            let name = std::path::Path::new(p)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_ascii_lowercase();
            name.starts_with("readme")
                || matches!(
                    name.as_str(),
                    "package.json" | "cargo.toml" | "pyproject.toml" | "cmakelists.txt" | "go.mod"
                )
                || source.kind == "file"
        })
        .collect::<Vec<_>>();
    paths.sort_by_key(|p| (p.matches('/').count(), p.len()));
    paths
        .into_iter()
        .take(8)
        .map(|path| Citation {
            source_id: source.id.clone(),
            path: path.clone(),
            start_line: 1,
            end_line: 200,
            hash: source.hashes[path].clone(),
        })
        .collect()
}
