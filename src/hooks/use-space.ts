import { useCallback, useEffect, useState } from "react";
import { spacesApi } from "@/features/spaces/api";
import { platform } from "@/platform";
import {
  type SpaceGraph,
  type SpaceMessage,
  type SpaceNode,
} from "@/features/spaces/types";

export function useSpace(spaceId: string | null) {
  const [graph, setGraph] = useState<SpaceGraph | null>(null);
  const [messages, setMessages] = useState<SpaceMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(spaceId));
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [prevSpaceId, setPrevSpaceId] = useState(spaceId);
  if (spaceId !== prevSpaceId) {
    setPrevSpaceId(spaceId);
    setGraph(null);
    setMessages([]);
    setLoading(Boolean(spaceId));
  }

  const loadGraph = useCallback(async () => {
    if (!spaceId) return;
    try {
      const data = await spacesApi.getSpace(spaceId);
      setGraph(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [spaceId]);

  const loadMessages = useCallback(async () => {
    if (!spaceId) return;
    try {
      const data = await spacesApi.listMessages(spaceId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [spaceId]);

  const reload = useCallback(async () => {
    await Promise.all([loadGraph(), loadMessages()]);
  }, [loadGraph, loadMessages]);

  useEffect(() => {
    if (!spaceId) return;
    let isCancelled = false;
    queueMicrotask(() => {
      void Promise.all([loadGraph(), loadMessages()]).finally(() => {
        if (!isCancelled) setLoading(false);
      });
    });
    return () => {
      isCancelled = true;
    };
  }, [spaceId, loadGraph, loadMessages]);

  useEffect(() => {
    if (!spaceId) return;
    const onFocus = () => {
      void loadGraph();
      void loadMessages();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [spaceId, loadGraph, loadMessages]);

  useEffect(() => {
    if (!spaceId) return;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = platform().live.subscribe((payload) => {
      if (payload.type === "live_reconnected") {
        void loadGraph();
        void loadMessages();
        return;
      }
      if (!payload.type.startsWith("space_") || payload.space_id !== spaceId) {
        return;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadGraph();
      }, 150);
      if (payload.type === "space_message_created") {
        void loadMessages();
      }
    });

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [spaceId, loadGraph, loadMessages]);

  const updateNode = useCallback(
    async (
      nodeId: string,
      patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>
    ) => {
      if (!spaceId) return;
      let prevGraph: SpaceGraph | null = null;
      setGraph((curr) => {
        prevGraph = curr;
        if (!curr) return curr;
        return {
          ...curr,
          nodes: curr.nodes.map((n) =>
            n.id === nodeId ? { ...n, ...patch } : n
          ),
        };
      });

      try {
        const updated = await spacesApi.updateNode(spaceId, nodeId, patch);
        setGraph((curr) => {
          if (!curr) return curr;
          return {
            ...curr,
            nodes: curr.nodes.map((n) => (n.id === nodeId ? updated : n)),
          };
        });
        return updated;
      } catch (err) {
        if (prevGraph) setGraph(prevGraph);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [spaceId]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!spaceId || !message.trim()) return;
      setSending(true);
      try {
        await spacesApi.sendSpaceChat(spaceId, message);
        await Promise.all([loadGraph(), loadMessages()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [spaceId, loadGraph, loadMessages]
  );

  const commit = useCallback(async () => {
    if (!spaceId) return null;
    setCommitting(true);
    try {
      const res = await spacesApi.commitSpace(spaceId);
      await loadGraph();
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setCommitting(false);
    }
  }, [spaceId, loadGraph]);

  return {
    graph,
    messages,
    loading,
    error,
    sending,
    committing,
    reload,
    sendMessage,
    commit,
    updateNode,
  };
}
