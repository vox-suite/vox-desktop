mod recordings;
mod recovery;
mod types;
use anyhow::{ensure, Context, Result};
pub use recovery::repair_checkpointed_wav;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::{
    collections::HashMap,
    fs::File,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
pub use types::*;
use uuid::Uuid;

pub fn now_ms() -> Result<i64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_millis()
        .try_into()?)
}

pub fn private_dir(path: &Path) -> Result<()> {
    std::fs::create_dir_all(path)?;
    ensure!(
        !std::fs::symlink_metadata(path)?.file_type().is_symlink(),
        "library directory cannot be a symlink"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

pub struct Store {
    conn: Connection,
    account_dir: PathBuf,
    recording_locks: HashMap<Uuid, File>,
}
impl Store {
    pub fn open(root: &Path, account: Uuid) -> Result<Self> {
        let account_dir = root.join(account.to_string());
        private_dir(&account_dir)?;
        private_dir(&account_dir.join("recordings"))?;
        let db = account_dir.join("meetings.sqlite3");
        ensure!(!db.is_symlink(), "library database cannot be a symlink");
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        options.open(&db)?;
        let conn = Connection::open(db)?;
        conn.busy_timeout(Duration::from_secs(5))?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        ensure!(version <= 1, "meeting library requires a newer Vox version");
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY, title TEXT NOT NULL, state TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_ms INTEGER NOT NULL,
            updated_ms INTEGER NOT NULL, lease_token TEXT, lease_until INTEGER, mic_frames INTEGER NOT NULL DEFAULT 0,
            system_frames INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS transcripts(meeting_id TEXT NOT NULL REFERENCES meetings(id), source TEXT NOT NULL,
            input_json TEXT NOT NULL, saved_json TEXT NOT NULL, PRIMARY KEY(meeting_id,source));
            PRAGMA user_version=1;")?;
        Ok(Self {
            conn,
            account_dir,
            recording_locks: HashMap::new(),
        })
    }

    pub fn recording_path(&self, id: Uuid) -> PathBuf {
        self.account_dir.join("recordings").join(id.to_string())
    }
    pub fn create(&mut self, id: Uuid, title: &str, now: i64) -> Result<Meeting> {
        let title = title.trim();
        ensure!(
            !title.is_empty() && title.chars().count() <= 200,
            "meeting title must be 1–200 characters"
        );
        self.conn.execute("INSERT INTO meetings(id,title,state,created_ms,updated_ms) VALUES(?1,?2,'prepared',?3,?3)", params![id.to_string(),title,now]).context("meeting already exists or was deleted")?;
        self.get(id)
    }
    pub fn get(&self, id: Uuid) -> Result<Meeting> {
        let tx = self.conn.unchecked_transaction()?;
        let mut meeting = tx.query_row("SELECT id,title,state,revision,notes,created_ms,updated_ms,mic_frames,system_frames FROM meetings WHERE id=?1 AND deleted=0", [id.to_string()], |row| {
            Ok((row.get::<_,String>(0)?,row.get::<_,String>(1)?,row.get::<_,String>(2)?,row.get::<_,i64>(3)?,row.get::<_,String>(4)?,row.get::<_,i64>(5)?,row.get::<_,i64>(6)?,row.get::<_,u64>(7)?,row.get::<_,u64>(8)?))
        }).optional()?.map(|r| -> Result<Meeting> { Ok(Meeting { id:Uuid::parse_str(&r.0)?,title:r.1,state:serde_json::from_value(serde_json::Value::String(r.2))?,revision:r.3,notes:r.4,created_ms:r.5,updated_ms:r.6,mic_frames:r.7,system_frames:r.8,tracks:vec![],cross_source_alignment_verified:false }) }).transpose()?.context("meeting not found")?;
        let mut stmt = tx.prepare(
            "SELECT source,saved_json FROM transcripts WHERE meeting_id=?1 ORDER BY source",
        )?;
        for row in stmt.query_map([id.to_string()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })? {
            let (source, segments) = row?;
            meeting.tracks.push(Track {
                source: serde_json::from_value(serde_json::Value::String(source))?,
                segments: serde_json::from_str(&segments)?,
            });
        }
        drop(stmt);
        tx.commit()?;
        Ok(meeting)
    }
    pub fn list(&self, offset: u32, limit: u32) -> Result<Vec<MeetingSummary>> {
        ensure!(
            (1..=100).contains(&limit) && offset <= 1_000_000,
            "invalid page"
        );
        let mut stmt=self.conn.prepare("SELECT id,title,state,revision,created_ms,updated_ms,EXISTS(SELECT 1 FROM transcripts t WHERE t.meeting_id=m.id) FROM meetings m WHERE deleted=0 ORDER BY created_ms DESC,id DESC LIMIT ?1 OFFSET ?2")?;
        let rows = stmt
            .query_map(params![limit, offset], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                    r.get::<_, i64>(5)?,
                    r.get::<_, bool>(6)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(|r| {
                Ok(MeetingSummary {
                    id: Uuid::parse_str(&r.0)?,
                    title: r.1,
                    state: serde_json::from_value(serde_json::Value::String(r.2))?,
                    revision: r.3,
                    created_ms: r.4,
                    updated_ms: r.5,
                    has_transcript: r.6,
                })
            })
            .collect()
    }
    pub fn save_notes(
        &mut self,
        id: Uuid,
        expected: i64,
        notes: &str,
        now: i64,
    ) -> Result<Meeting> {
        ensure!(notes.len() <= 256_000, "notes too large");
        ensure!(self.conn.execute("UPDATE meetings SET notes=?1,revision=revision+1,updated_ms=?2 WHERE id=?3 AND revision=?4 AND deleted=0",params![notes,now,id.to_string(),expected])? == 1,"meeting changed; reload before editing");
        self.get(id)
    }
    pub fn save_transcript(
        &mut self,
        id: Uuid,
        expected: i64,
        source: Source,
        input: &[Segment],
        now: i64,
    ) -> Result<Meeting> {
        let input = validate_segments(input)?;
        let json = serde_json::to_string(&input)?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let old: Option<String> = tx.query_row("SELECT input_json FROM transcripts t JOIN meetings m ON m.id=t.meeting_id WHERE t.meeting_id=?1 AND source=?2 AND m.deleted=0",params![id.to_string(),source.as_str()],|r| r.get(0)).optional()?;
        if old.as_deref() == Some(&json) {
            tx.commit()?;
            return self.get(id);
        }
        ensure!(tx.execute("UPDATE meetings SET revision=revision+1,updated_ms=?1,state=CASE WHEN state='prepared' THEN 'transcript_ready' ELSE state END WHERE id=?2 AND revision=?3 AND deleted=0 AND state!='recording'",params![now,id.to_string(),expected])? == 1, "meeting changed or recording is active");
        let segments: Vec<SavedSegment> = input
            .into_iter()
            .enumerate()
            .map(|(i, s)| SavedSegment {
                id: format!("{id}:{}:{}:{i}", source.as_str(), expected + 1),
                start_ms: s.start_ms,
                end_ms: s.end_ms,
                text: s.text,
            })
            .collect();
        tx.execute("INSERT INTO transcripts(meeting_id,source,input_json,saved_json) VALUES(?1,?2,?3,?4) ON CONFLICT(meeting_id,source) DO UPDATE SET input_json=excluded.input_json,saved_json=excluded.saved_json",params![id.to_string(),source.as_str(),json,serde_json::to_string(&segments)?])?;
        tx.commit()?;
        self.get(id)
    }
    pub fn delete(&mut self, id: Uuid, expected: i64, now: i64) -> Result<()> {
        let path = self.recording_path(id);
        let lock = self.capture_lock(id)?;
        lock.try_lock().context("recording or recovery is active")?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure!(tx.execute("UPDATE meetings SET deleted=1,title='',notes='',updated_ms=?1,revision=revision+1 WHERE id=?2 AND revision=?3 AND state!='recording' AND deleted=0",params![now,id.to_string(),expected])? == 1,"meeting changed or recording is active");
        if path.exists() {
            std::fs::remove_dir_all(path)?;
        }
        tx.execute(
            "DELETE FROM transcripts WHERE meeting_id=?1",
            [id.to_string()],
        )?;
        tx.commit()?;
        Ok(())
    }
    fn capture_lock(&self, id: Uuid) -> Result<File> {
        open_lock(&self.account_dir, id)
    }
}

fn open_lock(account: &Path, id: Uuid) -> Result<File> {
    let path = account.join("recordings").join(format!("{id}.lock"));
    ensure!(!path.is_symlink(), "capture lock cannot be a symlink");
    let mut options = std::fs::OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    Ok(options.open(path)?)
}

#[cfg(test)]
mod tests;
