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
}
