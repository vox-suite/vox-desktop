import type { AppCommand, AppResult } from "./types.ts";
import type { DesktopControlStore } from "./store.ts";
const actions = new Set([
  "navigate",
  "timeline_filter",
  "select_item",
  "terminal_panel",
  "create_space",
  "space_chat",
  "add_node",
  "update_node",
  "remove_node",
  "connect_nodes",
  "arrange_canvas",
  "stop_work",
  "create_pulse",
  "update_pulse",
  "list_pulse_measurements",
  "list_spaces",
]);
export function applyAppCommand(
  command: AppCommand,
  store: DesktopControlStore,
  execute: (command: AppCommand) => Promise<unknown>,
): Promise<AppResult> {
  const previous = store.commands.get(command.commandId);
  if (previous) return previous;
  const task = Promise.resolve().then(async (): Promise<AppResult> => {
    const fail = (error: string): AppResult => ({
      commandId: command.commandId,
      ok: false,
      error,
      context: store.snapshot(),
    });
    if (
      !Number.isFinite(Date.parse(command.expiresAt)) ||
      Date.parse(command.expiresAt) <= Date.now()
    )
      return fail("expired");
    if (!actions.has(command.action)) return fail("unsupported");
    if (
      command.expectedRevision != null &&
      command.expectedRevision !== store.snapshot().revision &&
      command.action !== "navigate"
    )
      return fail("stale_context");
    try {
      return {
        commandId: command.commandId,
        ok: true,
        output: await execute(command),
        context: store.snapshot(),
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "load_failed");
    }
  });
  store.commands.set(command.commandId, task);
  if (store.commands.size > 200)
    store.commands.delete(store.commands.keys().next().value!);
  return task;
}
