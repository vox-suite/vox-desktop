import { useCallback, useEffect, useState } from "react";
import { spacesApi, type SpaceGraph } from "@/lib/spaces";

export function useSpace(spaceId: string | null) {
  const [graph, setGraph] = useState<SpaceGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);

  const load = useCallback(async () => {
    if (!spaceId) return;
    try {
      const data = await spacesApi.getSpace(spaceId);
      setGraph(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId) {
      setGraph(null);
      return;
    }
    setLoading(true);
    void load().finally(() => setLoading(false));

    const interval = setInterval(() => {
      void load();
    }, 2500);

    return () => clearInterval(interval);
  }, [spaceId, load]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!spaceId || !message.trim()) return;
      setSending(true);
      try {
        await spacesApi.sendSpaceChat(spaceId, message);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [spaceId, load]
  );

  const commit = useCallback(async () => {
    if (!spaceId) return null;
    setCommitting(true);
    try {
      const res = await spacesApi.commitSpace(spaceId);
      await load();
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setCommitting(false);
    }
  }, [spaceId, load]);

  return {
    graph,
    loading,
    error,
    sending,
    committing,
    reload: load,
    sendMessage,
    commit,
  };
}
