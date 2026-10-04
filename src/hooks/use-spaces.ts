import { useCallback, useEffect, useState } from "react";
import { spacesApi } from "@/features/spaces/api";
import type { Space } from "@/features/spaces/types";
import { platform } from "@/platform";

const LIST_EVENTS = new Set([
  "space_created",
  "space_dropped",
  "space_committed",
  "space_updated",
  "space_run_started",
  "space_run_finished",
  "space_run_failed",
  "live_reconnected",
]);

export function useSpaces(enabled = true) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (enabled) setLoading(true);
  }

  const load = useCallback(async () => {
    try {
      const data = await spacesApi.listSpaces();
      setSpaces(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    queueMicrotask(() => void load());
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    return platform().live.subscribe((payload) => {
      if (LIST_EVENTS.has(payload.type)) void load();
    });
  }, [enabled, load]);

  const create = useCallback(
    async (title: string, intent: string) => {
      setLoading(true);
      try {
        const created = await spacesApi.createSpace(title, intent);
        await load();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  const drop = useCallback(
    async (id: string) => {
      try {
        await spacesApi.dropSpace(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [load],
  );

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { spaces, loading, error, reload, create, drop };
}
