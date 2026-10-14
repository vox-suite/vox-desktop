import { platform } from "@/platform";
import type {
  Collection,
  NewCollection,
  NewSpan,
  Span,
  SpanDayPage,
  SpanPatch,
  SpanQuery,
} from "@/features/spans/types";

const NOT_DEPLOYED = /failed: (400|404|405)\b/;

function localDayRange(fromDay: string, toDay: string) {
  const from = new Date(`${fromDay}T00:00:00`);
  const to = new Date(`${toDay}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export const spansApi = {
  getSpans: (q: SpanQuery) => {
    const body: Record<string, unknown> = {};
    if (q.from) body.from = q.from;
    if (q.to) body.to = q.to;
    if (q.collectionId) body.collection_id = q.collectionId;
    if (q.status) body.status = q.status;
    if (q.unscheduled !== undefined) body.unscheduled = q.unscheduled;
    return platform().http.request<Span[]>({
      method: "POST",
      path: "/v1/spans/list",
      body,
    });
  },
  getDayPage: (
    day: string,
    timezone: string,
    cursor: string | null,
    collectionId?: string,
    limit = 40,
  ): Promise<SpanDayPage> =>
    platform()
      .http.request<SpanDayPage>({
        method: "POST",
        path: "/v1/spans/day",
        body: {
          day,
          timezone,
          cursor,
          limit,
          collection_id: collectionId ?? null,
        },
      })
      .catch((err: unknown) =>
        NOT_DEPLOYED.test(String(err))
          ? spansApi
              .getSpans({ ...localDayRange(day, day), collectionId })
              .then((items) => ({ revision: 0, items, next_cursor: null }))
          : Promise.reject(err),
      ),
  createSpan: (payload: NewSpan) =>
    platform().http.request<Span>({
      method: "POST",
      path: "/v1/spans",
      body: payload,
    }),
  updateSpan: (id: string, patch: SpanPatch) =>
    platform().http.request<Span>({
      method: "POST",
      path: `/v1/spans/${id}/update`,
      body: patch,
    }),
  deleteSpan: (id: string) =>
    platform().http.request<void>({
      method: "POST",
      path: `/v1/spans/${id}/delete`,
    }),
  getCollections: () =>
    platform().http.request<Collection[]>({
      method: "POST",
      path: "/v1/collections/list",
      body: {},
    }),
  createCollection: (payload: NewCollection) =>
    platform().http.request<Collection>({
      method: "POST",
      path: "/v1/collections",
      body: payload,
    }),
  updateCollection: (id: string, patch: Partial<NewCollection>) =>
    platform().http.request<Collection>({
      method: "POST",
      path: `/v1/collections/${id}/update`,
      body: patch,
    }),
  archiveCollection: (id: string) =>
    platform().http.request<void>({
      method: "POST",
      path: `/v1/collections/${id}/archive`,
    }),
  setSpanCollection: (collectionId: string, spanId: string, member: boolean) =>
    platform().http.request<void>({
      method: "POST",
      path: `/v1/collections/${collectionId}/spans/${spanId}/${member ? "add" : "remove"}`,
    }),
};
