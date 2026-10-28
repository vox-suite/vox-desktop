import { test } from "node:test";
import assert from "node:assert/strict";
import { RecordingSession } from "../src/features/meetings/recording.ts";
import type {
  MeetingRecordingPort,
  RecordingStatus,
} from "../src/features/meetings/types.ts";
const status = (phase: RecordingStatus["phase"]): RecordingStatus => ({
  id: "a",
  phase,
  started_ms: 1,
  error: null,
  mic_frames: 0,
  system_frames: 0,
});
function port(
  overrides: Partial<MeetingRecordingPort> = {},
): MeetingRecordingPort {
  return {
    status: async () => status("recording"),
    start: async () => ({ id: "a" }) as never,
    stop: async () => {},
    modelReady: async () => true,
    chooseModel: async () => true,
    transcribe: async () => {},
    ...overrides,
  };
}
test("late status cannot reveal a closed account", async () => {
  let resolve!: (s: RecordingStatus) => void;
  const session = new RecordingSession(
    port({ status: () => new Promise((r) => (resolve = r)) }),
  );
  const pending = session.poll();
  session.close();
  resolve(status("recording"));
  await pending;
  assert.equal(session.snapshot().status.id, null);
});
test("failed stop stays visible and can be retried", async () => {
  let count = 0;
  const session = new RecordingSession(
    port({
      stop: async () => {
        if (++count === 1) throw Error("stop failed");
      },
    }),
  );
  await session.poll();
  await session.stop();
  assert.match(session.snapshot().error, /stop failed/);
  await session.stop();
  assert.equal(count, 2);
});
test("completed capture notifies library exactly once per phase transition", async () => {
  let phase: RecordingStatus["phase"] = "recording",
    changes = 0;
  const session = new RecordingSession(
    port({ status: async () => status(phase) }),
    () => {
      changes++;
    },
  );
  await session.poll();
  phase = "captured";
  await session.poll();
  await session.poll();
  assert.equal(changes, 1);
});

test("a status request started before recording cannot overwrite the new session", async () => {
  let resolve!: (s: RecordingStatus) => void;
  let calls = 0;
  const session = new RecordingSession(
    port({
      status: () =>
        ++calls === 1
          ? new Promise((r) => (resolve = r))
          : Promise.resolve(status("recording")),
    }),
  );
  const pending = session.poll();
  await session.start("Meeting");
  resolve({ ...status(""), id: null });
  await pending;
  await new Promise((r) => setImmediate(r));
  assert.equal(session.snapshot().status.phase, "recording");
});
