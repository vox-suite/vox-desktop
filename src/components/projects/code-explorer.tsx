import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import { Folder, FileText, ArrowLeft, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { localProjects } from "@/features/projects/api";
import type {
  Citation,
  GraphPage,
  LocalSource,
} from "@/features/projects/types";
import { token, useTheme } from "@/lib/theme";
export function CodeExplorer({
  projectId,
  sourceId,
  label,
  onClose,
  onRead,
}: {
  projectId: string;
  sourceId: string;
  label: string;
  onClose: () => void;
  onRead: (c: Citation) => void;
}) {
  const theme = useTheme();
  const [path, setPath] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<GraphPage | null>(null);
  const [local, setLocal] = useState<LocalSource | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"symbols" | "relationships">("symbols");
  useEffect(() => {
    let active = true;
    void localProjects()
      .sources(projectId)
      .then((s) => {
        if (active) setLocal(s.find((s) => s.id === sourceId) ?? null);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [projectId, sourceId]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      void localProjects()
        .graph(projectId, sourceId, path, search, offset)
        .then((p) => {
          if (active) setPage(p);
        })
        .catch((e) => {
          if (active) setError(String(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectId, sourceId, path, search, offset]);
  const nodes: Node[] = (page?.symbols.slice(0, 24) ?? []).map((s, i) => ({
    id: String(s.id),
    position: { x: (i % 3) * 250, y: Math.floor(i / 3) * 120 },
    data: {
      label: (
        <div className="text-left">
          <strong className="block truncate">{s.name}</strong>
          <span className="mt-1 block truncate text-[10px] text-muted-foreground">
            {s.kind} · {s.citation.path}:{s.citation.start_line}
          </span>
        </div>
      ),
    },
    style: {
      width: 225,
      background: token("surface-accent"),
      border: `1px solid ${token("border-strong")}`,
      color: token("text"),
      borderRadius: 8,
    },
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = (page?.relations ?? [])
    .filter((r) => ids.has(String(r.from)) && ids.has(String(r.to)))
    .map((r, i) => ({
      id: String(i),
      source: String(r.from),
      target: String(r.to),
      label:
        r.confidence === "extracted" ? r.kind : `${r.kind} (${r.confidence})`,
      style: { stroke: token(r.confidence === "extracted" ? "slate" : "gold") },
      type: "smoothstep",
    }));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[85vh] max-w-[1100px]! flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Local source structure. Relationships reflect static analysis;
            dynamic calls and unresolved references may be missing.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-56 shrink-0 overflow-auto border-r p-3 md:block">
            <button
              className="mb-3 flex items-center gap-2 text-xs"
              onClick={() => {
                setPath("");
                setOffset(0);
              }}
            >
              <Folder className="size-3.5" />
              All files
            </button>
            {(page?.files ?? []).map((file) => (
              <button
                key={file}
                title={file}
                className={`mb-1 block w-full truncate rounded px-2 py-1.5 text-left text-xs ${path === file ? "bg-muted" : "text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => {
                  setPath(file);
                  setOffset(0);
                }}
              >
                {file}
              </button>
            ))}
            <p className="mt-4 text-[10px] text-muted-foreground">
              Showing up to 500 matching paths. Search to narrow larger sources.
            </p>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <Input
                className="h-8 min-w-32 flex-1"
                placeholder="Find symbols or files"
                aria-label="Find symbols or files"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
              <Button
                size="sm"
                variant={mode === "symbols" ? "secondary" : "ghost"}
                onClick={() => setMode("symbols")}
              >
                Symbols
              </Button>
              <Button
                size="sm"
                variant={mode === "relationships" ? "secondary" : "ghost"}
                onClick={() => setMode("relationships")}
              >
                Relationships
              </Button>
            </div>
            {path && (
              <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
                <button
                  aria-label="Show all files"
                  onClick={() => {
                    setPath("");
                    setOffset(0);
                  }}
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <span className="flex-1 truncate">{path}</span>
                {local?.hashes[path] && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onRead({
                        source_id: sourceId,
                        path,
                        start_line: 1,
                        end_line: 200,
                        hash: local.hashes[path],
                      })
                    }
                  >
                    <FileText className="size-3" />
                    Read file
                  </Button>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="p-4 text-xs text-destructive">
                {error}
              </p>
            )}
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : mode === "relationships" ? (
              <div className="relative min-h-0 flex-1">
                <ReactFlow
                  key={`${path}-${search}-${offset}`}
                  nodes={nodes}
                  edges={edges}
                  fitView
                  nodesConnectable={false}
                  nodesDraggable={false}
                  onNodeClick={(_, n) => {
                    const symbol = page?.symbols.find(
                      (s) => String(s.id) === n.id,
                    );
                    if (symbol) onRead(symbol.citation);
                  }}
                  colorMode={theme}
                >
                  <Background color={token("border-strong")} />
                  <Controls showInteractive={false} />
                </ReactFlow>
                <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">
                  Up to 24 symbols from this page; only relationships between
                  displayed symbols appear.
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto p-3">
                {!page?.symbols.length && (
                  <p className="p-4 text-sm text-muted-foreground">
                    No extracted symbols here. Select a file to read its
                    contents.
                  </p>
                )}
                {page?.symbols.map((s) => (
                  <button
                    key={s.id}
                    className="block w-full border-b px-2 py-3 text-left hover:bg-muted/40"
                    onClick={() => onRead(s.citation)}
                  >
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {s.kind}
                    </span>
                    <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                      {s.citation.path}:{s.citation.start_line}–
                      {s.citation.end_line}
                    </span>
                    {s.signature && (
                      <span className="mt-1 block truncate font-mono text-[11px]">
                        {s.signature}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>{page?.total ?? 0} matching symbols</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={offset === 0 || loading}
                  onClick={() => setOffset((o) => Math.max(0, o - 80))}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page?.next_offset == null || loading}
                  onClick={() => setOffset(page?.next_offset ?? 0)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function SourcePreview({
  projectId,
  citation,
  onClose,
}: {
  projectId: string;
  citation: Citation;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void localProjects()
      .read(projectId, citation)
      .then((t) => {
        if (active) setText(t);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, citation]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl! flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="break-all text-sm">
            {citation.path}
          </DialogTitle>
          <DialogDescription>
            Lines {citation.start_line}–{citation.end_line} · read locally · up
            to 200 lines
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : loading ? (
          <p className="text-xs text-muted-foreground">Reading source…</p>
        ) : (
          <pre className="min-h-0 overflow-auto rounded border bg-muted/20 p-3 font-mono text-xs leading-5">
            {text.split("\n").map((line, i) => (
              <div key={i}>
                <span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground">
                  {citation.start_line + i}
                </span>
                {line || " "}
              </div>
            ))}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}
