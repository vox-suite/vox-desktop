import { useEffect, useMemo, useSyncExternalStore } from "react";
import { dayKey, timelineDays } from "@/features/timeline/day-store";
import type { TimelineDaySummary, TimelineEntry } from "@/features/timeline/api";
import { platform } from "@/platform";

const INVALIDATE_DEBOUNCE_MS = 350;

export type TimelineFrontier = { day: string; ms: number };

function useTimelineEvents(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => timelineDays.invalidate(), INVALIDATE_DEBOUNCE_MS);
    };
    const unsubscribe = platform().live.subscribe((payload) => {
      if (payload.type === "timeline_updated" || payload.type === "live_reconnected") schedule();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}

export function useTimelineDays(
  days: Date[],
  scope: string,
  enabled: boolean,
  prefetch = false,
) {
  useTimelineEvents(enabled);
  const version = useSyncExternalStore(timelineDays.subscribe, timelineDays.version);
  const keys = useMemo(() => days.map(dayKey), [days]);
  const signature = `${scope}:${keys[0]}:${keys[keys.length - 1]}:${keys.length}:${prefetch}`;
  const epoch = timelineDays.epoch;

  useEffect(() => {
    if (!enabled) return;
    if (prefetch) void timelineDays.prefetch(scope, keys);
    else void timelineDays.loadRange(scope, keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature, epoch]);

  return useMemo(() => {
    void version;
    const counts = new Map<string, TimelineDaySummary>();
    const seen = new Set<string>();
    const entries: TimelineEntry[] = [];
    const frontiers: TimelineFrontier[] = [];
    let loading = false;
    let error = "";
    for (const key of keys) {
      const summary = timelineDays.count(scope, key);
      if (summary) counts.set(key, summary);
      const entry = timelineDays.entry(scope, key);
      for (const item of entry.items) {
        if (seen.has(item.event.id)) continue;
        seen.add(item.event.id);
        entries.push(item);
      }
      loading ||= entry.loading;
      error ||= entry.error;
      if (!entry.done && entry.cursor) {
        const last = entry.items.at(-1)?.event.occurred_at;
        if (last) frontiers.push({ day: key, ms: new Date(last).getTime() });
      }
    }
    const countsLoading = !timelineDays.hasLoadedCounts(scope, keys[0], keys[keys.length - 1]);
    return { counts, entries, frontiers, loading, error, countsLoading };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, signature]);
}

export const loadMoreDay = (scope: string, day: string) => void timelineDays.loadMore(scope, day);
