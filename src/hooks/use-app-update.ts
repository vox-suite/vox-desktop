import { useEffect, useState } from "react";
import { platform } from "@/platform";

type AppUpdate = { required: boolean; latest: string | null };

const RELEASES = "https://github.com/vox-suite/vox-desktop/releases/latest";
const LATEST_API = "https://api.github.com/repos/vox-suite/vox-desktop/releases/latest";

let state: AppUpdate = { required: false, latest: null };
const listeners = new Set<(update: AppUpdate) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function parts(version: string) {
  return version.replace(/^v/, "").split(/[.+-]/).map(Number).filter(Number.isFinite);
}

function newer(candidate: string, current: string) {
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff > 0;
  }
  return false;
}

async function check() {
  const [server, release] = await Promise.allSettled([
    platform().http.request<{ status: string }>({ method: "GET", path: "/v1/app/version", query: { platform: "desktop", version: __APP_VERSION__ } }),
    fetch(LATEST_API).then((response) => (response.ok ? response.json() as Promise<{ tag_name?: string }> : null)),
  ]);
  const tag = release.status === "fulfilled" ? release.value?.tag_name : undefined;
  state = {
    required: server.status === "fulfilled" && server.value.status === "update_required",
    latest: tag && newer(tag, __APP_VERSION__) ? tag.replace(/^v/, "") : null,
  };
  listeners.forEach((listener) => listener(state));
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
  return { ...update, check, download: () => void platform().browser.openExternal(RELEASES) };
}
