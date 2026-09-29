import { useCallback, useEffect, useState } from "react";
import { spacesApi, type Space } from "@/lib/spaces";

export function useSpaces(enabled = true) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await spacesApi.listSpaces();
      setSpaces(data);
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

  const create = useCallback(
    async (title: string, intent: string) => {
      setLoading(true);
      try {
        const created = await spacesApi.createSpace(title, intent);
        await load();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [load]
  );

  const drop = useCallback(
    async (id: string) => {
      try {
        await spacesApi.dropSpace(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [load]
  );

  return { spaces, loading, error, reload: load, create, drop };
}
