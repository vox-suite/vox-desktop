import { platform } from "@/platform";
import { pulseTimezone } from "./api";
import type { ComposeMessage, PulseDefinition } from "./discovery-types";

export type GoalKind = "metric" | "saving";
export type GoalDirection = "at_least" | "at_most";
export type GoalPeriod = "week" | "month";
export type GoalStatus =
  | "done"
  | "ahead"
  | "on_track"
  | "behind"
  | "in_progress"
  | "within_limit"
  | "over_limit"
  | "unavailable";

export type GoalDraft = {
  timezone: string;
  title: string;
  kind: GoalKind;
  direction: GoalDirection;
  period: GoalPeriod | null;
  target: number;
  unit: string;
  definition: PulseDefinition | null;
  deadline: string | null;
};
export type GoalView = {
  id: string;
  title: string;
  kind: GoalKind;
  direction: GoalDirection;
  period?: GoalPeriod | null;
  target: number;
  unit: string;
  current: number;
  percent: number;
  status: GoalStatus;
  remaining: number;
  starts_on: string;
  deadline?: string | null;
  period_ends_on?: string | null;
  days_left?: number | null;
  per_week_needed?: number | null;
  projected_on?: string | null;
  error?: string | null;
};
export type GoalComposeResponse = {
  reply: string;
  draft: GoalDraft | null;
  preview: GoalView | null;
};

export const goalsApi = {
  list: () =>
    platform().http.request<GoalView[]>({
      method: "GET",
      path: "/v1/me/pulse/goals",
      query: { timezone: pulseTimezone() },
      timeoutMs: 60000,
    }),
  create: (draft: GoalDraft) =>
    platform().http.request<GoalView>({
      method: "POST",
      path: "/v1/me/pulse/goals",
      body: draft,
      timeoutMs: 60000,
    }),
  remove: (id: string) =>
    platform().http.request<void>({
      method: "DELETE",
      path: `/v1/me/pulse/goals/${id}`,
    }),
  addEntry: (id: string, amount: number, note?: string) =>
    platform().http.request<GoalView>({
      method: "POST",
      path: `/v1/me/pulse/goals/${id}/entries`,
      body: { timezone: pulseTimezone(), amount, note: note ?? null },
    }),
  compose: (messages: ComposeMessage[], current: GoalDraft | null) =>
    platform().http.request<GoalComposeResponse>({
      method: "POST",
      path: "/v1/me/pulse/goals/compose",
      body: { timezone: pulseTimezone(), messages, current },
      timeoutMs: 150000,
    }),
};
