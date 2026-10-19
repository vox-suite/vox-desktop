import { invoke } from "@tauri-apps/api/core";
import { platform } from "@/platform";
import { desktopStore } from "./store";
import type { AppCommand, DesktopPage } from "./types";
import { resolveTimelineFilter } from "@/features/timeline/filters";
import { projectsApi } from "@/features/projects/api";
import { spacesApi } from "@/features/spaces/api";
import { timelineApi } from "@/features/timeline/api";
import { discoveryApi } from "@/features/pulse/api";
import type { PulseDefinition } from "@/features/pulse/discovery-types";
import { desktopActions } from "./action-state";
import { diagramRequests } from "./diagram-requests";
const pages = new Set([
  "agent",
  "timeline",
  "pulse",
  "usage",
  "spaces",
  "projects",
  "connections",
  "updates",
]);
const text = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Specify ${label}`);
  return value;
};
async function resolveProject(args: Record<string, unknown>) {
  const id = args.projectId ?? args.project_id;
  if (typeof id === "string") return id;
  const name = args.projectName ?? args.project_name;
  if (typeof name !== "string" || !name.trim()) return null;
  const wanted = name.trim().toLowerCase();
  const { items } = await projectsApi.list();
  const exact = items.filter((p) => p.name.trim().toLowerCase() === wanted);
  const matches = exact.length
    ? exact
    : items.filter((p) => p.name.toLowerCase().includes(wanted));
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "Several projects match that name"
        : "No project has that name",
    );
  return matches[0].id;
}
export async function executeDesktopCommand(
  command: AppCommand,
): Promise<unknown> {
  const args = command.arguments ?? {};
  const context = desktopStore.snapshot();
  desktopActions.start(
    command.commandId,
    command.action,
    context.spaceId,
    context.selectedItemId,
  );
  try {
    let output: unknown;
    switch (command.action) {
      case "navigate": {
        const page = text(args.page, "a page");
        if (!pages.has(page)) throw new Error("Unsupported page");
        const spaceId = typeof args.spaceId === "string" ? args.spaceId : null;
        const pulseId = typeof args.pulseId === "string" ? args.pulseId : null;
        const projectId =
          page === "projects" ? await resolveProject(args) : null;
        if (projectId) await projectsApi.get(projectId);
        if (spaceId) await spacesApi.getSpace(spaceId);
        if (pulseId)
          await platform().http.request({
            method: "GET",
            path: `/v1/me/pulse/charts/${encodeURIComponent(pulseId)}`,
          });
        desktopStore.patch({
          page: page as DesktopPage,
          spaceId,
          pulseId,
          projectId,
          selectedItemId: null,
        });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        output = { page, spaceId, pulseId, projectId };
        break;
      }
      case "terminal_panel":
        if (typeof args.open !== "boolean")
          throw new Error("Specify whether to open the terminal");
        if (args.open && "__TAURI_INTERNALS__" in window)
          await invoke("terminal_open");
        desktopStore.patch({ terminalOpen: args.open });
        output = { open: args.open };
        break;
      case "timeline_filter": {
        const filter = resolveTimelineFilter(args);
        desktopStore.patch({
          page: "timeline",
          timeline: filter,
          selectedItemId: null,
        });
        output = await timelineApi.query({
          start_at: filter.startAt,
          end_at: filter.endAt,
          event_type_value: "transaction",
          spending_only: filter.spendingOnly,
          merchant: filter.merchant,
          category: filter.category,
          limit: 100,
        });
        break;
      }
      case "select_item": {
        const id = text(args.itemId, "an item");
        if (context.page !== "spaces" || !context.spaceId)
          throw new Error("Open a space to select a node");
        const graph = await spacesApi.getSpace(context.spaceId);
        if (desktopStore.snapshot().revision !== context.revision)
          throw new Error("Context changed; read context again");
        if (!graph.nodes.some((node) => node.id === id))
          throw new Error("Node does not exist in this space");
        desktopStore.patch({ selectedItemId: id });
        output = { selectedItemId: id };
        break;
      }
      case "draw_diagram": {
        const prompt = text(args.prompt, "what to draw");
        if (context.page !== "projects" || !context.projectId)
          throw new Error("Open a project before drawing a diagram");
        diagramRequests.start(context.projectId, prompt);
        output = { started: true, projectId: context.projectId };
        break;
      }
      case "list_spaces":
        output = await spacesApi.listSpaces();
        break;
      case "list_pulse_measurements":
        output = await discoveryApi.listMeasurements();
        break;
      case "space_chat":
      case "create_space":
      case "add_node":
      case "update_node":
      case "remove_node":
      case "connect_nodes":
      case "arrange_canvas":
      case "stop_work": {
        if (
          command.action !== "create_space" &&
          args.spaceId &&
          args.spaceId !== context.spaceId
        )
          throw new Error("Context changed; open the intended space first");
        if (command.action !== "create_space" && !context.spaceId)
          throw new Error("Open a space first");
        const result = await platform().http.request<{
          space_id: string;
          node_id?: string;
        }>({
          method: "POST",
          path: "/v1/me/desktop-actions",
          body: {
            command_id: command.commandId,
            action: command.action,
            space_id:
              command.action === "create_space" ? null : context.spaceId,
            arguments: {
              ...args,
              ...(["space_chat", "update_node", "remove_node"].includes(
                command.action,
              ) && !args.nodeId
                ? { nodeId: context.selectedItemId }
                : {}),
            },
          },
        });
        desktopStore.patch({
          page: "spaces",
          spaceId: result.space_id,
          selectedItemId: result.node_id ?? null,
        });
        output = result;
        break;
      }
      case "create_pulse": {
        const definition = args.definition as PulseDefinition;
        if (!definition)
          throw new Error("Choose a real Pulse measurement first");
        await discoveryApi.preview(definition);
        const result = await discoveryApi.save(
          text(args.title, "a title"),
          definition,
          command.commandId,
        );
        desktopStore.patch({
          page: "pulse",
          pulseId: result.id,
          selectedItemId: null,
        });
        output = result;
        break;
      }
      case "update_pulse": {
        const id =
          typeof args.pulseId === "string" ? args.pulseId : context.pulseId;
        if (!id) throw new Error("Choose a Pulse chart");
        if (args.definition)
          await discoveryApi.preview(args.definition as PulseDefinition);
        output = await platform().http.request({
          method: "PATCH",
          path: `/v1/me/pulse/charts/${encodeURIComponent(id)}`,
          body: { title: args.title, definition: args.definition },
        });
        desktopStore.patch({ page: "pulse", pulseId: id });
        break;
      }
      default:
        throw new Error("Unsupported action");
    }
    desktopActions.finish(command.commandId, "completed");
    return output;
  } catch (error) {
    desktopActions.finish(
      command.commandId,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
