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
import {
  ReactFlow,
  Controls,
  useNodesInitialized,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { ArrowLeft, Download, Loader2, FileCode2, X } from "lucide-react";
import type {
  Citation,
  ProjectFlow,
  RenderedDiagram,
} from "@/features/projects/types";
import { latestRenderer } from "@/features/projects/render-queue";
import { diagramKinds } from "@/features/projects/diagrams";
import { localProjects } from "@/features/projects/api";
import { GenerationAtmosphere } from "./generation-atmosphere";
import { CanvasAgentActivity } from "./canvas-agent-activity";
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
  focused: string | null;
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
  const selectRef = useRef(data.onSelect);
  useEffect(() => {
    selectRef.current = data.onSelect;
  }, [data.onSelect]);
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
      ":host{--canvas:var(--vox-surface-raised);--panel:var(--vox-surface-raised);--mask:var(--vox-surface-raised);background:transparent;display:block}svg{background:transparent!important;display:block;width:100%;height:100%;font-family:'Geist Mono',monospace}svg [data-node-id]{cursor:pointer}svg [data-node-id]:focus{outline:2px solid var(--vox-cyan);outline-offset:3px}svg [data-edge-from]{cursor:pointer}svg [data-edge-from]:focus{outline:1px solid var(--vox-mint)}";
    root.replaceChildren(style);
    const template = document.createElement("template");
    template.innerHTML = svg;
    // The pinned legend owns the key; remove the embedded copy rather than
    // relying on renderer CSS, which can override display rules.
    template.content
      .querySelectorAll("[data-legend]")
      .forEach((legend) => legend.remove());
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
        selectRef.current(node.getAttribute("data-node-id"));
        return;
      }
      const edge = event.target.closest("[data-edge-from][data-edge-to]");
      if (edge)
        selectRef.current(
          null,
          edge.getAttribute("data-edge-from") ?? undefined,
          edge.getAttribute("data-edge-to") ?? undefined,
          edge.getAttribute("data-edge-label") ?? undefined,
        );
      else selectRef.current(null);
    };
    const keyboard = (event: Event) => {
      const key = event as KeyboardEvent;
      if (key.key === "Escape") {
        key.preventDefault();
        selectRef.current(null);
      }
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
  }, [data.rendered, data.seen, theme]);
  useEffect(() => {
    const root = host.current?.shadowRoot;
    if (!root) return;
    root
      .querySelectorAll<SVGElement>("[data-node-id], [data-edge-from]")
      .forEach((element) => {
        const relevant =
          !data.focused ||
          element.getAttribute("data-node-id") === data.focused ||
          element.getAttribute("data-edge-from") === data.focused ||
          element.getAttribute("data-edge-to") === data.focused;
        element.style.opacity = relevant ? "1" : "0.18";
        element.dataset.highlighted =
          data.focused && relevant ? "true" : "false";
      });
  }, [data.focused, data.rendered]);
  return (
    <div
      ref={host}
      className="nodrag project-diagram-scene"
      style={{ width: data.rendered.width, height: data.rendered.height }}
    />
  );
}
// Keep the renderer's own legend and colors, outside the pan/zoom viewport.
function PinnedLegend({ rendered }: { rendered: RenderedDiagram }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    root.replaceChildren();
    element.hidden = true;
    const template = document.createElement("template");
    template.innerHTML = DOMPurify.sanitize(rendered.svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["script", "foreignObject", "image", "a"],
      FORBID_ATTR: ["href", "xlink:href"],
    });
    const legend = template.content.querySelector<SVGGElement>("[data-legend]");
    if (!legend) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.dataset.theme = theme;
    svg.style.colorScheme = theme;
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Diagram legend");
    template.content
      .querySelectorAll("defs")
      .forEach((defs) => svg.append(defs.cloneNode(true)));
    svg.append(legend);
    const style = document.createElement("style");
    style.textContent =
      rendered.css +
      ":host{--canvas:var(--vox-surface-raised);--panel:var(--vox-surface-raised);--mask:var(--vox-surface-raised)}svg{display:block;width:100%;height:auto;font-family:'Geist Mono',monospace}";
    root.append(style, svg);
    element.hidden = false;
    const bounds = legend.getBBox();
    svg.setAttribute(
      "viewBox",
      `${bounds.x - 4} ${bounds.y - 4} ${bounds.width + 8} ${bounds.height + 8}`,
    );
    svg.setAttribute("width", String(bounds.width + 8));
    svg.setAttribute("height", String(bounds.height + 8));
    element.style.width = `${bounds.width + 8}px`;
  }, [rendered, theme]);
  return <div ref={host} className="project-pinned-legend" />;
}
const nodeTypes = { scene: Scene };
function FitScene({ width, height }: { width: number; height: number }) {
  const ready = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (ready)
      void fitView({
        padding: 0.12,
        maxZoom: 1.3,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 180,
      });
  }, [ready, width, height, fitView]);
  return null;
}
export function DiagramCanvas({
  flow,
  onRead,
  actions,
  draft = false,
  onBack,
  backDisabled = false,
  generating = "",
  response = "",
  activity = [],
}: {
  flow: ProjectFlow;
  onRead: (citation: Citation) => void;
  actions?: ReactNode;
  draft?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
  generating?: string;
  response?: string;
  activity?: string[];
}) {
  const seen = useRef(new Set<string>());

  const theme = useTheme();
  const [result, setResult] = useState<{
    flow: ProjectFlow;
    rendered?: RenderedDiagram;
    error?: string;
    draft?: boolean;
  } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    title: string;
    detail: string;
    citations: Citation[];
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const inspector = useRef<HTMLDetailsElement>(null);
  type RenderInput = { flow: ProjectFlow; draft: boolean };
  const renderer = useRef<ReturnType<
    typeof latestRenderer<RenderInput, RenderedDiagram>
  > | null>(null);
  useEffect(() => {
    const queue = latestRenderer<RenderInput, RenderedDiagram>(
      ({ flow, draft }) => localProjects().renderDiagram(flow.diagram!, draft),
      ({ flow, draft }, rendered) => {
        const count = (rendered.svg.match(/data-node-id=/g) ?? []).length;
        if (draft && count === 0) return;
        setResult((previous) => {
          const previousCount = (
            previous?.rendered?.svg.match(/data-node-id=/g) ?? []
          ).length;
          if (draft && previous?.draft && count < previousCount)
            return previous;
          return { flow, rendered, draft };
        });
        setSelected(null);
        setFocused(null);
      },
      ({ flow, draft }, error) => {
        if (!draft)
          setResult((previous) => ({
            ...(previous ?? { flow }),
            error: String(error),
          }));
      },
    );
    renderer.current = queue;
    return () => queue.dispose();
  }, []);
  useEffect(() => {
    if (flow.diagram) renderer.current?.push({ flow, draft });
  }, [flow, retry, draft]);
  const rendered = result?.rendered;
  const empty = !rendered?.svg.includes("data-node-id=");
  const displayedFlow = result?.rendered ? result.flow : flow;
  const onSelect = useCallback(
    (id: string | null, from?: string, to?: string, label?: string) => {
      if ((!id && !from && !to) || (id && focused === id)) {
        setFocused(null);
        setSelected(null);
        return;
      }
      setFocused(id);
      setSelected(null);
      if (inspector.current) inspector.current.open = false;
      if (id) {
        const node = displayedFlow.nodes.find((n) => n.id === id);
        if (node) setSelected(node);
        return;
      }
      const edge = displayedFlow.edges.find(
        (e) => e.from === from && e.to === to && (!label || e.label === label),
      );
      if (edge)
        setSelected({
          title: edge.label || `${from} → ${to}`,
          detail: "",
          citations: edge.citations,
        });
    },
    [displayedFlow, focused],
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
              data: { rendered, onSelect, seen, focused },
              selectable: false,
              focusable: false,
            },
          ]
        : [],
    [rendered, onSelect, focused],
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
    <div
      className="project-architecture"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setSelected(null);
          setFocused(null);
        }
      }}
    >
      <div className="project-flow-header">
        <div className="project-diagram-heading">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              disabled={backDisabled}
            >
              <ArrowLeft className="size-3.5" /> Diagrams
            </Button>
          )}
          <div>
            <h2>{flow.title || "New diagram"}</h2>
            <span className="project-diagram-kind">
              {flow.diagram
                ? diagramKinds[flow.diagram.diagram_type]
                : "Canvas"}
            </span>
          </div>
        </div>
        <div className="project-flow-coverage">
          {!generating && <span>{flow.nodes.length} elements</span>}
          {(focused || selected) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(null);
                setFocused(null);
              }}
            >
              <X className="size-3" /> Clear focus
            </Button>
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
                disabled={exporting || !!generating || !flow.diagram}
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
      <div className="project-architecture-stage" aria-busy={!!generating}>
        <GenerationAtmosphere active={!!generating} empty={empty} />
        <CanvasAgentActivity
          status={generating}
          response={response}
          activity={activity}
          centered={empty}
        />
        {rendered ? (
          <ReactFlow
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
            onPaneClick={() => {
              setSelected(null);
              setFocused(null);
            }}
          >
            <FitScene width={rendered.width} height={rendered.height} />
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
                {!generating && (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Rendering the
                    diagram…
                  </>
                )}
              </>
            )}
          </div>
        )}
        {rendered && <PinnedLegend rendered={rendered} />}
      </div>
      {selected && (
        <details
          ref={inspector}
          className="project-flow-inspector"
          aria-label="Diagram details"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSelected(null);
              setFocused(null);
            }
          }}
        >
          <summary>
            {selected.title}
            <span>Details & source evidence</span>
          </summary>
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
        </details>
      )}
      {result?.error && rendered && (
        <div
          role="alert"
          className="flex items-center justify-between px-4 py-2 text-xs text-destructive"
        >
          Could not render the updated diagram.
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry rendering
          </Button>
        </div>
      )}
    </div>
  );
}
