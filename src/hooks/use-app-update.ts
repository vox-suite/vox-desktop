import { useEffect, useState } from "react";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { platform } from "@/platform";

type AppUpdate = { required: boolean; latest: string | null; installing: boolean };

const RELEASES = "https://github.com/vox-suite/vox-desktop/releases/latest";

let state: AppUpdate = { required: false, latest: null, installing: false };
let ready: Update | null = null;
let busy = false;
const listeners = new Set<(update: AppUpdate) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function publish(next: Partial<AppUpdate>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

async function install() {
  if (!ready || state.installing) return;
  publish({ installing: true });
  try {
    await ready.install();
    await relaunch();
  } catch {
    publish({ installing: false });
  }
}

async function check() {
  if (busy) return;
  busy = true;
  try {
    const server = await platform().http
      .request<{ status: string }>({ method: "GET", path: "/v1/app/version", query: { platform: "desktop", version: __APP_VERSION__ } })
      .catch(() => null);
    publish({ required: server?.status === "update_required" });
    if (!ready) {
      const update = await checkUpdate().catch(() => null);
      if (update) {
        await update.download();
        ready = update;
      }
    }
    publish({ latest: ready?.version ?? null });
    if (state.required) await install();
  } catch {
    publish({ latest: null });
  } finally {
    busy = false;
  }
}

export function useAppUpdate() {
  const [update, setUpdate] = useState(state);
  useEffect(() => {
    listeners.add(setUpdate);
    if (!timer) {
      void check();
      timer = setInterval(() => void check(), 60 * 60 * 1000);
    }
    return () => {
      listeners.delete(setUpdate);
    };
  }, []);
  return {
    ...update,
    check,
    install,
    download: () => void platform().browser?.openExternal(RELEASES),
  };
}
