import { SpanInfoTooltip } from "@/components/span-info-tooltip";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Span } from "@/features/spans/types";
import {
  displayTitle,
  formatAmount,
  formatTime,
  isEstimated,
  spanStyle,
} from "@/lib/span-format";
import { CategoryIndicator } from "@/components/category-indicator";
import { cn } from "@/lib/utils";

function durationLabel(start: number, end: number) {
  const minutes = Math.max(1, Math.round((end - start) / 60_000));
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} days`;
  if (minutes >= 60)
    return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  return `${minutes}m`;
}

export function PlanningTimeline({
  days,
  spans,
  onSelect,
  loading,
  hasMore = false,
  frontier = null,
  onLoadMore,
}: {
  days: Date[];
  spans: Span[];
  onSelect: (span: Span) => void;
  loading: boolean;
  hasMore?: boolean;
  frontier?: number | null;
  onLoadMore?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const start = days[0].getTime();
  const endDate = new Date(days[days.length - 1]);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.getTime();
  const width =
    days.length === 1
      ? 2400
      : days.length > 7
        ? days.length * 100
        : days.length * 400;
  const leadingSpace = 40;
  const scale = width / (end - start);
  const items = useMemo(() => {
    const lanes: number[] = [];
    return spans
      .flatMap((span) => {
        if (!span.start_at) return [];
        const from = new Date(span.start_at).getTime();
        const to = span.end_at ? new Date(span.end_at).getTime() : from;
        if (
          !Number.isFinite(from) ||
          !Number.isFinite(to) ||
          from >= end ||
          to < start
        )
          return [];
        return [{ span, from, to }];
      })
      .sort((a, b) => a.from - b.from || a.to - b.to)
      .map(({ span, from, to }) => {
        const left = Math.max(0, from - start) * scale;
        const barWidth = Math.min(
          width - left,
          Math.max(180, (Math.min(end, to) - Math.max(start, from)) * scale),
        );
        let lane = lanes.findIndex((occupied) => occupied + 8 <= left);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = left + barWidth;
        return { span, from, to, left, barWidth, lane };
      });
  }, [spans, start, end, scale, width]);
  const ticks =
    days.length === 1
      ? Array.from({ length: 24 }, (_, hour) => {
          const date = new Date(start);
          date.setHours(hour);
          return date;
        })
      : days.filter((_, index) => days.length <= 7 || index % 7 === 0);
  const sentinelLeft =
    frontier === null
      ? leadingSpace
      : leadingSpace + Math.max(0, frontier - start) * scale;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root: scrollRef.current, rootMargin: "0px 400px 0px 400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, sentinelLeft, spans.length]);
  const nowLeft = (now - start) * scale;
  const showNow = now >= start && now < end;
  const height = Math.max(
    240,
    (Math.max(0, ...items.map((item) => item.lane)) + 1) * 42 + 50,
  );

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 overflow-auto bg-background pt-3 text-foreground"
    >
      <div
        className="relative h-full"
        style={{ width: width + leadingSpace + 16, minHeight: height }}
      >
        {hasMore ? (
          <div
            ref={sentinelRef}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 h-px w-px"
            style={{ left: sentinelLeft }}
          />
        ) : null}
        <div className="relative h-8 border-b border-border text-xs text-muted-foreground">
          {ticks.map((date) => (
            <span
              key={date.getTime()}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: leadingSpace + (date.getTime() - start) * scale }}
            >
              {days.length === 1
                ? date.toLocaleTimeString(undefined, { hour: "numeric" })
                : date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
            </span>
          ))}
        </div>
        {(days.length > 7 ? days : ticks).map((date) => (
          <div
            key={`separator-${date.getTime()}`}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-8 w-px text-muted-foreground/12"
            style={{
              left: leadingSpace + (date.getTime() - start) * scale,
              backgroundImage:
                "repeating-linear-gradient(to bottom, currentColor 0, currentColor 4px, transparent 4px, transparent 10px)",
              backgroundSize: "1px 10px",
              backgroundRepeat: "repeat-y",
            }}
          />
        ))}
        {days.length === 7 &&
          days.flatMap((day) =>
            Array.from({ length: 7 }, (_, index) => {
              const time = new Date(day);
              time.setHours((index + 1) * 3);
              return (
                <div
                  key={`sub-hour-${time.getTime()}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 top-8 w-px text-muted-foreground/12"
                  style={{
                    left: leadingSpace + (time.getTime() - start) * scale,
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, currentColor 0, currentColor 4px, transparent 4px, transparent 10px)",
                  }}
                />
              );
            }),
          )}
        {days.length === 7 &&
          days.map((day) => (
            <div
              key={`day-${day.getTime()}`}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 top-8 w-px bg-[#242424]"
              style={{ left: leadingSpace + (day.getTime() - start) * scale }}
            />
          ))}
        {days.length > 7 &&
          [7, 14, 21, 28].map((dayIndex) => {
            const boundary = days[dayIndex]?.getTime() ?? end;
            return (
              <div
                key={`week-${dayIndex}`}
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 top-8 w-px bg-[#242424]"
                style={{
                  left: leadingSpace + (boundary - start) * scale,
                }}
              />
            );
          })}
        {showNow && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10"
            style={{ left: leadingSpace + nowLeft }}
          >
            <span className="absolute top-0 -translate-x-1/2 rounded-md bg-[#7f1d1d] px-2 py-1 text-xs text-white">
              Now
            </span>
            <div className="absolute bottom-0 top-9 w-px bg-[#7f1d1d]" />
          </div>
        )}
        {items.map(({ span, from, to, left, barWidth, lane }) => {
          const style = spanStyle(span);
          const amount = formatAmount(span);
          const badge =
            amount ||
            (to > from ? durationLabel(from, to) : formatTime(span.start_at));
          return (
            <SpanInfoTooltip key={span.id} span={span}>
              <button
                type="button"
                onClick={() => onSelect(span)}
                aria-label={`${displayTitle(span)}, ${formatTime(span.start_at)}${span.end_at ? ` to ${formatTime(span.end_at)}` : ""}`}
                className={cn(
                  "absolute z-20 flex h-8 items-center gap-2 overflow-hidden rounded-lg border px-2.5 text-left shadow-sm transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  span.status === "active" && "ring-1 ring-border",
                  span.status === "cancelled" && "opacity-45 line-through",
                  span.status === "failed" && "ring-1 ring-destructive",
                )}
                style={{
                  left: leadingSpace + left,
                  width: barWidth,
                  top: 42 + lane * 42,
                  backgroundColor: style.bg,
                  borderColor: style.border,
                  color: style.text,
                  borderStyle: isEstimated(span) ? "dashed" : "solid",
                }}
              >
                <CategoryIndicator
                  span={span}
                  color={style.dot}
                  dotSizeClass="size-1.5"
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {displayTitle(span)}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-foreground">
                  {isEstimated(span) ? "≈ " : ""}
                  {badge}
                </span>
              </button>
            </SpanInfoTooltip>
          );
        })}
        {items.length === 0 && (
          <p className="pt-8 text-sm text-muted-foreground">
            {loading
              ? "Loading your plan…"
              : "No events in this date range. Choose another date to explore your plan."}
          </p>
        )}
      </div>
    </div>
  );
}
