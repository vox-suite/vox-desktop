import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTimelineFilter } from "../src/features/timeline/filters.ts";
test("custom Kolkata dates are inclusive and UTC end is exclusive", () => {
  const r = resolveTimelineFilter({
    range: "custom",
    timezone: "Asia/Kolkata",
    startDate: "2026-10-10",
    endDate: "2026-10-10",
  });
  assert.equal(r.startAt, "2026-10-09T18:30:00.000Z");
  assert.equal(r.endAt, "2026-10-10T18:30:00.000Z");
});
test("New York spring DST day is 23 hours", () => {
  const r = resolveTimelineFilter({
    range: "custom",
    timezone: "America/New_York",
    startDate: "2026-03-08",
    endDate: "2026-03-08",
  });
  assert.equal(Date.parse(r.endAt) - Date.parse(r.startAt), 23 * 3600 * 1000);
});
test("invalid timezone and backward ranges are rejected", () => {
  assert.throws(() =>
    resolveTimelineFilter({
      range: "custom",
      timezone: "Mars",
      startDate: "2026-10-10",
      endDate: "2026-10-10",
    }),
  );
  assert.throws(() =>
    resolveTimelineFilter({
      range: "custom",
      timezone: "Asia/Kolkata",
      startDate: "2026-10-10",
      endDate: "2026-10-09",
    }),
  );
});
test("last week starts Sunday in the requested timezone", () => {
  const r = resolveTimelineFilter(
    { range: "last_week", timezone: "Asia/Kolkata" },
    new Date("2026-10-10T02:00:00Z"),
  );
  assert.equal(r.startAt, "2026-09-26T18:30:00.000Z");
  assert.equal(r.endAt, "2026-10-03T18:30:00.000Z");
});
