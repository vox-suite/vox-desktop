// Geometry-only fitting. Never change labels, identities, evidence or message order.
import { textUnits } from "./renderers/shared/utils.mjs";
export function fitDiagram(input) {
  const d = structuredClone(input);
  if (!d.meta) return d;
  const key = {
    architecture: "components",
    workflow: "nodes",
    dataflow: "nodes",
    lifecycle: "states",
  }[d.diagram_type];
  const authoredDataflow =
    d.diagram_type === "dataflow" &&
    (d.flows || []).some((f) =>
      ["via", "labelAt", "channelX", "channelY"].some((k) => f[k] != null),
    );
  for (const n of d[key] || []) {
    if (
      (d.diagram_type === "dataflow" && !authoredDataflow) ||
      d.diagram_type === "architecture"
    ) {
      const fit = (current) =>
        Math.ceil(
          Math.max(
            current,
            textUnits(n.label || "") * 7 + 28,
            textUnits(n.sublabel || "") * 4.5 + 24,
            textUnits(n.tag || "") * 4.5 + 24,
          ),
        );
      // Architecture components are sized by size:[w,h]; the schema has no width.
      if (d.diagram_type === "architecture") {
        const [w, h] = Array.isArray(n.size) ? n.size : [120, 60];
        n.size = [fit(w), h];
      } else n.width = fit(n.width || 112);
    }
  }
  if (d.diagram_type === "sequence" && d.participants?.length) {
    const messages = d.messages || [];
    const count = d.participants.length;
    const box = Math.max(
      190,
      ...d.participants.map((p) =>
        Math.max(
          textUnits(p.label || "") * 6.8 + 20,
          textUnits(p.sublabel || "") * 4.5 + 24,
        ),
      ),
    );
    let gap = box + 36;
    for (const m of messages) {
      const distance = Math.abs(
        d.participants.findIndex((p) => p.id === m.from) -
          d.participants.findIndex((p) => p.id === m.to),
      );
      if (distance)
        gap = Math.max(gap, (textUnits(m.label || "") * 6.6 + 50) / distance);
    }
    d.meta.column_fit = "spread";
    const width = Math.ceil(
      Math.max(
        d.meta.viewBox?.[0] || 0,
        124 + count * (box + 24),
        102 + box + gap * Math.max(0, count - 1),
      ),
    );
    // Apply one monotonic mapping to messages, segment bounds and activations.
    const old = [
      ...new Set(messages.map((m) => m.y).filter(Number.isFinite)),
    ].sort((a, b) => a - b);
    const next = old.map((y, i) => Math.max(y, 180 + i * 44));
    for (let i = 1; i < next.length; i++)
      next[i] = Math.max(next[i], next[i - 1] + 44);
    const map = (y) => {
      if (!Number.isFinite(y) || !old.length) return y;
      if (y <= old[0]) return y + next[0] - old[0];
      for (let i = 1; i < old.length; i++)
        if (y <= old[i])
          return (
            next[i - 1] +
            ((y - old[i - 1]) / (old[i] - old[i - 1])) * (next[i] - next[i - 1])
          );
      return y + next.at(-1) - old.at(-1);
    };
    for (const m of messages) m.y = map(m.y);
    for (const range of [...(d.segments || []), ...(d.activations || [])]) {
      range.from = map(range.from);
      range.to = map(range.to);
    }
    const bottom = Math.max(
      300,
      ...messages.map((m) => m.y || 0),
      ...(d.segments || []).map((s) => s.to || 0),
      ...(d.activations || []).map((s) => s.to || 0),
    );
    d.meta.viewBox = [
      width,
      Math.max(480, d.meta.viewBox?.[1] || 0, bottom + 140),
    ];
  }
  if (d.diagram_type === "dataflow" && !authoredDataflow) {
    const nodeWidth = Math.max(
      112,
      ...(d.nodes || []).map((n) => n.width || 112),
    );
    const labelWidth = Math.max(
      0,
      ...(d.flows || []).map(
        (f) =>
          Math.max(
            textUnits(f.label || ""),
            textUnits(f.classification || ""),
          ) *
            4.9 +
          36,
      ),
    );
    const gap = Math.max(d.meta.column_gap || 215, nodeWidth + labelWidth + 40);
    const rowGap = Math.max(
      d.meta.row_gap || 114,
      Math.max(58, ...(d.nodes || []).map((n) => n.height || 58)) +
        labelWidth +
        40,
    );
    const oldGap = d.meta.column_gap || 215,
      oldRow = d.meta.row_gap || 114;
    const x = (v) => 100 + ((v - 100) * gap) / oldGap;
    const y = (v) => 128 + ((v - 128) * rowGap) / oldRow;
    for (const f of d.flows || []) {
      for (const field of ["via"])
        if (Array.isArray(f[field]))
          f[field] = f[field].map((p) => [x(p[0]), y(p[1])]);
      if (Array.isArray(f.labelAt))
        f.labelAt = [x(f.labelAt[0]), y(f.labelAt[1])];
      if (Number.isFinite(f.channelX)) f.channelX = x(f.channelX);
      if (Number.isFinite(f.channelY)) f.channelY = y(f.channelY);
    }
    d.meta.column_gap = gap;
    d.meta.row_gap = rowGap;
    d.meta.viewBox = [
      Math.max(
        d.meta.viewBox?.[0] || 940,
        200 + gap * Math.max(0, (d.stages?.length || 1) - 1) + nodeWidth,
      ),
      Math.max(d.meta.viewBox?.[1] || 720, 128 + 4 * rowGap + 160),
    ];
  }
  return d;
}
export function arrowLabelProblems({
  labels,
  relations,
  pathFor,
  diagramType,
  relationCollection,
}) {
  const problems = [];
  for (const label of labels || []) {
    const relation = label.relation || relations?.[label.relationIndex];
    if (!relation || !Number.isFinite(label.width)) continue;
    const points = pathFor(relation)?.points || [];
    const longest = Math.max(
      0,
      ...points
        .slice(1)
        .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1])),
    );
    const required = label.width + 24;
    if (longest < required)
      problems.push(
        `[layout/arrow-label-span] ${diagramType} ${relationCollection}[${label.relationIndex}] label "${label.label || relation.label || ""}" needs a straight arrow segment of at least ${Math.ceil(required)}px including 12px clearance on each end; longest segment is ${Math.floor(longest)}px. Increase spacing or shorten the label.`,
      );
  }
  return problems;
}

