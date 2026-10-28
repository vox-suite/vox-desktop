use anyhow::{ensure, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Mic,
    System,
}
impl Source {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Mic => "mic",
            Self::System => "system",
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeetingState {
    Prepared,
    Recording,
    Interrupted,
    Captured,
    Partial,
    Failed,
    TranscriptReady,
}
impl MeetingState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Prepared => "prepared",
            Self::Recording => "recording",
            Self::Interrupted => "interrupted",
            Self::Captured => "captured",
            Self::Partial => "partial",
            Self::Failed => "failed",
            Self::TranscriptReady => "transcript_ready",
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Segment {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSegment {
    pub id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct Track {
    pub source: Source,
    pub segments: Vec<SavedSegment>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct Meeting {
    pub id: Uuid,
    pub title: String,
    pub state: MeetingState,
    pub revision: i64,
    pub notes: String,
    pub created_ms: i64,
    pub updated_ms: i64,
    pub mic_frames: u64,
    pub system_frames: u64,
    pub tracks: Vec<Track>,
    pub audio_available: bool,
    pub audio_cleanup_pending: bool,
    pub cross_source_alignment_verified: bool,
}

pub(crate) fn validate_segments(input: &[Segment]) -> Result<Vec<Segment>> {
    ensure!(input.len() <= 100_000, "too many segments");
    let mut last = 0;
    let mut bytes = 0;
    input
        .iter()
        .map(|s| {
            ensure!(
                s.start_ms >= last && s.end_ms >= s.start_ms && s.end_ms <= 7_200_000,
                "invalid transcript timestamps"
            );
            let text = s.text.trim();
            ensure!(
                !text.is_empty() && text.len() <= 20_000,
                "invalid transcript text"
            );
            bytes += text.len();
            ensure!(bytes <= 8_000_000, "transcript too large");
            last = s.start_ms;
            Ok(Segment {
                start_ms: s.start_ms,
                end_ms: s.end_ms,
                text: text.into(),
            })
        })
        .collect()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MeetingSummary {
    pub id: Uuid,
    pub title: String,
    pub state: MeetingState,
    pub revision: i64,
    pub created_ms: i64,
    pub updated_ms: i64,
    pub has_transcript: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecoveredTrack {
    pub source: Source,
    pub recovered_frames: Option<u64>,
    pub error: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct RecoveryReport {
    pub id: Uuid,
    pub tracks: Vec<RecoveredTrack>,
    pub recording_resumed: bool,
}
