import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultDefinition,
  LatestRequest,
  uniqueCharts,
} from "../src/features/pulse/settings.ts";
import type { Measurement } from "../src/features/pulse/discovery-types.ts";

test("Counter measurements choose a supported game dimension instead of daily allocation", () => {
  const m = {
    id: "counter",
    buckets: [],
    dimensions: ["game"],
    default_dimension: "game",
  } as unknown as Measurement;
  const d = defaultDefinition(m, "Asia/Kolkata");
  assert.equal(d.bucket, null);
  assert.equal(d.dimension, "game");
  assert.equal(d.chart_type, "bar");
});
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
