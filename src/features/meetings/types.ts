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
  mic_frames: number;
  system_frames: number;
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
