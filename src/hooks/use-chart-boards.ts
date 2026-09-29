import { useCallback, useEffect, useState } from "react";
import { api, type ChartBoard } from "@/lib/tauri";

export function useChartBoards(enabled = true) {
  const [boards, setBoards] = useState<ChartBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listChartBoards();
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
    void load();
  }, [enabled, load]);

  return { boards, loading, error, reload: load };
}
