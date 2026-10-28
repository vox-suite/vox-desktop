import { RecordingSession } from "./recording";
import { platform } from "@/platform";
import { registerCacheReset } from "@/features/cache-reset";
import { MeetingLibrary } from "./controller";
import type { MeetingsPort } from "./types";
const sessions = new Map<string, MeetingLibrary>();
function port(): MeetingsPort {
  const service = platform().meetings;
  if (!service)
    throw new Error("Meeting notes are available in the Vox desktop app.");
  return service;
}
const local: MeetingsPort = {
  list: async (o, l) => port().list(o, l),
  get: async (id) => port().get(id),
  create: async (title) => port().create(title),
  saveNotes: async (id, rev, text) => port().saveNotes(id, rev, text),
  remove: async (id, rev) => port().remove(id, rev),
  recover: async () => port().recover(),
  cleanupAudio: async (id) => port().cleanupAudio(id),
  importTranscript: async (id, rev) => port().importTranscript(id, rev),
  exportText: async (id) => port().exportText(id),
};
export function meetingLibrary(accountId: string) {
  let session = sessions.get(accountId);
  if (!session) {
    session = new MeetingLibrary(local);
    sessions.set(accountId, session);
  }
  return session;
}
export function clearMeetingLibraries() {
  sessions.forEach((s) => s.close());
  sessions.clear();
}
registerCacheReset(clearMeetingLibraries);

export function hasUnsavedMeetingNotes(accountId: string) {
  return sessions.get(accountId)?.hasDrafts() ?? false;
}

const recordings = new Map<string, RecordingSession>();
export function meetingRecording(accountId: string) {
  const port = platform().meetings?.recording;
  if (!port) return null;
  let session = recordings.get(accountId);
  if (!session) {
    session = new RecordingSession(port, () => {
      const library = meetingLibrary(accountId);
      void library.refresh();
      void library.reloadSelected();
    });
    recordings.set(accountId, session);
  }
  return session;
}
registerCacheReset(() => {
  recordings.forEach((s) => s.close());
  recordings.clear();
});
