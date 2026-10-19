import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "vox-layout-test-"));
execFileSync("tar", [
  "-xzf",
  new URL("../src-tauri/resources/archify-runtime.tar.gz", import.meta.url)
    .pathname,
  "-C",
  root,
]);
after(() => fs.rmSync(root, { recursive: true, force: true }));
const { fitDiagram, arrowLabelProblems } = await import(
  pathToFileURL(path.join(root, "vox-layout.mjs"))
);
function render(d, mode = "render-fit") {
  const input = path.join(root, "test.json");
  fs.writeFileSync(input, JSON.stringify(d));
  return JSON.parse(
    execFileSync(
      process.execPath,
      [path.join(root, "vox-render.mjs"), mode, input],
      { encoding: "utf8" },
    ),
  );
}
test("long sequence labels fit their arrows; dense times and ranges expand together", () => {
  const d = {
    schema_version: 1,
    diagram_type: "sequence",
    meta: { title: "Voice flow", viewBox: [600, 400] },
    participants: [
      { id: "desktop", type: "frontend", label: "Desktop audio capture" },
      {
        id: "bridge",
        type: "backend",
        label: "Voice bridge streaming service",
      },
    ],
    messages: [
      {
        from: "desktop",
        to: "bridge",
        label: "Bootstrap a single-use authenticated voice session ticket",
        y: 160,
      },
      {
        from: "bridge",
        to: "desktop",
        label: "Return session identity and supported audio format",
        y: 170,
      },
    ],
    activations: [{ participant: "bridge", from: 160, to: 170 }],
  };
  const fitted = fitDiagram(d);
  assert.deepEqual(
    fitted.messages.map((m) => m.label),
    d.messages.map((m) => m.label),
  );
  assert.ok(fitted.messages[1].y - fitted.messages[0].y >= 44);
  assert.equal(fitted.activations[0].to, fitted.messages[1].y);
  assert.deepEqual(fitDiagram(fitted), fitted);
  const result = render(d);
  assert.equal(result.receipt.composition_valid, true);
  assert.equal(render(result.diagram, "render").svg, result.svg);
});
test("simple dataflow fits long node and arrow labels without changing topology", () => {
  const d = {
    schema_version: 1,
    diagram_type: "dataflow",
    meta: { title: "Voice data" },
    stages: [{ label: "Capture" }, { label: "Process" }],
    nodes: [
      {
        id: "mic",
        type: "frontend",
        label: "Desktop microphone audio capture",
        stage: 0,
        row: 0,
      },
      {
        id: "bridge",
        type: "backend",
        label: "Voice bridge audio processing",
        stage: 1,
        row: 0,
      },
    ],
    flows: [
      {
        from: "mic",
        to: "bridge",
        label: "Authenticated streaming audio frames",
      },
    ],
  };
  const result = render(d);
  assert.equal(result.receipt.composition_valid, true);
  assert.equal(result.diagram.flows[0].from, "mic");
  assert.deepEqual(fitDiagram(result.diagram), result.diagram);
});
test("every diagram type rejects an arrow shorter than its label even without showcase", async () => {
  const { cleanLabelRouteClearanceProblems } = await import(
    pathToFileURL(path.join(root, "renderers/shared/geometry.mjs"))
  );
  for (const diagramType of [
    "sequence",
    "dataflow",
    "architecture",
    "workflow",
    "lifecycle",
  ]) {
    const relation = { from: "a", to: "b", label: "A wide label" };
    const args = {
      diagramType,
      relationCollection: "edges",
      relations: [relation],
      labels: [
        { relation, relationIndex: 0, label: relation.label, width: 100 },
      ],
      pathFor: () => ({
        points: [
          [0, 0],
          [120, 0],
        ],
      }),
    };
    assert.match(cleanLabelRouteClearanceProblems(args)[0], /arrow-label-span/);
    args.pathFor = () => ({
      points: [
        [0, 0],
        [124, 0],
      ],
    });
    assert.deepEqual(arrowLabelProblems(args), []);
  }
});
test("authored dataflow routes are not silently moved by automatic fitting", () => {
  const d = {
    diagram_type: "dataflow",
    meta: { title: "Authored" },
    nodes: [{ id: "a", label: "Long label", width: 112 }],
    flows: [{ via: [[10, 20]], labelAt: [15, 25] }],
  };
  assert.deepEqual(fitDiagram(d), d);
});


test("bundled layout modules match their reviewable sources", () => {
  for (const name of ["vox-render.mjs", "vox-layout.mjs"]) {
    assert.equal(fs.readFileSync(path.join(root, name), "utf8"), fs.readFileSync(new URL("../src-tauri/resources/" + name, import.meta.url), "utf8"));
  }
});

test("diagnostic label repairs preserve text and do not invent sequence fields", async () => {
  const {fixLabels} = await import(pathToFileURL(path.join(root, "vox-layout.mjs")));
  const d = {diagram_type:"dataflow", flows:[{from:"a",to:"b",label:"Payload"}]};
  const diagnostics=JSON.stringify({diagnostics:[{message:'Label "Payload" overlaps node "a" — set labelAt [120, 210]'}]});
  assert.equal(fixLabels(d, diagnostics, 0), 1);
  assert.deepEqual(d.flows[0], {from:"a",to:"b",label:"Payload",labelAt:[120,210]});
  const sequence={diagram_type:"sequence", messages:[{from:"a",to:"b",label:"Payload",y:180}]};
  const before=structuredClone(sequence);
  assert.equal(fixLabels(sequence, diagnostics, 0), 0);
  assert.deepEqual(sequence,before);
});
