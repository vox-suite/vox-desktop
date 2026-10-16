import { platform } from "@/platform";
import type { components } from "@/features/api.gen";
type S = components["schemas"];
export type TimelineGroup = S["TimelineGroup"];
export type TimelineEventType = S["TimelineEventType"];
export type TimelineEntry = S["TimelineEventWithEvidence"];
export type TimelineDaySummary = {
  day: string;
  count: number;
  rev: string;
  categories: { category: string; count: number }[];
};
export type TimelineDays = { revision: number; days: TimelineDaySummary[] };
export const TIMELINE_PAGE_SIZE = 30;
export const timelineApi = {
  groups: () => platform().http.request<TimelineGroup[]>({ method: "GET", path: "/v1/timeline/groups" }),
  types: () => platform().http.request<TimelineEventType[]>({ method: "GET", path: "/v1/timeline/event-types" }),
  query: (body: S["TimelineQuery"] & {spending_only?:boolean;merchant?:string|null;category?:string|null}) => platform().http.request<S["TimelinePage"]>({ method: "POST", path: "/v1/timeline/events/query", body }),
  days: (body: { start_at: string; end_at: string; timezone: string; group_value?: string | null }) => platform().http.request<TimelineDays>({ method: "POST", path: "/v1/timeline/events/days", body, timeoutMs: 15000 }),
  create: (body: S["IngestTimelineEventInput"]) => platform().http.request<TimelineEntry>({ method: "POST", path: "/v1/timeline/events", body }),
  update: (id: string, body: { title?: string; summary?: string | null; occurred_at?: string; ended_at?: string | null }) => platform().http.request<void>({ method: "PATCH", path: `/v1/timeline/events/${id}`, body }),
  remove: (id: string) => platform().http.request<void>({ method: "DELETE", path: `/v1/timeline/events/${id}` }),
  counts: (body: S["TimelineCountsQuery"]) => platform().http.request<S["TimelineDayCount"][]>({ method: "POST", path: "/v1/timeline/events/counts", body }),
};
