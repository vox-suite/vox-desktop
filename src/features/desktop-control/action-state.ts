export type DesktopAction = {
  id: string;
  action: string;
  phase: "started" | "completed" | "failed";
  spaceId: string | null;
  nodeId: string | null;
  error?: string;
};
export function reduceAction(
  state: Record<string, DesktopAction>,
  event: DesktopAction,
) {
  const current = state[event.id];
  if (current && current.phase !== "started" && event.phase === "started")
    return state;
  return { ...state, [event.id]: event };
}
class ActionState {
  private state: Record<string, DesktopAction> = {};
  private listeners = new Set<() => void>();
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  start(
    id: string,
    action: string,
    spaceId: string | null,
    nodeId: string | null,
  ) {
    this.state = reduceAction(this.state, {
      id,
      action,
      phase: "started",
      spaceId,
      nodeId,
    });
    const ids = Object.keys(this.state);
    if (ids.length > 100) {
      for (const key of ids.slice(0, ids.length - 100))
        if (this.state[key].phase !== "started") delete this.state[key];
    }
    this.emit();
  }
  finish(id: string, phase: "completed" | "failed", error?: string) {
    const current = this.state[id];
    if (current) {
      this.state = reduceAction(this.state, { ...current, phase, error });
      this.emit();
    }
  }
  reset() {
    this.state = {};
    this.emit();
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }
}
export const desktopActions = new ActionState();
