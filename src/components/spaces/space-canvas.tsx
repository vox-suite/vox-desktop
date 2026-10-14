import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
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
import { spacesApi } from "@/features/spaces/api";
import { cn } from "@/lib/utils";
import { PageContainer, PageBody } from "@/components/ui/page-container";
import { SpaceWorkflowNode } from "./space-workflow-node";
import { SpaceShader } from "./space-shader";
import { FlowEdge } from "./space-edge";
import { nodeAccent } from "./node-accent";
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
import { alpha, token, type VoxColor } from "@/lib/theme";

const nodeTypes = { spaceNode: SpaceWorkflowNode };
const edgeTypes = { flow: FlowEdge };
const STATE_ACCENT: Record<string, VoxColor> = {
  ideating: "teal",
  planned: "pink",
  committed: "mint",
};
const FIT_OPTIONS = { padding: 0.15, minZoom: 1, maxZoom: 1 };

function SpaceCanvasInner({
  graph: fullGraph,
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
  const graph = useMemo(() => {
    const current = fullGraph.nodes.filter((n) => n.is_current);
    const ids = new Set(current.map((n) => n.id));
    return {
      ...fullGraph,
      nodes: current,
      edges: fullGraph.edges.filter(
        (e) => ids.has(e.from_node) && ids.has(e.to_node),
      ),
    };
  }, [fullGraph]);
  const history = useMemo(() => {
    const byId = new Map(fullGraph.nodes.map((n) => [n.id, n]));
    return (node: SpaceNode | null) => {
      const out: SpaceNode[] = [];
      for (
        let at = node?.replaces ? byId.get(node.replaces) : undefined;
        at && out.length < 20;
        at = at.replaces ? byId.get(at.replaces) : undefined
      )
        out.push(at);
      return out;
    };
  }, [fullGraph.nodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectedNodeId = useDesktopContext().selectedItemId;
  const setSelectedNodeId = (selectedItemId: string | null) =>
    desktopStore.patch({ selectedItemId });
  useEffect(() => {
    desktopStore.patch({
      resourceDetails: {
        space: {
          id: graph.space.id,
          title: graph.space.title,
          state: graph.space.state,
        },
        nodes: graph.nodes.slice(0, 40).map((node) => ({
          id: node.id,
          title: node.title,
          kind: node.kind,
          version: node.version,
        })),
      },
    });
    return () => desktopStore.patch({ resourceDetails: undefined });
  }, [graph]);
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
              x: Math.round(
                Number.isFinite(node.position?.x) &&
                  (node.position.x !== 0 || node.position.y !== 0)
                  ? node.position.x
                  : radial.x,
              ),
              y: Math.round(
                Number.isFinite(node.position?.y) &&
                  (node.position.x !== 0 || node.position.y !== 0)
                  ? node.position.y
                  : radial.y,
              ),
            },
            data: {
              node,
              central: radial.central,
              versions: history(node).length,
            },
            selected: currMap.get(node.id)?.selected,
          };
        }),
      ];
    });

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    setEdges(
      graph.edges.map((e) => {
        const source = byId.get(e.from_node);
        const target = byId.get(e.to_node);
        const related =
          e.from_node === selectedNodeId || e.to_node === selectedNodeId;
        return {
          id: e.id,
          source: e.from_node,
          sourceHandle: "right",
          targetHandle: "left",
          target: e.to_node,
          type: "flow",
          data: {
            from: source ? nodeAccent(source) : token("slate"),
            to: target ? nodeAccent(target) : token("slate"),
            flowing:
              nodeStateMap.get(e.from_node) === "running" ||
              nodeStateMap.get(e.to_node) === "running",
            active: related,
            dim: !!selectedNodeId && !related,
          },
        };
      }),
    );
  }, [graph.nodes, graph.edges, selectedNodeId, setNodes, setEdges, history]);

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
        (n) =>
          (n.kind === "step" ||
            (n.kind === "plan" &&
              (n.is_final || !graph.nodes.some((f) => f.is_final)))) &&
          n.state === "done",
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
  const workNodes = graph.nodes.filter((n) => n.kind !== "goal");
  const progress = {
    done: workNodes.filter((n) => n.state === "done").length,
    total: workNodes.length,
  };
  const running = graph.space.run_state === "running";
  const shaderAccent = running
    ? "gold"
    : (STATE_ACCENT[graph.space.state] ?? "sky");

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
          progress={progress}
        />

        {(actionError || cyclic || graph.space.run_error) && (
          <div role="alert" className="px-5 py-2 text-xs text-destructive">
            {actionError ||
              graph.space.run_error ||
              "This legacy graph has a dependency cycle. Its hierarchy needs repair."}
          </div>
        )}

        <PageBody scroll={false}>
          <SpaceShader accent={shaderAccent} energy={running ? 1 : 0.15} />
          {graph.nodes.length === 0 && running && (
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-5">
              <div className="space-orb" />
              <div className="text-center">
                <h3 className="text-sm font-medium tracking-tight text-foreground/90">
                  Architecting your space…
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
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
            edgeTypes={edgeTypes}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={FIT_OPTIONS}
            className={cn(
              "bg-transparent",
              chatOpen && "spaces-flow-with-chat",
            )}
          >
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              className="max-md:!hidden"
              position="bottom-right"
              nodeColor={(node) => {
                const spaceNode = (node.data as { node?: SpaceNode })?.node;
                return spaceNode ? nodeAccent(spaceNode) : token("slate");
              }}
              nodeStrokeColor="transparent"
              nodeBorderRadius={6}
              pannable
              zoomable
              ariaLabel="Plan overview — drag to pan, scroll to zoom"
              maskColor={alpha("shade", 55)}
            />
          </ReactFlow>
          <div className="space-vignette" />
        </PageBody>
      </div>

      {chatOpen && (
        <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[min(580px,calc(100%-32px))] -translate-x-1/2">
          <SpaceChatPanel
            space={graph.space}
            messages={messages}
            selectedNode={selectedNode}
            staleNodes={staleNodes}
            history={history(selectedNode)}
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
