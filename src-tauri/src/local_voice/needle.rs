use serde::Deserialize;
use serde_json::Value;
use std::path::Path;
use std::sync::mpsc;
use tokio::sync::oneshot;

#[derive(Debug, Clone, Deserialize)]
pub struct Call {
    pub name: String,
    #[serde(default)]
    pub arguments: Value,
}

#[derive(Debug, Clone, Default)]
pub struct Routed {
    pub text: String,
    pub calls: Vec<Call>,
}

#[derive(Deserialize)]
struct RawRouted {
    #[serde(default)]
    audio_text: String,
    #[serde(default)]
    function_calls: Vec<Call>,
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
mod ffi {
    use std::ffi::{c_char, c_float, c_int, c_uchar, c_ulonglong, CStr, CString};

    unsafe extern "C" {
        fn needle_load(cact: *const c_uchar, n: c_ulonglong) -> c_int;
        fn needle_last_error() -> *const c_char;
        fn needle_init(
            system_prompt: *const c_char,
            tools_json: *const c_char,
            tool_index_path: *const c_char,
        ) -> c_int;
        fn needle_complete(
            input: *const c_char,
            pcm: *const c_float,
            samples: c_int,
            max_new_tokens: c_int,
            out: *mut c_char,
            out_capacity: c_int,
        ) -> c_int;
        fn needle_reset();
    }

    const MAX_SAMPLES: usize = 16_000 * 30;
    const OUT_CAPACITY: usize = 32 * 1024;

    fn last_error() -> String {
        unsafe {
            let ptr = needle_last_error();
            if ptr.is_null() {
                "unknown needle error".to_string()
            } else {
                CStr::from_ptr(ptr).to_string_lossy().into_owned()
            }
        }
    }

    pub fn load(bytes: &'static [u8]) -> Result<(), String> {
        let rc = unsafe { needle_load(bytes.as_ptr(), bytes.len() as c_ulonglong) };
        if rc < 0 {
            return Err(format!("needle_load failed: {}", last_error()));
        }
        Ok(())
    }

    pub fn init(tools_json: &str) -> Result<(), String> {
        let tools = CString::new(tools_json).map_err(|e| e.to_string())?;
        let system = CString::new("").map_err(|e| e.to_string())?;
        let rc = unsafe { needle_init(system.as_ptr(), tools.as_ptr(), std::ptr::null()) };
        if rc < 0 {
            return Err(format!("needle_init failed: {}", last_error()));
        }
        Ok(())
    }

    pub fn complete(pcm: &[f32]) -> Result<String, String> {
        let pcm = &pcm[..pcm.len().min(MAX_SAMPLES)];
        let mut out = vec![0u8; OUT_CAPACITY];
        unsafe { needle_reset() };
        let rc = unsafe {
            needle_complete(
                std::ptr::null(),
                pcm.as_ptr(),
                pcm.len() as c_int,
                256,
                out.as_mut_ptr() as *mut c_char,
                OUT_CAPACITY as c_int,
            )
        };
        if rc < 0 {
            return Err(format!("needle_complete failed: {}", last_error()));
        }
        let end = out.iter().position(|&b| b == 0).unwrap_or(out.len());
        String::from_utf8(out[..end].to_vec()).map_err(|e| e.to_string())
    }
}

#[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
mod ffi {
    pub fn load(_: &'static [u8]) -> Result<(), String> {
        Err("on-device Whistle/Needle is only built for macOS arm64".into())
    }
    pub fn init(_: &str) -> Result<(), String> {
        Err("unsupported platform".into())
    }
    pub fn complete(_: &[f32]) -> Result<String, String> {
        Err("unsupported platform".into())
    }
}

enum Cmd {
    Init(String, oneshot::Sender<Result<(), String>>),
    Route(Vec<f32>, oneshot::Sender<Result<Routed, String>>),
}

pub struct Needle {
    tx: mpsc::Sender<Cmd>,
}

impl Needle {
    pub fn start(whistle: &Path, needle3: &Path) -> Result<Self, String> {
        let whistle = std::fs::read(whistle).map_err(|e| format!("whistle: {e}"))?;
        let needle3 = std::fs::read(needle3).map_err(|e| format!("needle3: {e}"))?;
        let (tx, rx) = mpsc::channel::<Cmd>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
        std::thread::Builder::new()
            .name("needle".into())
            .spawn(move || {
                let whistle: &'static [u8] = Box::leak(whistle.into_boxed_slice());
                let needle3: &'static [u8] = Box::leak(needle3.into_boxed_slice());
                let loaded = ffi::load(needle3).and_then(|_| ffi::load(whistle));
                let failed = loaded.is_err();
                let _ = ready_tx.send(loaded);
                if failed {
                    return;
                }
                while let Ok(cmd) = rx.recv() {
                    match cmd {
                        Cmd::Init(tools, reply) => {
                            let _ = reply.send(ffi::init(&tools));
                        }
                        Cmd::Route(pcm, reply) => {
                            let _ = reply.send(ffi::complete(&pcm).and_then(|raw| parse(&raw)));
                        }
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        ready_rx.recv().map_err(|e| e.to_string())??;
        Ok(Self { tx })
    }

    pub async fn init_tools(&self, tools_json: String) -> Result<(), String> {
        let (reply, rx) = oneshot::channel();
        self.tx
            .send(Cmd::Init(tools_json, reply))
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn route(&self, pcm: Vec<f32>) -> Result<Routed, String> {
        let (reply, rx) = oneshot::channel();
        self.tx
            .send(Cmd::Route(pcm, reply))
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }
}

fn parse(raw: &str) -> Result<Routed, String> {
    let parsed: RawRouted = serde_json::from_str(raw).map_err(|e| format!("{e}: {raw}"))?;
    Ok(Routed {
        text: parsed.audio_text.trim().to_string(),
        calls: parsed.function_calls,
    })
}
