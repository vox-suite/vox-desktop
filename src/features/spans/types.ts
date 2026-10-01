export type SpanStatus =
  "planned" | "active" | "waiting_user" | "done" | "failed" | "cancelled";

export type ExecutionType = "autonomous" | "interactive" | "manual_human";

export type Span = {
  id: string;
  parent_id: string | null;
  title: string;
  notes: string;
  category: string;
  source: string;
  schema_id: string | null;
  schema_color_token: number | null;
  schema_icon_token: number | null;
  status: SpanStatus;
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
  priority: number;
  execution_type: ExecutionType | null;
  execution_result: unknown;
  data: Record<string, unknown>;
  collection_ids: string[];
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SpanQuery = {
  from?: string;
  to?: string;
  collectionId?: string;
  status?: SpanStatus;
  unscheduled?: boolean;
};

export type NewSpan = {
  title: string;
  notes?: string;
  category?: string;
  status?: SpanStatus;
  start_at?: string | null;
  end_at?: string | null;
  due_at?: string | null;
  execution_type?: ExecutionType | null;
  data?: Record<string, unknown>;
  collection_ids?: string[];
};

export type SpanPatch = Partial<
  Pick<
    Span,
    "title" | "notes" | "category" | "status" | "start_at" | "end_at" | "due_at"
  >
>;

export type CollectionKind = "trip" | "event" | "course" | "area" | "custom";

export type Collection = {
  id: string;
  name: string;
  description: string;
  kind: CollectionKind;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  span_count: number;
};

export type NewCollection = {
  name: string;
  description?: string;
  kind?: CollectionKind;
  starts_at?: string | null;
  ends_at?: string | null;
};
