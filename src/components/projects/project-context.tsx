import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import { ArrowLeft, Folder, Search, AlertCircle, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project, ContextNode } from "@/features/projects/types";
import "@xyflow/react/dist/style.css";
import { token, useTheme } from "@/lib/theme";

type ContextCardData = {
  title: string;
  body: string;
  origin: string;
  stale: boolean;
  kind: string;
};
function ContextCard({ data, selected }: NodeProps<Node<ContextCardData>>) {
  return (
    <div className={`project-context-card ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`project-origin ${data.origin}`} />
        {data.kind}
        {data.stale && <AlertCircle className="size-3 text-warning" />}
      </div>
      <strong className="mt-2 block text-sm font-medium">{data.title}</strong>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {data.body}
      </p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { context: ContextCard };
export function ProjectContext({
  project,
  onSelect,
  onSource,
  onAddSources,
  investigating,
}: {
  project: Project;
  onSelect: (n: ContextNode) => void;
  onSource: (id: string, path?: string) => void;
  onAddSources: () => void;
  investigating: boolean;
}) {
  const theme = useTheme();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const graph = useMemo(() => {
    const nodes: Node<ContextCardData>[] = [];
    const edges: Edge[] = [];
    const rootId = "project-root";
    nodes.push({
      id: rootId,
      type: "context",
      position: { x: 270, y: 0 },
      data: {
        title: sourceId
          ? (project.data.sources.find((s) => s.id === sourceId)?.label ??
            project.name)
          : project.name,
        body: sourceId
          ? "Components extracted from this source"
          : "Long-lived context for every iteration",
        kind: sourceId ? "Source" : "Project",
        origin: "user",
        stale: false,
      },
    });
    const sources = sourceId
      ? []
      : project.data.sources.filter((s) =>
          s.label.toLowerCase().includes(search.toLowerCase()),
        );
    const context = project.data.nodes
      .filter((n) =>
        sourceId
          ? n.citations.some((c) => c.source_id === sourceId)
          : n.origin !== "extracted",
      )
      .filter((n) =>
        `${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase()),
      );
    const entries = [
      ...sources.map((s) => ({
        id: `source-${s.id}`,
        data: {
          title: s.label,
          body: `${s.files} files · ${s.symbols} symbols`,
          kind: "Source",
          origin: "extracted",
          stale: project.data.nodes.some(
            (n) => n.stale && n.citations.some((c) => c.source_id === s.id),
          ),
        },
      })),
      ...context.map((n) => ({
        id: n.id,
        data: {
          title: n.title,
          body: n.body,
          kind: n.kind,
          origin: n.origin,
          stale: n.stale,
        },
      })),
    ];
    for (const [i, n] of entries.entries()) {
      nodes.push({
        ...n,
        type: "context",
        position: { x: (i % 3) * 270, y: 190 + Math.floor(i / 3) * 190 },
      });
      edges.push({
        id: `contains-${n.id}`,
        source: rootId,
        target: n.id,
        type: "smoothstep",
        style: { stroke: token("border-strong"), strokeWidth: 1 },
        label: sourceId ? "contains" : "context",
      });
    }
    if (!sourceId) {
      const meaningful = context.filter(
        (n) =>
          !(
            n.kind === "question" &&
            n.origin === "inferred" &&
            !n.citations.length &&
            n.body ===
              `What should we establish about ${n.title.toLowerCase()} for this project?`
          ),
      );
      const ids = new Set(meaningful.map((n) => n.id));
      if (!ids.size) return { nodes: [], edges: [] };
      return {
        nodes: nodes.filter((n) => n.id === rootId || ids.has(n.id)),
        edges: edges.filter((e) => ids.has(e.target)),
      };
    }
    return { nodes, edges };
  }, [project, sourceId, search]);
  if (!graph.nodes.length && !search)
    return (
      <div className="project-empty-canvas">
        <div className="project-empty-content">
          <div className="project-empty-mark">
            <Workflow className="size-6" />
          </div>
          <h2>
            {investigating
              ? "Following the code…"
              : project.data.sources.length
                ? "What would you like to understand?"
                : "Start with your project."}
          </h2>
          <p>
            {investigating
              ? "Vox is checking files and call sites. Your diagram will appear here."
              : project.data.sources.length
                ? "Ask a question below. Vox will trace the code and draw the connections."
                : "Add a folder or file, then ask Vox to map how it works."}
          </p>
          {project.data.sources.length ? (
            <button className="project-ready-source" onClick={onAddSources}>
              <Folder className="size-3.5" />
              {project.data.sources
                .map((s) => s.label)
                .slice(0, 2)
                .join(", ")}
              <span className="project-status-dot" />
              Sources added
            </button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onAddSources}>
              <Folder className="size-3.5" />
              Add sources
            </Button>
          )}
        </div>
      </div>
    );
  return (
    <div className="relative h-full min-h-72">
      <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2">
        {sourceId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSourceId(null)}
          >
            <ArrowLeft className="size-3.5" />
            Project
          </Button>
        )}
        <div className="relative w-56">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find context"
            aria-label="Find context"
            className="h-9 bg-background pl-9"
          />
        </div>
        {sourceId && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSource(sourceId)}
          >
            <Folder className="size-3.5" />
            Inspect code
          </Button>
        )}
      </div>
      <ReactFlow
        proOptions={{ hideAttribution: true }}
        key={sourceId ?? "root"}
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.35}
        maxZoom={1.2}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, n) => {
          if (n.id.startsWith("source-")) {
            setSourceId(n.id.slice(7));
            setSearch("");
            return;
          }
          const context = project.data.nodes.find((c) => c.id === n.id);
          if (context) onSelect(context);
        }}
        colorMode={theme}
      >
        <Background bgColor={token("surface-raised")} color={token("border-strong")} gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {!graph.nodes.length && search && (
        <p className="pointer-events-none absolute inset-x-6 top-1/2 text-center text-sm text-muted-foreground">
          No context matches “{search}”.
        </p>
      )}
      <div className="absolute bottom-3 left-4 flex gap-3 text-[11px] text-muted-foreground pointer-events-none">
        <span>● Extracted structure</span>
        <span>◇ Inferred claims</span>
        <span>○ Your decisions</span>
      </div>
    </div>
  );
}
