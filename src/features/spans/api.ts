import { platform } from "@/platform";
import type {
  Collection,
  NewCollection,
  NewSpan,
  Span,
  SpanDayPage,
  SpanDays,
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

function legacyDays(
  fromDay: string,
  toDay: string,
  collectionId?: string,
): Promise<SpanDays> {
  return spansApi
    .getSpans({ ...localDayRange(fromDay, toDay), collectionId })
    .then((spans) => {
      const byDay = new Map<string, Map<string, number>>();
      for (const span of spans) {
        if (!span.start_at) continue;
        const d = new Date(span.start_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const cats = byDay.get(key) ?? new Map<string, number>();
        cats.set(span.category, (cats.get(span.category) ?? 0) + 1);
        byDay.set(key, cats);
      }
      return {
        revision: 0,
        unchanged: false,
        days: [...byDay].map(([day, cats]) => ({
          day,
          count: [...cats.values()].reduce((a, b) => a + b, 0),
          categories: [...cats].map(([category, count]) => ({
            category,
            count,
          })),
        })),
      };
    });
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
  getDays: (
    fromDay: string,
    toDay: string,
    timezone: string,
    opts: { collectionId?: string; ifRevision?: number } = {},
  ): Promise<SpanDays> =>
    platform()
      .http.request<SpanDays>({
        method: "POST",
        path: "/v1/spans/days",
        body: {
          from_day: fromDay,
          to_day: toDay,
          timezone,
          collection_id: opts.collectionId ?? null,
          if_revision: opts.ifRevision ?? null,
        },
      })
      .catch((err: unknown) =>
        NOT_DEPLOYED.test(String(err))
          ? legacyDays(fromDay, toDay, opts.collectionId)
          : Promise.reject(err),
      ),
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
