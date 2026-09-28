/**
 * Local on-device Whisper speech-to-text engine and model manager.
 */
use crate::model_download::{download_model_file, models_dir};
use std::path::PathBuf;
use tauri::AppHandle;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const STT_MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";
const STT_MODEL_FILENAME: &str = "ggml-tiny.en.bin";

pub fn stt_model_path() -> PathBuf {
    models_dir().join(STT_MODEL_FILENAME)
}

pub fn is_stt_model_downloaded() -> bool {
    stt_model_path().exists()
}

pub async fn download_stt_model(app: AppHandle) -> Result<(), String> {
    download_model_file(&app, STT_MODEL_URL, stt_model_path(), "local-stt-download-progress").await
}

pub struct LocalSttEngine {
    ctx: WhisperContext,
}

impl LocalSttEngine {
    pub fn load() -> Result<Self, String> {
        let path = stt_model_path();
        if !path.exists() {
            return Err("Local Whisper model not found. Please download it first.".to_string());
        }

        let ctx = WhisperContext::new_with_params(
            &path,
            WhisperContextParameters::default(),
        )
        .map_err(|e| format!("Failed to initialize Whisper: {e:?}"))?;

        Ok(Self { ctx })
    }

    pub fn transcribe(&self, audio_16k_mono: &[f32]) -> Result<String, String> {
        if audio_16k_mono.is_empty() {
            return Ok(String::new());
        }

        let mut state = self.ctx.create_state().map_err(|e| format!("{e:?}"))?;
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_n_threads(4);
        params.set_language(Some("en"));
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_single_segment(true);

        state
            .full(params, audio_16k_mono)
            .map_err(|e| format!("Whisper inference error: {e:?}"))?;

        let mut text = String::new();
        for segment in state.as_iter() {
            if let Ok(segment_str) = segment.to_str() {
                text.push_str(segment_str);
            }
        }

        Ok(text.trim().to_string())
    }
}

static STT_CACHE: std::sync::Mutex<Option<std::sync::Arc<LocalSttEngine>>> =
    std::sync::Mutex::new(None);

pub fn get_stt_engine() -> Result<std::sync::Arc<LocalSttEngine>, String> {
    let mut guard = STT_CACHE
        .lock()
        .map_err(|_| "STT cache lock poisoned".to_string())?;
    if guard.is_none() {
        let engine = LocalSttEngine::load()?;
        *guard = Some(std::sync::Arc::new(engine));
    }
    Ok(guard.as_ref().expect("just set above").clone())
}

#[tauri::command]
pub fn is_local_stt_downloaded() -> bool {
    is_stt_model_downloaded()
}

#[tauri::command]
pub async fn download_local_stt(app: AppHandle) -> Result<(), String> {
    download_stt_model(app).await
}
