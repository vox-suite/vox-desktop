import { useCallback, useEffect, useRef, useState } from "react";
import { registerCacheReset } from "@/features/cache-reset";
import { readPersisted, schedulePersist } from "@/features/persist";
import { spacesApi, type SpaceListFilters } from "@/features/spaces/api";
import type { Space } from "@/features/spaces/types";
import { platform } from "@/platform";

const PAGE_SIZE = 24;

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

const isFiltered = (f: SpaceListFilters) =>
  !!(f.q || f.state || (f.sort && f.sort !== "created"));

export function useSpaces(enabled = true, filters: SpaceListFilters = {}) {
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });
  const filterKey = `${filters.q ?? ""}|${filters.state ?? ""}|${filters.sort ?? ""}`;
  const [spaces, setSpaces] = useState<Space[]>(cache.spaces ?? []);
  const [loading, setLoading] = useState(enabled && !cache.spaces);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const requests = useRef(0);

  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (enabled) setLoading(true);
  }

  const load = useCallback(async (countFirst = false) => {
    const ticket = ++requests.current;
    const filters = filtersRef.current;
    if (isFiltered(filters)) {
      try {
        const page = await spacesApi.listSpaces(PAGE_SIZE + 1, 0, filters);
        if (ticket !== requests.current) return;
        setSpaces(page.slice(0, PAGE_SIZE));
        setHasMore(page.length > PAGE_SIZE);
        setError("");
      } catch (err) {
        if (ticket === requests.current)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (ticket === requests.current) setLoading(false);
      }
      return;
    }
    try {
      await ready();
      if (ticket !== requests.current) return;
      if (cache.spaces)
        setSpaces((existing) =>
          existing.length ? existing : (cache.spaces ?? []),
        );
      let rev: string | null = null;
      if (countFirst) {
        const meta = await spacesApi.countSpaces().catch(() => null);
        if (ticket !== requests.current) return;
        if (meta?.count === 0) {
          cache.rev = meta.rev;
          cache.spaces = [];
          persist();
          setSpaces([]);
          setHasMore(false);
          setError("");
          return;
        }
        rev = meta?.rev ?? null;
        if (rev && cache.spaces && cache.rev === rev) {
          setSpaces(cache.spaces);
          setHasMore(
            cache.spaces.length < (meta?.count ?? cache.spaces.length),
          );
          setError("");
          return;
        }
      }
      const limit = Math.max(PAGE_SIZE, cache.spaces?.length ?? 0);
      const page = await spacesApi.listSpaces(limit + 1);
      if (ticket !== requests.current) return;
      const data = page.slice(0, limit);
      setHasMore(page.length > limit);
      cache.spaces = data;
      cache.rev = rev;
      persist();
      setSpaces(data);
      setError("");
    } catch (err) {
      if (ticket === requests.current)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (ticket === requests.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    queueMicrotask(() => void load(true));
  }, [enabled, load, filterKey]);

  useEffect(() => {
    if (!enabled) return;
    return platform().live.subscribe((payload) => {
      if (LIST_EVENTS.has(payload.type)) void load();
    });
  }, [enabled, load]);

  const create = useCallback(
    async (intent: string, projectId?: string) => {
      setLoading(true);
      try {
        const created = await spacesApi.createSpace(intent, projectId);
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

  const loadMore = async () => {
    if (loading || !hasMore) return;
    const ticket = ++requests.current;
    setLoading(true);
    try {
      const filtered = isFiltered(filtersRef.current);
      const page = await spacesApi.listSpaces(
        PAGE_SIZE + 1,
        spaces.length,
        filtersRef.current,
      );
      if (ticket !== requests.current) return;
      const merged = [
        ...spaces,
        ...page
          .slice(0, PAGE_SIZE)
          .filter((p) => !spaces.some((old) => old.id === p.id)),
      ];
      if (!filtered) {
        cache.spaces = merged;
        persist();
      }
      setSpaces(merged);
      setHasMore(page.length > PAGE_SIZE);
      setError("");
    } catch (err) {
      if (ticket === requests.current) setError(String(err));
    } finally {
      if (ticket === requests.current) setLoading(false);
    }
  };
  return { spaces, loading, error, reload, create, drop, hasMore, loadMore };
}
