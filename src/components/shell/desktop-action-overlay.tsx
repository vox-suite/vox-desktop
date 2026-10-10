import { useSyncExternalStore } from "react";
import { desktopActions } from "@/features/desktop-control/action-state";
export function DesktopActionOverlay() {
  const actions = useSyncExternalStore(
    desktopActions.subscribe,
    desktopActions.snapshot,
  );
  const pending = Object.values(actions).filter(
    (action) =>
      action.phase === "started" &&
      ![
        "navigate",
        "terminal_panel",
        "list_spaces",
        "list_pulse_measurements",
      ].includes(action.action),
  );
  if (!pending.length) return null;
  return (
    <div
      role="status"
      aria-label="Vox is working"
      className="pointer-events-none absolute bottom-5 right-5 z-40 w-64 rounded-lg border border-border bg-background/95 p-4 shadow-lg"
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {pending[0].action.replaceAll("_", " ")}…
      </p>
      <div className="space-y-2 motion-safe:animate-pulse">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}
