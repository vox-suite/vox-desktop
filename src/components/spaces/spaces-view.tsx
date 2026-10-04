import { useState } from "react";
import {
  Compass,
  Plus,
  RotateCw,
  Sparkles,
  ArrowRight,
  Trash2,
  Calendar,
  Boxes,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSpaces } from "@/hooks/use-spaces";
import { useSpace } from "@/hooks/use-space";
import { SpaceCanvas } from "@/components/spaces/space-canvas";

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

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-background p-4 text-foreground sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-foreground" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Spaces
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Visual ideation and decision boards connected to your timeline, spend, and goals
          </p>
        </div>

        <Button
          onClick={() => {
            setCreateError("");
            setShowCreateDialog(true);
          }}
          className="bg-primary hover:bg-primary text-foreground gap-1.5 shadow-sm text-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Space</span>
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && spaces.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-2xl border border-border bg-card p-4 mb-4">
            <Boxes className="h-10 w-10 text-foreground" />
          </div>
          <h3 className="text-base font-semibold text-muted-foreground">
            No spaces created yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            Start a space to explore trips, fitness routines, or major decisions. Vox will query your past data and research options visually.
          </p>
          <Button
            onClick={() => {
              setCreateError("");
              setShowCreateDialog(true);
            }}
            className="mt-5 bg-primary hover:bg-primary text-foreground text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Create First Space</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((sp) => (
            <Card
              key={sp.id}
              onClick={() => setSelectedSpaceId(sp.id)}
              className="group relative flex flex-col justify-between border-border bg-card hover:bg-accent hover:border-ring p-5 transition-all duration-200 cursor-pointer rounded-xl backdrop-blur-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                        sp.state === "committed"
                          ? "border-border bg-muted text-muted-foreground"
                          : "border-ring bg-primary/10 text-foreground"
                      }`}
                    >
                      {sp.state}
                    </span>
                    {sp.run_state === "running" && (
                      <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                        <RotateCw className="h-2.5 w-2.5 animate-spin" />
                        running
                      </span>
                    )}
                  </div>

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

                <h3 className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors">
                  {sp.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {sp.intent}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(sp.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 font-medium text-foreground group-hover:translate-x-0.5 transition-transform">
                  <span>Open Space</span>
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
              Describe what you are thinking of doing. Vox will architect a dedicated agent, inspect your spending and calendar, and build a visual flow.
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
                Architecting space with AI… querying schemas and building spec
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
                  <span>Architect Space</span>
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
