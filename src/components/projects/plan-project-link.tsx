import { useState } from "react";
import { Folder, Link } from "lucide-react";
import { useProjectOptions } from "@/features/projects/use-project-options";
import { projectsApi } from "@/features/projects/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { desktopStore } from "@/features/desktop-control/store";
export function PlanProjectLink({
  planId,
  projectId,
  running,
}: {
  planId: string;
  projectId: string | null;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [attached, setAttached] = useState(projectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = useProjectOptions(open);
  const id = attached ?? projectId;
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={id ? "Open attached project" : "Attach plan to a project"}
        title={id ? "Open project" : "Attach to project"}
        onClick={() => {
          if (id) desktopStore.patch({ page: "projects", projectId: id });
          else setOpen(true);
        }}
      >
        {id ? <Folder className="size-4" /> : <Link className="size-4" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach to a project</DialogTitle>
            <DialogDescription>
              {running
                ? "Stop this Plan before changing its project context."
                : "Future iterations will receive the project’s current context snapshot."}
            </DialogDescription>
          </DialogHeader>
          <select
            aria-label="Project"
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">
              {options.loading ? "Loading projects…" : "Choose project"}
            </option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {(error || options.error) && (
            <p role="alert" className="text-xs text-destructive">
              {error || options.error}
            </p>
          )}
          <Button
            disabled={busy || running || !choice}
            onClick={() => {
              setBusy(true);
              void projectsApi
                .attach(choice, planId)
                .then(() => {
                  setAttached(choice);
                  setOpen(false);
                })
                .catch((e) => setError(String(e)))
                .finally(() => setBusy(false));
            }}
          >
            Attach plan
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
