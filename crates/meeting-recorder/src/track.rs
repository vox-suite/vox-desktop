use anyhow::{ensure, Result};
use std::{fs::OpenOptions, io::BufWriter, path::Path};

pub const SAMPLE_RATE: u32 = 16_000;
const MAX_GAP: u64 = SAMPLE_RATE as u64 * 60;

/// A single source's sample clock. This does not synchronize two hardware clocks.
pub struct TrackWriter {
    wav: hound::WavWriter<BufWriter<std::fs::File>>,
    frames: u64,
    missing_frames: u64,
}

impl TrackWriter {
    pub fn create(path: &Path) -> Result<Self> {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options.open(path)?;
        let wav = hound::WavWriter::new(
            BufWriter::new(file),
            hound::WavSpec {
                channels: 1,
                sample_rate: SAMPLE_RATE,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            },
        )?;
        Ok(Self {
            wav,
            frames: 0,
            missing_frames: 0,
        })
    }

    pub fn append(&mut self, canonical_frame: u64, samples: &[f32]) -> Result<()> {
        ensure!(
            canonical_frame.is_multiple_of(3),
            "unaligned 48kHz frame index"
        );
        let start = canonical_frame / 3;
        ensure!(start >= self.frames, "overlapping or out-of-order audio");
        let gap = start - self.frames;
        ensure!(
            gap <= MAX_GAP,
            "audio gap exceeds one minute; stop and inspect capture"
        );
        ensure!(samples.iter().all(|x| x.is_finite()), "non-finite audio");
        for _ in 0..gap {
            self.wav.write_sample(0i16)?;
        }
        for sample in samples {
            self.wav
                .write_sample((sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)?;
        }
        self.frames = start + samples.len() as u64;
        self.missing_frames += gap;
        Ok(())
    }

    pub fn frames(&self) -> u64 {
        self.frames
    }
    pub fn missing_frames(&self) -> u64 {
        self.missing_frames
    }
    pub fn checkpoint(&mut self) -> Result<()> {
        Ok(self.wav.flush()?)
    }
    pub fn finish(self) -> Result<()> {
        Ok(self.wav.finalize()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dropped_chunks_leave_silence_and_overlapping_chunks_are_rejected() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("mic.wav");
        let mut track = TrackWriter::create(&path).unwrap();
        track.append(0, &[0.5; 320]).unwrap();
        // frame_index uses 48kHz even when samples are 16kHz.
        track.append(1920, &[-0.5; 320]).unwrap();
        assert!(track.append(1920, &[0.0; 320]).is_err());
        assert_eq!(track.frames(), 960);
        assert_eq!(track.missing_frames(), 320);
        track.finish().unwrap();
        let reader = hound::WavReader::open(path).unwrap();
        assert_eq!(reader.spec().sample_rate, 16000);
        assert_eq!(reader.spec().channels, 1);
        let samples: Vec<i16> = reader.into_samples().map(Result::unwrap).collect();
        assert!(samples[..320].iter().all(|x| *x > 0));
        assert_eq!(&samples[320..640], &[0; 320]);
        assert!(samples[640..].iter().all(|x| *x < 0));
    }

    #[test]
    fn rejects_invalid_audio_and_unbounded_gap_before_writing() {
        let temp = tempfile::tempdir().unwrap();
        let mut track = TrackWriter::create(&temp.path().join("system.wav")).unwrap();
        assert!(track.append(0, &[f32::NAN]).is_err());
        assert!(track.append(48_000 * 3600, &[0.1]).is_err());
        assert_eq!(track.frames(), 0);
    }

    #[test]
    fn never_overwrites_an_existing_recording() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("mic.wav");
        std::fs::write(&path, b"keep").unwrap();
        assert!(TrackWriter::create(&path).is_err());
        assert_eq!(std::fs::read(path).unwrap(), b"keep");
    }
}
