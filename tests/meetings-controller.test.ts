import { test } from "node:test";
import assert from "node:assert/strict";
import { MeetingLibrary } from "../src/features/meetings/controller.ts";
import type { Meeting, MeetingsPort } from "../src/features/meetings/types.ts";
const meeting = (id: string, revision = 0, notes = ""): Meeting => ({
  id,
  title: id,
  state: "transcript_ready",
  revision,
  notes,
  created_ms: 1,
  updated_ms: 1,
  mic_frames: 0,
  system_frames: 0,
  cross_source_alignment_verified: false,
  tracks: [],
});
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
function port(overrides: Partial<MeetingsPort> = {}): MeetingsPort {
  return {
    list: async () => [],
    get: async (id) => meeting(id),
    create: async (title) => ({ ...meeting("new"), title }),
    saveNotes: async (id, revision, notes) => meeting(id, revision + 1, notes),
    remove: async () => {},
    recover: async () => [],
    importTranscript: async () => null,
    exportText: async () => false,
    ...overrides,
  };
}
test("late meeting fetch cannot replace the current selection", async () => {
  const a = deferred<Meeting>();
  const lib = new MeetingLibrary(
    port({ get: async (id) => (id === "a" ? a.promise : meeting("b")) }),
  );
  const pending = lib.select("a");
  await lib.select("b");
  a.resolve(meeting("a"));
  await pending;
  assert.equal(lib.snapshot().detail?.id, "b");
});
test("typing during save keeps the newer draft and advances its base revision", async () => {
  const saved = deferred<Meeting>();
  const lib = new MeetingLibrary(port({ saveNotes: () => saved.promise }));
  await lib.select("a");
  lib.edit("first");
  const pending = lib.save();
  lib.edit("newer");
  saved.resolve(meeting("a", 1, "first"));
  await pending;
  assert.equal(lib.snapshot().draft, "newer");
  assert.equal(lib.snapshot().dirty, true);
  assert.equal(lib.snapshot().detail?.revision, 1);
});
test("unsaved drafts survive selecting another meeting", async () => {
  const lib = new MeetingLibrary(port());
  await lib.select("a");
  lib.edit("keep this");
  await lib.select("b");
  await lib.select("a");
  assert.equal(lib.snapshot().draft, "keep this");
  assert.equal(lib.snapshot().dirty, true);
});
test("save conflicts keep the draft until the user explicitly chooses", async () => {
  let calls = 0;
  const lib = new MeetingLibrary(
    port({
      get: async () => meeting("a", calls ? 2 : 0, calls ? "remote" : ""),
      saveNotes: async () => {
        calls++;
        throw Error("meeting changed");
      },
    }),
  );
  await lib.select("a");
  lib.edit("mine");
  await lib.save();
  assert.equal(lib.snapshot().draft, "mine");
  assert.equal(lib.snapshot().conflict?.notes, "remote");
  lib.useSavedNotes();
  assert.equal(lib.snapshot().draft, "remote");
  assert.equal(lib.snapshot().dirty, false);
});
test("closing an account prevents late data from being displayed", async () => {
  const a = deferred<Meeting>();
  const lib = new MeetingLibrary(port({ get: () => a.promise }));
  const pending = lib.select("a");
  lib.close();
  a.resolve(meeting("a", 0, "private"));
  await pending;
  assert.equal(lib.snapshot().detail, null);
  assert.equal(lib.snapshot().draft, "");
});
test("pagination appends unique items and stops on a short page", async () => {
  let calls = 0;
  const lib = new MeetingLibrary(
    port({
      list: async () => {
        calls++;
        return calls === 1
          ? Array.from({ length: 20 }, (_, i) => ({
              ...meeting(String(i)),
              has_transcript: false,
            }))
          : [
              { ...meeting("19"), has_transcript: false },
              { ...meeting("20"), has_transcript: false },
            ];
      },
    }),
  );
  await lib.load();
  await lib.loadMore();
  assert.equal(lib.snapshot().items.length, 21);
  assert.equal(lib.snapshot().hasMore, false);
});

test("reverting to previously saved text during save is still a newer edit", async () => {
  const saved = deferred<Meeting>();
  const lib = new MeetingLibrary(port({ saveNotes: () => saved.promise }));
  await lib.select("a");
  lib.edit("first");
  const pending = lib.save();
  lib.edit("");
  await lib.select("b");
  await lib.select("a");
  saved.resolve(meeting("a", 1, "first"));
  await pending;
  assert.equal(lib.snapshot().draft, "");
  assert.equal(lib.snapshot().dirty, true);
});

test("background refresh keeps the open detail and draft mounted", async () => {
  const next = deferred<Meeting>();
  let calls = 0;
  const lib = new MeetingLibrary(
    port({ get: async () => (++calls === 1 ? meeting("a") : next.promise) }),
  );
  await lib.select("a");
  lib.edit("live draft");
  const pending = lib.reloadSelected();
  assert.equal(lib.snapshot().detail?.id, "a");
  assert.equal(lib.snapshot().detailLoading, false);
  next.resolve({ ...meeting("a", 1), state: "captured" });
  await pending;
  assert.equal(lib.snapshot().draft, "live draft");
  assert.equal(lib.snapshot().detail?.state, "captured");
});
