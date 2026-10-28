use super::*;
use std::io::Read;

fn verified_frames(path: &Path) -> Result<u64> {
    let meta = std::fs::symlink_metadata(path)?;
    ensure!(
        meta.is_file() && !meta.file_type().is_symlink(),
        "Audio must be a regular file"
    );
    let mut file = File::open(path)?;
    let mut header = [0u8; 44];
    file.read_exact(&mut header)?;
    let bytes = u32::from_le_bytes(header[40..44].try_into()?) as u64;
    ensure!(
        &header[..4] == b"RIFF"
            && &header[8..16] == b"WAVEfmt "
            && u32::from_le_bytes(header[16..20].try_into()?) == 16
            && u16::from_le_bytes(header[20..22].try_into()?) == 1
            && u16::from_le_bytes(header[22..24].try_into()?) == 1
            && u32::from_le_bytes(header[24..28].try_into()?) == 16000
            && u16::from_le_bytes(header[34..36].try_into()?) == 16
            && &header[36..40] == b"data"
            && bytes.is_multiple_of(2)
            && meta.len() == 44 + bytes
            && u32::from_le_bytes(header[4..8].try_into()?) as u64 == 36 + bytes
            && bytes <= 230_400_000,
        "Recover interrupted audio before cleanup; audio has uncheckpointed or unsupported data"
    );
    Ok(bytes / 2)
}
impl Store {
    /// Trusted ASR completion barrier, not a renderer command. The caller must
    /// hold the file lock across inference and every source's successful CAS save.
    pub fn queue_audio_cleanup(
        &mut self,
        id: Uuid,
        expected: i64,
        guard: &RecordingFilesLock,
        now: i64,
    ) -> Result<Meeting> {
        ensure!(
            guard.id == id && guard.account_dir == self.account_dir,
            "Audio lock does not belong to this meeting/account"
        );
        let meeting = self.get(id)?;
        ensure!(
            meeting.state != MeetingState::Recording,
            "Recording is active"
        );
        ensure!(
            meeting.mic_frames > 0 || meeting.system_frames > 0,
            "No recorded audio to finalize"
        );
        let directory = self.recording_path(id);
        ensure!(
            !directory.is_symlink(),
            "Recording directory cannot be a symlink"
        );
        for (source, frames) in [
            (Source::Mic, meeting.mic_frames),
            (Source::System, meeting.system_frames),
        ] {
            let path = directory.join(format!("{}.wav", source.as_str()));
            let actual = match std::fs::symlink_metadata(&path) {
                Ok(_) => verified_frames(&path)?,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound && frames == 0 => 0,
                Err(e) => return Err(e.into()),
            };
            ensure!(
                actual == frames,
                "Recover interrupted audio before cleanup; source frame counts differ"
            );
            ensure!(
                frames == 0 || meeting.tracks.iter().any(|t| t.source == source),
                "All recorded sources need durable transcripts before cleanup"
            );
        }
        ensure!(self.conn.execute("UPDATE meetings SET audio_deleted=1,audio_cleanup_pending=1,revision=revision+1,updated_ms=?1 WHERE id=?2 AND revision=?3 AND state!='recording' AND deleted=0 AND audio_deleted=0",params![now,id.to_string(),expected])?==1,"Meeting changed; audio retained for retry");
        self.get(id)
    }
    /// Retry a previously committed deletion intent. Never infers completion from
    /// transcript presence; imported/partially transcribed audio is not eligible.
    pub fn cleanup_audio(&mut self, id: Uuid, now: i64) -> Result<Meeting> {
        let _guard = self.lock_recording_files(id)?;
        let meeting = self.get(id)?;
        if !meeting.audio_cleanup_pending {
            return Ok(meeting);
        }
        ensure!(
            meeting.state != MeetingState::Recording,
            "Recording is active"
        );
        let directory = self.recording_path(id);
        ensure!(
            !directory.is_symlink(),
            "Recording directory cannot be a symlink"
        );
        match std::fs::remove_dir_all(&directory) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => {
                return Err(e).context("Transcript saved; temporary audio cleanup needs retry")
            }
        }
        #[cfg(unix)]
        File::open(self.account_dir.join("recordings"))?.sync_all()?;
        self.conn.execute("UPDATE meetings SET audio_cleanup_pending=0,revision=revision+1,updated_ms=?1 WHERE id=?2 AND deleted=0 AND audio_cleanup_pending=1",params![now,id.to_string()])?;
        self.get(id)
    }
    pub fn cleanup_pending_audio(&mut self, now: i64) -> Result<Vec<Uuid>> {
        let ids = {
            let mut stmt=self.conn.prepare("SELECT id FROM meetings WHERE audio_cleanup_pending=1 AND deleted=0 ORDER BY updated_ms,id LIMIT 100")?;
            let ids = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            ids
        };
        let mut completed = vec![];
        for raw in ids {
            let id = Uuid::parse_str(&raw)?;
            if self.cleanup_audio(id, now).is_ok() {
                completed.push(id);
            }
        }
        Ok(completed)
    }
}
