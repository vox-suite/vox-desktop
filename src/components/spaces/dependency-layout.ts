import type { SpaceNode, SpaceEdge } from "@/features/spaces/types";

export const NODE_WIDTH = 420;
export const NODE_MIN_HEIGHT = 170;
export const NODE_MAX_HEIGHT = 360;
const CHROME_HEIGHT = 92;
const BODY_CHARS_PER_LINE = 48;
const TITLE_CHARS_PER_LINE = 44;
const COLUMN_GAP = 110;
const ROW_GAP = 44;

const lineCount = (text: string, perLine: number) =>
  text
    .split("\n")
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)),
      0,
    );

export function estimateNodeHeight(node: SpaceNode): number {
  const execution = node.data.execution as { error?: string } | undefined;
  const body = execution?.error ?? node.body;
  const height =
    CHROME_HEIGHT +
    lineCount(node.title, TITLE_CHARS_PER_LINE) * 24 +
    8 +
    lineCount(body, BODY_CHARS_PER_LINE) * 24;
  return Math.min(NODE_MAX_HEIGHT, Math.max(NODE_MIN_HEIGHT, height));
}

// Columns express prerequisite depth; stable creation order preserves sibling order.
export function dependencyLayout(nodes: SpaceNode[], edges: SpaceEdge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parents = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges)
    if (byId.has(edge.from_node) && byId.has(edge.to_node))
      parents.get(edge.to_node)!.add(edge.from_node);
  for (const node of nodes)
    for (const id of node.derived_from)
      if (byId.has(id)) parents.get(node.id)!.add(id);
  const ranks = new Map<string, number>();
  const pending = [...nodes].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  while (pending.length) {
    const ready = pending.filter((node) =>
      [...parents.get(node.id)!].every((id) => ranks.has(id)),
    );
    if (!ready.length) break;
    for (const node of ready) {
      ranks.set(
        node.id,
        Math.max(
          -1,
          ...[...parents.get(node.id)!].map((id) => ranks.get(id)!),
        ) + 1,
      );
      pending.splice(pending.indexOf(node), 1);
    }
  }
  const cyclic = pending.map((node) => node.id);
  for (const node of pending)
    ranks.set(node.id, Math.max(0, ...ranks.values()) + 1);
  const byRank = new Map<number, SpaceNode[]>();
  const ordered = [...nodes].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  for (const node of ordered) {
    const rank = ranks.get(node.id)!;
    byRank.set(rank, [...(byRank.get(rank) ?? []), node]);
  }
  const positions = new Map<
    string,
    { x: number; y: number; central: boolean }
  >();
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    const layer = byRank.get(rank)!;
    const pull = (node: SpaceNode) => {
      const known = [...parents.get(node.id)!]
        .map((id) => positions.get(id)?.y)
        .filter((y): y is number => y !== undefined);
      return known.length
        ? known.reduce((sum, y) => sum + y, 0) / known.length
        : 0;
    };
    layer.sort((a, b) => pull(a) - pull(b));
    const heights = layer.map(estimateNodeHeight);
    const total =
      heights.reduce((sum, h) => sum + h, 0) + (layer.length - 1) * ROW_GAP;
    let y = -total / 2;
    layer.forEach((node, index) => {
      positions.set(node.id, {
        x: rank * (NODE_WIDTH + COLUMN_GAP),
        y,
        central: node.kind === "goal",
      });
      y += heights[index] + ROW_GAP;
    });
  }
  return { positions, cyclic };
}
