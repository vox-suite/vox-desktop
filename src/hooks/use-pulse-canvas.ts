import { useCallback, useEffect, useRef, useState } from "react";
import { discoveryApi } from "@/features/pulse/api";
import type {
  CanvasResponse,
  PulseResult,
} from "@/features/pulse/discovery-types";
import { registerCacheReset } from "@/features/cache-reset";
import { LatestRequest, uniqueCharts } from "@/features/pulse/utils";
import { platform } from "@/platform";
const PAGE_SIZE = 12;
const RESULT_CONCURRENCY = 3;

type ResultCache = {
  revision: string | null;
  count: number | null;
  results: Map<string, PulseResult>;
  canvas: CanvasResponse | null;
};
registerCacheReset(() => {
  cache.revision = null;
  cache.count = null;
  cache.results.clear();
  cache.canvas = null;
});
const cache: ResultCache = {
  revision: null,
  count: null,
  results: new Map(),
  canvas: null,
};

const unavailable = (message: string): PulseResult =>
  ({
    coverage: { state: "unavailable" },
    total: null,
    source: "Source unavailable",
    points: [],
    unit: "",
    quality: "unavailable",
    description: message,
    record_count: 0,
    undated_count: 0,
    computed_at: new Date().toISOString(),
    data_as_of: null,
    error: message,
  }) as unknown as PulseResult;

async function pool<T>(
  items: T[],
  size: number,
  run: (item: T) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}

export function usePulseCanvas() {
  const [canvas, setCanvas] = useState<CanvasResponse | null>(cache.canvas);
  const [loading, setLoading] = useState(!cache.canvas);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loadedPages = useRef(1);
  const requests = useRef(new LatestRequest());
  const load = useCallback(async (refresh = false, cursor?: string) => {
    const ticket = requests.current.start();
    const current = () => requests.current.isCurrent(ticket);
    setRefreshing(true);
    try {
      let revision: string | null = null;
      let total: number | null = null;
      if (!cursor) {
        const meta = await discoveryApi.countCharts().catch(() => null);
        if (meta?.count === 0) {
          cache.results.clear();
          cache.revision = meta.revision;
          cache.count = 0;
          cache.canvas = { charts: [], next_cursor: null };
          if (current()) {
            loadedPages.current = 1;
            setCanvas(cache.canvas);
            setError("");
          }
          return;
        }
        revision = meta?.revision ?? null;
        total = meta?.count ?? null;
        if (
          !refresh &&
          revision &&
          cache.canvas &&
          cache.revision === revision &&
          cache.count === meta?.count
        ) {
          if (current()) {
            setCanvas(cache.canvas);
            setError("");
          }
          return;
        }
      }
      const pageIndexes = cursor
        ? [Number(cursor) / PAGE_SIZE]
        : Array.from({ length: loadedPages.current }, (_, i) => i);
      const pages = await Promise.all(
        pageIndexes.map((index) =>
          discoveryApi.listCharts(PAGE_SIZE + 1, index * PAGE_SIZE),
        ),
      );
      const last = pages[pages.length - 1];
      const more = last.length > PAGE_SIZE;
      const fresh = uniqueCharts(
        pages.flatMap((page, i) =>
          (i === pages.length - 1 ? page.slice(0, PAGE_SIZE) : page).map(
            (chart) => ({
              ...chart,
              result: cache.results.get(chart.id) ?? null,
            }),
          ),
        ),
      );
      if (!current()) return;
      const nextCursor = more
        ? String((pageIndexes[pageIndexes.length - 1] + 1) * PAGE_SIZE)
        : null;
      const merge = (base: CanvasResponse | null): CanvasResponse =>
        cursor && base
          ? {
              next_cursor: nextCursor,
              charts: uniqueCharts([...base.charts, ...fresh]),
            }
          : { next_cursor: nextCursor, charts: fresh };
      if (cursor) loadedPages.current = pageIndexes[0] + 1;
      let snapshot = merge(cache.canvas);
      cache.canvas = snapshot;
      setCanvas(snapshot);
      setError("");
      setLoading(false);
      const stale = fresh.filter(
        (chart) =>
          refresh ||
          !revision ||
          cache.revision !== revision ||
          !cache.results.has(chart.id),
      );
      await pool(stale, RESULT_CONCURRENCY, async (chart) => {
        let result: PulseResult;
        try {
          result = await discoveryApi.chartResult(chart.id, refresh);
        } catch (e) {
          result = unavailable(e instanceof Error ? e.message : String(e));
        }
        cache.results.set(chart.id, result);
        if (!current()) return;
        snapshot = {
          ...snapshot,
          charts: snapshot.charts.map((item) =>
            item.id === chart.id ? { ...item, result } : item,
          ),
        };
        cache.canvas = snapshot;
        setCanvas(snapshot);
      });
      if (current() && !cursor && revision) {
        cache.revision = revision;
        cache.count = total;
      }
    } catch (e) {
      if (current()) setError(String(e));
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useEffect(() => {
    const tracker = requests.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = 0;
    queueMicrotask(() => void load());
    const refresh = () => {
      if (document.hidden || timer) return;
      timer = setTimeout(
        () => {
          timer = undefined;
          if (!document.hidden) {
            lastRefresh = Date.now();
            void load();
          }
        },
        Math.max(100, 5000 - (Date.now() - lastRefresh)),
      );
    };
    const unsubscribe = platform().live.subscribe((event) => {
      if (
        event.type === "timeline_updated" ||
        event.type.startsWith("span_") ||
        event.type.includes("connection") ||
        event.type === "live_reconnected"
      )
        refresh();
    });
    const visible = () => {
      if (document.hidden) {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      } else refresh();
    };
    const fallback = setInterval(() => {
      if (!document.hidden) refresh();
    }, 60000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      tracker.cancel();
      unsubscribe();
      clearInterval(fallback);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  return { canvas, loading, refreshing, error, reload: load };
}
