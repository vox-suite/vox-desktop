import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LiveEvent, Platform } from "@/platform";

import type { WizStatus } from "./ports";

import { isAllowedExternalUrl } from "./external-url-policy";

export const tauriPlatform: Platform = {
  wiz: {
    getStatus: () => invoke("get_wiz_status"),
    connect: (consent, link) =>
      invoke<WizStatus>("connect_wiz", {
        consent,
        link,
      }).then((status) => status.devices),
    refresh: () => invoke("refresh_wiz"),
    control: (deviceId, state) =>
      invoke("control_wiz", {
        deviceId,
        on: state.on ?? null,
        brightness: state.brightness ?? null,
      }),
    disconnect: () => invoke("disconnect_wiz"),
  },
  browser: {
    openExternal: async (url) => {
      if (!isAllowedExternalUrl(url)) {
        throw new Error("Unsupported external destination");
      }
      await openUrl(url);
    },
  },
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
