import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Flag,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpaceNodeCard } from "@/components/spaces/space-node-card";
import { SpaceChatPanel } from "@/components/spaces/space-chat-panel";
import type { SpaceGraph, SpaceNode } from "@/lib/spaces";

const nodeTypes = {
  spaceNode: SpaceNodeCard,
};

function layoutGraph(
  nodes: SpaceNode[],
  edges: { from_node: string; to_node: string }[]
): Node[] {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of edges) {
    outgoing.get(e.from_node)?.push(e.to_node);
    incoming.get(e.to_node)?.push(e.from_node);
  }

  const levels = new Map<string, number>();
  const roots = nodes.filter((n) => (incoming.get(n.id)?.length ?? 0) === 0);

  const queue: { id: string; level: number }[] = roots.map((r) => ({
    id: r.id,
    level: 0,
  }));
  for (const r of roots) levels.set(r.id, 0);

  while (queue.length > 0) {
    const item = queue.shift()!;
    const children = outgoing.get(item.id) ?? [];
    for (const ch of children) {
      const currentLevel = levels.get(ch) ?? 0;
      if (item.level + 1 > currentLevel) {
        levels.set(ch, item.level + 1);
        queue.push({ id: ch, level: item.level + 1 });
      }
    }
  }

  const levelGroups = new Map<number, SpaceNode[]>();
  for (const n of nodes) {
    const lvl = levels.get(n.id) ?? 0;
    const group = levelGroups.get(lvl) ?? [];
    group.push(n);
    levelGroups.set(lvl, group);
  }

  return nodes.map((node) => {
    const lvl = levels.get(node.id) ?? 0;
    const group = levelGroups.get(lvl) ?? [node];
    const indexInGroup = group.findIndex((g) => g.id === node.id);

    const x =
      node.position && (node.position.x !== 0 || node.position.y !== 0)
        ? node.position.x
        : 60 + lvl * 360;
    const y =
      node.position && (node.position.x !== 0 || node.position.y !== 0)
        ? node.position.y
        : 80 + indexInGroup * 210;

    return {
      id: node.id,
      type: "spaceNode",
      position: { x, y },
      data: {
        node,
      } as unknown as Record<string, unknown>,
    };
  });
}

export function SpaceCanvas({
  graph,
  loading,
  sending,
  committing,
  onBack,
  onSendMessage,
  onCommit,
}: {
  graph: SpaceGraph;
  loading: boolean;
  sending: boolean;
  committing: boolean;
  onBack: () => void;
  onSendMessage: (msg: string) => Promise<void>;
  onCommit: () => Promise<unknown>;
}) {
  const [selectedNode, setSelectedNode] = useState<SpaceNode | null>(null);

  const initialNodes = useMemo(() => {
    const laidOut = layoutGraph(graph.nodes, graph.edges);
    return laidOut.map((n) => ({
      ...n,
      data: {
        ...(n.data as object),
        onSelectNode: (node: SpaceNode) => setSelectedNode(node),
      },
    }));
  }, [graph.nodes, graph.edges]);

  const initialEdges = useMemo<Edge[]>(() => {
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.from_node,
      target: e.to_node,
      animated: true,
      style: {
        stroke: "#6366f1",
        strokeWidth: 2,
        opacity: 0.8,
      },
    }));
  }, [graph.edges]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const isCommitted = graph.space.state === "committed";
  const hasDecision = graph.nodes.some(
    (n) => n.kind === "decision" || n.kind === "plan"
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#090a0f] text-zinc-100">
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header className="z-10 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-zinc-400 hover:text-zinc-100 p-1.5 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-indigo-400" />
                <h1 className="text-base font-bold text-zinc-100">
                  {graph.space.title}
                </h1>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    isCommitted
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                  }`}
                >
                  {graph.space.state}
                </span>
                {loading && (
                  <RotateCw className="h-3 w-3 animate-spin text-zinc-400" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCommitted ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                <span>Committed to Timeline & Span</span>
              </div>
            ) : (
              <Button
                onClick={() => void onCommit()}
                disabled={committing || !hasDecision}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 text-xs shadow-lg shadow-emerald-950/40"
              >
                {committing ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Flag className="h-3.5 w-3.5" />
                )}
                <span>Commit to Timeline</span>
              </Button>
            )}
          </div>
        </header>

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#090a0f]"
          >
            <Background color="#1e1e24" gap={20} size={1} />
            <Controls className="!bg-zinc-900 !border-zinc-800 !text-zinc-300" />
            <MiniMap
              className="!bg-zinc-950/90 !border !border-zinc-800"
              nodeColor={() => "#6366f1"}
              maskColor="rgba(0, 0, 0, 0.7)"
            />
          </ReactFlow>
        </div>
      </div>

      <SpaceChatPanel
        space={graph.space}
        selectedNode={selectedNode}
        sending={sending}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}
