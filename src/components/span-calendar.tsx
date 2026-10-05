import { useEffect, useMemo, useRef, useState } from "react";
import {
  layoutAllDay,
  layoutDay,
  startOfDay,
  type PlacedSpan,
} from "@/lib/span-layout";
import {
  displayTitle,
  formatAmount,
  formatTime,
  spanCover,
  spanStyle,
  spanSubtitle,
} from "@/lib/span-format";
import { CategoryIndicator } from "@/components/category-indicator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Span } from "@/features/spans/types";
import { cn } from "@/lib/utils";

const HOUR_PX = 128;
const QUARTER_PX = HOUR_PX / 4;
const INSTANT_HEIGHT_PX = QUARTER_PX - 4;
const PX_PER_MIN = HOUR_PX / 60;
const INDENT_PX = 10;
const GUTTER_PX = 54;

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function InstantChip({
  span,
  onSelect,
}: {
  span: Span;
  onSelect: (span: Span) => void;
}) {
  const style = spanStyle(span);
  const cover = spanCover(span);
  const subtitle = spanSubtitle(span);
  const amount = formatAmount(span);
  const label = displayTitle(span);
  const iconOnly = span.source === "spotify";
  const hasCard = iconOnly || !!cover;

  const chip = (
    <button
      type="button"
      data-no-drag
      aria-label={label}
      title={
        hasCard
          ? undefined
          : `${label} · ${formatTime(span.start_at)}${amount ? ` · ${amount}` : ""}`
      }
      onClick={(e) => {
        e.stopPropagation();
        onSelect(span);
      }}
      className={cn(
        "pointer-events-auto flex shrink-0 items-center rounded-full border shadow-md transition duration-150 hover:scale-105 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        iconOnly ? "justify-center" : "max-w-64 gap-2 px-3.5",
        span.status === "cancelled" && "opacity-40",
      )}
      style={{
        height: INSTANT_HEIGHT_PX,
        width: iconOnly ? INSTANT_HEIGHT_PX : undefined,
        backgroundColor: style.bg,
        borderColor: style.border,
      }}
    >
      <CategoryIndicator
        span={span}
        color={style.dot}
        dotSizeClass="size-1.5"
      />
      {iconOnly ? null : (
        <span className="truncate text-[13px] font-medium leading-none text-foreground">
          {label}
        </span>
      )}
      {!iconOnly && amount ? (
        <span className="shrink-0 rounded bg-muted px-1 font-mono text-[9px] font-semibold text-foreground">
          {amount}
        </span>
      ) : null}
    </button>
  );
  if (!hasCard) return chip;
  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>{chip}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-72 p-3">
        <div className="flex items-center gap-3">
          {cover ? (
            <img
              src={cover}
              alt=""
              referrerPolicy="no-referrer"
              className="size-16 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{label}</p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {formatTime(span.start_at)}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// One of the 96 quarter-hour slots: its entries sit side by side.
function InstantRow({
  items,
  onSelect,
}: {
  items: PlacedSpan[];
  onSelect: (span: Span) => void;
}) {
  const { slot = 0, left, width, depth } = items[0];
  const inset = depth * INDENT_PX;
  return (
    <div
      data-no-drag
      className="pointer-events-none absolute flex flex-row items-center gap-2 overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        top: slot * QUARTER_PX,
        height: QUARTER_PX,
        left: `calc(${left * 100}% + ${inset + 3}px)`,
        width: `calc(${width * 100}% - ${inset + 6}px)`,
        zIndex: depth + 50,
      }}
    >
      {items.map((placed) => (
        <InstantChip
          key={placed.span.id}
          span={placed.span}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SpanBlock({
  placed,
  hasChildren,
  onSelect,
}: {
  placed: PlacedSpan;
  hasChildren: boolean;
  onSelect: (span: Span) => void;
}) {
  const { span, top, height, left, width, depth } = placed;
  const style = spanStyle(span);
  const inset = depth * INDENT_PX;
  const heightPx = Math.max(height * PX_PER_MIN - 2, 22);
  const amount = formatAmount(span);
  const muted = span.status === "cancelled";
  // Only show time line if height is at least 48px to prevent vertical text collision
  const showTime = heightPx >= 48;

  return (
    <button
      type="button"
      data-no-drag
      title={`${displayTitle(span)} · ${formatTime(span.start_at)}${
        span.end_at ? `–${formatTime(span.end_at)}` : ""
      }${amount ? ` · ${amount}` : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(span);
      }}
      className={cn(
        "group absolute flex flex-col overflow-hidden rounded-lg text-left shadow-md transition duration-150 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        showTime ? "justify-between p-2.5" : "justify-center px-2 py-1",
        muted && "opacity-40 line-through",
        span.status === "active" &&
          "ring-1 ring-border shadow-[0_0_14px_rgba(255,255,255,0.2)]",
        span.status === "failed" && "ring-1 ring-destructive",
      )}
      style={{
        top: top * PX_PER_MIN + 2,
        height: heightPx,
        left: `calc(${left * 100}% + ${inset + 3}px)`,
        width: `calc(${width * 100}% - ${inset + 6}px)`,
        zIndex: depth + 1,
        backgroundColor: hasChildren
          ? `color-mix(in srgb, ${style.bg} 60%, #111215)`
          : style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <div className="flex w-full items-center justify-between gap-1 overflow-hidden">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold leading-tight text-foreground">
          {displayTitle(span)}
        </p>
        <div className="ml-1">
          <CategoryIndicator
            span={span}
            color={style.dot}
            dotSizeClass="size-1.5"
          />
        </div>
      </div>
      {showTime ? (
        <div className="mt-1 flex items-center gap-1.5 overflow-hidden font-mono text-[10px]">
          <span className="truncate" style={{ color: style.subtext }}>
            {formatTime(span.start_at)}
            {span.end_at ? ` – ${formatTime(span.end_at)}` : ""}
          </span>
          {amount ? (
            <span className="ml-auto shrink-0 rounded bg-muted px-1 py-0.2 text-[9px] font-semibold text-foreground">
              {amount}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on range change
  }, [days[0]?.getTime(), days.length]);

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

  // Compute current time position for laser indicator
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN;

  return (
    <div
      data-no-drag
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background select-none"
    >
      {/* Column Headers (Day + Date, as in SS: "Mon 6", "Fri 10") */}
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

      {/* Main Time Grid Scroll Container without layout-stealing scrollbars */}
      <div
        ref={scrollRef}
        data-no-drag
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="relative grid"
          style={{ gridTemplateColumns: columns, height: 24 * HOUR_PX }}
        >
          {/* Time Gutter with Labels (Current time label removed as requested) */}
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

          {/* Days Columns */}
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

          {/* Dotted Laser Current Time Line across the entire grid */}
          <div
            className="pointer-events-none absolute right-0 left-[54px] z-40 border-t border-dashed border-destructive/70"
            style={{ top: nowTop }}
          />
        </div>
      </div>
    </div>
  );
}
