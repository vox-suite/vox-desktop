import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Folder,
  Plus,
  Workflow,
  RefreshCw,
  Archive,
  Loader2,
  FileText,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useProject } from "@/features/projects/use-project";
import { replaceNode, activity } from "@/features/projects/context";
import { projectsApi, localProjects } from "@/features/projects/api";
import type { Citation, ContextNode, Project } from "@/features/projects/types";
import { spacesApi } from "@/features/spaces/api";
import type { Space } from "@/features/spaces/types";
import { desktopStore } from "@/features/desktop-control/store";
import { ProjectContext } from "./project-context";
import { ProjectSources } from "./project-sources";
import { ContextEditor } from "./context-editor";
import { CodeExplorer, SourcePreview } from "./code-explorer";
import { Input } from "@/components/ui/input";

export function ProjectDetail({
  id,
  onBack,
  initialTab = "context",
}: {
  id: string;
  onBack: () => void;
  initialTab?: string;
}) {
  const state = useProject(id);
  const p = state.project;
  const [tab, setTab] = useState(initialTab);
  const [importStatus, setImportStatus] = useState("");
  const [editing, setEditing] = useState<ContextNode | null>(null);
  const [explorer, setExplorer] = useState<string | null>(null);
  const [citation, setCitation] = useState<Citation | null>(null);
  const [newPlan, setNewPlan] = useState(false);
  const [intent, setIntent] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState<Space[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingArchive, setPendingArchive] = useState(false);
  useEffect(() => {
    if (!p) return;
    desktopStore.patch({
      projectId: p.id,
      resourceDetails: {
        name: p.name,
        contextNodes: p.data.nodes.slice(0, 30).map((n) => ({
          id: n.id,
          title: n.title.slice(0, 120),
          kind: n.kind,
          origin: n.origin,
          stale: n.stale,
        })),
        sourceCount: p.data.sources.length,
      },
    });
  }, [p]);
  useEffect(() => {
    if (tab !== "plans") return;
    let active = true;
    queueMicrotask(() => setPlansLoading(true));
    void spacesApi
      .listSpaces()
      .then((list) => {
        if (active) setPlans(list.filter((s) => s.project_id === id));
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, id]);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    }
  };
  const saveNode = async (node: ContextNode) => {
    await state.save((p) =>
      activity(
        { ...p, data: { ...p.data, nodes: replaceNode(p.data.nodes, node) } },
        `Updated context: ${node.title}`,
      ),
    );
  };
  const removeSource = async (sourceId: string) => {
    await state.save((p) =>
      activity(
        {
          ...p,
          data: {
            ...p.data,
            sources: p.data.sources.filter((s) => s.id !== sourceId),
            nodes: p.data.nodes
              .filter(
                (n) =>
                  n.origin !== "extracted" ||
                  !n.citations.some((c) => c.source_id === sourceId),
              )
              .map((n) => ({
                ...n,
                stale:
                  n.stale || n.citations.some((c) => c.source_id === sourceId),
              })),
          },
        },
        "Removed project source",
      ),
    );
  };
  const openPlan = (s: Space) =>
    desktopStore.patch({ page: "spaces", spaceId: s.id, selectedItemId: null });
  const createPlan = async () => {
    if (!p || !intent.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const s = await spacesApi.createSpace(intent.trim(), p.id);
      setNewPlan(false);
      openPlan(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };
  if (!p)
    return (
      <PageContainer>
        <PageHeader>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Projects
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void state.reload()}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </PageHeader>
        <PageBody>
          <div className="p-8">
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading project…
              </p>
            )}
          </div>
        </PageBody>
      </PageContainer>
    );
  const tabs = [
    { id: "context", label: "Context" },
    { id: "plans", label: "Plans" },
    { id: "sources", label: "Sources" },
    { id: "activity", label: "Activity" },
  ];
  return (
    <PageContainer>
      <PageHeader className="h-16 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to projects"
            disabled={!!importStatus}
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Folder className="size-4 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium">{p.name}</h1>
            <p className="text-[11px] text-muted-foreground">
              {p.data.sources.length} sources · {p.data.nodes.length} context
              nodes
              {p.data.nodes.some((n) => n.stale)
                ? " · review outdated context"
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit project"
            aria-label="Edit project"
            onClick={() => {
              setName(p.name);
              setNotes(p.data.notes);
              setSettings(true);
            }}
          >
            <FileText className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Archive project"
            aria-label="Archive project"
            disabled={state.busy}
            onClick={() => setPendingArchive(true)}
          >
            <Archive className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={state.busy}
            onClick={() => setNewPlan(true)}
          >
            <Plus className="size-3.5" />
            New plan
          </Button>
        </div>
      </PageHeader>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex h-12 shrink-0 items-center gap-5 border-b px-6"
            role="tablist"
            aria-label="Project views"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                disabled={!!importStatus && tab !== t.id}
                aria-selected={tab === t.id}
                aria-controls={`project-${t.id}`}
                className={`h-full border-b-2 text-xs ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            {tab === "context" && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={state.busy}
                onClick={() =>
                  setEditing({
                    id: crypto.randomUUID(),
                    kind: "decision",
                    title: "",
                    body: "",
                    origin: "user",
                    stale: false,
                    citations: [],
                    history: [],
                    updated_at: new Date().toISOString(),
                  })
                }
              >
                <Plus className="size-3" />
                Add context
              </Button>
            )}
          </div>
          {(state.error || error) && (
            <div
              role="alert"
              className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/25 px-5 py-3 text-xs text-destructive"
            >
              <span>{error || state.error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void state.reload()}
              >
                Reload
              </Button>
            </div>
          )}
          <PageBody
            scroll={tab !== "context"}
            id={`project-${tab}`}
            role="tabpanel"
          >
            {tab === "context" && (
              <ProjectContext
                project={p}
                onSelect={(n) => {
                  setEditing(n);
                }}
                onSource={(id) => setExplorer(id)}
              />
            )}
            {tab === "sources" && (
              <ProjectSources
                project={p}
                busy={state.busy}
                changes={state.changes}
                onIndex={state.index}
                onStatus={setImportStatus}
                onRemove={removeSource}
                onExplore={setExplorer}
              />
            )}
            {tab === "activity" && (
              <div className="mx-auto max-w-3xl p-6">
                <h2 className="mb-5 text-base font-medium">Project activity</h2>
                {[...p.data.activity].reverse().map((a) => (
                  <div key={a.id} className="flex gap-4 border-l pl-5 pb-6">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <div>
                      <p className="text-sm">{a.text}</p>
                      <time className="mt-1 block text-xs text-muted-foreground">
                        {new Date(a.at).toLocaleString()}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === "plans" && (
              <div className="mx-auto max-w-4xl p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-medium">
                      Iterations on {p.name}
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Each Plan starts with current project context. Its
                      findings can become the next iteration’s context.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setNewPlan(true)}>
                    <Plus className="size-3.5" />
                    New plan
                  </Button>
                </div>
                {plansLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading plans…
                  </p>
                ) : plans.length === 0 ? (
                  <div className="rounded-xl border p-8 text-center">
                    <Workflow className="mx-auto mb-3 size-6 text-muted-foreground" />
                    <p className="text-sm">
                      Choose a direction when you’re ready.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Describe what you want to build to start a Plan.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y rounded-xl border">
                    {plans.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 p-4"
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openPlan(s)}
                        >
                          <strong className="text-sm font-medium">
                            {s.title}
                          </strong>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {s.intent}
                          </p>
                          <span className="mt-2 block text-[10px] text-muted-foreground">
                            {s.state} ·{" "}
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        </button>
                        {s.state === "planned" || s.state === "committed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={state.busy}
                            onClick={() =>
                              void run(async () => {
                                const graph = await spacesApi.getSpace(s.id);
                                const final = graph.nodes.find(
                                  (n) => n.is_final && n.state === "done",
                                );
                                if (!final)
                                  throw new Error(
                                    "This plan has no completed final output yet.",
                                  );
                                setIntent(
                                  `Review the findings from ${s.title} and plan the next iteration.\n${final.body}`,
                                );
                                setNewPlan(true);
                              })
                            }
                          >
                            Review findings
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </PageBody>
          {tab === "context" && (
            <form
              className="project-build-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void createPlan();
              }}
            >
              <Textarea
                aria-label="What do you want to build?"
                placeholder="What do you want to build? For example, design the voice pipeline architecture…"
                value={intent}
                maxLength={12000}
                onChange={(e) => setIntent(e.target.value)}
                rows={2}
                disabled={creating}
              />
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTab("sources")}
                >
                  <Folder className="size-3.5" />
                  Add files or folders
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={state.busy || creating || !intent.trim()}
                >
                  {creating ? "Starting plan…" : "Build a plan"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
      {editing && (
        <ContextEditor
          key={editing.id}
          node={editing}
          busy={state.busy}
          onClose={() => setEditing(null)}
          onSave={saveNode}
          onReview={async (node) => {
            if (!node.citations.length)
              return { ...node, stale: false, origin: "user" };
            const local = await localProjects().sources(p.id);
            const citations = [];
            for (const c of node.citations) {
              const hash = local.find((s) => s.id === c.source_id)?.hashes[
                c.path
              ];
              if (!hash)
                throw new Error(
                  "Refresh or relink each cited source before marking this context reviewed.",
                );
              const updated = { ...c, hash };
              await localProjects().read(p.id, updated);
              citations.push(updated);
            }
            return { ...node, citations, stale: false, origin: "user" };
          }}
          onRemove={async () => {
            await state.save((p) =>
              activity(
                {
                  ...p,
                  data: {
                    ...p.data,
                    nodes: p.data.nodes.filter((n) => n.id !== editing.id),
                  },
                },
                `Removed context: ${editing.title}`,
              ),
            );
          }}
          onRead={setCitation}
        />
      )}
      {explorer && (
        <CodeExplorer
          projectId={p.id}
          sourceId={explorer}
          label={
            p.data.sources.find((s) => s.id === explorer)?.label ?? "Source"
          }
          onClose={() => setExplorer(null)}
          onRead={setCitation}
        />
      )}
      {citation && (
        <SourcePreview
          projectId={p.id}
          citation={citation}
          onClose={() => setCitation(null)}
        />
      )}
      <Dialog
        open={newPlan}
        onOpenChange={(open) => {
          if (!creating) setNewPlan(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New plan</DialogTitle>
            <DialogDescription>
              Attached to {p.name}. Current context summaries will guide the
              agent; raw files stay local.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Plan vision"
            placeholder="What do you want to work through?"
            value={intent}
            maxLength={12000}
            onChange={(e) => setIntent(e.target.value)}
            rows={5}
          />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={creating || !intent.trim()}
            onClick={() => void createPlan()}
          >
            {creating ? "Starting plan…" : "Start plan"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Keep your vision and constraints current.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-xs">
            Name
            <Input
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-xs">
            Notes
            <Textarea
              rows={6}
              maxLength={12000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={state.busy || !name.trim()}
            onClick={() =>
              void run(async () => {
                await state.save((p) =>
                  activity(
                    { ...p, name: name.trim(), data: { ...p.data, notes } },
                    "Updated project notes",
                  ),
                );
                setSettings(false);
              })
            }
          >
            Save project
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={pendingArchive} onOpenChange={setPendingArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {p.name}?</DialogTitle>
            <DialogDescription>
              Hide this project from the list. Its existing Plans and local
              sources are preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingArchive(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                void run(async () => {
                  await projectsApi.archive(p.id);
                  onBack();
                })
              }
            >
              Archive project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
export function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  return (
    <button
      className="project-list-row group flex w-full items-center justify-between gap-6 border-b px-5 py-5 text-left transition-colors hover:bg-muted/25"
      onClick={onOpen}
    >
      <div className="flex min-w-0 items-start gap-4">
        <Folder className="mt-1 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{project.name}</h2>
          <p className="mt-1.5 line-clamp-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            {project.data.notes ||
              "Add sources and describe what you want to build"}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {project.data.sources.length} sources ·{" "}
            {project.data.nodes.filter((n) => n.origin !== "extracted").length}{" "}
            saved decisions
          </p>
        </div>
      </div>
      <time className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {new Date(project.updated_at).toLocaleDateString()}
      </time>
    </button>
  );
}
