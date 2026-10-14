import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReadyPlan } from "@/hooks/use-plan-announcer";

export function PlanReadyPrompt({
  plan,
  onTellMe,
  onView,
  onDismiss,
}: {
  plan: ReadyPlan | null;
  onTellMe: () => void;
  onView: () => void;
  onDismiss: () => void;
}) {
  if (!plan) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-line bg-panel/95 p-4 shadow-float backdrop-blur-xl"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Flag className="size-3.5 text-gold" />
        Plan ready
      </div>
      <p className="mt-2 text-sm font-medium">{plan.title || "Your Space"}</p>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {plan.summary || "Your plan has been finalized."}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="h-8 rounded-full bg-gold px-3 text-xs text-on-accent hover:bg-gold/85"
          onClick={onTellMe}
        >
          Tell me
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 rounded-full px-3 text-xs"
          onClick={onView}
        >
          View plan
        </Button>
      </div>
    </div>
  );
}
