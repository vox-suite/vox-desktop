use rubato::{audioadapter_buffers::direct::InterleavedSlice, Fft, FixedSync, Resampler};

pub struct StreamResampler {
    buffer: Vec<f32>,
    fft: Option<(u32, u32, Fft<f32>)>,
}

impl StreamResampler {
    pub fn new() -> Self {
        Self {
            buffer: Vec::new(),
            fft: None,
        }
    }

    pub fn reset(&mut self) {
        self.buffer.clear();
        if let Some((_, _, fft)) = &mut self.fft {
            fft.reset();
        }
    }

    pub fn push(&mut self, samples: &[f32], src_rate: u32, out_rate: u32) -> Vec<f32> {
        if samples.is_empty() || src_rate == 0 || out_rate == 0 {
            return Vec::new();
        }
        if src_rate == out_rate {
            return samples.to_vec();
        }
        if !matches!(&self.fft, Some((s, o, _)) if (*s, *o) == (src_rate, out_rate)) {
            self.buffer.clear();
            self.fft = Fft::new(
                src_rate as usize,
                out_rate as usize,
                (src_rate as usize / 100).max(1),
                1,
                FixedSync::Input,
            )
            .ok()
            .map(|fft| (src_rate, out_rate, fft));
        }
        let Some((_, _, fft)) = &mut self.fft else {
            return Vec::new();
        };
        self.buffer.extend_from_slice(samples);
        let mut output = Vec::new();
        let mut used = 0;
        while self.buffer.len() - used >= fft.input_frames_next() {
            let frames = fft.input_frames_next();
            let Ok(input) = InterleavedSlice::new(&self.buffer[used..used + frames], 1, frames)
            else {
                break;
            };
            let Ok(chunk) = fft.process(&input, None) else {
                break;
            };
            output.extend(chunk.take_data());
            used += frames;
        }
        self.buffer.drain(..used);
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
    fn test_resample_empty_inputs() {
        assert!(StreamResampler::new().push(&[], 44100, 48000).is_empty());
    }

    #[test]
    fn test_upsampling_16k_to_48k_suppresses_images() {
        let tone = |hz: f32, rate: f32, n: usize| -> Vec<f32> {
            (0..n)
                .map(|i| (i as f32 * hz * std::f32::consts::TAU / rate).sin() * 0.5)
                .collect()
        };
        let out = StreamResampler::new().push(&tone(6000.0, 16000.0, 16000), 16000, 48000);
        assert!((out.len() as i64 - 48000).abs() <= 480);
        let steady = &out[4800..43200];
        let power = |hz: f32| {
            let reference = tone(hz, 48000.0, steady.len() + 4800);
            let cos: Vec<f32> = (0..steady.len() + 4800)
                .map(|i| (i as f32 * hz * std::f32::consts::TAU / 48000.0).cos())
                .collect();
            let re: f32 = steady.iter().zip(&reference[4800..]).map(|(a, b)| a * b).sum();
            let im: f32 = steady.iter().zip(&cos[4800..]).map(|(a, b)| a * b).sum();
            re * re + im * im
        };
        let image_db = 10.0 * (power(10000.0) / power(6000.0)).log10();
        assert!(image_db < -60.0, "image at {image_db} dB");
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
