import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalCard } from "@/components/pulse/goal-card";
import { formatTotal } from "@/features/pulse/format";
import { goalsApi, type GoalView } from "@/features/pulse/goals";
import { spacesApi } from "@/features/spaces/api";
import type { SpaceNode } from "@/features/spaces/types";

type Proposal = {
  title: string;
  kind: "saving" | "metric";
  direction?: "at_least" | "at_most";
  period?: "week" | "month" | null;
  target: number;
  unit?: string | null;
  deadline?: string | null;
  status?: string;
};

const money = (value: number, unit?: string | null) => {
  const f = formatTotal(value, unit ?? "");
  return f.unit ? `${f.text} ${f.unit}` : f.text;
};

function describe(p: Proposal) {
  const verb = p.direction === "at_most" ? "Stay under" : "Reach";
  const when = p.period
    ? `each ${p.period}`
    : p.deadline
      ? `by ${new Date(`${p.deadline}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : "";
  return `${verb} ${money(p.target, p.unit)} ${when}`.trim();
}

/** A goal the agent proposed on this node, or the Pulse goal it became after approval. */
export function NodeGoal({
  spaceId,
  node,
}: {
  spaceId: string;
  node: SpaceNode;
}) {
  const proposal = node.data.goal_proposal as Proposal | undefined;
  const goalId =
    typeof node.data.goal_id === "string" ? node.data.goal_id : null;
  const [goal, setGoal] = useState<GoalView | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!goalId) return;
    let active = true;
    void goalsApi
      .list()
      .then((all) => {
        if (!active) return;
        const found = all.find((g) => g.id === goalId) ?? null;
        setGoal(found);
        setMissing(!found);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [goalId]);

  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await spacesApi.approveNodeGoal(spaceId, node.id);
      setGoal(res.goal);
    } catch (e) {
      setError(
        String(e).includes("422")
          ? "Couldn’t create this goal from your data. Edit the plan and ask the agent to propose it again."
          : String(e),
      );
    } finally {
      setBusy(false);
    }
  }

  if (goal)
    return (
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Target className="h-3 w-3" /> Linked goal
        </p>
        <GoalCard goal={goal} onChange={setGoal} />
      </div>
    );
  if (goalId && missing)
    return (
      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        The goal linked to this node was removed.
      </p>
    );
  if (!proposal || proposal.status === "approved") return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <Target className="h-3 w-3" /> Goal proposed
      </p>
      <p className="text-sm font-medium">{proposal.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{describe(proposal)}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Nothing is tracked until you approve it.
      </p>
      <Button
        size="sm"
        className="mt-3 h-7 w-full text-xs"
        disabled={busy}
        onClick={() => void approve()}
      >
        {busy ? "Creating…" : "Create goal"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
