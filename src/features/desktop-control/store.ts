import type { DesktopContext, AppResult } from "./types.ts";
export class DesktopControlStore {
  private state: DesktopContext = {
    revision: 0,
    page: "agent",
    spaceId: null,
    projectId: null,
    pulseId: null,
    selectedItemId: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeline: null,
    terminalOpen: false,
  };
  private listeners = new Set<() => void>();
  readonly commands = new Map<string, Promise<AppResult>>();
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  patch(patch: Partial<Omit<DesktopContext, "revision">>) {
    const next = { ...this.state, ...patch };
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = { ...next, revision: this.state.revision + 1 };
    this.listeners.forEach((fn) => fn());
  }
  reset() {
    this.commands.clear();
    this.patch({
      page: "agent",
      spaceId: null,
      projectId: null,
      pulseId: null,
      selectedItemId: null,
      timeline: null,
      terminalOpen: false,
      resourceDetails: undefined,
    });
  }
  navigate(page: DesktopContext["page"]) {
    this.patch({ page, selectedItemId: null });
  }
}
export const desktopStore = new DesktopControlStore();
