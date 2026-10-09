import { useCallback, useEffect, useRef, useState } from "react";
import { discoveryApi } from "@/features/pulse/api";
import type { CanvasResponse } from "@/features/pulse/discovery-types";
import { LatestRequest, uniqueCharts } from "@/features/pulse/utils";
import { platform } from "@/platform";
export function usePulseCanvas() {
  const [canvas, setCanvas] = useState<CanvasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const cursors = useRef<(string | undefined)[]>([undefined]);
  const requests = useRef(new LatestRequest());
  const load = useCallback(async (refresh = false, cursor?: string) => {
    const ticket = requests.current.start();
    setRefreshing(true);
    try {
      const pages = await Promise.all(
        (cursor ? [cursor] : cursors.current).map((page) =>
          discoveryApi.getCanvas(refresh, page),
        ),
      );
      const next = {
        ...pages[pages.length - 1],
        charts: uniqueCharts(pages.flatMap((page) => page.charts)),
      };
      if (requests.current.isCurrent(ticket)) {
        if (cursor && !cursors.current.includes(cursor))
          cursors.current.push(cursor);
        setCanvas((current) =>
          cursor && current
            ? {
                ...next,
                charts: uniqueCharts([...current.charts, ...next.charts]),
              }
            : next,
        );
        setError("");
      }
    } catch (e) {
      if (requests.current.isCurrent(ticket)) setError(String(e));
    } finally {
      if (requests.current.isCurrent(ticket)) {
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
