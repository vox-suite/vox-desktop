import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTotal } from "@/features/pulse/format";
import {
  goalsApi,
  type GoalStatus,
  type GoalView,
} from "@/features/pulse/goals";

const TICKS = 48;
const statusText: Record<GoalStatus, string> = {
  done: "Done",
  ahead: "Ahead of pace",
  on_track: "On track",
  behind: "Behind pace",
  in_progress: "In progress",
  within_limit: "Within limit",
  over_limit: "Over the limit",
  unavailable: "Unavailable",
};
const statusColor: Record<GoalStatus, string> = {
  done: "#3ecf8e",
  ahead: "#3ecf8e",
  on_track: "#3ecf8e",
  behind: "#e5a04c",
  in_progress: "#a0a0a0",
  within_limit: "#3ecf8e",
  over_limit: "#e06c6c",
  unavailable: "#a0a0a0",
};
const fmt = (value: number, unit: string) => {
  const f = formatTotal(value, unit);
  return f.unit ? `${f.text} ${f.unit}` : f.text;
};
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

function details(g: GoalView): string[] {
  const out: string[] = [];
  if (g.error) return [g.error];
  if (g.direction === "at_most") {
    out.push(
      g.status === "over_limit"
        ? `${fmt(g.current - g.target, g.unit)} over`
        : `${fmt(g.remaining, g.unit)} left`,
    );
  } else if (g.status !== "done") {
    out.push(`${fmt(g.remaining, g.unit)} to go`);
  }
  if (g.period) {
    out.push(
      `this ${g.period}${g.period_ends_on ? ` · ends ${shortDate(g.period_ends_on)}` : ""}`,
    );
  } else if (g.deadline) {
    out.push(
      `by ${shortDate(g.deadline)}${g.days_left != null ? ` · ${g.days_left} days left` : ""}`,
    );
  }
  if (g.per_week_needed && g.status !== "done")
    out.push(`need ${fmt(g.per_week_needed, g.unit)} a week`);
  if (g.projected_on && !g.deadline)
    out.push(`on pace for ${shortDate(g.projected_on)}`);
  else if (g.projected_on && g.status === "behind")
    out.push(`at this pace: ${shortDate(g.projected_on)}`);
  return out;
}

export function GoalCard({
  goal,
  onChange,
  onRemove,
  preview = false,
}: {
  goal: GoalView;
  onChange?: (goal: GoalView) => void;
  onRemove?: () => void;
  preview?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filled = Math.round((Math.min(goal.percent, 100) / 100) * TICKS);
  const color = statusColor[goal.status];

  async function contribute() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      onChange?.(await goalsApi.addEntry(goal.id, value));
      setAmount("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="pulse-chart h-full gap-3 overflow-visible p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{goal.title}</h3>
          <p className="mt-1 text-xs" style={{ color }}>
            {statusText[goal.status]}
          </p>
        </div>
        {!preview && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete goal"
            onClick={() => {
              if (window.confirm(`Delete “${goal.title}”?`)) onRemove();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="font-mono text-3xl tracking-tight">
        {fmt(goal.current, goal.unit)}
        <span className="ml-2 text-sm text-muted-foreground">
          of {fmt(goal.target, goal.unit)}
        </span>
      </p>
      <div
        className="flex h-6 items-end gap-[3px]"
        role="progressbar"
        aria-valuenow={Math.round(goal.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${goal.title} progress`}
      >
        {Array.from({ length: TICKS }, (_, i) => (
          <span
            key={i}
            className="h-full flex-1"
            style={{
              background: i < filled ? color : "#2a2a2a",
              width: 1,
              maxWidth: 1,
            }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {details(goal).join(" · ")}
      </p>
      {goal.kind === "saving" && !preview && (
        <form
          className="mt-auto flex gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void contribute();
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={`Add ${goal.unit}`}
            aria-label={`Add to ${goal.title}`}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none"
          />
          <Button type="submit" size="sm" disabled={busy || !amount}>
            Add
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
