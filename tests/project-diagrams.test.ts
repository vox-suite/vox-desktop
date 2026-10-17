import assert from "node:assert/strict";
import { test } from "node:test";
import {
  latestDiagrams,
  removeDiagram,
  titleDiagram,
} from "../src/features/projects/diagrams.ts";
import type {
  ProjectFlow,
  ProjectMessage,
} from "../src/features/projects/types.ts";

const flow: ProjectFlow = {
  title: "Model title",
  nodes: [],
  edges: [],
  gaps: [],
  diagram: {
    diagram_type: "architecture",
    meta: { title: "Model title", description: "Evidence-backed" },
  },
};
const message = (id: string, diagram_id?: string): ProjectMessage => ({
  id,
  diagram_id,
  role: "assistant",
  body: "Saved diagram",
  at: "2026-10-16T12:00:00Z",
  proposals: [],
  flow,
});
const question = (id: string): ProjectMessage => ({
  id,
  role: "user",
  body: "Explain this flow",
  at: "2026-10-16T12:00:00Z",
  proposals: [],
});

test("The library shows one latest version per diagram, including legacy diagrams", () => {
  const messages = [
    question("q1"),
    message("a1", "a"),
    question("q2"),
    message("b1", "b"),
    question("q3"),
    message("a2", "a"),
    message("legacy"),
  ];
  assert.deepEqual(
    latestDiagrams(messages).map((m) => m.id),
    ["legacy", "a2", "b1"],
  );
});

test("Deleting a diagram removes every version and its questions, preserving other discussion", () => {
  const discussion = {
    ...question("discussion"),
    body: "Keep this project note",
  };
  const messages = [
    question("q1"),
    message("a1", "a"),
    question("q2"),
    message("b1", "b"),
    discussion,
    question("q3"),
    message("a2", "a"),
  ];
  assert.deepEqual(
    removeDiagram(messages, "a").map((m) => m.id),
    ["q2", "b1", "discussion"],
  );
  assert.equal(messages.length, 7);
  assert.deepEqual(
    removeDiagram([question("q"), message("legacy")], "legacy"),
    [],
  );
});

test("An edited title reaches the saved flow and exported diagram without mutating evidence", () => {
  const titled = titleDiagram(flow, "  Voice request lifecycle  ");
  assert.equal(titled.title, "Voice request lifecycle");
  assert.deepEqual(titled.diagram?.meta, {
    title: "Voice request lifecycle",
    description: "Evidence-backed",
  });
  assert.equal(titled.nodes, flow.nodes);
  assert.equal(flow.title, "Model title");
  assert.throws(() => titleDiagram(flow, "   "), /title/i);
  assert.throws(() => titleDiagram(flow, "x".repeat(121)), /120/);
});
