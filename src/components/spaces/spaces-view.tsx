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
      <div className="flex h-full w-full items-center justify-center bg-[#090a0f] text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <RotateCw className="h-8 w-8 animate-spin text-indigo-400" />
          <span className="text-xs text-zinc-400">Loading space…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#090a0f] p-6 text-zinc-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Spaces
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Visual ideation and decision boards connected to your timeline, spend, and goals
          </p>
        </div>

        <Button
          onClick={() => {
            setCreateError("");
            setShowCreateDialog(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-sm text-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Space</span>
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading && spaces.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-20 text-zinc-500">
          <RotateCw className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : spaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 mb-4">
            <Boxes className="h-10 w-10 text-indigo-400/80" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">
            No spaces created yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-zinc-400 leading-relaxed">
            Start a space to explore trips, fitness routines, or major decisions. Vox will query your past data and research options visually.
          </p>
          <Button
            onClick={() => {
              setCreateError("");
              setShowCreateDialog(true);
            }}
            className="mt-5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
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
              className="group relative flex flex-col justify-between border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-indigo-500/40 p-5 transition-all duration-200 cursor-pointer rounded-xl backdrop-blur-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                        sp.state === "committed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                      }`}
                    >
                      {sp.state}
                    </span>
                    {sp.run_state === "running" && (
                      <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                        <RotateCw className="h-2.5 w-2.5 animate-spin" />
                        running
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void drop(sp.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                    title="Drop Space"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                  {sp.title}
                </h3>
                <p className="mt-1.5 text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                  {sp.intent}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(sp.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 font-medium text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Space</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-indigo-400 mb-1">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                New Vision
              </span>
            </div>
            <h2 className="text-lg font-bold text-zinc-100">
              Create a Space
            </h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Describe what you are thinking of doing. Vox will architect a dedicated agent, inspect your spending and calendar, and build a visual flow.
            </p>

            {createError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                {createError}
              </div>
            )}

            {creating && (
              <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-300 flex items-center gap-2">
                <RotateCw className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                <span>Architecting space with AI… querying schemas and building spec</span>
              </div>
            )}

            <form onSubmit={(e) => void handleCreate(e)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekend getaway near Bangalore"
                  disabled={creating}
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Vision & Intent
                </label>
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="e.g. Planning a short trip with a friend this weekend. Avoid crowded places, check my recent expenditure to estimate a realistic budget, and give me a few options with pros, cons, and driving time."
                  rows={4}
                  disabled={creating}
                  required
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed disabled:opacity-60"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={creating}
                  onClick={() => setShowCreateDialog(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !title.trim() || !intent.trim()}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
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
          </div>
        </div>
      )}
    </div>
  );
}
