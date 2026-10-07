import {
  ArrowLeft,
  CheckCircle2,
  Compass,
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
}) {
  const isCommitted = graph.space.state === "committed";

  return (
    <PageHeader className="z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5 backdrop-blur-md sm:px-5 sm:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground p-1.5 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-foreground" />
            <h1 className="truncate text-base font-bold text-foreground">
              {graph.space.title}
            </h1>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                isCommitted
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-ring bg-primary/10 text-foreground"
              }`}
            >
              {graph.space.state}
            </span>
            {graph.space.run_state === "running" && (
              <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                <RotateCw className="h-2.5 w-2.5 animate-spin" />
                running
              </span>
            )}
            {loading && (
              <RotateCw className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {graph.space.run_state === "running" && (
          <Button variant="outline" size="sm" onClick={onStop}>
            Stop
          </Button>
        )}
        {selectedNode &&
          ["failed", "blocked", "cancelled"].includes(
            String(
              (
                selectedNode.data.execution as
                  { status?: string } | undefined
              )?.status,
            ),
          ) && (
            <Button variant="outline" size="sm" onClick={onRetryNode}>
              Retry node
            </Button>
          )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleChat}
          className="h-8 w-8 p-1.5 text-muted-foreground hover:text-foreground"
          title={chatOpen ? "Hide chat" : "Show chat"}
          aria-label={chatOpen ? "Hide chat" : "Show chat"}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
        {isCommitted ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted border border-border px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Committed to Timeline</span>
            <span className="sm:hidden">Committed</span>
          </div>
        ) : (
          <Button
            onClick={onOpenCommitDialog}
            disabled={committing || !canCommit}
            size="sm"
            className="bg-muted hover:bg-muted text-foreground font-medium gap-1.5 text-xs shadow-sm"
          >
            {committing ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Flag className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Commit to Timeline</span>
            <span className="sm:hidden">Commit</span>
          </Button>
        )}
      </div>
    </PageHeader>
  );
}
