import { useMemo } from "react";
import { monthGridDays, startOfDay } from "@/lib/span-layout";
import { categoryColor } from "@/lib/span-format";
import { dayKey } from "@/features/spans/day-store";
import type { SpanDaySummary } from "@/features/spans/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_SEGMENTS = 5;

export function SpanMonthCounts({
  anchorDate,
  counts,
  loading,
  onSelectDay,
}: {
  anchorDate: Date;
  counts: Map<string, SpanDaySummary>;
  loading: boolean;
  onSelectDay: (day: Date) => void;
}) {
  const gridDays = useMemo(() => monthGridDays(anchorDate), [anchorDate]);
  const today = startOfDay(new Date()).getTime();
  const month = anchorDate.getMonth();
  const peak = Math.max(1, ...[...counts.values()].map((c) => c.count));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background select-none">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((name) => (
          <div
            key={name}
            className="py-2.5 text-center font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7 divide-x divide-border overflow-y-auto"
        style={{
          gridTemplateRows: `repeat(${gridDays.length / 7}, minmax(96px, 1fr))`,
        }}
      >
        {gridDays.map((day) => {
          const summary = counts.get(dayKey(day));
          const inMonth = day.getMonth() === month;
          const isToday = startOfDay(day).getTime() === today;
          const segments = (summary?.categories ?? []).slice(0, MAX_SEGMENTS);
          return (
            <button
              key={day.toISOString()}
              type="button"
              data-no-drag
              onClick={() => onSelectDay(day)}
              className={cn(
                "group flex flex-col gap-2 border-b border-border p-2 text-left transition-colors hover:bg-accent",
                !inMonth && "bg-muted/30 opacity-40 hover:opacity-65",
                isToday && "bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[11.5px]",
                    isToday
                      ? "flex size-6 items-center justify-center rounded-md bg-muted font-bold text-foreground ring-1 ring-border"
                      : "font-medium text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                {summary ? (
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground/70">
                    {summary.count}
                  </span>
                ) : null}
              </div>
              {summary ? (
                <div className="mt-auto flex flex-col gap-1.5">
                  <div
                    className="flex h-1.5 overflow-hidden rounded-full bg-muted/40"
                    style={{
                      width: `${Math.max(18, (summary.count / peak) * 100)}%`,
                    }}
                  >
                    {segments.map((c) => (
                      <span
                        key={c.category}
                        title={`${c.category || "other"} · ${c.count}`}
                        style={{
                          flex: c.count,
                          backgroundColor: categoryColor(c.category),
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : loading && inMonth ? (
                <div className="mt-auto h-1.5 w-1/2 animate-pulse rounded-full bg-muted/40" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
