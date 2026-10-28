use crate::{types::validate_segments, Meeting, Segment, Source};
use anyhow::{ensure, Context, Result};
use serde::Deserialize;
pub const MAX_IMPORT_BYTES: u64 = 8_000_000;

pub fn parse_transcript_import(input: &[u8]) -> Result<(Source, Vec<Segment>)> {
    ensure!(
        input.len() as u64 <= MAX_IMPORT_BYTES,
        "Transcript file exceeds 8 MB"
    );
    #[derive(Deserialize)]
    struct Document {
        schema_version: u32,
        source: Source,
        segments: Vec<Segment>,
    }
    let document: Document = serde_json::from_slice(input)
        .context("Choose a Vox transcript JSON file with a source and timestamped segments")?;
    ensure!(
        document.schema_version == 1,
        "Unsupported transcript version"
    );
    Ok((document.source, validate_segments(&document.segments)?))
}

pub fn export_text(meeting: &Meeting) -> String {
    let mut output = format!(
        "{}\n\nYour notes\n{}\n\nTranscript\nTimestamps are relative to each audio source.\n",
        meeting.title, meeting.notes
    );
    for track in &meeting.tracks {
        output.push_str(match track.source {
            Source::Mic => "\nMicrophone\n",
            Source::System => "\nComputer audio\n",
        });
        for segment in &track.segments {
            let seconds = segment.start_ms / 1000;
            let time = if seconds >= 3600 {
                format!(
                    "{}:{:02}:{:02}",
                    seconds / 3600,
                    seconds / 60 % 60,
                    seconds % 60
                )
            } else {
                format!("{:02}:{:02}", seconds / 60, seconds % 60)
            };
            output.push_str(&format!("[{time}] {}\n", segment.text));
        }
    }
    output
}
