import type { SpaceNode, SpaceEdge } from "@/features/spaces/types";

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
  const rows = new Map<number, number>();
  const positions = new Map<
    string,
    { x: number; y: number; central: boolean }
  >();
  for (const node of [...nodes].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )) {
    const rank = ranks.get(node.id)!;
    const row = rows.get(rank) ?? 0;
    positions.set(node.id, {
      x: rank * 380,
      y: row * 240,
      central: node.kind === "goal",
    });
    rows.set(rank, row + 1);
  }
  return { positions, cyclic };
}
