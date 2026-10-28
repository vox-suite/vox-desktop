export type MeetingState =
  | "prepared"
  | "recording"
  | "interrupted"
  | "captured"
  | "partial"
  | "failed"
  | "transcript_ready";
export type MeetingSource = "mic" | "system";
export type MeetingSummary = {
  id: string;
  title: string;
  state: MeetingState;
  revision: number;
  created_ms: number;
  updated_ms: number;
  has_transcript: boolean;
};
export type TranscriptSegment = {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
};
export type Meeting = Omit<MeetingSummary, "has_transcript"> & {
  notes: string;
  analysis: AttachedAnalysis | null;
  action_reviews: ActionReview[];
  mic_frames: number;
  system_frames: number;
  audio_available: boolean;
  audio_cleanup_pending: boolean;
  cross_source_alignment_verified: boolean;
  tracks: { source: MeetingSource; segments: TranscriptSegment[] }[];
};
export type RecoveryReport = {
  id: string;
  recording_resumed: false;
  tracks: {
    source: MeetingSource;
    recovered_frames: number | null;
    error: string | null;
  }[];
};
export interface MeetingsPort {
  recording?: MeetingRecordingPort;
  list(offset: number, limit: number): Promise<MeetingSummary[]>;
  get(id: string): Promise<Meeting>;
  create(title: string): Promise<Meeting>;
  saveNotes(
    id: string,
    expectedRevision: number,
    notes: string,
  ): Promise<Meeting>;
  remove(id: string, expectedRevision: number): Promise<void>;
  recover(): Promise<RecoveryReport[]>;
  cleanupAudio(id: string): Promise<Meeting>;
  analyze(
    id: string,
    names: string[],
    timezone: string,
    force: boolean,
  ): Promise<Meeting>;
  promoteAction(id: string, key: string): Promise<Meeting>;
  dismissAction(id: string, key: string): Promise<Meeting>;
  importTranscript(
    id: string,
    expectedRevision: number,
  ): Promise<Meeting | null>;
  exportText(id: string): Promise<boolean>;
}

export type RecordingStatus = {
  id: string | null;
  phase:
    | ""
    | "recording"
    | "stopping"
    | "captured"
    | "transcribing"
    | "ready"
    | "failed";
  started_ms: number;
  error: string | null;
  mic_frames: number;
  system_frames: number;
};
export interface MeetingRecordingPort {
  modelStatus(): Promise<SpeechModelStatus>;
  installModel(): Promise<void>;
  cancelModel(): Promise<void>;
  start(title: string): Promise<Meeting>;
  stop(): Promise<void>;
  status(): Promise<RecordingStatus>;
  modelReady(): Promise<boolean>;
  chooseModel(): Promise<boolean>;
  transcribe(id: string): Promise<void>;
}

export type SpeechModelStatus = {
  phase:
    | "uninitialized"
    | "checking"
    | "missing"
    | "downloading"
    | "verifying"
    | "cancelling"
    | "cancelled"
    | "failed"
    | "ready";
  downloaded_bytes: number;
  total_bytes: number;
  ready: boolean;
  engine: "bundled" | "custom" | null;
  error: string | null;
};

export type CitedText = { text: string; evidence_ids: string[] };
export type ActionCandidate = {
  title: string;
  notes: string;
  owner: "me" | "other" | "unknown";
  due_at: string | null;
  evidence_ids: string[];
  evidence_quote: string;
};
export type AttachedAnalysis = {
  input_hash: string;
  transcript_hash: string;
  created_ms: number;
  stale: boolean;
  action_keys: string[];
  my_names: string[];
  response: {
    model: string;
    prompt_revision: number;
    analysis: {
      overview: CitedText[];
      decisions: CitedText[];
      open_questions: CitedText[];
      actions: ActionCandidate[];
    };
  };
};
export type ActionReview = {
  key: string;
  state: "pending" | "saved" | "dismissed";
  span_id: string | null;
  approved_task: { title: string; notes: string; due_at: string | null } | null;
};
