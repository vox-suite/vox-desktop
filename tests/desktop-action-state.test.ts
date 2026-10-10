import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reduceAction,
  type DesktopAction,
} from "../src/features/desktop-control/action-state.ts";
test("late starts cannot resurrect a completed skeleton", () => {
  const event: DesktopAction = {
    id: "one",
    action: "add_node",
    phase: "completed",
    spaceId: "space",
    nodeId: null,
  };
  const state = reduceAction({}, event);
  assert.equal(reduceAction(state, { ...event, phase: "started" }), state);
});
test("failed actions retain their target and visible error", () => {
  const event: DesktopAction = {
    id: "two",
    action: "update_node",
    phase: "started",
    spaceId: "space",
    nodeId: "node",
  };
  const state = reduceAction({}, event);
  const next = reduceAction(state, {
    ...event,
    phase: "failed",
    error: "Version changed",
  });
  assert.equal(next.two.phase, "failed");
  assert.equal(next.two.error, "Version changed");
  assert.equal(next.two.nodeId, "node");
});
