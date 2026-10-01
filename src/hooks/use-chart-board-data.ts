import { useCallback, useEffect, useState } from "react";
import { pulseApi } from "@/features/pulse/api";
import type { ChartBoardDetails, ChartDataResult } from "@/features/pulse/types";

export function useChartBoardData(boardId: string | null) {
  const [board, setBoard] = useState<ChartBoardDetails | null>(null);
  const [data, setData] = useState<ChartDataResult[]>([]);
  const [loading, setLoading] = useState(Boolean(boardId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Switching boards starts a fresh load; set during render, not in an effect.
  const [prevBoardId, setPrevBoardId] = useState(boardId);
  if (boardId !== prevBoardId) {
    setPrevBoardId(boardId);
    setLoading(Boolean(boardId));
  }

  const load = useCallback(async () => {
    if (!boardId) return;
    try {
      const [boardDetails, chartData] = await Promise.all([
        pulseApi.getChartBoard(boardId),
        pulseApi.getChartBoardData(boardId),
      ]);
      setBoard(boardDetails);
      setData(chartData);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    queueMicrotask(() => void load());
  }, [boardId, load]);

  const reload = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  return {
    board: boardId ? board : null,
    data: boardId ? data : [],
    loading,
    refreshing,
    error,
    reload,
  };
}
