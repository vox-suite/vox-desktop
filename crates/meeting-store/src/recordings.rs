use super::*;

impl Store {
    pub fn begin_recording(&mut self, id: Uuid, token: Uuid, now: i64) -> Result<()> {
        let lock = self.capture_lock(id)?;
        lock.try_lock()
            .context("recording is active in another process")?;
        ensure!(self.conn.execute("UPDATE meetings SET state='recording',lease_token=?1,lease_until=?2,updated_ms=?3,revision=revision+1 WHERE id=?4 AND state='prepared' AND deleted=0",params![token.to_string(),now+30_000,now,id.to_string()])? == 1,"meeting cannot start recording");
        self.recording_locks.insert(id, lock);
        Ok(())
    }
    pub fn checkpoint(
        &mut self,
        id: Uuid,
        token: Uuid,
        mic: u64,
        system: u64,
        now: i64,
    ) -> Result<()> {
        ensure!(
            mic <= 115_200_000 && system <= 115_200_000,
            "recording exceeds two hours"
        );
        ensure!(self.conn.execute("UPDATE meetings SET mic_frames=?1,system_frames=?2,lease_until=?3,updated_ms=?4 WHERE id=?5 AND state='recording' AND deleted=0 AND lease_token=?6 AND lease_until>=?4 AND mic_frames<=?1 AND system_frames<=?2",params![mic,system,now+30_000,now,id.to_string(),token.to_string()])? == 1,"recording lease lost or checkpoint moved backwards");
        Ok(())
    }
    pub fn finish_recording(
        &mut self,
        id: Uuid,
        token: Uuid,
        state: MeetingState,
        now: i64,
    ) -> Result<Meeting> {
        ensure!(
            self.recording_locks.contains_key(&id),
            "recording is not owned by this process"
        );
        ensure!(
            matches!(
                state,
                MeetingState::Captured
                    | MeetingState::Partial
                    | MeetingState::Interrupted
                    | MeetingState::Failed
            ),
            "invalid final capture state"
        );
        ensure!(self.conn.execute("UPDATE meetings SET state=?1,lease_token=NULL,lease_until=NULL,revision=revision+1,updated_ms=?2 WHERE id=?3 AND deleted=0 AND state='recording' AND lease_token=?4",params![state.as_str(),now,id.to_string(),token.to_string()])? == 1,"recording lease lost");
        self.recording_locks.remove(&id);
        self.get(id)
    }
    pub fn recover_expired(&mut self, now: i64) -> Result<Vec<Uuid>> {
        let account_dir = self.account_dir.clone();
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let ids = {
            let mut stmt = tx.prepare("SELECT id FROM meetings WHERE state='recording' AND deleted=0 AND lease_until<?1 ORDER BY id")?;
            let rows = stmt
                .query_map([now], |r| r.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        let mut recovered = vec![];
        let mut locks = vec![];
        for raw in ids {
            let id = Uuid::parse_str(&raw)?;
            let lock = open_lock(&account_dir, id)?;
            match lock.try_lock() {
                Ok(()) => {}
                Err(std::fs::TryLockError::WouldBlock) => continue,
                Err(error) => return Err(error.into()),
            }
            tx.execute("UPDATE meetings SET state='interrupted',lease_token=NULL,lease_until=NULL,updated_ms=?1,revision=revision+1 WHERE id=?2 AND state='recording'",params![now,raw])?;
            recovered.push(id);
            locks.push(lock);
        }
        tx.commit()?;
        Ok(recovered)
    }
    /// Retryable repair of expired or already-interrupted sessions. Never resumes capture.
    pub fn recover_interrupted(&mut self, now: i64) -> Result<Vec<RecoveryReport>> {
        self.recover_expired(now)?;
        let ids = {
            let mut stmt=self.conn.prepare("SELECT id FROM meetings WHERE state='interrupted' AND deleted=0 AND audio_deleted=0 ORDER BY updated_ms,id LIMIT 100")?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        let mut reports = vec![];
        for raw in ids {
            let id = Uuid::parse_str(&raw)?;
            let lock = self.capture_lock(id)?;
            match lock.try_lock() {
                Ok(()) => {}
                Err(std::fs::TryLockError::WouldBlock) => continue,
                Err(error) => return Err(error.into()),
            }
            let directory = self.recording_path(id);
            let tx = self
                .conn
                .transaction_with_behavior(TransactionBehavior::Immediate)?;
            let old=tx.query_row("SELECT mic_frames,system_frames FROM meetings WHERE id=?1 AND state='interrupted' AND deleted=0 AND audio_deleted=0",[&raw],|r|Ok((r.get::<_,u64>(0)?,r.get::<_,u64>(1)?))).optional()?;
            let Some((mut mic, mut system)) = old else {
                continue;
            };
            let before = (mic, system);
            let mut tracks = vec![];
            for source in [Source::Mic, Source::System] {
                match repair_checkpointed_wav(&directory.join(format!("{}.wav", source.as_str()))) {
                    Ok(frames) => {
                        match source {
                            Source::Mic => mic = frames,
                            Source::System => system = frames,
                        };
                        tracks.push(RecoveredTrack {
                            source,
                            recovered_frames: Some(frames),
                            error: None,
                        });
                    }
                    Err(error) => tracks.push(RecoveredTrack {
                        source,
                        recovered_frames: None,
                        error: Some(error.to_string()),
                    }),
                }
            }
            tx.execute("UPDATE meetings SET mic_frames=?1,system_frames=?2,updated_ms=?3,revision=revision+?4 WHERE id=?5 AND state='interrupted'",params![mic,system,now,i64::from(before!=(mic,system)),raw])?;
            tx.commit()?;
            reports.push(RecoveryReport {
                id,
                tracks,
                recording_resumed: false,
            });
        }
        Ok(reports)
    }
}
