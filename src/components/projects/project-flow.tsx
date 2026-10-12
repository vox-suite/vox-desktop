import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Loader2, X, FileCode2 } from "lucide-react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  type NodeProps,
  type Node,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { Citation, ProjectFlow } from "@/features/projects/types";
import {
  layoutFlow,
  compactLabel,
  NODE_WIDTH,
  NODE_HEIGHT,
  type FlowLayout,
  type FlowPoint,
} from "./flow-layout";
import {
  FLOW_PALETTE,
  flowCategory,
  connectionColor,
  type FlowCategory,
} from "./flow-palette";
import { Button } from "@/components/ui/button";
import "@xyflow/react/dist/style.css";

type Selection = {
  id?: string;
  title: string;
  detail: string;
  citations: Citation[];
  kind: string;
  evidence?: string;
};
type FlowData = ProjectFlow["nodes"][number] & {
  onInspect: (item: Selection) => void;
};
type RouteData = {
  points: FlowPoint[];
  labelPosition?: FlowPoint;
  onInspect: () => void;
};

function FlowCard({ data, selected }: NodeProps<Node<FlowData>>) {
  const category = FLOW_PALETTE[flowCategory(data.kind)];
  const Icon = category.icon;
  return (
    <div
      className={`project-architecture-node ${selected ? "is-selected" : ""}`}
      style={{ "--node-color": category.color } as CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <div className="project-architecture-node-top">
        <Icon className="size-3" aria-label={category.label} />
        <button
          className="nodrag nopan project-evidence-badge"
          data-supported={data.citations.length > 0}
          aria-label={`Inspect ${data.title}: ${data.citations.length} source references`}
          onClick={() => data.onInspect(data)}
        >
          SRC {data.citations.length}
        </button>
      </div>
      <h3 title={data.title}>{data.title}</h3>
      <p title={data.detail}>{data.detail}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function CodeBoundary({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="project-code-boundary">
      <span title="Grouped by the folder paths in source references">
        Code folder · {data.label}
      </span>
    </div>
  );
}
function routePath(points: FlowPoint[]) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1],
      point = points[i],
      after = points[i + 1];
    const a = Math.hypot(point.x - before.x, point.y - before.y),
      b = Math.hypot(after.x - point.x, after.y - point.y);
    const r = Math.min(8, a / 2, b / 2);
    if (!a || !b) continue;
    path += ` L ${point.x - ((point.x - before.x) * r) / a} ${point.y - ((point.y - before.y) * r) / a} Q ${point.x} ${point.y} ${point.x + ((after.x - point.x) * r) / b} ${point.y + ((after.y - point.y) * r) / b}`;
  }
  const end = points.at(-1)!;
  return `${path} L ${end.x} ${end.y}`;
}
function RoutedEdge({
  id,
  data,
  markerEnd,
  style,
  label,
}: EdgeProps<Edge<RouteData>>) {
  if (!data?.points.length) return null;
  const position =
    data.labelPosition ?? data.points[Math.floor(data.points.length / 2)];
  return (
    <>
      <BaseEdge
        id={id}
        path={routePath(data.points)}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={18}
      />
      {!!label && (
        <EdgeLabelRenderer>
          <button
            className="project-route-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
            }}
            onClick={data.onInspect}
            title={String(label)}
          >
            {compactLabel(String(label))}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const nodeTypes = { flow: FlowCard, boundary: CodeBoundary };
const edgeTypes = { routed: RoutedEdge };

export function ProjectFlowCanvas({
  flow,
  onRead,
}: {
  flow: ProjectFlow;
  onRead: (citation: Citation) => void;
}) {
  const [result, setResult] = useState<{
    flow: ProjectFlow;
    layout?: FlowLayout;
    error?: string;
  } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selection) inspectorRef.current?.focus();
  }, [selection]);
  const [retry, setRetry] = useState(0);
  const inspect = useCallback((item: Selection) => setSelection(item), []);
  useEffect(() => {
    let active = true;
    void layoutFlow(flow)
      .then((layout) => {
        if (active) {
          setResult({ flow, layout });
          setSelection(null);
        }
      })
      .catch(() => {
        if (active)
          setResult({ flow, error: "Could not arrange this diagram." });
      });
    return () => {
      active = false;
    };
  }, [flow, retry]);
  const layout = result?.flow === flow ? result.layout : undefined;
  const graph = useMemo(() => {
    if (!layout) return { nodes: [], edges: [] };
    const positions = new Map(layout.nodes.map((n) => [n.id, n]));
    const nodes: Node[] = [
      ...layout.groups.map((group) => ({
        id: group.id,
        type: "boundary",
        position: { x: group.x, y: group.y },
        style: { width: group.width, height: group.height },
        data: { label: group.label },
        selectable: false,
        focusable: false,
        zIndex: -1,
      })),
      ...flow.nodes.map((node) => {
        const position = positions.get(node.id)!;
        return {
          id: node.id,
          type: "flow",
          selected: selection?.id === node.id,
          position: { x: position.x, y: position.y },
          parentId: position.parentId,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: { ...node, onInspect: inspect },
        };
      }),
    ];
    const edges: Edge<RouteData>[] = flow.edges.map((edge, i) => {
      const route = layout.routes[`call-${i}`];
      const source = flow.nodes.find((n) => n.id === edge.from)!;
      const target = flow.nodes.find((n) => n.id === edge.to)!;
      const focused =
        !!selection?.id &&
        (edge.from === selection.id || edge.to === selection.id);
      const color = connectionColor(
        edge.evidence,
        source.kind,
        target.kind,
        focused,
      );
      return {
        id: `call-${i}`,
        type: "routed",
        source: edge.from,
        target: edge.to,
        label: edge.label,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16,
        },
        style: {
          stroke: color,
          strokeWidth:
            selection?.id &&
            (edge.from === selection.id || edge.to === selection.id)
              ? 2.5
              : 1.5,
          strokeDasharray: edge.evidence === "observed" ? undefined : "5 5",
        },
        data: {
          points: route?.points ?? [],
          labelPosition: route?.label,
          onInspect: () =>
            inspect({
              title: edge.label || "Connection",
              kind: `${source.title} → ${flow.nodes.find((n) => n.id === edge.to)?.title}`,
              detail:
                edge.evidence === "observed"
                  ? "This connection is supported by the referenced call sites."
                  : "This connection is inferred. The available code does not establish a complete call path.",
              evidence: edge.evidence,
              citations: edge.citations,
            }),
        },
      };
    });
    return { nodes, edges };
  }, [flow, layout, inspect, selection]);
  const categories = useMemo(() => {
    const counts = new Map<FlowCategory, number>();
    flow.nodes.forEach((node) => {
      const kind = flowCategory(node.kind);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    });
    return [...counts];
  }, [flow]);
  return (
    <div className="project-architecture">
      <div className="project-flow-header">
        <h2>{flow.title}</h2>
        <div className="project-flow-coverage">
          <span>{flow.nodes.length} components</span>
          <span>{flow.edges.length} connections</span>
          {!!flow.gaps.length && (
            <details>
              <summary>
                {flow.gaps.length}{" "}
                {flow.gaps.length === 1 ? "open question" : "open questions"}
              </summary>
              <ul>
                {flow.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
      <div className="project-architecture-stage">
        {layout ? (
          <ReactFlow
            key={flow.title + retry + flow.nodes.map((n) => n.id).join("|")}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.16, maxZoom: 1.2 }}
            minZoom={0.15}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            colorMode="dark"
            onNodeClick={(_, node) => {
              if (node.type === "flow") inspect(node.data as FlowData);
            }}
            onEdgeClick={(_, edge) => edge.data?.onInspect()}
            onPaneClick={() => setSelection(null)}
          >
            <Background
              variant={BackgroundVariant.Lines}
              bgColor="#020617"
              color="#1e293b"
              gap={32}
              lineWidth={0.5}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="project-layout-status" role="status">
            {result?.flow === flow && result.error ? (
              <>
                <span>{result.error}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Retry layout
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" />
                Arranging the map…
              </>
            )}
          </div>
        )}
        {selection && (
          <aside
            className="project-flow-inspector"
            aria-label="Diagram details"
            tabIndex={-1}
            ref={inspectorRef}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelection(null);
            }}
          >
            <div className="project-inspector-heading">
              <span>
                {selection.evidence
                  ? selection.evidence === "observed"
                    ? "Traced connection"
                    : "Inferred connection"
                  : selection.kind}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close diagram details"
                onClick={() => setSelection(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <h3>{selection.title}</h3>
            <p>{selection.detail}</p>
            <div className="project-inspector-sources">
              <h4>Source references</h4>
              {selection.citations.length ? (
                selection.citations.map((c, i) => (
                  <button key={i} onClick={() => onRead(c)}>
                    <FileCode2 className="size-3.5" />
                    <span>
                      {c.path}
                      <small>
                        Lines {c.start_line}–{c.end_line}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <p>No source reference available.</p>
              )}
            </div>
          </aside>
        )}
      </div>
      <div className="project-flow-legend" aria-label="Component types">
        {categories.map(([kind, count]) => (
          <span key={kind}>
            <i
              style={
                { "--node-color": FLOW_PALETTE[kind].color } as CSSProperties
              }
            />
            {FLOW_PALETTE[kind].label}
            <small>{count}</small>
          </span>
        ))}
        <span className="project-flow-line-key">
          Dashed connections are inferred
        </span>
      </div>
    </div>
  );
}
