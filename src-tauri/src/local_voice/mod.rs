mod chunker;
pub mod download;
mod fetch;
mod needle;
mod tools;
mod tts;

pub use chunker::SentenceChunker;

use crate::audio::AudioEngine;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

const MAX_DIRECT_CALLS: usize = 3;

struct Models {
    needle: needle::Needle,
    tts: tts::Tts,
}

static MODELS: Mutex<Option<Arc<Models>>> = Mutex::const_new(None);

pub struct LocalVoice {
    models: Arc<Models>,
    tools: tools::ToolClient,
}

pub struct LocalTurn {
    pub text: String,
    pub tool_results: Vec<Value>,
}

pub(crate) fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("VOX_LOCAL_MODELS_DIR") {
        return Ok(PathBuf::from(dir));
    }
    app.path()
        .app_data_dir()
        .map(|d| d.join("models"))
        .map_err(|e| e.to_string())
}

async fn models(app: &AppHandle) -> Result<Arc<Models>, String> {
    let mut slot = MODELS.lock().await;
    if let Some(models) = slot.as_ref() {
        return Ok(Arc::clone(models));
    }
    let dir = models_dir(app)?;
    let loaded = tokio::task::spawn_blocking(move || {
        Ok::<_, String>(Arc::new(Models {
            needle: needle::Needle::start(&dir.join("whistle.cact"), &dir.join("needle3.cact"))?,
            tts: tts::Tts::start(&dir)?,
        }))
    })
    .await
    .map_err(|e| e.to_string())??;
    *slot = Some(Arc::clone(&loaded));
    Ok(loaded)
}

impl LocalVoice {
    pub async fn start(app: &AppHandle, api_url: &str, token: &str) -> Result<Self, String> {
        let models = models(app).await?;
        let tools = tools::ToolClient::new(api_url, token);
        let manifest = tools.direct_manifest().await.unwrap_or_else(|_| "[]".into());
        models.needle.init_tools(manifest).await?;
        Ok(Self { models, tools })
    }

    pub async fn turn(&self, pcm: Vec<f32>) -> Result<Option<LocalTurn>, String> {
        let routed = self.models.needle.route(pcm).await?;
        if routed.text.is_empty() {
            return Ok(None);
        }
        let mut tool_results = Vec::new();
        for call in routed.calls.iter().take(MAX_DIRECT_CALLS) {
            if !tools::is_direct(&call.name) {
                continue;
            }
            match self.tools.invoke(&call.name, &call.arguments).await {
                Ok(output) => tool_results.push(json!({
                    "name": call.name,
                    "arguments": call.arguments,
                    "output": output,
                })),
                Err(err) => eprintln!("direct tool {} failed: {err}", call.name),
            }
        }
        Ok(Some(LocalTurn {
            text: routed.text,
            tool_results,
        }))
    }

    pub fn speak(&self, sentence: String, engine: &Arc<AudioEngine>) {
        self.models
            .tts
            .speak(sentence, engine.playback_epoch(), Arc::clone(engine));
    }
}
