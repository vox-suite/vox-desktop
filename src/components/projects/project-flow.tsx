import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import type { Citation, ProjectFlow } from "@/features/projects/types";
import "@xyflow/react/dist/style.css";

type FlowData = {
  title: string;
  kind: string;
  detail: string;
  citations: Citation[];
  onRead: (citation: Citation) => void;
};
function FlowCard({ data }: NodeProps<Node<FlowData>>) {
  return (
    <div className="project-flow-card">
      <Handle type="target" position={Position.Left} />
      <span className="text-[11px] text-muted-foreground">{data.kind}</span>
      <h3 className="mt-2 text-sm font-medium break-words">{data.title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {data.detail}
      </p>
      {!data.citations.length && (
        <p className="mt-3 text-[11px] text-amber-200">
          Inferred · source not verified
        </p>
      )}
      {data.citations.map((c, i) => (
        <button
          key={i}
          className="nodrag mt-2 block max-w-full truncate text-left text-[11px] underline underline-offset-4"
          title={`${c.path}:${c.start_line}-${c.end_line}`}
          onClick={() => data.onRead(c)}
        >
          {c.path}:{c.start_line}
        </button>
      ))}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { flow: FlowCard };
export function ProjectFlowCanvas({
  flow,
  onRead,
}: {
  flow: ProjectFlow;
  onRead: (citation: Citation) => void;
}) {
  const graph = useMemo(() => {
    const ranks = new Map<string, number>();
    const incoming = new Set(flow.edges.map((e) => e.to));
    const roots = flow.nodes.filter((n) => !incoming.has(n.id));
    const queue = (roots.length ? roots : flow.nodes.slice(0, 1)).map(
      (n) => n.id,
    );
    queue.forEach((id) => ranks.set(id, 0));
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      for (const edge of flow.edges.filter((e) => e.from === id)) {
        if (!ranks.has(edge.to)) {
          ranks.set(edge.to, (ranks.get(id) ?? 0) + 1);
          queue.push(edge.to);
        }
      }
    }
    const rows = new Map<number, number>();
    const counts = new Map<number, number>();
    for (const n of flow.nodes) {
      const rank = ranks.get(n.id) ?? 0;
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }
    const bandOffsets = new Map<number, number>();
    let height = 0;
    for (
      let band = 0;
      band <= Math.floor(Math.max(0, ...ranks.values()) / 3);
      band++
    ) {
      bandOffsets.set(band, height);
      height +=
        Math.max(
          1,
          ...[0, 1, 2].map((column) => counts.get(band * 3 + column) ?? 0),
        ) * 340;
    }
    const nodes: Node<FlowData>[] = flow.nodes.map((n) => {
      const rank = ranks.get(n.id) ?? 0;
      const row = rows.get(rank) ?? 0;
      rows.set(rank, row + 1);
      return {
        id: n.id,
        type: "flow",
        position: {
          x: (rank % 3) * 350,
          y: (bandOffsets.get(Math.floor(rank / 3)) ?? 0) + row * 340,
        },
        data: { ...n, onRead },
      };
    });
    const edges: Edge[] = flow.edges.map((e, i) => ({
      id: `call-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: e.evidence === "observed" ? "#a7b7c5" : "#ae905b",
        strokeDasharray: e.evidence === "observed" ? undefined : "5 5",
      },
      data: e,
    }));
    return { nodes, edges };
  }, [flow, onRead]);
  return (
    <div className="flex h-full min-h-80 flex-col">
      <div className="shrink-0 border-b bg-background px-5 py-3">
        <h2 className="text-sm font-medium">{flow.title}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Runtime calls · dashed connections are inferred · select a file
          reference to inspect
        </p>
        {!!flow.gaps.length && (
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              {flow.gaps.length} evidence gaps
            </summary>
            <ul className="mt-2 space-y-2">
              {flow.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.2}
          maxZoom={1.3}
          nodesDraggable
          nodesConnectable={false}
          colorMode="dark"
          onEdgeClick={(_, edge) => {
            const citations = edge.data?.citations as Citation[] | undefined;
            if (citations?.length) onRead(citations[0]);
          }}
        >
          <Background color="#33353a" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
