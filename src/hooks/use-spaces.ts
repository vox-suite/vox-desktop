import { useCallback, useEffect, useState } from "react";
import { registerCacheReset } from "@/features/cache-reset";
import { readPersisted, schedulePersist } from "@/features/persist";
import { spacesApi } from "@/features/spaces/api";
import type { Space } from "@/features/spaces/types";
import { platform } from "@/platform";

const LIST_EVENTS = new Set([
  "space_created",
  "space_dropped",
  "space_committed",
  "space_updated",
  "space_graph_updated",
  "space_run_started",
  "space_run_finished",
  "space_run_failed",
  "live_reconnected",
]);

const cache: { rev: string | null; spaces: Space[] | null } = {
  rev: null,
  spaces: null,
};

let hydrating: Promise<void> | null = null;
const ready = () => {
  hydrating ??= readPersisted<{ rev: string | null; spaces: Space[] }>(
    "spaces",
  ).then((data) => {
    if (!data || cache.spaces) return;
    cache.rev = data.rev;
    cache.spaces = data.spaces;
  });
  return hydrating;
};
const persist = () =>
  schedulePersist("spaces", () => ({ rev: cache.rev, spaces: cache.spaces }));
registerCacheReset(() => {
  hydrating = null;
  cache.rev = null;
  cache.spaces = null;
});

export function useSpaces(enabled = true) {
  const [spaces, setSpaces] = useState<Space[]>(cache.spaces ?? []);
  const [loading, setLoading] = useState(enabled && !cache.spaces);
  const [error, setError] = useState("");

  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (enabled) setLoading(true);
  }

  const load = useCallback(async (countFirst = false) => {
    try {
      await ready();
      if (cache.spaces)
        setSpaces((existing) =>
          existing.length ? existing : (cache.spaces ?? []),
        );
      let rev: string | null = null;
      if (countFirst) {
        const meta = await spacesApi.countSpaces().catch(() => null);
        if (meta?.count === 0) {
          cache.rev = meta.rev;
          cache.spaces = [];
          persist();
          setSpaces([]);
          setError("");
          return;
        }
        rev = meta?.rev ?? null;
        if (rev && cache.spaces && cache.rev === rev) {
          setSpaces(cache.spaces);
          setError("");
          return;
        }
      }
      const data = await spacesApi.listSpaces();
      cache.spaces = data;
      cache.rev = rev;
      persist();
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
    queueMicrotask(() => void load(true));
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    return platform().live.subscribe((payload) => {
      if (LIST_EVENTS.has(payload.type)) void load();
    });
  }, [enabled, load]);

  const create = useCallback(
    async (intent: string) => {
      setLoading(true);
      try {
        const created = await spacesApi.createSpace(intent);
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
    return load(true);
  }, [load]);

  return { spaces, loading, error, reload, create, drop };
}
