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

pub fn resample_pcm_to_output(
    pcm_mono: &[f32],
    src_rate: u32,
    out_rate: u32,
    out_channels: u16,
) -> Vec<f32> {
    if pcm_mono.is_empty() || src_rate == 0 || out_rate == 0 || out_channels == 0 {
        return Vec::new();
    }

    let resampled = linear_resample(pcm_mono, src_rate, out_rate);
    let ch = out_channels as usize;
    let mut out = Vec::with_capacity(resampled.len() * ch);
    for &s in &resampled {
        for _ in 0..ch {
            out.push(s);
        }
    }
    out
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
    fn test_resample_pcm_to_output_441k_to_48k_stereo() {
        // 1 second of 44.1kHz mono audio from ElevenLabs MP3
        let src_rate = 44100;
        let out_rate = 48000;
        let out_channels = 2;
        let input: Vec<f32> = vec![0.25; src_rate as usize];
        let out = resample_pcm_to_output(&input, src_rate, out_rate, out_channels);
        assert_eq!(out.len(), (out_rate * out_channels as u32) as usize);
        for &sample in &out {
            assert!((sample - 0.25).abs() < 1e-4);
        }
    }

    #[test]
    fn test_resample_empty_inputs() {
        assert!(resample_to_16k_mono(&[], 44100, 2).is_empty());
        assert!(resample_pcm_to_output(&[], 44100, 48000, 2).is_empty());
    }
}

