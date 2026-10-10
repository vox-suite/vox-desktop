import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LatestRequest,
  uniqueCharts,
} from "../src/features/pulse/utils.ts";
test("A stale preview cannot replace the user's newer settings", () => {
  const requests = new LatestRequest();
  const first = requests.start();
  const second = requests.start();
  assert.equal(requests.isCurrent(first), false);
  assert.equal(requests.isCurrent(second), true);
  requests.cancel();
  assert.equal(requests.isCurrent(second), false);
});

test("Refreshing loaded pages retains charts and removes overlap after deletions", () => {
  assert.deepEqual(
    uniqueCharts([{ id: "a" }, { id: "b" }, { id: "b" }, { id: "c" }]),
    [{ id: "a" }, { id: "b" }, { id: "c" }],
  );
});
