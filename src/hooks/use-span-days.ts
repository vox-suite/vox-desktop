import { useEffect, useMemo, useSyncExternalStore } from "react";
import { dayKey, spanDays } from "@/features/spans/day-store";
import type { Span, SpanDaySummary } from "@/features/spans/types";
import { platform } from "@/platform";

const SPAN_EVENT_PREFIX = "span_";
const INVALIDATE_DEBOUNCE_MS = 400;

function useSpanDayEvents(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const unsubscribe = platform().live.subscribe((payload) => {
      if (
        !payload.type.startsWith(SPAN_EVENT_PREFIX) &&
        payload.type !== "live_reconnected"
      )
        return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => spanDays.invalidate(),
        INVALIDATE_DEBOUNCE_MS,
      );
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);
}

export function useDayCounts(days: Date[], enabled = true) {
  useSpanDayEvents(enabled);
  const version = useSyncExternalStore(spanDays.subscribe, spanDays.version);
  const fromDay = dayKey(days[0]);
  const toDay = dayKey(days[days.length - 1]);
  const epoch = spanDays.epoch;

  useEffect(() => {
    if (!enabled) return;
    void spanDays.loadCounts(fromDay, toDay);
  }, [enabled, fromDay, toDay, epoch]);

  return useMemo(() => {
    void version;
    const byDay = new Map<string, SpanDaySummary>();
    let known = 0;
    for (const date of days) {
      const summary = spanDays.count(dayKey(date));
      if (summary) {
        byDay.set(dayKey(date), summary);
        known++;
      }
    }
    return {
      byDay,
      loading: known === 0 && !spanDays.hasLoadedCounts(fromDay, toDay),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, fromDay, toDay]);
}

export function useDayItems(days: Date[], enabled = true) {
  useSpanDayEvents(enabled);
  const version = useSyncExternalStore(spanDays.subscribe, spanDays.version);
  const keys = useMemo(() => days.map(dayKey), [days]);
  const keySignature = keys.join(",");
  const epoch = spanDays.epoch;

  useEffect(() => {
    if (!enabled) return;
    for (const key of keys) void spanDays.loadFirst(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keySignature, epoch]);

  const state = useMemo(() => {
    void version;
    const seen = new Set<string>();
    const spans: Span[] = [];
    let loading = false;
    let error = "";
    const remaining: string[] = [];
    let frontier: number | null = null;
    for (const key of keys) {
      const entry = spanDays.entry(key);
      for (const span of entry.items) {
        if (seen.has(span.id)) continue;
        seen.add(span.id);
        spans.push(span);
      }
      loading ||= entry.loading;
      error ||= entry.error;
      if (!entry.done && entry.cursor) {
        remaining.push(key);
        const last = entry.items.at(-1)?.start_at;
        if (last) {
          const at = new Date(last).getTime();
          frontier = frontier === null ? at : Math.min(frontier, at);
        }
      }
    }
    return { spans, loading, error, remaining, frontier };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, keySignature]);

  const loadMore = () => {
    for (const key of state.remaining) void spanDays.loadMore(key);
  };

  return { ...state, hasMore: state.remaining.length > 0, loadMore };
}
