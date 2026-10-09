import { platform } from "@/platform";
import type { components } from "@/features/api.gen";
type S = components["schemas"];
export type TimelineGroup = S["TimelineGroup"];
export type TimelineEventType = S["TimelineEventType"];
export type TimelineEntry = S["TimelineEventWithEvidence"];
export const timelineApi = {
  groups: () => platform().http.request<TimelineGroup[]>({ method: "GET", path: "/v1/timeline/groups" }),
  types: () => platform().http.request<TimelineEventType[]>({ method: "GET", path: "/v1/timeline/event-types" }),
  query: (body: S["TimelineQuery"]) => platform().http.request<S["TimelinePage"]>({ method: "POST", path: "/v1/timeline/events/query", body }),
  counts: (body: S["TimelineCountsQuery"]) => platform().http.request<S["TimelineDayCount"][]>({ method: "POST", path: "/v1/timeline/events/counts", body }),
};
