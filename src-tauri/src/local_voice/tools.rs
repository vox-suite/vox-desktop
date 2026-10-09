use serde_json::{json, Value};

const DIRECT_TOOLS: &[&str] = &[
    "control_wiz_lights",
    "list_spans",
    "get_span",
    "list_visits",
    "show_on_map",
    "clear_map",
    "search_places",
    "get_route",
    "web_search",
    "read_connected_app",
    "list_timeline_types",
    "find_schemas",
    "list_data_schemas",
    "get_agent_memory",
];

pub fn is_direct(name: &str) -> bool {
    DIRECT_TOOLS.contains(&name)
}

pub struct ToolClient {
    http: reqwest::Client,
    base: String,
    token: String,
}

impl ToolClient {
    pub fn new(api_url: &str, token: &str) -> Self {
        Self {
            http: reqwest::Client::new(),
            base: api_url.trim_end_matches('/').to_string(),
            token: token.to_string(),
        }
    }

    pub async fn direct_manifest(&self) -> Result<String, String> {
        let manifest: Vec<Value> = self
            .http
            .get(format!("{}/v1/me/tools", self.base))
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let direct: Vec<Value> = manifest
            .into_iter()
            .filter(|t| t["name"].as_str().is_some_and(is_direct))
            .collect();
        serde_json::to_string(&direct).map_err(|e| e.to_string())
    }

    pub async fn invoke(&self, name: &str, arguments: &Value) -> Result<Value, String> {
        let result: Value = self
            .http
            .post(format!("{}/v1/me/tools/{name}", self.base))
            .bearer_auth(&self.token)
            .json(&json!({ "arguments": arguments }))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        if result["ok"].as_bool() == Some(true) {
            Ok(result["output"].clone())
        } else {
            Err(result["output"].to_string())
        }
    }
}
