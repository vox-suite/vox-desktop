import type { components } from "../api.gen";

type S = components["schemas"];

export type SpanStatus = S["SpanStatus"];
export type ExecutionType = S["ExecutionType"];
export type CollectionKind = S["CollectionKind"];

export type Span = Omit<Required<S["Span"]>, "data"> & {
  data: Record<string, unknown>;
};

export type NewSpan = Omit<S["NewSpan"], "data"> & {
  data?: Record<string, unknown>;
};

export type SpanPatch = S["SpanPatch"];

export type SpanQuery = {
  from?: string;
  to?: string;
  collectionId?: string;
  status?: SpanStatus;
  unscheduled?: boolean;
};

export type Collection = Required<S["Collection"]>;

export type NewCollection = S["CreateCollectionInput"];
