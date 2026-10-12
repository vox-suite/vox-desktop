import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Folder,
  Plus,
  Workflow,
  RefreshCw,
  Archive,
  Loader2,
  FileText,
  Settings2,
  MoreHorizontal,
  ChevronRight,
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
import type {
  Citation,
  ContextNode,
  Project,
  ProjectAgentStatus,
} from "@/features/projects/types";
import { spacesApi } from "@/features/spaces/api";
import type { Space } from "@/features/spaces/types";
import { desktopStore } from "@/features/desktop-control/store";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { InvestigationComposer } from "./investigation-composer";
import { ProjectFlowCanvas } from "./project-flow";
import { ProjectContext } from "./project-context";
import { ProjectSources } from "./project-sources";
import { ContextEditor } from "./context-editor";
import { CodeExplorer, SourcePreview } from "./code-explorer";
import { platform } from "@/platform";
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
  const [traceStatus, setTraceStatus] = useState("");
  const [traceLog, setTraceLog] = useState<string[]>([]);
  const [agentStatus, setAgentStatus] = useState<ProjectAgentStatus | null>(
    null,
  );
  const [agentSetup, setAgentSetup] = useState(false);
  const [agentKey, setAgentKey] = useState("");
  const [agentSetupBusy, setAgentSetupBusy] = useState(false);
  const traceRequest = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (platform().projects)
      void localProjects()
        .agentStatus()
        .then(setAgentStatus)
        .catch((e) => setError(String(e)));
    return () => {
      mounted.current = false;
      const request = traceRequest.current;
      if (request && platform().projects)
        void localProjects()
          .cancelTrace(request)
          .catch(() => {});
    };
  }, []);
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
  const trace = async () => {
    if (!p || !intent.trim() || state.busy || traceRequest.current) return;
    setError("");
    setTraceLog([]);
    const requestId = crypto.randomUUID();
    traceRequest.current = requestId;
    setTraceStatus("Checking source freshness…");
    try {
      const status = await localProjects().agentStatus();
      setAgentStatus(status);
      if (!status.authenticated) {
        setAgentSetup(true);
        return;
      }
      const changes = await localProjects().changes(p.id);
      for (const source of p.data.sources) {
        if (changes[source.id]?.unavailable)
          throw new Error(`Relink ${source.label} before investigating.`);
        if (changes[source.id]?.files?.length) {
          setTraceStatus(`Refreshing ${source.label} before investigation…`);
          await state.index(source.id);
        }
      }
      if (traceRequest.current !== requestId) return;
      const context = p.data.messages
        .filter((m) => m.flow)
        .slice(-2)
        .map((m) => JSON.stringify(m.flow))
        .join("\n")
        .slice(0, 20000);
      const result = await localProjects().trace(
        p.id,
        requestId,
        intent.trim(),
        context,
        (event) => {
          if (!mounted.current || traceRequest.current !== requestId) return;
          setTraceStatus(event.message);
          setTraceLog((old) => [...old, event.message].slice(-40));
        },
      );
      if (!mounted.current || traceRequest.current !== requestId) return;
      await state.save((current) =>
        activity(
          {
            ...current,
            data: {
              ...current.data,
              messages: [
                ...current.data.messages,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  body: intent.trim(),
                  at: new Date().toISOString(),
                  proposals: [],
                },
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  body: result.reply,
                  at: new Date().toISOString(),
                  proposals: [],
                  flow: result.flow,
                },
              ].slice(-100),
            },
          },
          `Traced runtime flow: ${result.flow.title}`,
        ),
      );
      setIntent("");
    } catch (e) {
      if (mounted.current && traceRequest.current === requestId)
        setError(String(e));
    } finally {
      if (mounted.current) setTraceStatus("");
      if (traceRequest.current === requestId) traceRequest.current = null;
    }
  };
  const cancelTrace = async () => {
    const request = traceRequest.current;
    if (!request) return;
    traceRequest.current = null;
    setTraceStatus("Stopping investigation…");
    await localProjects().cancelTrace(request);
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
    { id: "context", label: "Canvas" },
    { id: "sources", label: "Sources" },
    { id: "plans", label: "Plans" },
    { id: "activity", label: "Activity" },
  ];
  return (
    <PageContainer className="project-workspace">
      <PageHeader className="h-16 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to projects"
            disabled={!!importStatus || !!traceStatus}
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Folder className="size-4 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-medium">{p.name}</h1>
            <p className="project-header-meta">
              {p.data.sources.length}{" "}
              {p.data.sources.length === 1 ? "source" : "sources"}
              <span className="project-meta-divider" />
              {p.data.sources
                .reduce((sum, source) => sum + source.files, 0)
                .toLocaleString()}{" "}
              files
              {p.data.nodes.some((n) => n.stale) && (
                <span className="project-needs-review">
                  Context needs review
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={state.busy || !!traceStatus}
            onClick={() => setNewPlan(true)}
          >
            <Plus className="size-3.5" />
            New plan
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Project options"
                disabled={!!traceStatus || !!importStatus}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setName(p.name);
                  setNotes(p.data.notes);
                  setSettings(true);
                }}
              >
                <FileText />
                Edit project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAgentSetup(true)}>
                <Settings2 />
                Model connection
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={state.busy}
                onSelect={() =>
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
                <Plus />
                Add decision
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={state.busy}
                variant="destructive"
                onSelect={() => setPendingArchive(true)}
              >
                <Archive />
                Archive project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="project-tabs"
            role="tablist"
            aria-label="Project views"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`project-tab-${t.id}`}
                disabled={(!!importStatus || !!traceStatus) && tab !== t.id}
                tabIndex={tab === t.id ? 0 : -1}
                aria-selected={tab === t.id}
                aria-controls={`project-${t.id}`}
                className={`h-full border-b-2 text-xs ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                onKeyDown={(e) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      e.key,
                    ) ||
                    importStatus ||
                    traceStatus
                  )
                    return;
                  e.preventDefault();
                  const current = tabs.findIndex((item) => item.id === tab);
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : (current +
                            (e.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length;
                  setTab(tabs[next].id);
                  document
                    .getElementById(`project-tab-${tabs[next].id}`)
                    ?.focus();
                }}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
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
            aria-labelledby={`project-tab-${tab}`}
          >
            {tab === "context" &&
              (p.data.messages.filter((m) => m.role === "assistant").at(-1)
                ?.flow ? (
                <ProjectFlowCanvas
                  flow={
                    p.data.messages
                      .filter((m) => m.role === "assistant")
                      .at(-1)!.flow!
                  }
                  onRead={setCitation}
                />
              ) : (
                <ProjectContext
                  project={p}
                  onAddSources={() => setTab("sources")}
                  investigating={!!traceStatus}
                  onSelect={(n) => {
                    if (!traceStatus) setEditing(n);
                  }}
                  onSource={(id) => setExplorer(id)}
                />
              ))}
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
              <div className="project-content-page">
                <h2 className="mb-5 text-base font-medium">Project activity</h2>
                {!p.data.activity.length && (
                  <p className="project-quiet-empty">
                    Imports, diagrams and decisions will appear here.
                  </p>
                )}
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
              <div className="project-content-page">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-medium">
                      Iterations on {p.name}
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Turn a direction into a plan, with this project as
                      context.
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
                            disabled={state.busy || !!traceStatus}
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
            <InvestigationComposer
              question={intent}
              onChange={setIntent}
              onSubmit={() => void trace()}
              onSources={() => setTab("sources")}
              onStop={() => void cancelTrace()}
              status={traceStatus}
              log={traceLog}
              disabled={state.busy || creating}
              sourceCount={p.data.sources.length}
            />
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
        open={agentSetup}
        onOpenChange={(open) => {
          if (!agentSetupBusy) {
            setAgentSetup(open);
            if (!open) setAgentKey("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gemini investigation engine</DialogTitle>
            <DialogDescription>
              Vox manages the local engine and uses its Gemini connection by
              default. You can optionally supply your own API key. Relevant
              source code is sent to Google during investigation.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {agentStatus?.authenticated
              ? `Connected through ${agentStatus.auth_method === "api-key" ? "your API key" : "Vox’s Gemini connection"}.`
              : "Vox’s Gemini connection is used by default."}{" "}
            The engine downloads automatically on first use.
          </p>
          <label className="grid gap-2 text-xs">
            Gemini API key
            <Input
              type="password"
              autoComplete="off"
              value={agentKey}
              onChange={(e) => setAgentKey(e.target.value)}
              placeholder="Stored securely in the system keychain"
            />
          </label>
          <Button
            disabled={agentSetupBusy || !agentKey.trim()}
            onClick={() => {
              setAgentSetupBusy(true);
              void localProjects()
                .configureAgent(agentKey)
                .then(() => localProjects().agentStatus())
                .then((status) => {
                  setAgentStatus(status);
                  setAgentKey("");
                  setAgentSetup(false);
                })
                .catch((e) => setError(String(e)))
                .finally(() => setAgentSetupBusy(false));
            }}
          >
            {agentSetupBusy ? "Saving…" : "Save connection"}
          </Button>
          {agentStatus?.auth_method === "api-key" && (
            <Button
              variant="ghost"
              disabled={agentSetupBusy}
              onClick={() => {
                setAgentSetupBusy(true);
                void localProjects()
                  .configureAgent("")
                  .then(() => localProjects().agentStatus())
                  .then(setAgentStatus)
                  .catch((e) => setError(String(e)))
                  .finally(() => setAgentSetupBusy(false));
              }}
            >
              Remove my key and use Vox
            </Button>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
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
    <button className="project-list-row group" onClick={onOpen}>
      <div className="project-list-icon">
        <Folder className="size-5" />
      </div>
      <div className="project-list-content">
        <h2>{project.name}</h2>
        <p>{project.data.notes || "Add sources, then explore your project."}</p>
        <div className="project-list-meta">
          <span>
            {project.data.sources.length}{" "}
            {project.data.sources.length === 1 ? "source" : "sources"}
          </span>
          <span>
            {project.data.sources
              .reduce((total, s) => total + s.files, 0)
              .toLocaleString()}{" "}
            files
          </span>
          <time>
            {new Date(project.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>
      </div>
      <ChevronRight className="project-list-chevron size-4" />
    </button>
  );
}
