import type { SpaceNode } from "@/features/spaces/types";

// Use distinct sectors so sparse spaces remain compact and readable.
export function radialLayout(nodes: SpaceNode[]) {
  const goal = nodes.find((node) => node.kind === "goal") ?? nodes[0];
  const research = new Set(["data", "research", "budget", "risk", "limit"]);
  const plans = new Set(["plan", "decision", "step"]);
  const groups = [
    nodes.filter((n) => n !== goal && research.has(n.kind)),
    nodes.filter(
      (n) => n !== goal && !research.has(n.kind) && !plans.has(n.kind),
    ),
    nodes.filter((n) => n !== goal && plans.has(n.kind)),
  ];
  const positions = new Map<
    string,
    { x: number; y: number; angle: number; central: boolean }
  >();
  if (goal) positions.set(goal.id, { x: -90, y: -90, angle: 0, central: true });
  const sectors = [-Math.PI, -Math.PI / 3, Math.PI / 3];
  let radius = 500;
  groups.forEach((group, sector) => {
    group.forEach((node, i) => {
      const lane = Math.floor(i / 3);
      const count = Math.min(3, group.length - lane * 3);
      const angle = sectors[sector] + ((i % 3) - (count - 1) / 2) * 0.75;
      const distance = 340 + lane * 290;
      radius = Math.max(radius, distance + 160);
      positions.set(node.id, {
        x: Math.cos(angle) * distance - 110,
        y: Math.sin(angle) * distance - 44,
        angle,
        central: false,
      });
    });
  });
  return { positions, radius };
}
