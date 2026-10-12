import { projectList } from "@/features/projects/list-cache";
import { useCallback, useEffect, useState } from "react";
import {
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
      <PageHeader className="h-16">
        <div className="flex items-center gap-3">
          <Folder className="size-5" />
          <div>
            <h1 className="text-base font-medium">Projects</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {count === null
                ? "Context that stays with your work"
                : `${count} ${count === 1 ? "project" : "projects"}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh projects"
            onClick={() => void reload()}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => start("import")}>
            <FolderInput className="size-3.5" />
            Import project
          </Button>
          <Button size="sm" onClick={() => start("new")}>
            <Plus className="size-3.5" />
            New project
          </Button>
        </div>
      </PageHeader>
      <PageBody>
        <div className="project-library">
          {error && (
            <p role="alert" className="mb-5 text-sm text-destructive">
              {error}
            </p>
          )}
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="project-start">
              <div className="project-empty-mark">
                <Folder className="size-6" />
              </div>
              <h2 className="mt-6 text-2xl font-medium tracking-tight">
                A home for your project.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                Bring your code and notes, or start with an idea. Your sources,
                diagrams and decisions stay together.
              </p>
              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                <button
                  className="project-entry"
                  onClick={() => start("import")}
                >
                  <FolderInput className="size-5" />
                  <h3 className="mt-5 text-base font-medium">
                    Bring an existing project
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Connect local folders and files. Explore the structure,
                    inspect sources, and plan your next change.
                  </p>
                  <span className="mt-5 block text-xs">Import project</span>
                </button>
                <button className="project-entry" onClick={() => start("new")}>
                  <Plus className="size-5" />
                  <h3 className="mt-5 text-base font-medium">
                    Start with an idea
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Keep a brief and your decisions together. Add sources as
                    your project takes shape.
                  </p>
                  <span className="mt-5 block text-xs">New project</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="project-library-heading">
                <div>
                  <h2>Your projects</h2>
                  <p>Pick up where you left off.</p>
                </div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    aria-label="Find projects"
                    placeholder="Find a project"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="project-library-grid">
                {items
                  .filter((p) =>
                    `${p.name} ${p.data.notes}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onOpen={() => open(p)}
                    />
                  ))}
              </div>
              {items.every(
                (p) =>
                  !`${p.name} ${p.data.notes}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              ) && (
                <p className="project-quiet-empty">
                  No projects match “{search}”.
                </p>
              )}
              {next && (
                <Button
                  variant="ghost"
                  disabled={loading}
                  className="mt-4"
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
            </>
          )}
        </div>
      </PageBody>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setMode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "import" ? "Import a project" : "New project"}
            </DialogTitle>
            <DialogDescription>
              {mode === "import"
                ? "Name the project, then choose local sources in its Sources tab. Nothing is uploaded during indexing."
                : "Give your idea a home. You can add sources whenever you’re ready."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="grid gap-2 text-xs">
              Project name
              <Input
                autoFocus
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What are you working on?"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Vision or notes
              <Textarea
                maxLength={12000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Optional project notes"
              />
            </label>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={creating}
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating
                  ? "Creating project…"
                  : mode === "import"
                    ? "Choose sources"
                    : "Create project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
