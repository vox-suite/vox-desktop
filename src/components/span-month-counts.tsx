import { useMemo } from "react";
import { monthGridDays, startOfDay } from "@/lib/span-layout";
import {
  categoryColor,
  displayTitle,
  formatAmount,
  formatTime,
  spanStyle,
} from "@/lib/span-format";
import { dayKey } from "@/features/timeline/day-store";
import { CategoryIndicator } from "@/components/category-indicator";
import type { Span, SpanDaySummary } from "@/features/spans/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_SEGMENTS = 5;
const MAX_CHIPS = 3;

export function SpanMonthCounts({
  anchorDate,
  counts,
  spans = [],
  loading,
  onSelectDay,
  onSelectSpan,
}: {
  anchorDate: Date;
  counts: Map<string, SpanDaySummary>;
  spans?: Span[];
  loading: boolean;
  onSelectDay: (day: Date) => void;
  onSelectSpan?: (span: Span) => void;
}) {
  const gridDays = useMemo(() => monthGridDays(anchorDate), [anchorDate]);
  const today = startOfDay(new Date()).getTime();
  const month = anchorDate.getMonth();
  const peak = Math.max(1, ...[...counts.values()].map((c) => c.count));
  const spansByDay = useMemo(() => {
    const map = new Map<string, Span[]>();
    for (const span of [...spans].sort((a, b) =>
      (a.start_at ?? "").localeCompare(b.start_at ?? ""),
    )) {
      if (!span.start_at) continue;
      const key = dayKey(new Date(span.start_at));
      map.set(key, [...(map.get(key) ?? []), span]);
    }
    return map;
  }, [spans]);

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
          gridTemplateRows: `repeat(${gridDays.length / 7}, minmax(128px, 1fr))`,
        }}
      >
        {gridDays.map((day) => {
          const summary = counts.get(dayKey(day));
          const inMonth = day.getMonth() === month;
          const isToday = startOfDay(day).getTime() === today;
          const segments = (summary?.categories ?? []).slice(0, MAX_SEGMENTS);
          const daySpans = spansByDay.get(dayKey(day)) ?? [];
          const chips = daySpans.slice(0, MAX_CHIPS);
          const more = Math.max(summary?.count ?? 0, daySpans.length) - chips.length;
          return (
            <div
              key={day.toISOString()}
              data-no-drag
              onClick={() => onSelectDay(day)}
              className={cn(
                "group flex min-w-0 cursor-pointer flex-col gap-1.5 border-b border-border p-1.5 text-left transition-colors hover:bg-accent",
                !inMonth && "bg-muted/30 opacity-40 hover:opacity-65",
                isToday && "bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between px-0.5">
                <button
                  type="button"
                  aria-label={`Open ${day.toDateString()}`}
                  className={cn(
                    "rounded font-mono text-[11.5px] focus-visible:outline-2",
                    isToday
                      ? "flex size-6 items-center justify-center rounded-md bg-muted font-bold text-foreground ring-1 ring-border"
                      : "font-medium text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {day.getDate()}
                </button>
                {summary ? (
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground/70">
                    {summary.count}
                  </span>
                ) : null}
              </div>
              {chips.length > 0 && (
                <div className="flex min-w-0 flex-col gap-1">
                  {chips.map((s) => {
                    const style = spanStyle(s);
                    const amount = formatAmount(s);
                    const time = formatTime(s.start_at);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        data-no-drag
                        title={`${displayTitle(s)}${time ? ` · ${time}` : ""}${amount ? ` · ${amount}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSpan?.(s);
                        }}
                        className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] text-left transition hover:brightness-110 focus-visible:outline-2"
                        style={{
                          backgroundColor: style.bg,
                          boxShadow: `inset 0 0 0 1px ${style.border}`,
                        }}
                      >
                        <CategoryIndicator
                          span={s}
                          color={style.dot}
                          dotSizeClass="size-1.5"
                        />
                        <span className="truncate text-[11px] font-medium text-foreground">
                          {displayTitle(s)}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[9.5px] text-muted-foreground">
                          {amount ?? time}
                        </span>
                      </button>
                    );
                  })}
                  {more > 0 && (
                    <span className="px-1.5 font-mono text-[10px] text-muted-foreground group-hover:text-foreground">
                      +{more} more
                    </span>
                  )}
                </div>
              )}
              {summary ? (
                <div className="mt-auto flex flex-col gap-1.5 px-0.5">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
