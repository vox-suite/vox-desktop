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
} from "@/features/projects/types";
export function ProjectSources({
  project,
  busy,
  changes,
  onIndex,
  onRemove,
  onExplore,
  onImported,
  onStatus,
}: {
  project: Project;
  busy: boolean;
  changes: SourceChanges;
  onIndex: (id: string) => Promise<IndexResult>;
  onRemove: (id: string) => Promise<void>;
  onExplore: (id: string) => void;
  onImported?: () => void;
  onStatus?: (status: string) => void;
}) {
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);
  const [completed, setCompleted] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!status) return;
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [status]);
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
    setCompleted("");
    setElapsed(0);
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
    setCompleted("Index refreshed. Ready to build a plan.");
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
    if (newSources.length) {
      setCompleted(
        `${newSources.length} ${newSources.length === 1 ? "source" : "sources"} imported. Indexing complete — ready to build a plan.`,
      );
      onImported?.();
    }
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
      <div className="project-sources-heading">
        <div>
          <h2 className="text-xl font-medium tracking-tight">
            Project sources
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">
            Connect your codebase, briefs, and notes. Files and their index stay
            on this device.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
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
          <span>
            <strong className="block font-medium">{status}</strong>
            <span className="mt-1 block text-muted-foreground">
              {elapsed}s elapsed · Keep this project open. Large folders may
              take a few minutes.
            </span>
          </span>
        </p>
      )}
      {completed && !status && (
        <p role="status" className="mt-5 rounded-lg border p-4 text-sm">
          {completed}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <details className="project-import-notices mt-4 text-xs">
          <summary>{warnings.length} import notices · view details</summary>
          <p className="mt-3 leading-5 text-muted-foreground">
            Some files were excluded from the index. The details below explain
            which files are missing from project context and why.
          </p>
          <ul className="mt-2 max-h-40 overflow-auto space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="project-source-list mt-6 divide-y rounded-xl border">
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
              <div key={s.id} className="project-source-row">
                <div className="flex min-w-0 items-start gap-3">
                  {s.kind === "folder" ? (
                    <Folder className="mt-1 size-4" />
                  ) : (
                    <File className="mt-1 size-4" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <strong className="text-base font-medium">
                        {s.label}
                      </strong>
                      <span className="project-source-state">
                        {!local
                          ? "Another device"
                          : stale
                            ? "Changes found"
                            : s.indexed_at
                              ? "Indexed"
                              : status
                                ? "Indexing"
                                : "Ready to index"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.indexed_at
                        ? `${s.files.toLocaleString()} files · ${s.symbols.toLocaleString()} symbols`
                        : "Waiting for a local index"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {change?.unavailable ??
                        (!local
                          ? "Source is on another device"
                          : stale
                            ? `${change.files?.length} changed files · refresh to update context`
                            : s.indexed_at
                              ? `Last indexed ${new Date(s.indexed_at).toLocaleString()}`
                              : "Local files stay on this device")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
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
        sync to Vox and guide your Plans. Raw files stay on this device. Source
        changes are checked while this project is open.
      </p>
    </div>
  );
}
