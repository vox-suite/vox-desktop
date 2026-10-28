import type {
  Meeting,
  MeetingSummary,
  MeetingsPort,
} from "@/features/meetings/types";
const stamp = Date.parse("2026-10-28T16:00:00Z");
const base = (id: string, title: string, index: number): Meeting => ({
  id,
  title,
  state: "transcript_ready",
  revision: 1,
  notes:
    index === 0
      ? "Keep the first release focused on reliable local recording."
      : "",
  created_ms: stamp - index * 86400000,
  updated_ms: stamp,
  mic_frames: 240000,
  system_frames: 240000,
  cross_source_alignment_verified: false,
  tracks: [
    {
      source: "mic",
      segments: [
        {
          id: `${id}:mic:0`,
          start_ms: 0,
          end_ms: 5000,
          text: "Let’s keep the first release focused. We need local recording and notes that survive restarting the app.",
        },
        {
          id: `${id}:mic:1`,
          start_ms: 12000,
          end_ms: 17000,
          text: "I’ll bring a short proposal to our next planning session.",
        },
      ],
    },
    {
      source: "system",
      segments: [
        {
          id: `${id}:system:0`,
          start_ms: 3000,
          end_ms: 9000,
          text: "Agreed. We should test a quiet room, headphones, and switching the output device during a call.",
        },
      ],
    },
  ],
});
const records = new Map(
  Array.from({ length: 22 }, (_, index) => {
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const m = base(
      id,
      index === 0
        ? "Product planning"
        : index === 1
          ? "Design review"
          : `Planning notes ${index + 1}`,
      index,
    );
    if (index === 1) m.state = "interrupted";
    return [id, m];
  }),
);
export const meetingFixture = {
  records,
  failSave: false,
  failGetId: "",
  conflictNextSave: false,
  failList: false,
  failImport: false,
  saveCount: 0,
  exports: [] as string[],
};
const summary = (m: Meeting): MeetingSummary => ({
  id: m.id,
  title: m.title,
  state: m.state,
  revision: m.revision,
  created_ms: m.created_ms,
  updated_ms: m.updated_ms,
  has_transcript: m.tracks.length > 0,
});
const get = (id: string) => {
  const m = records.get(id);
  if (!m) throw Error("Meeting not found");
  return m;
};
export const meetingFixturePort: MeetingsPort = {
  list: async (offset, limit) => {
    if (meetingFixture.failList)
      throw Error("Could not open local meeting notes");
    return [...records.values()]
      .sort((a, b) => b.created_ms - a.created_ms)
      .slice(offset, offset + limit)
      .map(summary);
  },
  get: async (id) => {
    if (meetingFixture.failGetId === id)
      throw Error("Could not open this meeting");
    return structuredClone(get(id));
  },
  create: async (title) => {
    const m = base(crypto.randomUUID(), title, -1);
    m.state = "prepared";
    m.revision = 0;
    m.notes = "";
    m.tracks = [];
    m.mic_frames = 0;
    m.system_frames = 0;
    records.set(m.id, m);
    return structuredClone(m);
  },
  saveNotes: async (id, revision, notes) => {
    const m = get(id);
    if (meetingFixture.failSave) throw Error("Could not save notes");
    if (meetingFixture.conflictNextSave) {
      meetingFixture.conflictNextSave = false;
      m.notes = "Updated by another window.";
      m.revision++;
    }
    if (m.revision !== revision)
      throw Error("meeting changed; reload before editing");
    m.notes = notes;
    m.revision++;
    meetingFixture.saveCount++;
    return structuredClone(m);
  },
  remove: async (id, revision) => {
    if (get(id).revision !== revision) throw Error("Meeting changed");
    records.delete(id);
  },
  recover: async () =>
    [...records.values()]
      .filter((m) => m.state === "interrupted")
      .map((m) => ({
        id: m.id,
        recording_resumed: false,
        tracks: [
          { source: "mic" as const, recovered_frames: 240000, error: null },
        ],
      })),
  importTranscript: async (id, revision) => {
    if (meetingFixture.failImport)
      throw Error("Choose a Vox transcript JSON file");
    const m = get(id);
    if (m.revision !== revision) throw Error("Meeting changed");
    m.tracks = [
      {
        source: "mic",
        segments: [
          {
            id: `${id}:imported`,
            start_ms: 1000,
            end_ms: 4000,
            text: "Imported transcript passage.",
          },
        ],
      },
    ];
    m.state = "transcript_ready";
    m.revision++;
    return structuredClone(m);
  },
  exportText: async (id) => {
    meetingFixture.exports.push(id);
    return true;
  },
};
