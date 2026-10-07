import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
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
import "./spaces.css";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Compass,
  Flag,
  RotateCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpaceRadialNode, SpaceOrbitNode } from "./space-radial-node";
import { radialLayout } from "./radial-layout";
import { SpaceChatPanel } from "@/components/spaces/space-chat-panel";
import type {
  CommitSpaceResult,
  SpaceGraph,
  SpaceMessage,
  SpaceNode,
} from "@/features/spaces/types";

const nodeTypes = { spaceNode: SpaceRadialNode, orbit: SpaceOrbitNode };

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
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>,
  ) => Promise<unknown>;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitSpaceResult | null>(
    null,
  );

  const { fitView } = useReactFlow();
  const prevCountRef = useRef(0);

  useEffect(() => {
    const layout = radialLayout(graph.nodes);
    const nodeStateMap = new Map(graph.nodes.map((n) => [n.id, n.state]));
    setNodes((current) => {
      const currMap = new Map(current.map((n) => [n.id, n]));
      const orbit: Node = {
        id: "__space_orbits",
        type: "orbit",
        position: { x: -layout.radius, y: -layout.radius },
        data: { radius: layout.radius },
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        zIndex: -1,
      };
      return [
        orbit,
        ...graph.nodes.map((node) => {
          const radial = layout.positions.get(node.id)!;
          return {
            id: node.id,
            type: "spaceNode",
            position: currMap.get(node.id)?.position ?? {
              x: radial.x,
              y: radial.y,
            },
            data: { node, central: radial.central },
            selected: currMap.get(node.id)?.selected,
          };
        }),
      ];
    });

    setEdges(
      graph.edges.map((e) => {
        const sourceState = nodeStateMap.get(e.from_node);
        const isRunning = sourceState === "running";
        return {
          id: e.id,
          source: e.from_node,
          sourceHandle: "right",
          targetHandle: "left",
          target: e.to_node,
          type: "default",
          animated: isRunning,
          style: {
            stroke:
              selectedNodeId &&
              (e.from_node === selectedNodeId || e.to_node === selectedNodeId)
                ? "#cfe3f1"
                : "#777777",
            strokeWidth: 1,
            opacity: selectedNodeId
              ? e.from_node === selectedNodeId || e.to_node === selectedNodeId
                ? 0.9
                : 0.12
              : 0.3,
          },
        };
      }),
    );
  }, [graph.nodes, graph.edges, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    if (nodes.length > 0 && nodes.length > prevCountRef.current) {
      window.requestAnimationFrame(() => {
        void fitView({ duration: 300, padding: 0.2 });
      });
    }
    prevCountRef.current = nodes.length;
  }, [nodes.length, fitView]);

  const handleNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      void onUpdateNode(node.id, { position: node.position });
    },
    [onUpdateNode],
  );

  const [chatOpen, setChatOpen] = useState(true);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "orbit") return;
    setSelectedNodeId(node.id);
    setChatOpen(true);
  }, []);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  const staleNodes = useMemo(
    () => graph.nodes.filter((n) => n.state === "stale"),
    [graph.nodes],
  );

  const isCommitted = graph.space.state === "committed";

  const committableNodes = useMemo(
    () =>
      graph.nodes.filter(
        (n) => (n.kind === "plan" || n.kind === "step") && n.state === "done",
      ),
    [graph.nodes],
  );
  const canCommit = committableNodes.length > 0 && !isCommitted;

  return (
    <div className="spaces-workbench flex h-full w-full overflow-hidden bg-background text-foreground">
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header className="z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5 backdrop-blur-md sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground p-1.5 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-foreground" />
                <h1 className="truncate text-base font-bold text-foreground">
                  {graph.space.title}
                </h1>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    isCommitted
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-ring bg-primary/10 text-foreground"
                  }`}
                >
                  {graph.space.state}
                </span>
                {graph.space.run_state === "running" && (
                  <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                    <RotateCw className="h-2.5 w-2.5 animate-spin" />
                    running
                  </span>
                )}
                {loading && (
                  <RotateCw className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChatOpen((open) => !open)}
              className="h-8 w-8 p-1.5 text-muted-foreground hover:text-foreground"
              title={chatOpen ? "Hide chat" : "Show chat"}
              aria-label={chatOpen ? "Hide chat" : "Show chat"}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {isCommitted ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted border border-border px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Committed to Timeline</span>
                <span className="sm:hidden">Committed</span>
              </div>
            ) : (
              <Button
                onClick={() => setShowCommitDialog(true)}
                disabled={committing || !canCommit}
                size="sm"
                className="bg-muted hover:bg-muted text-foreground font-medium gap-1.5 text-xs shadow-sm"
              >
                {committing ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Flag className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Commit to Timeline</span>
                <span className="sm:hidden">Commit</span>
              </Button>
            )}
          </div>
        </header>

        <div className="relative flex-1">
          {graph.nodes.length === 0 && graph.space.run_state === "running" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-ring text-foreground shadow-xl">
                <RotateCw className="h-6 w-6 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Architecting space…
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
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
            proOptions={{ hideAttribution: true }}
            fitView
            className={cn("bg-background", chatOpen && "spaces-flow-with-chat")}
          >
            <Controls className="!bg-card !border-border !text-muted-foreground" />
            <MiniMap
              className="!bg-card !border !border-border max-md:!hidden"
              nodeColor={(node) =>
                node.type === "orbit"
                  ? "transparent"
                  : node.selected
                    ? "#cfe3f1"
                    : "#777"
              }
              nodeStrokeColor={(node) =>
                node.type === "orbit" ? "transparent" : "#777"
              }
              nodeBorderRadius={8}
              pannable
              zoomable
              ariaLabel="Space overview — drag to pan, scroll to zoom"
              maskColor="rgba(0, 0, 0, 0.65)"
            />
          </ReactFlow>
        </div>
      </div>

      <div
        className={cn(
          chatOpen &&
            "spaces-chat-dock max-md:!top-auto max-md:!right-0 max-md:!bottom-0 max-md:!left-0",
          chatOpen
            ? "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex max-md:h-[78%] max-md:flex-col max-md:overflow-hidden max-md:rounded-t-2xl max-md:border-t max-md:border-border max-md:bg-card max-md:shadow-2xl"
            : "hidden",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Space chat
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChatOpen(false)}
            className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 h-full flex-1">
          <SpaceChatPanel
            space={graph.space}
            messages={messages}
            selectedNode={selectedNode}
            staleNodes={staleNodes}
            sending={sending}
            onSendMessage={onSendMessage}
            onUpdateNode={onUpdateNode}
          />
        </div>
      </div>

      <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {commitResult ? "Space Committed" : "Commit to Timeline"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {commitResult
                ? `Created ${commitResult.committed_spans_count} spans in your timeline.`
                : `This will create spans in a new collection for all completed plan and step nodes.`}
            </DialogDescription>
          </DialogHeader>

          {commitResult ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="font-semibold">Successfully committed!</span>
                  <p className="mt-1 text-muted-foreground/90">
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
                  className="bg-primary hover:bg-primary text-foreground text-xs"
                >
                  Back to Spaces
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">
                  Collection Name:{" "}
                </span>
                <span className="font-semibold text-foreground">
                  {graph.space.title}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Spans to create ({committableNodes.length}):
                </span>
                <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-card p-2.5">
                  {committableNodes.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs bg-card border border-border"
                    >
                      <span className="rounded bg-primary/15 text-foreground border border-ring px-1.5 py-0.2 font-mono text-[10px] uppercase">
                        {n.kind}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {n.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCommitDialog(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
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
                  className="bg-muted hover:bg-muted text-foreground text-xs gap-1.5"
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
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>,
  ) => Promise<unknown>;
}) {
  return (
    <ReactFlowProvider>
      <SpaceCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
