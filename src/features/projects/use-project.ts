import { useCallback, useEffect, useRef, useState } from "react";
import { projectsApi, localProjects } from "./api";
import type { Project, ProjectExcerpt, SourceChanges } from "./types";
import { platform } from "@/platform";
import { activity } from "./context";

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<SourceChanges>({});
  const current = useRef<Project | null>(null);
  const working = useRef(false);
  const alive = useRef(true);
  const put = useCallback((p: Project) => {
    if (alive.current) {
      current.current = p;
      setProject(p);
    }
  }, []);
  const reload = useCallback(async () => {
    try {
      const p = await projectsApi.get(id);
      put(p);
      setError("");
    } catch (e) {
      if (alive.current) setError(String(e));
    }
  }, [id, put]);
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => void reload());
    return () => {
      alive.current = false;
    };
  }, [reload]);
  useEffect(
    () =>
      platform().live.subscribe((e) => {
        if (
          e.type === "project_updated" &&
          e.project_id === id &&
          !working.current
        )
          void reload();
      }),
    [id, reload],
  );
  const save = useCallback(
    async (transform: (p: Project) => Project) => {
      if (working.current || !current.current)
        throw new Error("Wait for the current change to finish");
      working.current = true;
      setBusy(true);
      setError("");
      try {
        const p = await projectsApi.save(transform(current.current));
        put(p);
        return p;
      } catch (e) {
        const message = String(e);
        setError(
          message.includes("409")
            ? "This project changed on another device. Reload it before saving your change."
            : message,
        );
        throw e;
      } finally {
        working.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [put],
  );
  useEffect(() => {
    if (!platform().projects) return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (checking || working.current || document.hidden) return;
      checking = true;
      try {
        const next = await localProjects().changes(id);
        if (!active) return;
        setChanges(next);
        const p = current.current;
        if (
          p?.data.nodes.some(
            (n) =>
              !n.stale &&
              n.citations.some(
                (c) =>
                  next[c.source_id]?.unavailable ||
                  (next[c.source_id]?.files?.length &&
                    n.origin === "extracted") ||
                  next[c.source_id]?.files?.includes(c.path),
              ),
          )
        ) {
          await save((p) => ({
            ...p,
            data: {
              ...p.data,
              nodes: p.data.nodes.map((n) => ({
                ...n,
                stale:
                  n.stale ||
                  n.citations.some(
                    (c) =>
                      !!next[c.source_id]?.unavailable ||
                      !!(
                        next[c.source_id]?.files?.length &&
                        n.origin === "extracted"
                      ) ||
                      !!next[c.source_id]?.files?.includes(c.path),
                  ),
              })),
            },
          }));
        }
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), 30000);
    void check();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, save]);
  const chat = useCallback(
    async (message: string, excerpts: ProjectExcerpt[]) => {
      if (!current.current || working.current)
        throw new Error("Wait for the current change to finish");
      working.current = true;
      setBusy(true);
      setError("");
      try {
        put(await projectsApi.chat(current.current, message, excerpts));
      } catch (e) {
        setError(String(e));
        throw e;
      } finally {
        working.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [put],
  );
  const index = useCallback(
    async (sourceId: string) => {
      const result = await localProjects().index(id, sourceId);
      const local = (await localProjects().sources(id)).find(
        (s) => s.id === sourceId,
      );
      await save((p) => {
        const retained = p.data.nodes.filter(
          (n) =>
            n.origin !== "extracted" ||
            !n.citations.some((c) => c.source_id === sourceId),
        );
        for (let i = 0; i < retained.length; i++) {
          const n = retained[i];
          if (
            n.citations.some(
              (c) =>
                c.source_id === sourceId && local?.hashes[c.path] !== c.hash,
            )
          )
            retained[i] = { ...n, stale: true };
        }
        const refreshed = result.nodes
          .filter(
            (n) =>
              !retained.some(
                (o) =>
                  o.origin === "user" &&
                  o.citations.some((c) => c.source_id === sourceId) &&
                  (o.title === n.title ||
                    o.history.some((v) => v.title === n.title)),
              ),
          )
          .map((n) => {
            const old = p.data.nodes.find(
              (o) =>
                o.origin === "extracted" &&
                o.title === n.title &&
                o.citations.some((c) => c.source_id === sourceId),
            );
            return old
              ? {
                  ...n,
                  id: old.id,
                  history: [
                    ...old.history,
                    {
                      title: old.title,
                      body: old.body,
                      citations: old.citations,
                      origin: old.origin,
                      updated_at: old.updated_at,
                    },
                  ].slice(-20),
                }
              : n;
          });
        const sources = p.data.sources.some((s) => s.id === sourceId)
          ? p.data.sources.map((s) => (s.id === sourceId ? result.source : s))
          : [...p.data.sources, result.source];
        if (retained.length + refreshed.length > 300)
          throw new Error(
            "This project reached 300 context nodes. Remove unneeded context before importing another source.",
          );
        return activity(
          {
            ...p,
            data: {
              ...p.data,
              sources,
              nodes: [...retained, ...refreshed],
              messages: p.data.messages.map((m) => ({
                ...m,
                proposals: m.proposals.map((n) => ({
                  ...n,
                  stale:
                    n.stale ||
                    n.citations.some(
                      (c) =>
                        c.source_id === sourceId &&
                        local?.hashes[c.path] !== c.hash,
                    ),
                })),
              })),
            },
          },
          `Indexed ${result.source.label}: ${result.source.files} files, ${result.source.symbols} symbols`,
        );
      });
      setChanges((c) => ({ ...c, [sourceId]: { files: [] } }));
      return result;
    },
    [id, save],
  );
  return { project, error, busy, changes, reload, save, chat, index };
}
