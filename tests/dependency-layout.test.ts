import { test } from "node:test";
import assert from "node:assert/strict";
import { dependencyLayout } from "../src/components/spaces/dependency-layout.ts";
const node = (id: string, derived_from: string[] = []) =>
  ({
    id,
    kind: id === "v" ? "goal" : "research",
    derived_from,
    created_at: id,
  }) as Parameters<typeof dependencyLayout>[0][number];
const edge = (from_node: string, to_node: string) =>
  ({ from_node, to_node }) as Parameters<typeof dependencyLayout>[1][number];
test("fork, follow-up, and join preserve dependency hierarchy", () => {
  const { positions, cyclic } = dependencyLayout(
    [node("v"), node("a"), node("b"), node("c"), node("s")],
    [
      edge("v", "a"),
      edge("v", "b"),
      edge("a", "c"),
      edge("c", "s"),
      edge("b", "s"),
    ],
  );
  assert.equal(positions.get("a")!.x, positions.get("b")!.x);
  assert.ok(positions.get("c")!.x > positions.get("a")!.x);
  assert.ok(positions.get("s")!.x > positions.get("c")!.x);
  assert.notEqual(positions.get("a")!.y, positions.get("b")!.y);
  assert.deepEqual(cyclic, []);
});
test("legacy cycle is surfaced without hanging", () => {
  assert.equal(
    dependencyLayout([node("a"), node("b")], [edge("a", "b"), edge("b", "a")])
      .cyclic.length,
    2,
  );
});
test("derived_from is respected for legacy graphs", () => {
  const r = dependencyLayout([node("v"), node("a", ["v"])], []);
  assert.ok(r.positions.get("a")!.x > r.positions.get("v")!.x);
});
