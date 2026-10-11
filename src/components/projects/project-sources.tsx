import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";
import {
  FolderPlus,
  FilePlus,
  RefreshCw,
  Trash2,
  Folder,
  File,
  Download,
  Loader2,
  Search,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { platform } from "@/platform";
import { localProjects } from "@/features/projects/api";
import type {
  Project,
  LocalSource,
  IndexResult,
  SourceChanges,
  ProjectExcerpt,
} from "@/features/projects/types";
export function ProjectSources({
  project,
  busy,
  changes,
  onIndex,
  onRemove,
  onExplore,
  onImported,
  onUnderstand,
}: {
  project: Project;
  busy: boolean;
  changes: SourceChanges;
  onIndex: (id: string) => Promise<IndexResult>;
  onRemove: (id: string) => Promise<void>;
  onExplore: (id: string) => void;
  onImported?: () => void;
  onUnderstand: (id: string, excerpts: ProjectExcerpt[]) => Promise<void>;
}) {
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [brief, setBrief] = useState<{
    sourceId: string;
    excerpts: ProjectExcerpt[];
  } | null>(null);
  const [budget, setBudget] = useState(24000);
  const candidates = brief?.excerpts ?? [];
  const bounded = candidates.flatMap((e, index) => {
    const previous = candidates
      .slice(0, index)
      .reduce((total, item) => total + item.text.length, 0);
    const text = e.text.slice(0, Math.max(0, budget - previous));
    return text ? [{ ...e, text }] : [];
  });
  const reload = useCallback(async () => {
    if (!platform().projects) return;
    const [local, engine] = await Promise.all([
      localProjects().sources(project.id),
      localProjects().engineStatus(),
    ]);
    setSources(local);
    setInstalled(engine.installed);
  }, [project.id]);
  useEffect(() => {
    let active = true;
    queueMicrotask(
      () =>
        void reload().catch((e) => {
          if (active) setError(String(e));
        }),
    );
    return () => {
      active = false;
    };
  }, [reload]);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setWarnings([]);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setStatus("");
      await reload().catch((e) => setError(String(e)));
    }
  };
  const ensureEngine = async () => {
    if (installed) return;
    setStatus("Downloading the local indexer…");
    await localProjects().installEngine();
    setInstalled(true);
  };
  const index = async (id: string) => {
    await ensureEngine();
    const source = sources.find((s) => s.id === id);
    setStatus(`Indexing ${source?.label ?? "source"} locally…`);
    const result = await onIndex(id);
    setWarnings((old) => [...old, ...result.warnings]);
  };
  const add = async (kind: "folder" | "file") => {
    setStatus("Choose sources…");
    const next = await localProjects().pickSources(project.id, kind);
    setSources(next);
    const newSources = next.filter(
      (s) => !sources.some((old) => old.id === s.id),
    );
    for (const s of newSources) {
      await ensureEngine();
      setStatus(`Indexing ${s.label} locally…`);
      const result = await onIndex(s.id);
      setWarnings((old) => [...old, ...result.warnings]);
    }
    if (newSources.length) onImported?.();
  };
  const all = [
    ...project.data.sources,
    ...sources
      .filter((s) => !project.data.sources.some((old) => old.id === s.id))
      .map((s) => ({
        id: s.id,
        label: s.label,
        kind: s.kind,
        files: 0,
        symbols: 0,
        indexed_at: "",
        fingerprint: "",
      })),
  ];
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Dialog
        open={!!brief}
        onOpenChange={(open) => {
          if (!open && !status) setBrief(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Understand this source</DialogTitle>
            <DialogDescription>
              Vox will make one model request using these local excerpts and
              existing context. Review the scope before sharing. Model pricing
              depends on the configured provider.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-xs">
            {bounded.map((e, i) => (
              <li key={i}>
                {e.citation.path}:{e.citation.start_line}–{e.citation.end_line}{" "}
                ({e.text.length.toLocaleString()} characters)
              </li>
            ))}
          </ul>
          <label className="grid gap-2 text-xs">
            Maximum source characters
            <Input
              type="number"
              min={1000}
              max={24000}
              step={1000}
              value={budget}
              onChange={(e) =>
                setBudget(
                  Math.max(
                    1000,
                    Math.min(24000, Number(e.target.value) || 1000),
                  ),
                )
              }
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {bounded
              .reduce((sum, e) => sum + e.text.length, 0)
              .toLocaleString()}{" "}
            source characters will be shared (roughly{" "}
            {Math.ceil(
              bounded.reduce((sum, e) => sum + e.text.length, 0) / 4,
            ).toLocaleString()}{" "}
            source tokens; context and reply are additional). Files and the full
            index stay local.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !!status || !bounded.length}
            onClick={() =>
              void run(async () => {
                if (!brief) return;
                setStatus("Understanding source…");
                await onUnderstand(brief.sourceId, bounded);
                setBrief(null);
              })
            }
          >
            Share excerpts and understand
          </Button>
        </DialogContent>
      </Dialog>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Sources on this device</h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
            Add project folders or up to five individual text and code files.
            Vox respects .gitignore, skips generated files and common credential
            files, and keeps the index on your device.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !!status || !platform().projects}
            onClick={() => void run(() => add("folder"))}
          >
            <FolderPlus className="size-3.5" />
            Add folders
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !!status || !platform().projects}
            onClick={() => void run(() => add("file"))}
          >
            <FilePlus className="size-3.5" />
            Add files
          </Button>
        </div>
      </div>
      {!platform().projects && (
        <p className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
          Open this project in Vox desktop to import or inspect local files.
          Context summaries are available on this device.
        </p>
      )}
      {status && (
        <p
          role="status"
          className="mt-5 flex items-center gap-2 rounded-lg border p-3 text-xs"
        >
          <Loader2 className="size-3.5 animate-spin" />
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <details
          open
          className="mt-4 rounded-lg border border-amber-400/30 p-3 text-xs text-amber-200"
        >
          <summary>Import coverage ({warnings.length} notices)</summary>
          <ul className="mt-2 max-h-40 overflow-auto space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-6 divide-y rounded-xl border">
        {all.length === 0 ? (
          <div className="p-8 text-center">
            <Folder className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="text-sm">Give Vox the context you already have.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Import a codebase, a brief, or your project notes.
            </p>
          </div>
        ) : (
          all.map((s) => {
            const local = sources.find((l) => l.id === s.id);
            const change = changes[s.id];
            const stale = !!change?.files?.length;
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {s.kind === "folder" ? (
                    <Folder className="mt-1 size-4" />
                  ) : (
                    <File className="mt-1 size-4" />
                  )}
                  <div className="min-w-0">
                    <strong className="text-sm font-medium">{s.label}</strong>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.indexed_at
                        ? `${s.files} files · ${s.symbols} symbols · ${new Date(s.indexed_at).toLocaleString()}`
                        : "Ready to index"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {change?.unavailable ??
                        (!local
                          ? "Source is on another device"
                          : stale
                            ? `${change.files?.length} changed files · refresh to update context`
                            : "Local files stay on this device")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {local && s.indexed_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || !!status}
                      onClick={() =>
                        void run(async () => {
                          setStatus("Reading project briefs for Vox…");
                          const excerpts = await localProjects().retrieve(
                            project.id,
                            "",
                            s.id,
                            true,
                          );
                          if (!excerpts.length)
                            throw new Error(
                              "No project briefs found. Inspect code and include relevant excerpts in ideation instead.",
                            );
                          setBrief({ sourceId: s.id, excerpts });
                        })
                      }
                    >
                      Understand source
                    </Button>
                  )}
                  {local && s.indexed_at && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Inspect ${s.label}`}
                      title="Inspect source"
                      disabled={!!status}
                      onClick={() => onExplore(s.id)}
                    >
                      <Search className="size-4" />
                    </Button>
                  )}
                  {local && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Refresh ${s.label}`}
                      title="Refresh source"
                      disabled={busy || !!status}
                      onClick={() => void run(() => index(s.id))}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                  {!local && platform().projects && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || !!status}
                      onClick={() =>
                        void run(async () => {
                          setStatus("Relink source…");
                          const next = await localProjects().pickSources(
                            project.id,
                            s.kind === "file" ? "file" : "folder",
                            s.id,
                          );
                          setSources(next);
                          if (next.some((n) => n.id === s.id))
                            await index(s.id);
                        })
                      }
                    >
                      <Link className="size-3.5" />
                      Relink
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${s.label}`}
                    title="Remove source"
                    disabled={busy || !!status}
                    onClick={() =>
                      void run(async () => {
                        setStatus(`Removing ${s.label}…`);
                        await onRemove(s.id);
                        if (local)
                          await localProjects().remove(project.id, s.id);
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {platform().projects && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span>
            Local engine: code-graph-mcp · v0.169.0 ·{" "}
            {installed ? "installed" : "downloads on first import"}
          </span>
          {!installed && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || !!status}
              onClick={() => void run(ensureEngine)}
            >
              <Download className="size-3.5" />
              Install indexer
            </Button>
          )}
        </div>
      )}
      <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
        Structural indexing uses no model calls. Project summaries and citations
        sync to Vox. File excerpts go to the model only when you explicitly
        include them in ideation. Source changes are checked while this project
        is open.
      </p>
    </div>
  );
}
