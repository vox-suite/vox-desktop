import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./spaces.css";
import { RotateCw } from "lucide-react";
import { spacesApi } from "@/features/spaces/api";
import { cn } from "@/lib/utils";
import { PageContainer, PageBody } from "@/components/ui/page-container";
import { SpaceWorkflowNode } from "./space-workflow-node";
import { dependencyLayout } from "./dependency-layout";
import { SpaceChatPanel } from "@/components/spaces/space-chat-panel";
import { SpaceCanvasHeader } from "./space-canvas-header";
import { CommitSpaceDialog } from "./commit-space-dialog";
import type {
  CommitSpaceResult,
  SpaceGraph,
  SpaceMessage,
  SpaceNode,
} from "@/features/spaces/types";

const nodeTypes = { spaceNode: SpaceWorkflowNode };
const FIT_OPTIONS = { padding: 0.15, minZoom: 0.9, maxZoom: 1.1 };

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
  onSendMessage: (msg: string, nodeId?: string) => Promise<void>;
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
  const [chatOpen, setChatOpen] = useState(true);
  const [actionError, setActionError] = useState("");

  const { fitView } = useReactFlow();
  const prevCountRef = useRef(0);

  useEffect(() => {
    const layout = dependencyLayout(graph.nodes, graph.edges);
    const nodeStateMap = new Map(graph.nodes.map((n) => [n.id, n.state]));
    setNodes((current) => {
      const currMap = new Map(current.map((n) => [n.id, n]));
      return [
        ...graph.nodes.map((node) => {
          const radial = layout.positions.get(node.id)!;
          return {
            id: node.id,
            type: "spaceNode",
            position: {
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
        const related =
          e.from_node === selectedNodeId || e.to_node === selectedNodeId;
        const color = related
          ? "#ffffff"
          : selectedNodeId
            ? "#2e2e33"
            : "#5c5c63";
        return {
          id: e.id,
          source: e.from_node,
          sourceHandle: "right",
          targetHandle: "left",
          target: e.to_node,
          type: "default",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color,
          },
          animated: isRunning,
          style: { stroke: color, strokeWidth: 1.5 },
        };
      }),
    );
  }, [graph.nodes, graph.edges, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    if (nodes.length > 0 && prevCountRef.current === 0) {
      window.requestAnimationFrame(() => {
        void fitView({ duration: 300, ...FIT_OPTIONS });
      });
    }
    prevCountRef.current = nodes.length;
  }, [nodes.length, fitView]);

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

  const canCommit =
    committableNodes.length > 0 &&
    !isCommitted &&
    graph.nodes.every((n) => n.state === "done");

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const cyclic = dependencyLayout(graph.nodes, graph.edges).cyclic.length > 0;

  return (
    <PageContainer className="spaces-workbench flex-row">
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <SpaceCanvasHeader
          graph={graph}
          loading={loading}
          committing={committing}
          canCommit={canCommit}
          selectedNode={selectedNode}
          chatOpen={chatOpen}
          onBack={onBack}
          onStop={() =>
            void runAction(() => spacesApi.stopSpace(graph.space.id))
          }
          onRetryNode={() =>
            selectedNode &&
            void runAction(() =>
              spacesApi.retryNode(graph.space.id, selectedNode.id),
            )
          }
          onToggleChat={() => setChatOpen((open) => !open)}
          onOpenCommitDialog={() => setShowCommitDialog(true)}
        />

        {(actionError || cyclic || graph.space.run_error) && (
          <div role="alert" className="px-5 py-2 text-xs text-destructive">
            {actionError ||
              graph.space.run_error ||
              "This legacy graph has a dependency cycle. Its hierarchy needs repair."}
          </div>
        )}

        <PageBody scroll={false}>
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
            onPaneClick={() => setSelectedNodeId(null)}
            nodesDraggable={false}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={FIT_OPTIONS}
            className={cn("bg-background", chatOpen && "spaces-flow-with-chat")}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#3a3a40"
            />
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
              nodeBorderRadius={0}
              pannable
              zoomable
              ariaLabel="Space overview — drag to pan, scroll to zoom"
              maskColor="rgba(0, 0, 0, 0.65)"
            />
          </ReactFlow>
        </PageBody>
      </div>

      {chatOpen && (
        <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[min(580px,calc(100%-32px))] -translate-x-1/2">
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
      )}

      <CommitSpaceDialog
        open={showCommitDialog}
        onOpenChange={setShowCommitDialog}
        graph={graph}
        committableNodes={committableNodes}
        committing={committing}
        commitResult={commitResult}
        setCommitResult={setCommitResult}
        onCommit={onCommit}
        onBack={onBack}
      />
    </PageContainer>
  );
}

export function SpaceCanvas(props: {
  graph: SpaceGraph;
  messages: SpaceMessage[];
  loading: boolean;
  sending: boolean;
  committing: boolean;
  onBack: () => void;
  onSendMessage: (msg: string, nodeId?: string) => Promise<void>;
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
