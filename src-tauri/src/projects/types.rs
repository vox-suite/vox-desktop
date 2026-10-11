use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Serialize, Deserialize)]
pub struct LocalSource {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub root: String,
    #[serde(default)]
    pub hashes: BTreeMap<String, String>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Citation {
    pub source_id: String,
    pub path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub hash: String,
}
#[derive(Serialize)]
pub struct IndexResult {
    pub source: serde_json::Value,
    pub nodes: Vec<serde_json::Value>,
    pub warnings: Vec<String>,
}
#[derive(Serialize)]
pub struct Symbol {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub citation: Citation,
    pub signature: Option<String>,
}
#[derive(Serialize)]
pub struct Relation {
    pub from: i64,
    pub to: i64,
    pub kind: String,
    pub confidence: String,
}
#[derive(Serialize)]
pub struct GraphPage {
    pub symbols: Vec<Symbol>,
    pub relations: Vec<Relation>,
    pub files: Vec<String>,
    pub total: i64,
    pub next_offset: Option<i64>,
}
