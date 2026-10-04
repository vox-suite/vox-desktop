use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct CallStatus {
    pub active: bool,
    pub state: String,
    pub mic_level: f32,
    pub is_speaking: bool,
    pub is_vox_speaking: bool,
}
