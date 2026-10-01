import { platform } from "@/platform";
import type {
  Collection,
  NewCollection,
  NewSpan,
  Span,
  SpanPatch,
  SpanQuery,
} from "./types";

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
