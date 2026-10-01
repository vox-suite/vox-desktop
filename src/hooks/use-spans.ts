import { useCallback, useEffect, useState } from "react";
import { spansApi } from "@/features/spans/api";
import type { Span, SpanQuery } from "@/features/spans/types";
import { platform } from "@/platform";

const POLL_INTERVAL_MS = 15_000;
const SPAN_EVENT_PREFIX = "span_";

export function useSpans(query: SpanQuery, enabled = true) {
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const key = JSON.stringify(query);

  // A new query (or becoming enabled) starts a fresh load; set during render, not in an effect.
  const loadKey = `${enabled}:${key}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    if (enabled) setLoading(true);
  }

  const load = useCallback(async () => {
    const query = JSON.parse(key) as SpanQuery;
    try {
      setSpans(await spansApi.getSpans(query));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    queueMicrotask(() => void load());
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    return platform().live.subscribe((payload) => {
      if (payload.type.startsWith(SPAN_EVENT_PREFIX)) void load();
    });
  }, [enabled, load]);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { spans, loading, error, reload };
}
