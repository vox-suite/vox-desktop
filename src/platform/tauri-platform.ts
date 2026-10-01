import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LiveEvent, Platform } from "./ports";

export const tauriPlatform: Platform = {
  http: {
    request: <T>(req: Parameters<Platform["http"]["request"]>[0]) =>
      invoke<T>("core_http", {
        method: req.method,
        path: req.path,
        query: req.query ? Object.entries(req.query) : null,
        body: req.body ?? null,
        timeoutMs: req.timeoutMs ?? null,
      }),
  },
  live: {
    subscribe: (handler) => {
      let active = true;
      let unlisten: (() => void) | undefined;
      void listen<string>("vox-live-update", (event) => {
        if (!active) return;
        try {
          const parsed = JSON.parse(event.payload) as LiveEvent;
          if (typeof parsed.type === "string") handler(parsed);
        } catch {
          return;
        }
      }).then((fn) => {
        if (active) unlisten = fn;
        else fn();
      });
      return () => {
        active = false;
        unlisten?.();
      };
    },
  },
};
