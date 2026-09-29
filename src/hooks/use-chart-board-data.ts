import { useCallback, useEffect, useState } from "react";
import { api, type ChartBoardDetails, type ChartDataResult } from "@/lib/tauri";

export function useChartBoardData(boardId: string | null) {
  const [board, setBoard] = useState<ChartBoardDetails | null>(null);
  const [data, setData] = useState<ChartDataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!boardId) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [boardDetails, chartData] = await Promise.all([
        api.getChartBoard(boardId),
        api.getChartBoardData(boardId),
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
    if (!boardId) {
      setBoard(null);
      setData([]);
      setError("");
      return;
    }
    void load(false);
  }, [boardId, load]);

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  return { board, data, loading, refreshing, error, reload };
}
