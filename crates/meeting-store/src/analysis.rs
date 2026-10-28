use super::*;
use vox_shared::meetings::{
    self, AnalysisRequest, AnalysisResponse, AudioSource, TranscriptSegment,
};
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AttachedAnalysis {
    pub input_hash: String,
    pub transcript_hash: String,
    pub created_ms: i64,
    pub response: AnalysisResponse,
    pub stale: bool,
    pub action_keys: Vec<String>,
    pub my_names: Vec<String>,
}
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ActionReview {
    pub key: String,
    pub state: String,
    pub span_id: Option<Uuid>,
    pub approved_task: Option<serde_json::Value>,
}
#[derive(serde::Serialize, serde::Deserialize)]
struct StoredResponse {
    response: AnalysisResponse,
    action_keys: Vec<String>,
    #[serde(default)]
    my_names: Vec<String>,
}
fn segments(tracks: &[Track]) -> Vec<TranscriptSegment> {
    tracks
        .iter()
        .flat_map(|track| {
            track.segments.iter().map(|s| TranscriptSegment {
                id: s.id.clone(),
                source: match track.source {
                    Source::Mic => AudioSource::Mic,
                    Source::System => AudioSource::System,
                },
                start_ms: s.start_ms,
                end_ms: s.end_ms,
                text: s.text.clone(),
            })
        })
        .collect()
}
fn request(
    conn: &Connection,
    id: Uuid,
    names: Vec<String>,
    timezone: String,
) -> Result<AnalysisRequest> {
    let (created, state): (i64, String) = conn.query_row(
        "SELECT created_ms,state FROM meetings WHERE id=?1 AND deleted=0",
        [id.to_string()],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    ensure!(
        state != "recording",
        "Stop recording before generating a summary"
    );
    let mut stmt = conn
        .prepare("SELECT source,saved_json FROM transcripts WHERE meeting_id=?1 ORDER BY source")?;
    let tracks = stmt
        .query_map([id.to_string()], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?
        .map(|r| -> Result<Track> {
            let (source, raw) = r?;
            Ok(Track {
                source: serde_json::from_value(serde_json::Value::String(source))?,
                segments: serde_json::from_str(&raw)?,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    let segments = segments(&tracks);
    let input = AnalysisRequest {
        schema_version: 1,
        meeting_id: id.to_string(),
        transcript_hash: meetings::transcript_hash(&segments),
        started_at: chrono::DateTime::from_timestamp_millis(created)
            .context("Invalid meeting date")?
            .to_rfc3339(),
        timezone,
        my_names: names,
        segments,
    };
    meetings::validate_request(&input).map_err(anyhow::Error::msg)?;
    Ok(input)
}
pub(crate) fn attach(conn: &Connection, meeting: &mut Meeting) -> Result<()> {
    let row:Option<(String,String,String,i64)>=conn.query_row("SELECT input_hash,transcript_hash,response_json,created_ms FROM meeting_analyses WHERE meeting_id=?1",[meeting.id.to_string()],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()?;
    if let Some((input_hash, transcript_hash, raw, created_ms)) = row {
        let stale = transcript_hash != meetings::transcript_hash(&segments(&meeting.tracks));
        let stored: StoredResponse = serde_json::from_str(&raw)?;
        meeting.analysis = Some(AttachedAnalysis {
            input_hash,
            transcript_hash,
            created_ms,
            response: stored.response,
            action_keys: stored.action_keys,
            my_names: stored.my_names,
            stale,
        });
    }
    let mut stmt=conn.prepare("SELECT action_key,state,span_id,request_json FROM meeting_action_reviews WHERE meeting_id=?1 ORDER BY action_key")?;
    meeting.action_reviews = stmt
        .query_map([meeting.id.to_string()], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })?
        .map(|r| -> Result<ActionReview> {
            let (key, state, id, raw) = r?;
            Ok(ActionReview {
                key,
                state,
                span_id: id.map(|v| Uuid::parse_str(&v)).transpose()?,
                approved_task: raw.map(|v| serde_json::from_str(&v)).transpose()?,
            })
        })
        .collect::<Result<_>>()?;
    Ok(())
}
impl Store {
    pub fn analysis_request(
        &self,
        id: Uuid,
        names: Vec<String>,
        timezone: String,
    ) -> Result<AnalysisRequest> {
        request(&self.conn, id, names, timezone)
    }
    pub fn save_analysis(
        &mut self,
        id: Uuid,
        input: &AnalysisRequest,
        mut response: AnalysisResponse,
        now: i64,
    ) -> Result<Meeting> {
        ensure!(input.meeting_id == id.to_string(), "Meeting ID mismatch");
        meetings::validate_analysis(input, &mut response.analysis).map_err(anyhow::Error::msg)?;
        ensure!(
            response.prompt_revision == 1
                && !response.model.is_empty()
                && response.model.len() <= 256,
            "Unsupported analysis response"
        );
        let keys = response
            .analysis
            .actions
            .iter()
            .map(|a| meetings::action_key(input, a).map_err(anyhow::Error::msg))
            .collect::<Result<Vec<_>>>()?;
        let stored = StoredResponse {
            response,
            action_keys: keys,
            my_names: input.my_names.clone(),
        };
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current = request(&tx, id, input.my_names.clone(), input.timezone.clone())?;
        ensure!(
            current.transcript_hash == input.transcript_hash,
            "Transcript changed; generate a new summary"
        );
        tx.execute("INSERT INTO meeting_analyses(meeting_id,input_hash,transcript_hash,response_json,created_ms) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(meeting_id) DO UPDATE SET input_hash=excluded.input_hash,transcript_hash=excluded.transcript_hash,response_json=excluded.response_json,created_ms=excluded.created_ms",params![id.to_string(),meetings::request_hash(input),input.transcript_hash,serde_json::to_string(&stored)?,now])?;
        tx.execute(
            "UPDATE meetings SET revision=revision+1,updated_ms=?1 WHERE id=?2 AND deleted=0",
            params![now, id.to_string()],
        )?;
        tx.commit()?;
        self.get(id)
    }
    pub fn prepare_action(&mut self, id: Uuid, key: &str) -> Result<Option<serde_json::Value>> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.query_row(
            "SELECT id FROM meetings WHERE id=?1 AND deleted=0",
            [id.to_string()],
            |r| r.get::<_, String>(0),
        )?;
        let old:Option<(String,Option<String>)>=tx.query_row("SELECT state,request_json FROM meeting_action_reviews WHERE meeting_id=?1 AND action_key=?2",params![id.to_string(),key],|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
        if let Some((state, raw)) = old {
            let body = if state == "pending" {
                Some(serde_json::from_str(
                    &raw.context("Missing approved request")?,
                )?)
            } else {
                None
            };
            tx.commit()?;
            return Ok(body);
        }
        let (source_hash, raw): (String, String) = tx.query_row(
            "SELECT transcript_hash,response_json FROM meeting_analyses WHERE meeting_id=?1",
            [id.to_string()],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        let input = request(&tx, id, vec![], "UTC".into())?;
        ensure!(
            source_hash == input.transcript_hash,
            "Transcript changed; review a new summary first"
        );
        let stored: StoredResponse = serde_json::from_str(&raw)?;
        let index = stored
            .action_keys
            .iter()
            .position(|k| k == key)
            .context("Task candidate not found")?;
        let action = stored
            .response
            .analysis
            .actions
            .get(index)
            .context("Task candidate not found")?;
        let body = serde_json::json!({"request_id":format!("meeting:{id}:{key}"),"title":action.title,"notes":action.notes,"due_at":action.due_at,"source_links":[{"kind":"meeting","id":id,"evidence_ids":action.evidence_ids}]});
        tx.execute("INSERT INTO meeting_action_reviews(meeting_id,action_key,state,request_json) VALUES(?1,?2,'pending',?3)",params![id.to_string(),key,serde_json::to_string(&body)?])?;
        tx.commit()?;
        Ok(Some(body))
    }
    pub fn finish_action(&mut self, id: Uuid, key: &str, span: Option<Uuid>) -> Result<Meeting> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let (state,old):(String,Option<String>)=tx.query_row("SELECT state,span_id FROM meeting_action_reviews WHERE meeting_id=?1 AND action_key=?2",params![id.to_string(),key],|r|Ok((r.get(0)?,r.get(1)?)))?;
        if state == "dismissed" || (state == "saved" && old == span.map(|v| v.to_string())) {
            tx.commit()?;
            return self.get(id);
        }
        ensure!(
            state == "pending" || (state == "saved" && span.is_none()),
            "Approved task response conflicts; refresh the meeting"
        );
        tx.execute("UPDATE meeting_action_reviews SET state=?1,span_id=?2 WHERE meeting_id=?3 AND action_key=?4",params![if span.is_some(){"saved"}else{"dismissed"},span.map(|s|s.to_string()),id.to_string(),key])?;
        tx.commit()?;
        self.get(id)
    }
    pub fn dismiss_action(&mut self, id: Uuid, key: &str) -> Result<Meeting> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let raw:String=tx.query_row("SELECT response_json FROM meeting_analyses a JOIN meetings m ON m.id=a.meeting_id WHERE m.id=?1 AND m.deleted=0",[id.to_string()],|r|r.get(0))?;
        let stored: StoredResponse = serde_json::from_str(&raw)?;
        ensure!(
            stored.action_keys.iter().any(|k| k == key),
            "Task candidate not found"
        );
        tx.execute("INSERT INTO meeting_action_reviews(meeting_id,action_key,state) VALUES(?1,?2,'dismissed') ON CONFLICT(meeting_id,action_key) DO NOTHING",params![id.to_string(),key])?;
        let state: String = tx.query_row(
            "SELECT state FROM meeting_action_reviews WHERE meeting_id=?1 AND action_key=?2",
            params![id.to_string(), key],
            |r| r.get(0),
        )?;
        ensure!(
            state == "dismissed",
            "Task already approved; use Timeline to change it"
        );
        tx.commit()?;
        self.get(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vox_shared::meetings::*;
    fn prepared(store: &mut Store) -> (Uuid, AnalysisRequest, AnalysisResponse) {
        let id = Uuid::new_v4();
        store.create(id, "Planning", 1_700_000_000_000).unwrap();
        store
            .save_transcript(
                id,
                0,
                crate::Source::Mic,
                &[crate::Segment {
                    start_ms: 0,
                    end_ms: 1000,
                    text: "Rahul will send it.".into(),
                }],
                2,
            )
            .unwrap();
        let request = store
            .analysis_request(id, vec!["Rahul".into()], "UTC".into())
            .unwrap();
        let segment = request.segments[0].id.clone();
        let response:AnalysisResponse=serde_json::from_value(serde_json::json!({"analysis":{"overview":[{"text":"A follow-up.","evidence_ids":[segment]}],"decisions":[],"open_questions":[],"actions":[{"title":"Send it","notes":"","owner":"me","due_at":null,"evidence_ids":[request.segments[0].id],"evidence_quote":"Rahul will send it."}]},"model":"test","prompt_revision":1})).unwrap();
        (id, request, response)
    }
    #[test]
    fn summary_and_approved_request_survive_restart_without_overwriting_notes() {
        let temp = tempfile::tempdir().unwrap();
        let owner = Uuid::new_v4();
        let mut store = Store::open(temp.path(), owner).unwrap();
        let (id, request, response) = prepared(&mut store);
        let rev = store.get(id).unwrap().revision;
        store.save_notes(id, rev, "Human notes", 3).unwrap();
        store.save_analysis(id, &request, response, 4).unwrap();
        let key = action_key(
            &request,
            &store
                .get(id)
                .unwrap()
                .analysis
                .unwrap()
                .response
                .analysis
                .actions[0],
        )
        .unwrap();
        let body = store.prepare_action(id, &key).unwrap().unwrap();
        drop(store);
        let mut store = Store::open(temp.path(), owner).unwrap();
        assert_eq!(store.get(id).unwrap().notes, "Human notes");
        assert_eq!(body, store.prepare_action(id, &key).unwrap().unwrap());
        store.finish_action(id, &key, Some(Uuid::new_v4())).unwrap();
        assert!(store.prepare_action(id, &key).unwrap().is_none());
    }
    #[test]
    fn changed_transcript_cannot_accept_stale_generated_summary() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
        let (id, request, response) = prepared(&mut store);
        let rev = store.get(id).unwrap().revision;
        store
            .save_transcript(
                id,
                rev,
                crate::Source::Mic,
                &[crate::Segment {
                    start_ms: 0,
                    end_ms: 1000,
                    text: "A different meeting.".into(),
                }],
                3,
            )
            .unwrap();
        assert!(store.save_analysis(id, &request, response, 4).is_err());
        assert!(store.get(id).unwrap().analysis.is_none());
    }
    #[test]
    fn approvals_are_immutable_and_tombstones_survive_regeneration() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
        let (id, request, mut response) = prepared(&mut store);
        store
            .save_analysis(id, &request, response.clone(), 4)
            .unwrap();
        let key = action_key(&request, &response.analysis.actions[0]).unwrap();
        let approved = store.prepare_action(id, &key).unwrap().unwrap();
        response.analysis.actions[0].title = "A rewritten suggestion".into();
        store
            .save_analysis(id, &request, response.clone(), 5)
            .unwrap();
        assert_eq!(store.prepare_action(id, &key).unwrap().unwrap(), approved);
        assert!(store.dismiss_action(id, &key).is_err());
        let span = Uuid::new_v4();
        store.finish_action(id, &key, Some(span)).unwrap();
        store.finish_action(id, &key, Some(span)).unwrap();
        assert!(store.finish_action(id, &key, Some(Uuid::new_v4())).is_err());
        store.finish_action(id, &key, None).unwrap();
        store.finish_action(id, &key, Some(span)).unwrap();
        store.save_analysis(id, &request, response, 6).unwrap();
        assert!(store.prepare_action(id, &key).unwrap().is_none());
        assert_eq!(store.get(id).unwrap().action_reviews[0].state, "dismissed");
    }
    #[test]
    fn dismissal_and_stale_approval_guards_persist() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(temp.path(), Uuid::new_v4()).unwrap();
        let (id, request, response) = prepared(&mut store);
        store
            .save_analysis(id, &request, response.clone(), 4)
            .unwrap();
        let key = action_key(&request, &response.analysis.actions[0]).unwrap();
        store.dismiss_action(id, &key).unwrap();
        store.save_analysis(id, &request, response, 5).unwrap();
        assert!(store.prepare_action(id, &key).unwrap().is_none());
        let revision = store.get(id).unwrap().revision;
        store
            .save_transcript(
                id,
                revision,
                crate::Source::Mic,
                &[crate::Segment {
                    start_ms: 0,
                    end_ms: 1000,
                    text: "Changed text".into(),
                }],
                6,
            )
            .unwrap();
        assert!(store.get(id).unwrap().analysis.unwrap().stale);
        assert!(store.prepare_action(id, "unapproved-key").is_err());
    }
}
