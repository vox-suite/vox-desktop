import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
  type RefObject,
} from "react";
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
  seen: RefObject<Set<string>>;
  onSelect: (
    id: string | null,
    from?: string,
    to?: string,
    label?: string,
  ) => void;
};
function Scene({ data }: NodeProps<Node<SceneData>>) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useTheme();
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
    // Theme selectors inside the shadow root cannot see the app's root attribute.
    const diagram = template.content.querySelector("svg");
    if (diagram) {
      diagram.dataset.theme = theme;
      diagram.style.colorScheme = theme;
    }
    root.append(template.content);
    // Fade in elements that were not on the previous render, so a streaming draft builds up piece by piece.
    const fresh = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    root
      .querySelectorAll("[data-node-id], [data-edge-from]")
      .forEach((element, i) => {
        const key =
          element.getAttribute("data-node-id") ??
          `${element.getAttribute("data-edge-from")}>${element.getAttribute("data-edge-to")}`;
        if (data.seen.current.has(key)) return;
        data.seen.current.add(key);
        if (fresh)
          element.animate(
            [
              { opacity: 0, transform: "translateY(4px)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 420,
              delay: Math.min(i, 8) * 40,
              easing: "ease-out",
              fill: "backwards",
            },
          );
      });
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
  }, [data, theme]);
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
  actions,
  draft = false,
}: {
  flow: ProjectFlow;
  onRead: (citation: Citation) => void;
  actions?: ReactNode;
  draft?: boolean;
}) {
  const seen = useRef(new Set<string>());
  const shown = useRef(0);
  const requested = useRef(0);
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
    const request = ++requested.current;
    void localProjects()
      .renderDiagram(flow.diagram!, draft)
      .then((rendered) => {
        // Drafts arrive faster than they render: show any newer one, never an older one.
        if (draft ? request > shown.current : active) {
          shown.current = request;
          setResult({ flow, rendered });
          setSelected(null);
        }
      })
      .catch((error) => {
        // A draft that does not validate yet keeps the last good render on screen.
        if (active && !draft) setResult({ flow, error: String(error) });
      });
    return () => {
      active = false;
    };
  }, [flow, retry, draft]);
  const rendered =
    result?.flow === flow || draft ? result?.rendered : undefined;
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
      if (edge)
        setSelected({
          title: edge.label || `${from} → ${to}`,
          detail: "",
          citations: edge.citations,
        });
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
              data: { rendered, onSelect, seen },
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
          {draft ? (
            <span className="project-thinking">Drawing…</span>
          ) : (
            <span>{flow.nodes.length} elements</span>
          )}
          {!!flow.gaps.length && (
            <details>
              <summary>{flow.gaps.length} not in sources</summary>
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
          {actions}
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
            key={
              draft && rendered
                ? `${rendered.width}x${rendered.height}`
                : flow.title + retry
            }
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
                {draft
                  ? "Laying out the first elements…"
                  : "Rendering the diagram…"}
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
            {selected.detail && <p>{selected.detail}</p>}
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
        Validated schema and composition
        <span>Choose a component or connection to inspect</span>
      </div>
    </div>
  );
}
