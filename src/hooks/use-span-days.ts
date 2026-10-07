import { useEffect, useMemo, useSyncExternalStore } from "react";
import { dayKey, spanDays } from "@/features/spans/day-store";
import type { Span, SpanDaySummary } from "@/features/spans/types";
import { platform } from "@/platform";

const SPAN_EVENT_PREFIX = "span_";
const INVALIDATE_DEBOUNCE_MS = 400;

export type DayFrontier = { day: string; ms: number };

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
    const onVisible = () => {
      if (document.visibilityState === "visible") void spanDays.revalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled]);
}

export function useDayCounts(days: Date[], scope = "", enabled = true) {
  useSpanDayEvents(enabled);
  const version = useSyncExternalStore(spanDays.subscribe, spanDays.version);
  const fromDay = dayKey(days[0]);
  const toDay = dayKey(days[days.length - 1]);
  const epoch = spanDays.epoch;

  useEffect(() => {
    if (!enabled) return;
    void spanDays.loadCounts(scope, fromDay, toDay);
  }, [enabled, scope, fromDay, toDay, epoch]);

  return useMemo(() => {
    void version;
    const byDay = new Map<string, SpanDaySummary>();
    let known = 0;
    for (const date of days) {
      const summary = spanDays.count(scope, dayKey(date));
      if (summary) {
        byDay.set(dayKey(date), summary);
        known++;
      }
    }
    return {
      byDay,
      loading: known === 0 && !spanDays.hasLoadedCounts(scope, fromDay, toDay),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, scope, fromDay, toDay]);
}

export function useDayItems(days: Date[], scope = "", enabled = true) {
  useSpanDayEvents(enabled);
  const version = useSyncExternalStore(spanDays.subscribe, spanDays.version);
  const keys = useMemo(() => days.map(dayKey), [days]);
  const keySignature = `${scope}:${keys.join(",")}`;
  const epoch = spanDays.epoch;

  useEffect(() => {
    if (!enabled) return;
    for (const key of keys) void spanDays.loadFirst(scope, key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keySignature, epoch]);

  const state = useMemo(() => {
    void version;
    const seen = new Set<string>();
    const spans: Span[] = [];
    let loading = false;
    let error = "";
    const frontiers: DayFrontier[] = [];
    for (const key of keys) {
      const entry = spanDays.entry(scope, key);
      for (const span of entry.items) {
        if (seen.has(span.id)) continue;
        seen.add(span.id);
        spans.push(span);
      }
      loading ||= entry.loading;
      error ||= entry.error;
      if (!entry.done && entry.cursor) {
        const last = entry.items.at(-1)?.start_at;
        if (last) frontiers.push({ day: key, ms: new Date(last).getTime() });
      }
    }
    return { spans, loading, error, frontiers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, keySignature]);

  const loadMore = (day: string) => void spanDays.loadMore(scope, day);

  return { ...state, loadMore };
}
