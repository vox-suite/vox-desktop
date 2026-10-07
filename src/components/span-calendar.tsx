import { useEffect, useMemo, useRef, useState } from "react";
import {
  layoutAllDay,
  layoutDay,
  type PlacedSpan,
} from "@/lib/span-layout";
import {
  displayTitle,
  spanStyle,
} from "@/lib/span-format";
import { CategoryIndicator } from "@/components/category-indicator";
import type { Span } from "@/features/spans/types";
import { cn } from "@/lib/utils";
import {
  GUTTER_PX,
  HOUR_PX,
  PX_PER_MIN,
  QUARTER_PX,
  InstantRow,
  SpanBlock,
  isSameDay,
} from "./spans/calendar";

export function SpanCalendar({
  days,
  spans,
  onSelect,
}: {
  days: Date[];
  spans: Span[];
  onSelect: (span: Span) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const earliest = spans
      .filter((s) => s.start_at)
      .map((s) => new Date(s.start_at!))
      .filter((d) => days.some((day) => isSameDay(day, d)))
      .map((d) => d.getHours())
      .sort((a, b) => a - b)[0];
    const hour =
      earliest ??
      (days.some((d) => isSameDay(d, new Date()))
        ? new Date().getHours() - 2
        : 8);
    el.scrollTop = Math.max(0, hour - 1) * HOUR_PX;
  }, [days, spans]);

  const perDay = useMemo(
    () =>
      days.map((day) => {
        const placed = layoutDay(spans, day);
        const parents = new Set(
          placed
            .map((p) => p.span.parent_id)
            .filter((id): id is string => !!id),
        );
        const blocks = placed.filter((p) => !p.instant);
        const groups = new Map<string, PlacedSpan[]>();
        for (const p of placed) {
          if (!p.instant) continue;
          const key = `${p.depth}|${p.left}|${p.width}|${p.slot}`;
          groups.set(key, [...(groups.get(key) ?? []), p]);
        }
        return { day, blocks, rows: [...groups.entries()], parents };
      }),
    [days, spans],
  );

  const allDay = useMemo(() => layoutAllDay(spans, days), [spans, days]);
  const allDayRows = allDay.reduce((max, r) => Math.max(max, r.row + 1), 0);
  const columns = `${GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`;
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN;

  return (
    <div
      data-no-drag
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background select-none"
    >
      <div
        className="grid shrink-0 border-b border-border bg-background"
        style={{ gridTemplateColumns: columns }}
      >
        <div />
        {days.map((day) => {
          const today = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className="flex items-center justify-center gap-1.5 border-l border-border py-2"
            >
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-wide",
                  today
                    ? "text-muted-foreground font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "font-mono text-[12px] font-semibold transition",
                  today
                    ? "rounded-md bg-muted px-1.5 py-0.5 text-foreground ring-1 ring-border shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {allDayRows > 0 ? (
        <div
          className="relative grid shrink-0 border-b border-border"
          style={{ gridTemplateColumns: columns, height: allDayRows * 24 + 6 }}
        >
          <p className="self-center pr-2 text-right font-mono text-[9px] uppercase text-muted-foreground">
            all day
          </p>
          {allDay.map(({ span, startCol, endCol, row }) => (
            <button
              key={span.id}
              type="button"
              onClick={() => onSelect(span)}
              className="absolute flex h-5 items-center gap-1.5 truncate rounded px-2 text-left text-[11px] text-foreground"
              style={{
                top: row * 24 + 3,
                left: `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX}px) * ${startCol / days.length} + 2px)`,
                width: `calc((100% - ${GUTTER_PX}px) * ${(endCol - startCol + 1) / days.length} - 4px)`,
                background: `color-mix(in srgb, ${spanStyle(span).dot} 30%, #111214)`,
              }}
            >
              <CategoryIndicator
                span={span}
                color={spanStyle(span).dot}
                dotSizeClass="size-1.5"
              />
              <span className="truncate">{displayTitle(span)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        data-no-drag
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="relative grid"
          style={{ gridTemplateColumns: columns, height: 24 * HOUR_PX }}
        >
          <div className="relative">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span
                key={h}
                className="absolute right-3 -translate-y-1/2 font-mono text-[10px] font-medium text-muted-foreground select-none"
                style={{ top: h * HOUR_PX }}
              >
                {new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
                  hour: "numeric",
                })}
              </span>
            ))}
            {Array.from({ length: 24 * 3 }, (_, i) => {
              const hour = Math.floor(i / 3);
              const minute = ((i % 3) + 1) * 15;
              return (
                <span
                  key={`q${i}`}
                  className="absolute right-3 -translate-y-1/2 font-mono text-[8.5px] text-muted-foreground/45 select-none"
                  style={{ top: hour * HOUR_PX + (minute / 15) * QUARTER_PX }}
                >
                  :{minute}
                </span>
              );
            })}
          </div>

          {perDay.map(({ day, blocks, rows, parents }) => {
            const today = isSameDay(day, now);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-l border-border",
                  today && "bg-muted/30",
                )}
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgba(255,255,255,0.09) ${HOUR_PX - 1}px, rgba(255,255,255,0.09) ${HOUR_PX}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${QUARTER_PX - 1}px, rgba(255,255,255,0.035) ${QUARTER_PX - 1}px, rgba(255,255,255,0.035) ${QUARTER_PX}px)`,
                }}
              >
                {blocks.map((p) => (
                  <SpanBlock
                    key={p.span.id}
                    placed={p}
                    hasChildren={parents.has(p.span.id)}
                    onSelect={onSelect}
                  />
                ))}
                {rows.map(([key, items]) => (
                  <InstantRow key={key} items={items} onSelect={onSelect} />
                ))}
              </div>
            );
          })}

          <div
            className="pointer-events-none absolute right-0 left-[54px] z-40 border-t border-dashed border-destructive/70"
            style={{ top: nowTop }}
          />
        </div>
      </div>
    </div>
  );
}
