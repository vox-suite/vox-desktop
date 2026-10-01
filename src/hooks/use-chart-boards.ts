import { useCallback, useEffect, useState } from "react";
import { pulseApi } from "@/features/pulse/api";
import type { ChartBoard } from "@/features/pulse/types";

export function useChartBoards(enabled = true) {
  const [boards, setBoards] = useState<ChartBoard[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (enabled) setLoading(true);
  }

  const load = useCallback(async () => {
    try {
      const data = await pulseApi.listChartBoards();
      setBoards(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    queueMicrotask(() => void load());
  }, [enabled, load]);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { boards, loading, error, reload };
}
