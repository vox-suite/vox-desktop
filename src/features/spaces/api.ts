import { platform } from "@/platform";
import { pulseTimezone } from "@/features/pulse/api";
import type { GoalView } from "@/features/pulse/goals";
import type {
  CommitSpaceResult,
  Space,
  SpaceGraph,
  SpaceMessage,
  SpaceNode,
} from "@/features/spaces/types";

const CREATE_TIMEOUT_MS = 30_000;

export const spacesApi = {
  listSpaces: () =>
    platform().http.request<Space[]>({ method: "GET", path: "/v1/me/spaces" }),
  getSpace: (id: string) =>
    platform().http.request<SpaceGraph>({
      method: "GET",
      path: `/v1/me/spaces/${id}`,
    }),
  createSpace: (intent: string) =>
    platform().http.request<Space>({
      method: "POST",
      path: "/v1/me/spaces",
      body: { intent, title: intent.split(/\s+/).slice(0, 5).join(" ") },
      timeoutMs: CREATE_TIMEOUT_MS,
    }),
  dropSpace: (id: string) =>
    platform().http.request<void>({
      method: "DELETE",
      path: `/v1/me/spaces/${id}`,
    }),
  sendSpaceChat: (id: string, message: string) =>
    platform().http.request<{ status: string }>({
      method: "POST",
      path: `/v1/me/spaces/${id}/chat`,
      body: { message },
    }),
  commitSpace: (id: string) =>
    platform().http.request<CommitSpaceResult>({
      method: "POST",
      path: `/v1/me/spaces/${id}/commit`,
    }),
  updateNode: (
    spaceId: string,
    nodeId: string,
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>,
  ) =>
    platform().http.request<SpaceNode>({
      method: "PATCH",
      path: `/v1/me/spaces/${spaceId}/nodes/${nodeId}`,
      body: patch,
    }),
  approveNodeGoal: (spaceId: string, nodeId: string) =>
    platform().http.request<{ goal: GoalView; node: SpaceNode }>({
      method: "POST",
      path: `/v1/me/spaces/${spaceId}/nodes/${nodeId}/goal`,
      body: { timezone: pulseTimezone() },
      timeoutMs: 60000,
    }),
  listMessages: (spaceId: string) =>
    platform().http.request<SpaceMessage[]>({
      method: "GET",
      path: `/v1/me/spaces/${spaceId}/messages`,
    }),
};
