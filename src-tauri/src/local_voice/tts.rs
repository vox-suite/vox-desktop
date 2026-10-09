use crate::audio::AudioEngine;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;
use llama_cpp_2::sampling::LlamaSampler;
use ort::session::Session;
use ort::value::Tensor;
use std::num::NonZeroU32;
use std::path::Path;
use std::sync::{mpsc, Arc};
use unicode_normalization::UnicodeNormalization;

const SAMPLE_RATE: u32 = 24_000;
const MAX_CONTEXT: u32 = 2048;
const BATCH: usize = 512;
const SPEAKER: &str = "emily";
const EMOTION: &str = "NEUTRAL";

struct Job {
    text: String,
    epoch: u64,
    engine: Arc<AudioEngine>,
}

pub struct Tts {
    tx: mpsc::Sender<Job>,
}

struct Speaker {
    codes: String,
    text: String,
}

impl Tts {
    pub fn start(dir: &Path) -> Result<Self, String> {
        let gguf = dir.join("neutts-2e-Q4_0.gguf");
        let decoder = dir.join("neucodec-decoder.onnx");
        let speaker = load_speaker(&dir.join("speakers"), SPEAKER)?;
        let (tx, rx) = mpsc::channel::<Job>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
        std::thread::Builder::new()
            .name("neutts".into())
            .spawn(move || match Engine::load(&gguf, &decoder) {
                Ok(mut engine) => {
                    let _ = ready_tx.send(Ok(()));
                    while let Ok(job) = rx.recv() {
                        if job.engine.playback_epoch() != job.epoch {
                            continue;
                        }
                        match engine.synthesize(&speaker, &job.text) {
                            Ok(pcm) => job.engine.enqueue_pcm(&pcm, SAMPLE_RATE, job.epoch),
                            Err(err) => eprintln!("NeuTTS synthesis failed: {err}"),
                        }
                    }
                }
                Err(err) => {
                    let _ = ready_tx.send(Err(err));
                }
            })
            .map_err(|e| e.to_string())?;
        ready_rx.recv().map_err(|e| e.to_string())??;
        Ok(Self { tx })
    }

    pub fn speak(&self, text: String, epoch: u64, engine: Arc<AudioEngine>) {
        let _ = self.tx.send(Job {
            text,
            epoch,
            engine,
        });
    }
}

fn load_speaker(dir: &Path, name: &str) -> Result<Speaker, String> {
    let raw = std::fs::read(dir.join(format!("{name}.codes"))).map_err(|e| format!("{name}.codes: {e}"))?;
    let codes = raw
        .chunks_exact(4)
        .map(|b| format!("<|speech_{}|>", i32::from_le_bytes([b[0], b[1], b[2], b[3]])))
        .collect::<String>();
    let text = std::fs::read_to_string(dir.join(format!("{name}.txt"))).map_err(|e| format!("{name}.txt: {e}"))?;
    Ok(Speaker {
        codes,
        text: normalize(text.trim()),
    })
}

fn normalize(text: &str) -> String {
    text.replace(['\u{2018}', '\u{2019}'], "'")
        .replace(['\u{201c}', '\u{201d}'], "\"")
        .nfkc()
        .collect()
}

struct Engine {
    backend: LlamaBackend,
    model: LlamaModel,
    decoder: Session,
}

impl Engine {
    fn load(gguf: &Path, decoder: &Path) -> Result<Self, String> {
        let backend = LlamaBackend::init().map_err(|e| e.to_string())?;
        let model = LlamaModel::load_from_file(&backend, gguf, &LlamaModelParams::default())
            .map_err(|e| format!("neutts gguf: {e}"))?;
        let decoder = Session::builder()
            .map_err(|e| e.to_string())?
            .with_intra_threads(2)
            .map_err(|e| e.to_string())?
            .commit_from_file(decoder)
            .map_err(|e| format!("neucodec decoder: {e}"))?;
        Ok(Self {
            backend,
            model,
            decoder,
        })
    }

    fn synthesize(&mut self, speaker: &Speaker, text: &str) -> Result<Vec<f32>, String> {
        let prompt = format!(
            "<|TEXT_PROMPT_START|>{}<|{EMOTION}|>{}<|TEXT_PROMPT_END|><|SPEECH_GENERATION_START|>{}",
            speaker.text,
            normalize(text),
            speaker.codes
        );
        let ids = self.generate(&prompt)?;
        if ids.is_empty() {
            return Err("no speech tokens generated".into());
        }
        let frames = ids.len();
        let input = Tensor::from_array(([1usize, 1, frames], ids)).map_err(|e| e.to_string())?;
        let outputs = self
            .decoder
            .run(ort::inputs!["codes" => input])
            .map_err(|e| e.to_string())?;
        let (_, audio) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;
        Ok(audio.to_vec())
    }

    fn generate(&self, prompt: &str) -> Result<Vec<i32>, String> {
        let params = LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(MAX_CONTEXT))
            .with_n_batch(BATCH as u32)
            .with_n_ubatch(BATCH as u32);
        let mut ctx = self
            .model
            .new_context(&self.backend, params)
            .map_err(|e| e.to_string())?;
        let vocab = self.model.vocab();
        let tokens = vocab.tokenize(prompt.as_bytes(), false, true);
        if tokens.len() as u32 >= MAX_CONTEXT {
            return Err("prompt exceeds context".into());
        }
        let end = vocab
            .tokenize(b"<|SPEECH_GENERATION_END|>", false, true)
            .first()
            .copied()
            .ok_or("missing end token")?;

        let mut batch = LlamaBatch::new(BATCH, 1);
        let last = tokens.len() - 1;
        for (start, chunk) in tokens.chunks(BATCH).enumerate() {
            batch.clear();
            for (i, token) in chunk.iter().enumerate() {
                let pos = start * BATCH + i;
                batch
                    .add(*token, pos as i32, &[0], pos == last)
                    .map_err(|e| e.to_string())?;
            }
            ctx.decode(&mut batch).map_err(|e| e.to_string())?;
        }

        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let mut sampler = LlamaSampler::chain_simple([
            LlamaSampler::top_k(50),
            LlamaSampler::temp(1.0),
            LlamaSampler::dist(seed),
        ]);
        let mut ids = Vec::new();
        let mut pos = tokens.len();
        while pos < MAX_CONTEXT as usize {
            let token = sampler.sample(&ctx, batch.n_tokens() - 1);
            if token == end || vocab.is_eog(token) {
                break;
            }
            let piece = vocab
                .text(token)
                .map(|t| t.to_string_lossy().into_owned())
                .unwrap_or_default();
            if let Some(n) = piece
                .strip_prefix("<|speech_")
                .and_then(|p| p.strip_suffix("|>"))
                .and_then(|n| n.parse::<i32>().ok())
            {
                ids.push(n);
            }
            batch.clear();
            batch.add(token, pos as i32, &[0], true).map_err(|e| e.to_string())?;
            ctx.decode(&mut batch).map_err(|e| e.to_string())?;
            pos += 1;
        }
        Ok(ids)
    }
}
