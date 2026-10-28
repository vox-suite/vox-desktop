use anyhow::{ensure, Result};
use std::{
    io::{Read, Seek, SeekFrom, Write},
    path::Path,
};

/// Repair only our canonical PCM16 mono 16kHz WAV, never arbitrary imported media.
/// Call after atomically claiming an expired recording lease, not on an active file.
pub fn repair_checkpointed_wav(path: &Path) -> Result<u64> {
    ensure!(
        !std::fs::symlink_metadata(path)?.file_type().is_symlink(),
        "audio cannot be a symlink"
    );
    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)?;
    let mut header = [0u8; 44];
    file.read_exact(&mut header)?;
    ensure!(
        &header[..4] == b"RIFF"
            && &header[8..16] == b"WAVEfmt "
            && u32::from_le_bytes(header[16..20].try_into()?) == 16
            && u16::from_le_bytes(header[20..22].try_into()?) == 1
            && u16::from_le_bytes(header[22..24].try_into()?) == 1
            && u32::from_le_bytes(header[24..28].try_into()?) == 16000
            && u16::from_le_bytes(header[34..36].try_into()?) == 16
            && &header[36..40] == b"data",
        "unsupported recovery audio format"
    );
    let bytes = file
        .metadata()?
        .len()
        .checked_sub(44)
        .ok_or_else(|| anyhow::anyhow!("truncated WAV"))?;
    ensure!(bytes <= 230_400_000, "recording exceeds two hours");
    let bytes = bytes / 2 * 2;
    file.set_len(44 + bytes)?;
    file.seek(SeekFrom::Start(4))?;
    file.write_all(&(36 + bytes as u32).to_le_bytes())?;
    file.seek(SeekFrom::Start(40))?;
    file.write_all(&(bytes as u32).to_le_bytes())?;
    file.sync_all()?;
    Ok(bytes / 2)
}
