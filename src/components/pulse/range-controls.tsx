import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Bucket, PulseDefinition } from "@/features/pulse/discovery-types";

const ranges = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];
const fmt = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
function windowLabel(d: PulseDefinition) {
  const end = new Date();
  end.setDate(end.getDate() - (d.offset_days ?? 0));
  const start = new Date(end);
  start.setDate(start.getDate() - (d.period_days - 1));
  return `${fmt(start)} – ${fmt(end)}`;
}

export function RangeControls({
  definition,
  buckets = [],
  onChange,
}: {
  definition: PulseDefinition;
  buckets?: Bucket[];
  onChange: (change: Partial<PulseDefinition>) => void;
}) {
  if (!definition.bucket) return null;
  const offset = definition.offset_days ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="pulse-seg" role="group" aria-label="Range">
        {ranges.map((r) => (
          <button
            key={r.days}
            aria-pressed={definition.period_days === r.days}
            onClick={() =>
              onChange({
                period_days: r.days,
                offset_days: 0,
                bucket:
                  r.days > 60 && definition.bucket === "day"
                    ? "week"
                    : definition.bucket,
              })
            }
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Earlier"
          onClick={() =>
            onChange({ offset_days: offset + definition.period_days })
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-28 text-center font-mono">
          {windowLabel(definition)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Later"
          disabled={offset === 0}
          onClick={() =>
            onChange({
              offset_days: Math.max(0, offset - definition.period_days),
            })
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {buckets.length > 1 && (
        <div className="pulse-seg" role="group" aria-label="Group by">
          {buckets.map((b) => (
            <button
              key={b}
              aria-pressed={definition.bucket === b}
              onClick={() => onChange({ bucket: b })}
            >
              {b[0].toUpperCase() + b.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
