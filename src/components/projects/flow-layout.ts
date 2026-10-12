import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api";
import type { ProjectFlow } from "@/features/projects/types";

export type FlowPoint = { x: number; y: number };
export type FlowLayout = {
  nodes: { id: string; x: number; y: number; parentId?: string }[];
  groups: {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  routes: Record<string, { points: FlowPoint[]; label?: FlowPoint }>;
};
export const NODE_WIDTH = 188;
export const NODE_HEIGHT = 88;
export function compactLabel(label: string) {
  return label.length > 24 ? `${label.slice(0, 21)}…` : label;
}

export async function layoutFlow(flow: ProjectFlow): Promise<FlowLayout> {
  const [{ default: ELK }, { default: ElkWorker }] = await Promise.all([
    import("elkjs/lib/elk-api.js"),
    import("elkjs/lib/elk-worker.min.js?worker"),
  ]);
  const folders = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const node of flow.nodes) {
    const paths = node.citations.map((c) => c.path.split("/"));
    if (
      !paths.length ||
      paths.some((p) => p.length < 2 || p[0] !== paths[0][0])
    )
      continue;
    const folder = paths[0][0];
    folders.set(node.id, folder);
    members.set(folder, [...(members.get(folder) ?? []), node.id]);
  }
  const groupIds = new Map<string, string>();
  for (const [folder, ids] of members) {
    if (ids.length < 2) continue;
    let id = `__vox_boundary_${groupIds.size}`;
    while (flow.nodes.some((n) => n.id === id)) id += "_";
    groupIds.set(folder, id);
  }
  const children: ElkNode[] = [];
  const groups = new Map<string, ElkNode>();
  for (const [folder, id] of groupIds) {
    const group: ElkNode = {
      id,
      children: [],
      layoutOptions: { "elk.padding": "[top=42,left=24,bottom=24,right=24]" },
    };
    groups.set(folder, group);
    children.push(group);
  }
  for (const node of flow.nodes) {
    const child: ElkNode = {
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
    const parent = groups.get(folders.get(node.id) ?? "");
    if (parent) parent.children!.push(child);
    else children.push(child);
  }
  let rootId = "__vox_flow_root";
  while (flow.nodes.some((node) => node.id === rootId)) rootId += "_";
  const engine = new ELK({ workerFactory: () => new ElkWorker() });
  const result = await engine
    .layout({
      id: rootId,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.spacing.nodeNode": "48",
        "elk.layered.spacing.nodeNodeBetweenLayers": "48",
        "elk.layered.spacing.edgeNodeBetweenLayers": "24",
        "elk.spacing.edgeNode": "20",
        "elk.padding": "[top=28,left=28,bottom=28,right=28]",
      },
      children,
      edges: flow.edges.map((edge, i) => ({
        id: `call-${i}`,
        sources: [edge.from],
        targets: [edge.to],
        labels: edge.label
          ? [
              {
                text: compactLabel(edge.label),
                width: Math.min(
                  140,
                  compactLabel(edge.label).length * 5.2 + 10,
                ),
                height: 18,
              },
            ]
          : [],
      })),
    })
    .finally(() => engine.terminateWorker());
  const layout: FlowLayout = { nodes: [], groups: [], routes: {} };
  const labels = new Map([...groupIds].map(([label, id]) => [id, label]));
  const offsets = new Map<string, FlowPoint>([[rootId, { x: 0, y: 0 }]]);
  const visit = (node: ElkNode, offset: FlowPoint, parentId?: string) => {
    for (const child of node.children ?? []) {
      const label = labels.get(child.id);
      if (label)
        layout.groups.push({
          id: child.id,
          label,
          x: child.x ?? 0,
          y: child.y ?? 0,
          width: child.width ?? 0,
          height: child.height ?? 0,
        });
      else
        layout.nodes.push({
          id: child.id,
          x: child.x ?? 0,
          y: child.y ?? 0,
          parentId,
        });
      offsets.set(child.id, {
        x: offset.x + (child.x ?? 0),
        y: offset.y + (child.y ?? 0),
      });
      visit(
        child,
        { x: offset.x + (child.x ?? 0), y: offset.y + (child.y ?? 0) },
        label ? child.id : parentId,
      );
    }
    for (const edge of (node.edges ?? []) as ElkExtendedEdge[]) {
      const section = edge.sections?.[0];
      if (!section) continue;
      const origin = offsets.get(edge.container ?? node.id) ?? offset;
      const points = [
        section.startPoint,
        ...(section.bendPoints ?? []),
        section.endPoint,
      ].map((point) => ({ x: point.x + origin.x, y: point.y + origin.y }));
      const label = edge.labels?.[0];
      layout.routes[edge.id] = {
        points,
        label: label
          ? {
              x: (label.x ?? 0) + origin.x + (label.width ?? 0) / 2,
              y: (label.y ?? 0) + origin.y + (label.height ?? 0) / 2,
            }
          : undefined,
      };
    }
  };
  visit(result, { x: 0, y: 0 });
  if (Object.keys(layout.routes).length !== flow.edges.length)
    throw new Error("Incomplete edge routing");
  return layout;
}
