import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpaceNodeCard } from "@/components/spaces/space-node-card";
import { SpaceChatPanel } from "@/components/spaces/space-chat-panel";
import type {
  CommitSpaceResult,
  SpaceGraph,
  SpaceMessage,
  SpaceNode,
} from "@/lib/spaces";

const nodeTypes = {
  spaceNode: SpaceNodeCard,
};

function layoutGraph(
  nodes: SpaceNode[],
  edges: { from_node: string; to_node: string }[]
): { id: string; position: { x: number; y: number } }[] {
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
      position: { x, y },
    };
  });
}

function SpaceCanvasInner({
  graph,
  messages,
  loading,
  sending,
  committing,
  onBack,
  onSendMessage,
  onCommit,
  onUpdateNode,
}: {
  graph: SpaceGraph;
  messages: SpaceMessage[];
  loading: boolean;
  sending: boolean;
  committing: boolean;
  onBack: () => void;
  onSendMessage: (msg: string) => Promise<void>;
  onCommit: () => Promise<unknown>;
  onUpdateNode: (
    nodeId: string,
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>
  ) => Promise<unknown>;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitSpaceResult | null>(
    null
  );

  const { fitView } = useReactFlow();
  const prevCountRef = useRef(0);

  useEffect(() => {
    const bfs = layoutGraph(graph.nodes, graph.edges);
    const bfsMap = new Map(bfs.map((b) => [b.id, b.position]));
    const nodeStateMap = new Map(graph.nodes.map((n) => [n.id, n.state]));

    setNodes((current) => {
      const currMap = new Map(current.map((c) => [c.id, c.position]));
      return graph.nodes.map((node) => {
        let position = currMap.get(node.id);
        if (!position) {
          if (
            node.position &&
            (node.position.x !== 0 || node.position.y !== 0)
          ) {
            position = node.position;
          } else {
            position = bfsMap.get(node.id) ?? { x: 60, y: 80 };
          }
        }
        return {
          id: node.id,
          type: "spaceNode",
          position,
          data: { node } as unknown as Record<string, unknown>,
        };
      });
    });

    setEdges(
      graph.edges.map((e) => {
        const sourceState = nodeStateMap.get(e.from_node);
        const isRunning = sourceState === "running";
        return {
          id: e.id,
          source: e.from_node,
          target: e.to_node,
          animated: isRunning,
          style: {
            stroke: isRunning ? "#818cf8" : "#6366f1",
            strokeWidth: 2,
            opacity: 0.8,
          },
        };
      })
    );
  }, [graph.nodes, graph.edges, setNodes, setEdges]);

  useEffect(() => {
    if (nodes.length > 0 && nodes.length > prevCountRef.current) {
      window.requestAnimationFrame(() => {
        void fitView({ duration: 300, padding: 0.2 });
      });
    }
    prevCountRef.current = nodes.length;
  }, [nodes.length, fitView]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      void onUpdateNode(node.id, { position: node.position });
    },
    [onUpdateNode]
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );

  const staleNodes = useMemo(
    () => graph.nodes.filter((n) => n.state === "stale"),
    [graph.nodes]
  );

  const isCommitted = graph.space.state === "committed";

  const committableNodes = useMemo(
    () =>
      graph.nodes.filter(
        (n) => (n.kind === "plan" || n.kind === "step") && n.state === "done"
      ),
    [graph.nodes]
  );
  const canCommit = committableNodes.length > 0 && !isCommitted;

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
                {graph.space.run_state === "running" && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                    <RotateCw className="h-2.5 w-2.5 animate-spin" />
                    running
                  </span>
                )}
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
                <span>Committed to Timeline</span>
              </div>
            ) : (
              <Button
                onClick={() => setShowCommitDialog(true)}
                disabled={committing || !canCommit}
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
          {graph.nodes.length === 0 && graph.space.run_state === "running" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-xl shadow-indigo-950/50">
                <RotateCw className="h-6 w-6 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Architecting space…
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Researching options and synthesizing your plan
                </p>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
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
        messages={messages}
        selectedNode={selectedNode}
        staleNodes={staleNodes}
        sending={sending}
        onSendMessage={onSendMessage}
        onUpdateNode={onUpdateNode}
      />

      <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-100">
              {commitResult ? "Space Committed" : "Commit to Timeline"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {commitResult
                ? `Created ${commitResult.committed_spans_count} spans in your timeline.`
                : `This will create spans in a new collection for all completed plan and step nodes.`}
            </DialogDescription>
          </DialogHeader>

          {commitResult ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>
                  <span className="font-semibold">Successfully committed!</span>
                  <p className="mt-1 text-emerald-400/90">
                    {commitResult.committed_spans_count} spans created under
                    collection{" "}
                    <span className="font-medium underline">
                      "{graph.space.title}"
                    </span>
                    .
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowCommitDialog(false);
                    onBack();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  Back to Spaces
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="text-xs">
                <span className="font-medium text-zinc-400">Collection Name: </span>
                <span className="font-semibold text-zinc-100">
                  {graph.space.title}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-zinc-400 mb-1.5 block">
                  Spans to create ({committableNodes.length}):
                </span>
                <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
                  {committableNodes.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs bg-zinc-900 border border-zinc-800/80"
                    >
                      <span className="rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 font-mono text-[10px] uppercase">
                        {n.kind}
                      </span>
                      <span className="text-zinc-200 truncate">{n.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCommitDialog(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-100"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await onCommit();
                    if (res) {
                      setCommitResult(res as CommitSpaceResult);
                    }
                  }}
                  disabled={committing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                >
                  {committing ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Flag className="h-3.5 w-3.5" />
                  )}
                  <span>Confirm & Commit</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SpaceCanvas(props: {
  graph: SpaceGraph;
  messages: SpaceMessage[];
  loading: boolean;
  sending: boolean;
  committing: boolean;
  onBack: () => void;
  onSendMessage: (msg: string) => Promise<void>;
  onCommit: () => Promise<unknown>;
  onUpdateNode: (
    nodeId: string,
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>
  ) => Promise<unknown>;
}) {
  return (
    <ReactFlowProvider>
      <SpaceCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
