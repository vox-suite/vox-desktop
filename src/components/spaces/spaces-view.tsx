import { useProjectOptions } from "@/features/projects/use-project-options";
import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import "./spaces.css";
import { useEffect, useState } from "react";
import {
  Plus,
  RotateCw,
  Sparkles,
  ArrowRight,
  Trash2,
  Calendar,
  Workflow,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Space } from "@/features/spaces/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSpaces } from "@/hooks/use-spaces";
import { useSpace } from "@/hooks/use-space";
import { SpaceCanvas } from "@/components/spaces/space-canvas";
import { SpacesIntroduction } from "./spaces-introduction";
import { token } from "@/lib/theme";

export function SpacesView() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<
    "all" | "active" | "committed"
  >("all");
  const [sort, setSort] = useState<"created" | "updated" | "title">("created");
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const filtering = !!(query || stateFilter !== "all" || sort !== "created");
  const { spaces, loading, error, reload, create, drop, hasMore, loadMore } =
    useSpaces(true, {
      q: query || undefined,
      state: stateFilter === "all" ? undefined : stateFilter,
      sort,
    });
  const visible = spaces;
  const selectedSpaceId = useDesktopContext().spaceId;
  const setSelectedSpaceId = (spaceId: string | null) =>
    desktopStore.patch({ spaceId, selectedItemId: null });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [intent, setIntent] = useState("");
  const [projectId, setProjectId] = useState("");
  const projectOptions = useProjectOptions(showCreateDialog);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const currentSpace = useSpace(selectedSpaceId);
  const sections: [string, Space[]][] =
    stateFilter === "all"
      ? [
          ["In progress", visible.filter((sp) => sp.state !== "committed")],
          ["Committed", visible.filter((sp) => sp.state === "committed")],
        ]
      : [["", visible]];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim() || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const created = await create(intent.trim(), projectId || undefined);
      setIntent("");
      setShowCreateDialog(false);
      setSelectedSpaceId(created.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  if (selectedSpaceId) {
    if (currentSpace.graph) {
      return (
        <SpaceCanvas
          graph={currentSpace.graph}
          messages={currentSpace.messages}
          loading={currentSpace.loading}
          sending={currentSpace.sending}
          committing={currentSpace.committing}
          onBack={() => {
            setSelectedSpaceId(null);
            void reload();
          }}
          onSendMessage={currentSpace.sendMessage}
          onCommit={currentSpace.commit}
          onUpdateNode={currentSpace.updateNode}
        />
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="h-8 w-8 animate-spin text-foreground" />
          <span className="text-xs text-muted-foreground">Loading plan…</span>
        </div>
      </div>
    );
  }

  const openCreate = () => {
    setCreateError("");
    setProjectId("");
    setShowCreateDialog(true);
  };
  const stateDot = (state: string, running: boolean) =>
    token(running ? "danger" : state === "committed" ? "text-muted" : "gold");

  return (
    <PageContainer>
      <PageHeader className="h-16 px-6 py-0">
        <div className="flex items-center gap-3.5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <Workflow className="size-[18px] text-gold" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight">Plans</h1>
            {loading && spaces.length === 0 ? (
              <span
                role="status"
                aria-label="Loading"
                className="mt-0.5 block h-4 w-20 animate-pulse rounded-sm bg-muted"
              />
            ) : (
              <p className="mt-0.5 font-mono text-[10.5px] leading-4 text-muted-foreground">
                {spaces.length === 0
                  ? "Nothing here yet"
                  : `${spaces.length} ${spaces.length === 1 ? "plan" : "plans"}`}
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={openCreate}
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-3 text-xs"
        >
          <Plus className="size-3.5" />
          New plan
        </Button>
      </PageHeader>
      <PageBody
        scroll
        className={`flex flex-col p-6${spaces.length > 0 ? " spaces-plans-populated" : ""}`}
      >
        {error && (
          <div className="relative z-10 mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {spaces.length === 0 && !filtering && !search ? (
          <SpacesIntroduction onCreate={openCreate} />
        ) : (
          <>
            <div className="relative z-10 mb-5 flex flex-wrap items-center gap-2">
              <Input
                aria-label="Search plans"
                placeholder="Search plans"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56 text-xs"
              />
              <div role="group" aria-label="Plan state" className="flex gap-1">
                {(
                  [
                    ["all", "All"],
                    ["active", "In progress"],
                    ["committed", "Committed"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={stateFilter === value ? "secondary" : "ghost"}
                    aria-pressed={stateFilter === value}
                    onClick={() => setStateFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <select
                aria-label="Sort plans"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="created">Newest first</option>
                <option value="updated">Recently updated</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
            {visible.length === 0 && !loading && (
              <p className="relative z-10 text-sm text-muted-foreground">
                No plans match.
              </p>
            )}
            {sections
              .filter(([, list]) => list.length > 0)
              .map(([heading, list]) => (
                <section key={heading} className="relative z-10 mb-6">
                  {heading && (
                    <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {heading} · {list.length}
                    </h2>
                  )}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((sp) => (
                      <Card
                        key={sp.id}
                        onClick={() => setSelectedSpaceId(sp.id)}
                        className="group relative flex cursor-pointer flex-col justify-between rounded-xl border-border bg-card p-5 shadow-none transition-colors duration-200 hover:border-ring"
                      >
                        <div>
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${sp.run_state === "running" ? "animate-pulse" : ""}`}
                                style={{
                                  background: stateDot(
                                    sp.state,
                                    sp.run_state === "running",
                                  ),
                                }}
                              />
                              {sp.run_state === "running"
                                ? "running"
                                : sp.state}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Abandon “${sp.title}”? This removes it from Plans.`,
                                  )
                                )
                                  void drop(sp.id).catch(() => undefined);
                              }}
                              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                              aria-label={`Drop ${sp.title}`}
                              title="Abandon plan"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <h3 className="text-sm font-medium text-foreground">
                            {sp.title}
                          </h3>
                          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                            {sp.intent}
                          </p>
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(sp.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 text-foreground transition-transform group-hover:translate-x-0.5">
                            Open
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
          </>
        )}

        {hasMore && (
          <Button
            variant="ghost"
            className="relative z-10 mt-4 self-start"
            disabled={loading}
            onClick={() => void loadMore()}
          >
            {loading ? "Loading plans…" : "Load more plans"}
          </Button>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent
            aria-describedby={undefined}
            className="gap-5 p-6 sm:max-w-lg"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Create a plan
              </DialogTitle>
            </DialogHeader>

            {createError && (
              <Alert variant="destructive">
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            {creating && (
              <Alert>
                <RotateCw className="animate-spin" />
                <AlertDescription>
                  Preparing your research workspace…
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={(e) => void handleCreate(e)} className="space-y-5">
              <div className="space-y-2">
                <Textarea
                  id="space-intent"
                  aria-label="Intent"
                  autoFocus
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="What are you thinking about?"
                  rows={4}
                  className="min-h-28 resize-none py-2.5 leading-relaxed"
                  disabled={creating}
                  required
                />
              </div>

              <label className="grid gap-2 text-xs">
                Attach to project (optional)
                <select
                  aria-label="Attach to project"
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  disabled={creating}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value=""></option>
                  {projectOptions.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {projectOptions.hasMore && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={creating || projectOptions.loading}
                  onClick={() => void projectOptions.loadMore()}
                >
                  {projectOptions.loading
                    ? "Loading projects…"
                    : "Load more projects"}
                </Button>
              )}
              {projectOptions.error && (
                <p className="text-xs text-destructive">
                  {projectOptions.error}
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={creating}
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !intent.trim()}
                  size="sm"
                  className="gap-1.5"
                >
                  {creating ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Create plan</span>
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageBody>
    </PageContainer>
  );
}
