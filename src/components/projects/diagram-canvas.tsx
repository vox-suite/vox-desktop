import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { ReactFlow, Controls, type NodeProps, type Node } from "@xyflow/react";
import { Download, Loader2, X, FileCode2 } from "lucide-react";
import type {
  Citation,
  ProjectFlow,
  RenderedDiagram,
} from "@/features/projects/types";
import { localProjects } from "@/features/projects/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "@xyflow/react/dist/style.css";
import { useTheme } from "@/lib/theme";

type SceneData = {
  rendered: RenderedDiagram;
  onSelect: (
    id: string | null,
    from?: string,
    to?: string,
    label?: string,
  ) => void;
};
function Scene({ data }: NodeProps<Node<SceneData>>) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    const svg = DOMPurify.sanitize(data.rendered.svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "foreignObject", "image", "a"],
      FORBID_ATTR: ["href", "xlink:href"],
    });
    const style = document.createElement("style");
    style.textContent =
      data.rendered.css +
      ":host{--canvas:var(--vox-surface-raised);--panel:var(--vox-surface-raised);--mask:var(--vox-surface-raised);background:var(--vox-surface-raised);display:block}svg{display:block;width:100%;height:100%;font-family:'Geist Mono',monospace}svg [data-node-id]{cursor:pointer}svg [data-node-id]:focus{outline:2px solid var(--vox-cyan);outline-offset:3px}svg [data-edge-from]{cursor:pointer}svg [data-edge-from]:focus{outline:1px solid var(--vox-mint)}";
    root.replaceChildren(style);
    const template = document.createElement("template");
    template.innerHTML = svg;
    root.append(template.content);
    const select = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const node = event.target.closest("[data-node-id]");
      if (node) {
        data.onSelect(node.getAttribute("data-node-id"));
        return;
      }
      const edge = event.target.closest("[data-edge-from][data-edge-to]");
      if (edge)
        data.onSelect(
          null,
          edge.getAttribute("data-edge-from") ?? undefined,
          edge.getAttribute("data-edge-to") ?? undefined,
          edge.getAttribute("data-edge-label") ?? undefined,
        );
    };
    const keyboard = (event: Event) => {
      const key = event as KeyboardEvent;
      if (key.key === "Enter" || key.key === " ") {
        key.preventDefault();
        select(event);
      }
    };
    root.addEventListener("click", select);
    root.addEventListener("keydown", keyboard);
    return () => {
      root.removeEventListener("click", select);
      root.removeEventListener("keydown", keyboard);
    };
  }, [data]);
  return (
    <div
      ref={host}
      className="nodrag project-diagram-scene"
      style={{ width: data.rendered.width, height: data.rendered.height }}
    />
  );
}
const nodeTypes = { scene: Scene };
const labels = {
  architecture: "Architecture",
  workflow: "Workflow",
  sequence: "Sequence",
  dataflow: "Data flow",
  lifecycle: "Lifecycle",
};
export function DiagramCanvas({
  flow,
  onRead,
}: {
  flow: ProjectFlow;
  onRead: (citation: Citation) => void;
}) {
  const theme = useTheme();
  const [result, setResult] = useState<{
    flow: ProjectFlow;
    rendered?: RenderedDiagram;
    error?: string;
  } | null>(null);
  const [selected, setSelected] = useState<{
    title: string;
    detail: string;
    citations: Citation[];
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const inspector = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) inspector.current?.focus();
  }, [selected]);
  useEffect(() => {
    let active = true;
    void localProjects()
      .renderDiagram(flow.diagram!)
      .then((rendered) => {
        if (active) {
          setResult({ flow, rendered });
          setSelected(null);
        }
      })
      .catch((error) => {
        if (active) setResult({ flow, error: String(error) });
      });
    return () => {
      active = false;
    };
  }, [flow, retry]);
  const rendered = result?.flow === flow ? result.rendered : undefined;
  const onSelect = useCallback(
    (id: string | null, from?: string, to?: string, label?: string) => {
      if (id) {
        const node = flow.nodes.find((n) => n.id === id);
        if (node) setSelected(node);
        return;
      }
      const edge = flow.edges.find(
        (e) => e.from === from && e.to === to && (!label || e.label === label),
      );
      setSelected(
        edge
          ? {
              title: edge.label || `${from} → ${to}`,
              detail:
                edge.evidence === "observed"
                  ? "Traced in the referenced implementation."
                  : "Inferred connection. The complete path is not established by code evidence.",
              citations: edge.citations,
            }
          : {
              title: `${from} → ${to}`,
              detail:
                "This visual ordering has no independently cited relationship.",
              citations: [],
            },
      );
    },
    [flow],
  );
  const sceneNodes = useMemo(
    () =>
      rendered
        ? [
            {
              id: "scene",
              type: "scene",
              style: { pointerEvents: "all" as const },
              position: { x: 0, y: 0 },
              width: rendered.width,
              height: rendered.height,
              data: { rendered, onSelect },
              selectable: false,
              focusable: false,
            },
          ]
        : [],
    [rendered, onSelect],
  );
  const exportFile = async (format: "html" | "svg" | "json") => {
    setExporting(true);
    setExportError("");
    try {
      await localProjects().exportDiagram(flow, format);
    } catch (error) {
      setExportError(String(error));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="project-architecture">
      <div className="project-flow-header">
        <div>
          <h2>{flow.title}</h2>
          <span className="project-diagram-kind">
            {labels[flow.diagram!.diagram_type]}
          </span>
        </div>
        <div className="project-flow-coverage">
          <span>{flow.nodes.length} elements</span>
          {!!flow.gaps.length && (
            <details>
              <summary>{flow.gaps.length} open questions</summary>
              <ul>
                {flow.gaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </details>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Export diagram"
                disabled={exporting}
              >
                <Download className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["html", "svg", "json"] as const).map((format) => (
                <DropdownMenuItem
                  key={format}
                  onSelect={() => void exportFile(format)}
                >
                  {format === "html"
                    ? "Interactive HTML"
                    : format === "svg"
                      ? "SVG image"
                      : "JSON with source evidence"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {exportError && (
        <p role="alert" className="px-5 py-2 text-xs text-destructive">
          {exportError}
        </p>
      )}
      <div className="project-architecture-stage">
        {rendered ? (
          <ReactFlow
            key={flow.title + retry}
            nodes={sceneNodes}
            nodeTypes={nodeTypes}
            edges={[]}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1.3 }}
            minZoom={0.1}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
            colorMode={theme}
            onPaneClick={() => setSelected(null)}
          >
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="project-layout-status" role="status">
            {result?.flow === flow && result.error ? (
              <>
                <span>{result.error}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" />
                Rendering the diagram…
              </>
            )}
          </div>
        )}
        {selected && (
          <aside
            ref={inspector}
            tabIndex={-1}
            className="project-flow-inspector"
            aria-label="Diagram details"
            onKeyDown={(event) => {
              if (event.key === "Escape") setSelected(null);
            }}
          >
            <div className="project-inspector-heading">
              <span>Source evidence</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close diagram details"
                onClick={() => setSelected(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <h3>{selected.title}</h3>
            <p>{selected.detail}</p>
            <div className="project-inspector-sources">
              <h4>Source references</h4>
              {selected.citations.length ? (
                selected.citations.map((citation, i) => (
                  <button key={i} onClick={() => onRead(citation)}>
                    <FileCode2 className="size-3.5" />
                    <span>
                      {citation.path}
                      <small>
                        Lines {citation.start_line}–{citation.end_line}
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
      <div className="project-diagram-receipt">
        Validated schema and composition · Source references attached
        <span>Choose a component or connection to inspect</span>
      </div>
    </div>
  );
}
