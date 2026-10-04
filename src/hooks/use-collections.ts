import { useCallback, useEffect, useState } from "react";
import { spansApi } from "@/features/spans/api";
import type { Collection, NewCollection } from "@/features/spans/types";
import { errorMessage } from "@/lib/errors";

export function useCollections(signedIn: boolean) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await spansApi.getCollections();
      setCollections(list);
    } catch {
      /* keep previous list */
    }
  }, []);

  useEffect(() => {
    if (signedIn) queueMicrotask(() => void load());
  }, [signedIn, load]);

  async function create(form: NewCollection) {
    try {
      await spansApi.createCollection(form);
      setError("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }

  async function archive(id: string) {
    try {
      await spansApi.archiveCollection(id);
      if (selectedId === id) setSelectedId(null);
      setError("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return {
    collections,
    selectedId,
    setSelectedId,
    error,
    reload: load,
    create,
    archive,
  };
}
