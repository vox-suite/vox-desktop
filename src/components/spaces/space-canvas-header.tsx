import { PlanProjectLink } from "@/components/projects/plan-project-link";
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  MessageSquare,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-container";
import type { SpaceGraph, SpaceNode } from "@/features/spaces/types";

export function SpaceCanvasHeader({
  graph,
  loading,
  committing,
  canCommit,
  selectedNode,
  chatOpen,
  onBack,
  onStop,
  onRetryNode,
  onToggleChat,
  onOpenCommitDialog,
  progress,
}: {
  graph: SpaceGraph;
  loading: boolean;
  committing: boolean;
  canCommit: boolean;
  selectedNode: SpaceNode | null;
  chatOpen: boolean;
  onBack: () => void;
  onStop: () => void;
  onRetryNode: () => void;
  onToggleChat: () => void;
  onOpenCommitDialog: () => void;
  progress: { done: number; total: number };
}) {
  const isCommitted = graph.space.state === "committed";

  const running = graph.space.run_state === "running";
  const segments = Math.min(progress.total, 14);
  const filled = progress.total
    ? Math.round((progress.done / progress.total) * segments)
    : 0;

  return (
    <PageHeader className="z-10 flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 py-0 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to Plans"
          className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {graph.space.title}
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                isCommitted
                  ? "bg-white/[0.06] text-muted-foreground"
                  : "bg-[#f5b83d]/15 text-[#f5d48a]"
              }`}
            >
              {graph.space.state}
            </span>
            {running && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#f5d48a]">
                <span className="size-1.5 animate-pulse rounded-full bg-[#f5b83d]" />
                live
              </span>
            )}
            {loading && (
              <RotateCw className="size-3 animate-spin text-muted-foreground" />
            )}
          </div>
          {progress.total > 0 && (
            <div
              className="mt-1.5 flex items-center gap-2"
              aria-label={`${progress.done} of ${progress.total} steps done`}
            >
              <div className="flex gap-[3px]">
                {Array.from({ length: segments }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-3.5 rounded-full ${i < filled ? "bg-[#4ade80]" : "bg-white/10"}`}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <PlanProjectLink
          key={graph.space.id}
          planId={graph.space.id}
          projectId={graph.space.project_id}
          running={running}
        />
        {running && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStop}
            className="rounded-xl"
          >
            Stop
          </Button>
        )}
        {selectedNode &&
          ["failed", "blocked", "cancelled"].includes(
            String(
              (selectedNode.data.execution as { status?: string } | undefined)
                ?.status,
            ),
          ) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryNode}
              className="rounded-xl"
            >
              Retry node
            </Button>
          )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleChat}
          className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
          title={chatOpen ? "Hide chat" : "Show chat"}
          aria-label={chatOpen ? "Hide chat" : "Show chat"}
        >
          <MessageSquare className="size-4" />
        </Button>
        {isCommitted ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="size-4" />
            <span className="hidden sm:inline">Committed to Timeline</span>
            <span className="sm:hidden">Committed</span>
          </div>
        ) : (
          <Button
            onClick={onOpenCommitDialog}
            disabled={committing || !canCommit}
            size="sm"
            className="gap-1.5 rounded-xl bg-[#f5b83d] text-xs font-medium text-black hover:bg-[#f8c75e] disabled:bg-white/10 disabled:text-muted-foreground"
          >
            {committing ? (
              <RotateCw className="size-3.5 animate-spin" />
            ) : (
              <Flag className="size-3.5" />
            )}
            <span className="hidden sm:inline">Commit to Timeline</span>
            <span className="sm:hidden">Commit</span>
          </Button>
        )}
      </div>
    </PageHeader>
  );
}
