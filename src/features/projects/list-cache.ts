import { projectsApi } from "./api";
import { registerCacheReset } from "@/features/cache-reset";
import { readPersisted, schedulePersist } from "@/features/persist";
import type { Project } from "./types";
type CachedList = {
  rev: string;
  count: number;
  items: Project[];
  next_cursor: string | null;
};
let cache: CachedList | null = null;
let hydration: Promise<void> | null = null;
let epoch = 0;
registerCacheReset(() => {
  epoch++;
  cache = null;
  hydration = null;
});
export async function projectList() {
  const started = epoch;
  hydration ??= readPersisted<CachedList>("projects").then((data) => {
    if (started === epoch && !cache && data) cache = data;
  });
  await hydration;
  const count = await projectsApi.count();
  if (started !== epoch)
    throw new Error("Account changed while loading projects");
  if (cache?.rev === count.rev) return cache;
  const list = count.count
    ? await projectsApi.list()
    : { items: [], next_cursor: null };
  if (started !== epoch)
    throw new Error("Account changed while loading projects");
  cache = { ...list, ...count };
  const snapshot = cache;
  schedulePersist("projects", () => snapshot);
  return cache;
}
