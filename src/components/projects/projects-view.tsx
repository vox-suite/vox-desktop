import { projectList } from "@/features/projects/list-cache";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Folder,
  FolderInput,
  Plus,
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { projectsApi } from "@/features/projects/api";
import { initialData } from "@/features/projects/context";
import type { Project } from "@/features/projects/types";
import { platform } from "@/platform";
import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import { ProjectDetail, ProjectCard } from "./project-detail";
import { ProjectIllustration } from "./project-illustration";
import { StateCard } from "@/components/state-card";
import "./projects.css";
export function ProjectsView() {
  const id = useDesktopContext().projectId;
  const [items, setItems] = useState<Project[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"import" | "new" | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [initialTab, setInitialTab] = useState("context");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await projectList();
      setCount(list.count);
      setItems(list.items);
      setNext(list.next_cursor);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void reload());
    return platform().live.subscribe((e) => {
      if (e.type === "project_updated") void reload();
    });
  }, [reload]);
  const open = (p: Project) => {
    setInitialTab("context");
    desktopStore.patch({
      projectId: p.id,
      page: "projects",
      selectedItemId: null,
    });
  };
  const start = (m: "import" | "new") => {
    setMode(m);
    setName("");
    setNotes("");
    setError("");
  };
  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const p = await projectsApi.create(name.trim(), initialData(notes));
      setMode(null);
      setInitialTab(mode === "import" ? "sources" : "context");
      desktopStore.patch({
        projectId: p.id,
        page: "projects",
        selectedItemId: null,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };
  if (id)
    return (
      <ProjectDetail
        key={id}
        id={id}
        initialTab={initialTab}
        onBack={() => {
          desktopStore.patch({ projectId: null, selectedItemId: null });
          void reload();
        }}
      />
    );
  return (
    <PageContainer>
      <PageHeader className="h-16 px-6 py-0">
        <div className="flex items-center gap-3.5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <Folder className="size-[18px] text-pink" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight">Projects</h1>
            <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
              {count === null
                ? "Context that stays with your work"
                : `${count} ${count === 1 ? "project" : "projects"}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(items.length > 0 || search) && (
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                aria-label="Find projects"
                placeholder="Find a project"
                className="h-8 rounded-lg pl-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label="Refresh projects"
            onClick={() => void reload()}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 rounded-lg px-3 text-xs"
            onClick={() => start("import")}
          >
            <FolderInput className="size-3.5" />
            Import project
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-3 text-xs"
            onClick={() => start("new")}
          >
            <Plus className="size-3.5" />
            New project
          </Button>
        </div>
      </PageHeader>
      <PageBody scroll className="flex flex-col p-6">
        {error && (
          <p role="alert" className="mb-5 text-sm text-destructive">
            {error}
          </p>
        )}
        {loading && items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <StateCard
              loading
              tall
              accent="pink"
              figure={<ProjectIllustration />}
              kicker="Projects"
              title="Loading projects…"
              text="Gathering your sources, diagrams and decisions."
            />
          </div>
        ) : items.length === 0 ? (
          <div className="start">
            <header className="start-head">
              <div>
                <p className="start-kicker">Getting started</p>
                <h2 className="mt-3 text-[28px] font-medium leading-tight tracking-tight">
                  A home for your project.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Bring your code and notes, or start with an idea. Your sources,
                diagrams and decisions stay together.
              </p>
            </header>
            <div className="start-bento">
              <button
                className="start-tile start-tile-feature"
                onClick={() => start("import")}
              >
                <div className="start-tile-art">
                  <ProjectIllustration />
                </div>
                <div className="start-tile-body">
                  <span className="start-tile-icon">
                    <FolderInput className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-medium">
                      Bring an existing project
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      Connect local folders and files. Explore the structure,
                      inspect sources, and plan your next change.
                    </p>
                  </div>
                  <span className="start-tile-cta start-tile-cta-primary">
                    Import project
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </button>
              <button className="start-tile" onClick={() => start("new")}>
                <div className="start-panel" aria-hidden="true">
                  <span className="start-panel-title">Untitled idea</span>
                  <span className="start-line w-[82%]" />
                  <span className="start-line w-[64%]" />
                  <span className="start-line w-[71%]" />
                  <span className="start-caret" />
                </div>
                <span className="start-tile-icon">
                  <Plus className="size-4" />
                </span>
                <h3 className="mt-4 text-base font-medium">
                  Start with an idea
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Keep a brief and your decisions together. Add sources as your
                  project takes shape.
                </p>
                <span className="start-tile-cta mt-5">
                  New project
                  <ArrowRight className="size-3.5" />
                </span>
              </button>
              <div className="start-tile start-tile-preview">
                <div className="start-ghosts" aria-hidden="true">
                  {[0, 1].map((n) => (
                    <div key={n} className="start-ghost">
                      <span className="start-ghost-mark" />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <span className="start-line w-[58%]" />
                        <span className="start-line w-[86%] opacity-60" />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Your projects will collect here, each with its sources,
                  diagrams and decisions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items
                .filter((p) =>
                  `${p.name} ${p.data.notes}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((p) => (
                  <ProjectCard key={p.id} project={p} onOpen={() => open(p)} />
                ))}
            </div>
            {items.every(
              (p) =>
                !`${p.name} ${p.data.notes}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            ) && (
              <p className="project-quiet-empty py-16 text-center text-sm text-muted-foreground">
                No projects match “{search}”.
              </p>
            )}
            {next && (
              <Button
                variant="ghost"
                disabled={loading}
                className="mt-4 self-start"
                onClick={() => {
                  setLoading(true);
                  void projectsApi
                    .list(next)
                    .then((list) => {
                      setItems((old) => [
                        ...old,
                        ...list.items.filter(
                          (p) => !old.some((o) => o.id === p.id),
                        ),
                      ]);
                      setNext(list.next_cursor);
                    })
                    .catch((e) => setError(String(e)))
                    .finally(() => setLoading(false));
                }}
              >
                Load more projects
              </Button>
            )}
          </div>
        )}
      </PageBody>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setMode(null);
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          <DialogHeader className="flex-row items-start gap-3.5 p-5 pr-12">
            <span className="start-tile-icon size-10">
              {mode === "import" ? (
                <FolderInput className="size-[18px]" />
              ) : (
                <Plus className="size-[18px]" />
              )}
            </span>
            <div className="grid gap-1">
              <DialogTitle className="text-base">
                {mode === "import" ? "Import a project" : "New project"}
              </DialogTitle>
              <DialogDescription className="leading-5">
                {mode === "import"
                  ? "Name it here, then pick local folders and files. Nothing is uploaded while indexing."
                  : "Give your idea a home. Add sources whenever you’re ready."}
              </DialogDescription>
            </div>
          </DialogHeader>
          {mode === "import" && (
            <ol className="mx-5 mb-4 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
              <li className="flex items-center gap-1.5 text-foreground">
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                  1
                </span>
                Name
              </li>
              <li aria-hidden="true" className="h-px w-6 bg-border" />
              <li className="flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full border border-border text-[9px]">
                  2
                </span>
                Choose sources
              </li>
            </ol>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void create();
              }
            }}
          >
            <div className="grid gap-4 px-5 pb-5">
              <label className="grid gap-2 text-xs font-medium">
                Project name
                <Input
                  autoFocus
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What are you working on?"
                  className="h-10 text-sm"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium">
                <span className="flex items-baseline justify-between">
                  {mode === "import" ? "Notes" : "Vision"}
                  <span className="font-normal text-muted-foreground">
                    Optional
                  </span>
                </span>
                <Textarea
                  maxLength={12000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder={
                    mode === "import"
                      ? "What should Vox know about this codebase?"
                      : "What are you trying to build, and why?"
                  }
                  className="min-h-24 resize-none text-sm"
                />
              </label>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
              <span className="hidden font-mono text-[10.5px] text-muted-foreground sm:inline">
                ⌘ ↵ to {mode === "import" ? "continue" : "create"}
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={creating}
                  onClick={() => setMode(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="gap-1.5"
                >
                  {creating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {creating
                    ? "Creating…"
                    : mode === "import"
                      ? "Choose sources"
                      : "Create project"}
                  {!creating && <ArrowRight className="size-3.5" />}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
