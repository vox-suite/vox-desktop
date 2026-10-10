import { desktopActions } from "@/features/desktop-control/action-state";
import { useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { desktopStore } from "@/features/desktop-control/store";
import { applyAppCommand } from "@/features/desktop-control/commands";
import type { AppCommand } from "@/features/desktop-control/types";
import { executeDesktopCommand } from "@/features/desktop-control/execute";
export function useDesktopContext() {
  return useSyncExternalStore(desktopStore.subscribe, desktopStore.snapshot);
}
export function useDesktopControl(enabled: boolean) {
  const context = useDesktopContext();
  useEffect(() => {
    if (!enabled || !("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen<{ requestId: string; command: AppCommand }>(
      "vox-app-command",
      (event) => {
        if (!active) return;
        void applyAppCommand(
          event.payload.command,
          desktopStore,
          executeDesktopCommand,
        ).then((result) =>
          invoke("complete_app_command", {
            requestId: event.payload.requestId,
            result,
          }),
        );
      },
    ).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    const publish = () => {
      void invoke("set_app_context", {
        context: desktopStore.snapshot(),
      }).catch(() => {});
    };
    publish();
    const unsubscribe = desktopStore.subscribe(publish);
    const heartbeat = setInterval(publish, 10000);
    return () => {
      active = false;
      unlisten?.();
      unsubscribe();
      clearInterval(heartbeat);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) {
      desktopStore.reset();
      desktopActions.reset();
    }
  }, [enabled]);
  return context;
}
