import { useEffect, useState } from "react";
import { projectsApi } from "./api";
import type { Project } from "./types";
export function useProjectOptions(enabled = true) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        let before: string | undefined;
        const items: Project[] = [];
        const seen = new Set<string>();
        do {
          const page = await projectsApi.list(before);
          if (!active) return;
          items.push(
            ...page.items.filter((p) => !items.some((o) => o.id === p.id)),
          );
          before = page.next_cursor ?? undefined;
          if (before && seen.has(before))
            throw new Error("Project pagination did not advance");
          if (before) seen.add(before);
        } while (before);
        if (active) {
          setProjects(items);
          setError("");
        }
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [enabled]);
  return { projects, error, loading };
}
