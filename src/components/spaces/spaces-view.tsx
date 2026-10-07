import "./spaces.css";
import { useState } from "react";
import {
  Plus,
  RotateCw,
  Sparkles,
  ArrowRight,
  Trash2,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSpaces } from "@/hooks/use-spaces";
import { useSpace } from "@/hooks/use-space";
import { SpaceCanvas } from "@/components/spaces/space-canvas";
import { SpacesOrbit } from "./spaces-orbit";

export function SpacesView() {
  const { spaces, loading, error, reload, create, drop } = useSpaces();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const currentSpace = useSpace(selectedSpaceId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !intent.trim() || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const created = await create(title.trim(), intent.trim());
      setTitle("");
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
          <span className="text-xs text-muted-foreground">Loading space…</span>
        </div>
      </div>
    );
  }

  const openCreate = () => {
    setCreateError("");
    setShowCreateDialog(true);
  };
  const stateDot = (state: string, running: boolean) =>
    running ? "#ff5a67" : state === "committed" ? "#cfe3f1" : "#f5b83d";

  return (
    <div className="spaces-workbench spaces-library relative flex h-full w-full flex-col overflow-x-hidden overflow-y-auto bg-black p-6 text-foreground">
      <SpacesOrbit />
      <header className="relative z-10 mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Vox / Spaces
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">Spaces</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Explore an idea. Compare options. Build a plan.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="gap-1.5 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>New space</span>
        </Button>
      </header>

      {error && (
        <div className="relative z-10 mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && spaces.length === 0 ? (
        <div className="relative z-10 flex flex-1 items-center justify-center py-20">
          <RotateCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="relative z-10 flex flex-1 flex-col justify-center py-16">
          <div className="max-w-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              00 spaces
            </p>
            <h2 className="mt-3 text-3xl font-medium tracking-tight">
              Map out a decision.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Start a space to explore trips, fitness routines or big decisions.
              Vox reads your past data and lays the options out around your
              goal.
            </p>
            <Button
              onClick={openCreate}
              className="mt-6 gap-1.5 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Create first space</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((sp) => (
            <Card
              key={sp.id}
              onClick={() => setSelectedSpaceId(sp.id)}
              className="group relative flex cursor-pointer flex-col justify-between rounded-lg border-border bg-black/70 p-5 backdrop-blur transition-colors duration-200 hover:border-ring"
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
                    {sp.run_state === "running" ? "running" : sp.state}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      void drop(sp.id);
                    }}
                    className="opacity-0 group-hover:opacity-100"
                    title="Drop Space"
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
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Create a Space
            </DialogTitle>
            <DialogDescription>
              Describe what you are thinking of doing. Vox will research options
              using your available data and build a visual plan.
            </DialogDescription>
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

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div>
              <Label htmlFor="space-title">Title</Label>
              <Input
                id="space-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekend getaway near Bangalore"
                disabled={creating}
                required
              />
            </div>

            <div>
              <Label htmlFor="space-intent">Vision &amp; Intent</Label>
              <Textarea
                id="space-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="e.g. Planning a short trip with a friend this weekend. Avoid crowded places, check my recent expenditure to estimate a realistic budget, and give me a few options with pros, cons, and driving time."
                rows={4}
                disabled={creating}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
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
                disabled={creating || !title.trim() || !intent.trim()}
                size="sm"
                className="gap-1.5"
              >
                {creating ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Create Space</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
