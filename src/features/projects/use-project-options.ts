import { useCallback, useEffect, useRef, useState } from "react";
import { projectList } from "./list-cache";
import type { Project } from "./types";
export function useProjectOptions(enabled = true) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);
  const load = useCallback(async (before?: string) => {
    const current = ++ticket.current;
    setLoading(true);
    try {
      const page = await projectList(before);
      if (current !== ticket.current) return;
      setProjects(page.items);
      setNext(page.next_cursor);
      setError("");
    } catch (e) {
      if (current === ticket.current) setError(String(e));
    } finally {
      if (current === ticket.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void load();
    return () => {
      ticket.current++;
    };
  }, [enabled, load]);
  return {
    projects,
    error,
    loading,
    hasMore: !!next,
    loadMore: () => (next ? load(next) : Promise.resolve()),
  };
}
