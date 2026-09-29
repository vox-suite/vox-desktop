use std::collections::VecDeque;

fn linear_resample(mono: &[f32], src_rate: u32, out_rate: u32) -> Vec<f32> {
    if src_rate == out_rate {
        return mono.to_vec();
    }

    let target_len = (mono.len() as f64 * out_rate as f64 / src_rate as f64).round() as usize;
    let mut output = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let src_idx = (i as f64 * src_rate as f64) / out_rate as f64;
        let idx0 = src_idx.floor() as usize;
        let idx1 = (idx0 + 1).min(mono.len().saturating_sub(1));
        let frac = (src_idx - idx0 as f64) as f32;

        let s0 = mono.get(idx0).copied().unwrap_or(0.0);
        let s1 = mono.get(idx1).copied().unwrap_or(0.0);
        output.push(s0 + frac * (s1 - s0));
    }

    output
}

pub fn resample_to_16k_mono(input: &[f32], in_rate: u32, in_channels: u16) -> Vec<f32> {
    if input.is_empty() || in_rate == 0 || in_channels == 0 {
        return Vec::new();
    }

    let ch = in_channels as usize;
    let mono_len = input.len() / ch;
    if mono_len == 0 {
        return Vec::new();
    }

    let mut mono = Vec::with_capacity(mono_len);
    for frame in input.chunks_exact(ch) {
        let sum: f32 = frame.iter().sum();
        mono.push(sum / ch as f32);
    }

    linear_resample(&mono, in_rate, 16000)
        .into_iter()
        .map(|s| s.clamp(-1.0, 1.0))
        .collect()
}

/// Continuously resamples a mono f32 stream, carrying the fractional
/// interpolation phase and any not-yet-interpolatable tail samples across
/// calls. A one-shot `linear_resample` per chunk restarts its phase at index
/// 0 every call, which for a src/out ratio that doesn't divide evenly (e.g.
/// 44.1kHz -> 48kHz) puts a small timing discontinuity at every chunk
/// boundary -- audible as clicking/static when chunks arrive every ~100ms
/// from a streaming decoder.
pub struct StreamResampler {
    buffer: VecDeque<f32>,
    pos: f64,
    src_rate: u32,
    out_rate: u32,
}

impl StreamResampler {
    pub fn new() -> Self {
        Self {
            buffer: VecDeque::new(),
            pos: 0.0,
            src_rate: 0,
            out_rate: 0,
        }
    }

    pub fn reset(&mut self) {
        self.buffer.clear();
        self.pos = 0.0;
        self.src_rate = 0;
        self.out_rate = 0;
    }

    /// Feeds in the next chunk of source-rate mono samples and returns
    /// whatever output-rate samples could be produced so far, holding back
    /// any tail that needs a future sample to interpolate against.
    pub fn push(&mut self, samples: &[f32], src_rate: u32, out_rate: u32) -> Vec<f32> {
        if samples.is_empty() || src_rate == 0 || out_rate == 0 {
            return Vec::new();
        }
        if src_rate == out_rate {
            return samples.to_vec();
        }
        if src_rate != self.src_rate || out_rate != self.out_rate {
            self.buffer.clear();
            self.pos = 0.0;
            self.src_rate = src_rate;
            self.out_rate = out_rate;
        }

        self.buffer.extend(samples.iter().copied());

        let ratio = src_rate as f64 / out_rate as f64;
        let mut output = Vec::new();
        loop {
            let idx0 = self.pos.floor() as usize;
            let idx1 = idx0 + 1;
            if idx1 >= self.buffer.len() {
                break;
            }
            let frac = (self.pos - idx0 as f64) as f32;
            let s0 = self.buffer[idx0];
            let s1 = self.buffer[idx1];
            output.push(s0 + frac * (s1 - s0));
            self.pos += ratio;
        }

        let consumed = (self.pos.floor() as usize).min(self.buffer.len());
        if consumed > 0 {
            self.buffer.drain(..consumed);
            self.pos -= consumed as f64;
        }

        output
    }
}

impl Default for StreamResampler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_to_16k_mono_from_48k_stereo() {
        // 1 second of 48kHz stereo audio
        let in_rate = 48000;
        let in_channels = 2;
        let input: Vec<f32> = vec![0.5; (in_rate * in_channels as u32) as usize];
        let out = resample_to_16k_mono(&input, in_rate, in_channels);
        assert_eq!(out.len(), 16000);
        for &sample in &out {
            assert!((sample - 0.5).abs() < 1e-4);
        }
    }

    #[test]
    fn test_resample_to_16k_mono_identity() {
        let input: Vec<f32> = (0..1600).map(|i| (i as f32) / 1600.0).collect();
        let out = resample_to_16k_mono(&input, 16000, 1);
        assert_eq!(out.len(), 1600);
        assert_eq!(out, input);
    }

    #[test]
    fn test_resample_empty_inputs() {
        assert!(resample_to_16k_mono(&[], 44100, 2).is_empty());
        assert!(StreamResampler::new().push(&[], 44100, 48000).is_empty());
    }

    #[test]
    fn test_stream_resampler_matches_one_shot_for_a_single_chunk() {
        let src_rate = 44100;
        let out_rate = 48000;
        let input: Vec<f32> = vec![0.25; src_rate as usize];
        let out = StreamResampler::new().push(&input, src_rate, out_rate);
        // Within one sample of the whole-buffer length: the streaming version
        // holds back a tail sample it can't interpolate yet without more input.
        assert!((out.len() as i64 - out_rate as i64).abs() <= 1);
        for &sample in &out {
            assert!((sample - 0.25).abs() < 1e-4);
        }
    }

    #[test]
    fn test_stream_resampler_is_continuous_across_chunk_boundaries() {
        // Splitting the same input into many small chunks (as streamed MP3
        // decode chunks arrive) must produce the same total output as one
        // big chunk -- this is the property that was broken before: each
        // call used to restart its interpolation phase at index 0.
        let src_rate = 44100;
        let out_rate = 48000;
        let full_input: Vec<f32> = (0..src_rate)
            .map(|i| (i as f32 * 0.01).sin() * 0.5)
            .collect();

        let one_shot = StreamResampler::new().push(&full_input, src_rate, out_rate);

        let mut streaming = StreamResampler::new();
        let mut chunked_out = Vec::new();
        for chunk in full_input.chunks(137) {
            chunked_out.extend(streaming.push(chunk, src_rate, out_rate));
        }

        assert!((chunked_out.len() as i64 - one_shot.len() as i64).abs() <= 1);
        let compare_len = chunked_out.len().min(one_shot.len());
        for i in 0..compare_len {
            assert!(
                (chunked_out[i] - one_shot[i]).abs() < 1e-4,
                "sample {i} diverged: chunked={} one_shot={}",
                chunked_out[i],
                one_shot[i]
            );
        }
    }
}

