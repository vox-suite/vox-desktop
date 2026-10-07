import { CheckCircle2, Flag, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CommitSpaceResult,
  SpaceGraph,
  SpaceNode,
} from "@/features/spaces/types";

export function CommitSpaceDialog({
  open,
  onOpenChange,
  graph,
  committableNodes,
  committing,
  commitResult,
  setCommitResult,
  onCommit,
  onBack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graph: SpaceGraph;
  committableNodes: SpaceNode[];
  committing: boolean;
  commitResult: CommitSpaceResult | null;
  setCommitResult: (res: CommitSpaceResult | null) => void;
  onCommit: () => Promise<unknown>;
  onBack: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            {commitResult ? "Space Committed" : "Commit to Timeline"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {commitResult
              ? `Created ${commitResult.committed_spans_count} spans in your timeline.`
              : `This will create spans in a new collection for all completed plan and step nodes.`}
          </DialogDescription>
        </DialogHeader>

        {commitResult ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <span className="font-semibold">Successfully committed!</span>
                <p className="mt-1 text-muted-foreground/90">
                  {commitResult.committed_spans_count} spans created under
                  collection{" "}
                  <span className="font-medium underline">
                    "{graph.space.title}"
                  </span>
                  .
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onBack();
                }}
                className="bg-primary hover:bg-primary text-foreground text-xs"
              >
                Back to Spaces
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="text-xs">
              <span className="font-medium text-muted-foreground">
                Collection Name:{" "}
              </span>
              <span className="font-semibold text-foreground">
                {graph.space.title}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Spans to create ({committableNodes.length}):
              </span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-card p-2.5">
                {committableNodes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs bg-card border border-border"
                  >
                    <span className="rounded bg-primary/15 text-foreground border border-ring px-1.5 py-0.2 font-mono text-[10px] uppercase">
                      {n.kind}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {n.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const res = await onCommit();
                  if (res) {
                    setCommitResult(res as CommitSpaceResult);
                  }
                }}
                disabled={committing}
                className="bg-muted hover:bg-muted text-foreground text-xs gap-1.5"
              >
                {committing ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Flag className="h-3.5 w-3.5" />
                )}
                <span>Confirm & Commit</span>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