const EDGES = {
  architecture: "connections",
  workflow: "edges",
  sequence: "messages",
  dataflow: "flows",
  lifecycle: "transitions",
};
// Applies the renderer's label-placement diagnostics to the diagram in place.
// Only labelAt/labelDx/labelDy move; labels, identities and order never change.
// Returns how many relationships were moved.
export function fixLabels(d, stderr, pass) {
  // Sequence schemas have no labelAt/labelDy; their spacing is fitted above.
  if (d.diagram_type === "sequence") return 0;
  let diagnostics;
  try {
    diagnostics = JSON.parse(stderr).diagnostics || [];
  } catch {
    return 0;
  }
  const relations = d[EDGES[d.diagram_type]] || [];
  const byLabel = (label) => {
    const hits = relations.filter((r) => r.label === label);
    return hits.length === 1 ? hits[0] : null;
  };
  const moved = new Set();
  const nudge = (rel, step) => {
    if (!rel || moved.has(rel) || Array.isArray(rel.labelAt)) return;
    rel.labelDy = (Number.isFinite(rel.labelDy) ? rel.labelDy : 0) + step;
    moved.add(rel);
  };
  const step = (pass % 2 ? -1 : 1) * (14 + 7 * Math.floor(pass / 2));
  for (const { message = "" } of diagnostics) {
    // "Label "X" overlaps node "Y" … set labelAt [x, y]": take the computed clear spot.
    const overlap = /^Label "([^"]+)" overlaps \w+ "[^"]+"/.exec(message);
    const at = /set labelAt \[(-?[\d.]+), (-?[\d.]+)\]/.exec(message);
    if (overlap) {
      const rel = byLabel(overlap[1]);
      if (rel && at && !moved.has(rel)) {
        rel.labelAt = [Number(at[1]), Number(at[2])];
        delete rel.labelDx;
        delete rel.labelDy;
        delete rel.labelSegment;
        moved.add(rel);
      } else nudge(rel, step);
      continue;
    }
    // Two labels collide: move the second one.
    const pair = /^Labels "([^"]+)" and "([^"]+)" overlap/.exec(message);
    if (pair) {
      nudge(byLabel(pair[2]), step);
      continue;
    }
    // A label sits too close to another route: step it off the route.
    const clear =
      /label-route-clearance\][^]*?label "[^"]*" on (\w+)\[(\d+)\]/.exec(
        message,
      );
    if (clear && clear[1] === EDGES[d.diagram_type]) {
      nudge(relations[Number(clear[2])], step);
      continue;
    }
  }
  return moved.size;
}
