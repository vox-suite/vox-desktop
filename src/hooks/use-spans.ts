import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, type Span, type SpanQuery } from "@/lib/tauri";

const POLL_INTERVAL_MS = 15_000;
const SPAN_EVENT_PREFIX = "span_";

export function useSpans(query: SpanQuery, enabled = true) {
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const key = JSON.stringify(query);

  const load = useCallback(async () => {
    setLoading(true);
    const query = JSON.parse(key) as SpanQuery;
    try {
      setSpans(await api.getSpans(query));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    let unlisten: (() => void) | undefined;
    void listen<string>("vox-live-update", (event) => {
      try {
        const payload = JSON.parse(event.payload) as { type?: string };
        if (payload.type?.startsWith(SPAN_EVENT_PREFIX)) void load();
      } catch {
        /* ignore malformed frame */
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [enabled, load]);

  return { spans, loading, error, reload: load };
}
