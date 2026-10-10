import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, type LocalModelsStatus } from "@/lib/tauri";

const INITIAL: LocalModelsStatus = {
  ready: true,
  configured: false,
  downloading: false,
  downloaded_bytes: 0,
  total_bytes: 0,
  error: null,
};

export function useLocalModels() {
  const [status, setStatus] = useState(INITIAL);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void api.localModelsStatus().then(setStatus);
    void listen<LocalModelsStatus>("vox-models-progress", (event) =>
      setStatus(event.payload),
    ).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  return status;
}
