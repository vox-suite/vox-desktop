pub fn encode(sample: f32) -> u8 {
    let value = (sample.clamp(-1.0, 1.0) * 32767.0) as i32;
    let sign = if value < 0 { 0x80 } else { 0 };
    let magnitude = value.abs().min(32635) + 132;
    let exponent = (7 - (magnitude.leading_zeros() as i32 - 17)).clamp(0, 7) as u8;
    let mantissa = ((magnitude >> (exponent + 3)) & 15) as u8;
    !(sign | exponent << 4 | mantissa)
}
pub fn decode(byte: u8) -> f32 {
    let value = !byte;
    let magnitude = (((value & 15) as i32 * 8 + 132) << ((value & 0x70) >> 4)) - 132;
    (if value & 0x80 != 0 {
        -magnitude
    } else {
        magnitude
    }) as f32
        / 32768.0
}
pub fn encode_s16le(sample: f32) -> [u8; 2] {
    ((sample.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes()
}
pub fn decode_s16le(carry: &mut Option<u8>, bytes: &[u8]) -> Vec<f32> {
    let mut joined = Vec::with_capacity(bytes.len() + 1);
    joined.extend(carry.take());
    joined.extend_from_slice(bytes);
    let (pairs, rest) = joined.as_chunks::<2>();
    *carry = rest.first().copied();
    pairs
        .iter()
        .map(|pair| i16::from_le_bytes(*pair) as f32 / 32768.0)
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signed_roundtrip_and_silence() {
        for s in [-1.0, -0.5, -0.1, 0.0, 0.1, 0.5, 1.0] {
            assert!((decode(encode(s)) - s).abs() < 0.04, "{s}");
        }
        assert_eq!(decode(0xff), 0.0);
    }
    #[test]
    fn s16le_roundtrip_across_odd_frame_split() {
        let bytes: Vec<u8> = [0.5, -0.25, 1.0].into_iter().flat_map(encode_s16le).collect();
        let mut carry = None;
        let mut out = decode_s16le(&mut carry, &bytes[..3]);
        out.extend(decode_s16le(&mut carry, &bytes[3..]));
        assert_eq!(carry, None);
        for (got, want) in out.iter().zip([0.5, -0.25, 1.0]) {
            assert!((got - want).abs() < 1e-4, "{got} {want}");
        }
    }
}
