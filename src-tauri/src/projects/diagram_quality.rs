//! Evidence coverage checks, not a claim of automated semantic correctness.
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub const ASPECTS: [&str; 6] = [
    "trigger",
    "processing",
    "conditions",
    "concurrency",
    "outcomes",
    "failures",
];
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str, String> {
    v[key]
        .as_str()
        .filter(|s| !s.trim().is_empty() && s.len() <= 2000)
        .ok_or_else(|| format!("Missing or invalid {key}"))
}
fn array<'a>(v: &'a Value, key: &str, min: usize, max: usize) -> Result<&'a Vec<Value>, String> {
    v[key]
        .as_array()
        .filter(|a| a.len() >= min && a.len() <= max)
        .ok_or_else(|| format!("{key} must contain {min} to {max} entries"))
}
fn proof(v: &Value) -> Result<(), String> {
    let ids = array(v, "citations", 1, 20)?;
    if ids
        .iter()
        .any(|id| id.as_str().is_none_or(|s| s.is_empty()))
    {
        return Err("Use issued citation IDs".into());
    }
    Ok(())
}
pub fn keys(diagram: &Value) -> Result<(&'static str, &'static str), String> {
    match diagram["diagram_type"].as_str() {
        Some("architecture") => Ok(("components", "connections")),
        Some("workflow") => Ok(("nodes", "edges")),
        Some("sequence") => Ok(("participants", "messages")),
        Some("dataflow") => Ok(("nodes", "flows")),
        Some("lifecycle") => Ok(("states", "transitions")),
        _ => Err("Unknown diagram type".into()),
    }
}
pub fn report_schema() -> Value {
    let citations = json!({"type":"array","minItems":1,"maxItems":20,"items":{"type":"string"}});
    json!({"type":"object","required":["systems","boundaries","targets"],"properties":{
        "systems":{"type":"array","minItems":1,"maxItems":40,"items":{"type":"object","required":["id","name","kind","role","citations"],"properties":{"kind":{"type":"string","enum":["internal","external","concept"]},"source_id":{"type":"string"},"source_root":{"type":"string","description":"For internal owners, exact root from list_sources code_owners; use its canonical name in name."},"id":{"type":"string"},"name":{"type":"string"},"role":{"type":"string"},"citations":citations}}},
        "boundaries":{"type":"array","maxItems":80,"items":{"type":"object","required":["from","to","summary","citations"],"properties":{"from":{"type":"string"},"to":{"type":"string"},"summary":{"type":"string"},"citations":citations}}},
        "targets":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"object","required":["target_index","status","summary","mechanisms","aspects"],"properties":{
            "target_index":{"type":"integer","minimum":0},"status":{"type":"string","enum":["resolved","unresolved"]},"summary":{"type":"string"},"gap":{"type":"string"},
            "mechanisms":{"type":"array","maxItems":20,"items":{"type":"object","required":["summary","citations"],"properties":{"summary":{"type":"string"},"citations":citations}}},
            "aspects":{"type":"array","minItems":6,"maxItems":6,"items":{"type":"object","required":["aspect","status"],"properties":{"aspect":{"type":"string","enum":ASPECTS},"status":{"type":"string","enum":["explained","unresolved","not_applicable"]},"mechanism_indexes":{"type":"array","items":{"type":"integer","minimum":0}},"reason":{"type":"string"}}}}
        }}}
    }})
}
pub fn review_schema() -> Value {
    json!({"type":"object","required":["systems","boundaries","targets","checks"],"properties":{
        "systems":{"type":"array","items":{"type":"object","required":["system_id","element_ids"],"properties":{"system_id":{"type":"string"},"element_ids":{"type":"array","items":{"type":"string"}}}}},
        "boundaries":{"type":"array","items":{"type":"object","required":["boundary_index","relationship_indexes"],"properties":{"boundary_index":{"type":"integer"},"relationship_indexes":{"type":"array","items":{"type":"integer"}}}}},
        "targets":{"type":"array","items":{"type":"object","required":["target_index","mechanisms"],"properties":{"target_index":{"type":"integer"},"mechanisms":{"type":"array","items":{"type":"object","required":["mechanism_index","element_ids","relationship_indexes"],"properties":{"mechanism_index":{"type":"integer"},"element_ids":{"type":"array","items":{"type":"string"}},"relationship_indexes":{"type":"array","items":{"type":"integer"}}}}}}}},
        "checks":{"type":"array","minItems":4,"maxItems":4,"items":{"type":"object","required":["kind","assessment","citations"],"properties":{"kind":{"type":"string","enum":["request_fit","ownership","ordering","grounding"]},"assessment":{"type":"string"},"citations":{"type":"array","minItems":1,"items":{"type":"string"}}}}}
    }})
}
pub fn validate_report(plan: &Value, report: &Value) -> Result<(), String> {
    let systems = array(report, "systems", 1, 40)?;
    let mut ids = BTreeSet::new();
    for s in systems {
        if !ids.insert(text(s, "id")?) {
            return Err("Duplicate system ID".into());
        }
        if !matches!(text(s, "kind")?, "internal" | "external" | "concept") {
            return Err("System kind must be internal, external or concept".into());
        }
        text(s, "name")?;
        text(s, "role")?;
        proof(s)?;
    }
    for b in array(report, "boundaries", 0, 80)? {
        if !ids.contains(text(b, "from")?) || !ids.contains(text(b, "to")?) {
            return Err("Boundary references unknown system".into());
        }
        text(b, "summary")?;
        proof(b)?;
    }
    let count = array(plan, "investigation_targets", 1, 12)?.len();
    let targets = array(report, "targets", count, count)?;
    let mut seen = BTreeSet::new();
    for t in targets {
        let index = t["target_index"]
            .as_u64()
            .filter(|i| (*i as usize) < count)
            .ok_or("Invalid target_index")?;
        if !seen.insert(index) {
            return Err("Duplicate target_index".into());
        }
        text(t, "summary")?;
        let unresolved = match text(t, "status")? {
            "resolved" => false,
            "unresolved" => true,
            _ => return Err("Invalid target status".into()),
        };
        if unresolved {
            text(t, "gap")?;
        }
        let mechanisms = array(t, "mechanisms", if unresolved { 0 } else { 1 }, 20)?;
        for m in mechanisms {
            text(m, "summary")?;
            proof(m)?;
        }
        let mut aspects = BTreeSet::new();
        for a in array(t, "aspects", 6, 6)? {
            let name = text(a, "aspect")?;
            if !ASPECTS.contains(&name) || !aspects.insert(name) {
                return Err("Cover each mechanism aspect exactly once".into());
            }
            match text(a, "status")? {
                "explained" => {
                    for i in array(a, "mechanism_indexes", 1, 20)? {
                        if i.as_u64().is_none_or(|i| i as usize >= mechanisms.len()) {
                            return Err("Aspect references unknown mechanism".into());
                        }
                    }
                }
                "unresolved" | "not_applicable" => {
                    text(a, "reason")?;
                }
                _ => return Err("Invalid aspect status".into()),
            }
        }
    }
    Ok(())
}
fn find<'a>(items: &'a [Value], key: &str, value: &Value) -> Result<&'a Value, String> {
    let matches: Vec<_> = items.iter().filter(|v| &v[key] == value).collect();
    if matches.len() != 1 {
        return Err(format!("Map {key} {value} exactly once"));
    }
    Ok(matches[0])
}
fn subset_proof(required: &Value, provided: &Value) -> bool {
    required.as_array().is_some_and(|r| {
        !r.is_empty()
            && r.iter()
                .all(|id| provided.as_array().is_some_and(|p| p.contains(id)))
    })
}
/// Review maps every investigated claim to actual visible elements and relationships.
pub fn validate_review(
    report: &Value,
    args: &Value,
    base: Option<&Value>,
    expanding: bool,
) -> Result<(), String> {
    let diagram = &args["diagram"];
    let (nk, ek) = keys(diagram)?;
    let nodes = array(diagram, nk, 1, 40)?;
    let edges = array(diagram, ek, 0, 80)?;
    let np = array(args, "node_evidence", nodes.len(), nodes.len())?;
    let ep = array(args, "edge_evidence", edges.len(), edges.len())?;
    for n in nodes {
        proof(find(np, "id", &n["id"])?)?;
    }
    for i in 0..edges.len() {
        proof(find(ep, "index", &json!(i))?)?;
    }
    let review = &args["review"];
    let systems = array(report, "systems", 1, 40)?;
    let maps = array(review, "systems", systems.len(), systems.len())?;
    let mut owned = BTreeSet::new();
    for s in systems {
        let map = find(maps, "system_id", &s["id"])?;
        for id in array(map, "element_ids", 1, 40)? {
            let node = find(nodes, "id", id)?;
            let visible = ["label", "sublabel", "context"]
                .iter()
                .filter_map(|k| node[*k].as_str())
                .collect::<Vec<_>>()
                .join(" ");
            if !visible
                .to_lowercase()
                .contains(&text(s, "name")?.to_lowercase())
            {
                return Err(format!(
                    "Show system name {} on element {id} in label, sublabel or context",
                    s["name"]
                ));
            }
            if !subset_proof(&s["citations"], &find(np, "id", id)?["citations"]) {
                return Err(format!("Element {id} must include ownership citations {} for system {} in node_evidence", s["citations"], s["id"]));
            }
            owned.insert(id.to_string());
        }
    }
    if nodes.iter().any(|n| !owned.contains(&n["id"].to_string())) {
        return Err(
            "Every element needs an owning system or source-supported actor/concept".into(),
        );
    }
    let boundaries = array(report, "boundaries", 0, 80)?;
    let bm = array(review, "boundaries", boundaries.len(), boundaries.len())?;
    for (i, b) in boundaries.iter().enumerate() {
        let m = find(bm, "boundary_index", &json!(i))?;
        let from = &find(maps, "system_id", &b["from"])?["element_ids"];
        let to = &find(maps, "system_id", &b["to"])?["element_ids"];
        for index in array(m, "relationship_indexes", 1, 80)? {
            let j = index
                .as_u64()
                .filter(|j| (*j as usize) < edges.len())
                .ok_or("Unknown boundary relationship")? as usize;
            if !from.as_array().unwrap().contains(&edges[j]["from"])
                || !to.as_array().unwrap().contains(&edges[j]["to"])
            {
                return Err(format!("Boundary {i} ({} -> {}) maps to relationship {index} ({} -> {}), which does not connect those owners", b["from"], b["to"], edges[j]["from"], edges[j]["to"]));
            }
            if !subset_proof(&b["citations"], &find(ep, "index", index)?["citations"]) {
                return Err(format!(
                    "Relationship {index} must include boundary {i} citations {} in edge_evidence",
                    b["citations"]
                ));
            }
        }
    }
    let targets = array(report, "targets", 1, 12)?;
    let tm = array(review, "targets", targets.len(), targets.len())?;
    let gaps = array(args, "gaps", 0, 20)?;
    let mut explained_change = false;
    for t in targets {
        let map = find(tm, "target_index", &t["target_index"])?;
        if t["status"] == "unresolved" && !gaps.contains(&t["gap"]) {
            return Err("Include unresolved target gaps verbatim in gaps".into());
        }
        for a in t["aspects"].as_array().into_iter().flatten() {
            if a["status"] == "unresolved" && !gaps.contains(&a["reason"]) {
                return Err("Include unresolved mechanism aspects verbatim in gaps".into());
            }
        }
        let mechanisms = t["mechanisms"].as_array().ok_or("Missing mechanisms")?;
        let mm = array(map, "mechanisms", mechanisms.len(), mechanisms.len())?;
        for (i, m) in mechanisms.iter().enumerate() {
            let mapping = find(mm, "mechanism_index", &json!(i))?;
            let ids = array(mapping, "element_ids", 1, 40)?;
            let indexes = array(mapping, "relationship_indexes", 0, 80)?;
            let mut changed = false;
            for id in ids {
                let n = find(nodes, "id", id)?;
                if !subset_proof(&m["citations"], &find(np, "id", id)?["citations"]) {
                    return Err(format!("Element {id} must include target {} mechanism {i} citations {} in node_evidence", t["target_index"], m["citations"]));
                }
                let old = base
                    .and_then(|b| b["diagram"][nk].as_array())
                    .and_then(|ns| ns.iter().find(|n| n["id"] == *id));
                changed |= old.is_none_or(|old| {
                    ["label", "sublabel", "context"]
                        .iter()
                        .any(|k| old[*k] != n[*k])
                });
            }
            for index in indexes {
                let j = index
                    .as_u64()
                    .filter(|j| (*j as usize) < edges.len())
                    .ok_or("Unknown mechanism relationship")? as usize;
                if !ids.contains(&edges[j]["from"]) && !ids.contains(&edges[j]["to"]) {
                    return Err("Mechanism relationship must touch a mapped element".into());
                }
                if !subset_proof(&m["citations"], &find(ep, "index", index)?["citations"]) {
                    return Err(format!("Relationship {index} must include target {} mechanism {i} citations {} in edge_evidence", t["target_index"], m["citations"]));
                }
                changed |= base
                    .and_then(|b| b["diagram"][ek].as_array())
                    .is_none_or(|es| {
                        !es.iter().any(|e| {
                            e["from"] == edges[j]["from"]
                                && e["to"] == edges[j]["to"]
                                && e["label"] == edges[j]["label"]
                        })
                    });
            }
            explained_change |= changed && !indexes.is_empty();
        }
    }
    if expanding && !explained_change {
        return Err("Expansion needs a source-backed mechanism change connected to the flow; an extra isolated API box is insufficient".into());
    }
    let checks = array(review, "checks", 4, 4)?;
    for kind in ["request_fit", "ownership", "ordering", "grounding"] {
        let check = find(checks, "kind", &json!(kind))?;
        text(check, "assessment")?;
        proof(check)?;
    }
    Ok(())
}
pub fn candidate(args: &Value) -> Value {
    let mut result = json!({});
    for k in [
        "diagram",
        "node_evidence",
        "edge_evidence",
        "gaps",
        "mode",
        "replace_current",
        "removed_element_ids",
    ] {
        if !args[k].is_null() {
            result[k] = args[k].clone();
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (Value, Value, Value) {
        let plan = json!({"investigation_targets":["Explain the acknowledgement gate"]});
        let aspects: Vec<_> = ASPECTS
            .iter()
            .map(|aspect| json!({"aspect":aspect,"status":"explained","mechanism_indexes":[0]}))
            .collect();
        let report = json!({"systems":[
            {"id":"bridge","name":"Bridge","kind":"internal","role":"Orchestrates voice","citations":["c1"]},
            {"id":"core","name":"Core","kind":"internal","role":"Streams response","citations":["c2"]}],
            "boundaries":[{"from":"bridge","to":"core","summary":"Requests response","citations":["c1","c2"]}],
            "targets":[{"target_index":0,"status":"resolved","summary":"Gate races response","mechanisms":[{"summary":"Skip acknowledgement when response wins","citations":["c1"]}],"aspects":aspects}]});
        let checks:Vec<_>=["request_fit","ownership","ordering","grounding"].iter().map(|kind|json!({"kind":kind,"assessment":"Compared gate and response call sites","citations":["c1","c2"]})).collect();
        let args = json!({"diagram":{"diagram_type":"dataflow","nodes":[
            {"id":"gate","label":"Bridge: acknowledgement gate"}, {"id":"response","label":"Core: response"}],
            "flows":[{"from":"gate","to":"response","label":"Start response concurrently"}]},
            "node_evidence":[{"id":"gate","citations":["c1"]},{"id":"response","citations":["c2"]}],
            "edge_evidence":[{"index":0,"citations":["c1","c2"]}],"gaps":[],
            "review":{"systems":[{"system_id":"bridge","element_ids":["gate"]},{"system_id":"core","element_ids":["response"]}],
            "boundaries":[{"boundary_index":0,"relationship_indexes":[0]}],
            "targets":[{"target_index":0,"mechanisms":[{"mechanism_index":0,"element_ids":["gate"],"relationship_indexes":[0]}]}],"checks":checks}});
        (plan, report, args)
    }
    #[test]
    fn grounded_connected_expansion_is_accepted() {
        let (p, r, a) = fixture();
        validate_report(&p, &r).unwrap();
        validate_review(
            &r,
            &a,
            Some(&json!({"diagram":{"nodes":[],"flows":[]}})),
            true,
        )
        .unwrap();
    }
    #[test]
    fn omitted_or_duplicate_targets_and_unexamined_aspects_are_rejected() {
        let (p, mut r, _) = fixture();
        r["targets"] = json!([]);
        assert!(validate_report(&p, &r).is_err());
        let (p, mut r, _) = fixture();
        r["targets"][0]["aspects"][1]["aspect"] = json!("trigger");
        assert!(validate_report(&p, &r).is_err());
        let (p, mut r, _) = fixture();
        r["targets"][0]["aspects"][0]["mechanism_indexes"] = json!([99]);
        assert!(validate_report(&p, &r).is_err());
    }
    #[test]
    fn unresolved_findings_must_reach_user_visible_gaps() {
        let (p, mut r, mut a) = fixture();
        r["targets"][0]["status"] = json!("unresolved");
        r["targets"][0]["gap"] = json!("Deployment config unavailable");
        validate_report(&p, &r).unwrap();
        assert!(validate_review(&r, &a, None, false).is_err());
        a["gaps"] = json!(["Deployment config unavailable"]);
        validate_review(&r, &a, None, false).unwrap();
        r["targets"][0]["aspects"][0] =
            json!({"aspect":"trigger","status":"unresolved","reason":"No entry point found"});
        assert!(validate_review(&r, &a, None, false).is_err());
    }
    #[test]
    fn generic_labels_missing_citations_and_false_boundaries_are_rejected() {
        let (_, r, mut a) = fixture();
        a["diagram"]["nodes"][0]["label"] = json!("Agent Client");
        assert!(validate_review(&r, &a, None, false).is_err());
        let (_, r, mut a) = fixture();
        a["edge_evidence"][0]["citations"] = json!([]);
        assert!(validate_review(&r, &a, None, false).is_err());
        let (_, r, mut a) = fixture();
        a["diagram"]["flows"][0]["to"] = json!("gate");
        assert!(validate_review(&r, &a, None, false).is_err());
        let (_, r, mut a) = fixture();
        a["review"]["targets"][0]["mechanisms"] = json!([]);
        assert!(validate_review(&r, &a, None, false).is_err());
    }
    #[test]
    fn unchanged_mechanisms_or_isolated_boxes_are_not_expansions() {
        let (_, r, mut a) = fixture();
        let base = json!({"diagram":a["diagram"]});
        assert!(validate_review(&r, &a, Some(&base), true).is_err());
        a["diagram"]["meta"] = json!({"title":"Very detailed explanation"});
        assert!(validate_review(&r, &a, Some(&base), true).is_err());
        a["diagram"]["nodes"][0]["row"] = json!(5);
        assert!(validate_review(&r, &a, Some(&base), true).is_err());
        a["diagram"]["nodes"][0]["label"] =
            json!("Bridge: skip acknowledgement after first sentence");
        a["review"]["targets"][0]["mechanisms"][0]["relationship_indexes"] = json!([]);
        assert!(validate_review(&r, &a, Some(&base), true).is_err());
        a["review"]["targets"][0]["mechanisms"][0]["relationship_indexes"] = json!([0]);
        validate_review(&r, &a, Some(&base), true).unwrap();
    }
    #[test]
    fn reviewed_candidate_identity_includes_evidence_gaps_and_revision_flags() {
        let (_, _, a) = fixture();
        for key in [
            "diagram",
            "node_evidence",
            "edge_evidence",
            "gaps",
            "mode",
            "replace_current",
            "removed_element_ids",
        ] {
            let mut changed = a.clone();
            changed[key] = json!("changed");
            assert_ne!(candidate(&a), candidate(&changed));
        }
    }
    #[test]
    fn ownership_and_proofs_apply_to_all_five_representations() {
        for kind in [
            "architecture",
            "workflow",
            "sequence",
            "dataflow",
            "lifecycle",
        ] {
            let (_, r, mut a) = fixture();
            let nodes = a["diagram"]["nodes"].clone();
            let edges = a["diagram"]["flows"].clone();
            a["diagram"] = json!({"diagram_type":kind});
            let (nk, ek) = keys(&a["diagram"]).unwrap();
            a["diagram"][nk] = nodes;
            a["diagram"][ek] = edges;
            validate_review(&r, &a, None, false).unwrap();
        }
    }
}
