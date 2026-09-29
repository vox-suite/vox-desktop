import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type AuthState = {
  signed_in: boolean;
  user_id: string | null;
  email: string | null;
  bridge_url: string;
  api_url: string;
  has_phone: boolean;
  user_name?: string | null;
  avatar_url?: string | null;
};

export type CallStatus = {
  active: boolean;
  state: string;
  mic_level: number;
  is_speaking: boolean;
};

export type DeviceLinkStatus = {
  status: "connected" | "connecting" | "disconnected" | "disabled";
};

export type LocalEvent = {
  id: string;
  timestamp: string;
  kind: "system" | "command" | "output" | "status" | "success" | "error";
  text: string;
};

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

export type Schema = {
  id: string;
  user_id: string | null;
  owner_scope: string;
  namespace: string;
  name: string;
  version: number;
  description: string;
  json_schema: Record<string, unknown>;
  color_token: number;
  icon_token: number;
  state: "active" | "deprecated";
  created_at: string;
  updated_at: string;
};

export type ChartType = "line" | "bar" | "pie" | "area";

export type Aggregation = "sum" | "count" | "avg" | "min" | "max";

export type QuerySpec = {
  metric_field: string;
  aggregation: Aggregation;
  group_by: "day" | "week" | "month" | string;
};

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type Chart = {
  id: string;
  board_id: string;
  title: string;
  chart_type: ChartType;
  schema_ids: string[];
  query_spec: QuerySpec | Record<string, unknown>;
  created_at: string;
};

export type ChartSuggestion = {
  title: string;
  description: string;
  chart_type: ChartType;
  schema_ids: string[];
  query_spec: QuerySpec;
};

export type ChartBoard = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  chart_count?: number;
  charts?: Chart[];
};

export type ChartBoardDetails = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  charts: Chart[];
};

export type ChartDataResult = {
  chart_id: string;
  data_points: ChartDataPoint[];
  error: string | null;
};

export const api = {
  getAuthState: () => invoke<AuthState>("get_auth_state"),
  signInWithGoogle: () => invoke<AuthState>("sign_in_with_google"),
  signOut: () => invoke<AuthState>("sign_out"),
  linkPhone: (phoneNumber: string) =>
    invoke<AuthState>("link_phone", { phoneNumber }),
  setWindowSize: (width: number, height: number) =>
    invoke("set_window_size", { width, height }),
  centerWindow: () => invoke("center_window"),
  getSpans: (q: SpanQuery) =>
    invoke<Span[]>("get_spans", {
      from: q.from ?? null,
      to: q.to ?? null,
      collectionId: q.collectionId ?? null,
      status: q.status ?? null,
      unscheduled: q.unscheduled ?? null,
    }),
  createSpan: (payload: NewSpan) => invoke<Span>("create_span", { payload }),
  updateSpan: (id: string, patch: SpanPatch) =>
    invoke<Span>("update_span", { id, patch }),
  deleteSpan: (id: string) => invoke<void>("delete_span", { id }),
  startCall: () => invoke<CallStatus>("start_call"),
  endCall: () => invoke<CallStatus>("end_call"),
  callStatus: () => invoke<CallStatus>("call_status"),
  getCollections: () => invoke<Collection[]>("get_collections"),
  createCollection: (payload: NewCollection) =>
    invoke<Collection>("create_collection", { payload }),
  updateCollection: (id: string, patch: Partial<NewCollection>) =>
    invoke<Collection>("update_collection", { id, patch }),
  archiveCollection: (id: string) => invoke<void>("archive_collection", { id }),
  setSpanCollection: (collectionId: string, spanId: string, member: boolean) =>
    invoke<void>("set_span_collection", { collectionId, spanId, member }),
  deviceLinkStatus: () => invoke<DeviceLinkStatus>("get_device_link_status"),
  setRemoteControl: (enabled: boolean) =>
    invoke<boolean>("set_remote_control", { enabled }),
  getLocalEvents: () => invoke<LocalEvent[]>("get_local_events"),
  listSchemas: () => invoke<Schema[]>("list_schemas"),
  suggestCharts: (schemaIds: string[]) =>
    invoke<ChartSuggestion[]>("suggest_charts", { schemaIds }),
  createChartBoard: (name: string, charts: ChartSuggestion[]) =>
    invoke<ChartBoardDetails>("create_chart_board", { name, charts }),
  listChartBoards: () => invoke<ChartBoard[]>("list_chart_boards"),
  getChartBoard: (id: string) =>
    invoke<ChartBoardDetails>("get_chart_board", { id }),
  getChartBoardData: (id: string) =>
    invoke<ChartDataResult[]>("get_chart_board_data", { id }),
};

export const windowControls = {
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  close: () => getCurrentWindow().close(),
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Eases the native window to a target logical size instead of snapping to it. */
export async function animateWindowSize(
  targetWidth: number,
  targetHeight: number,
  duration = 320,
): Promise<void> {
  const win = getCurrentWindow();
  const factor = await win.scaleFactor();
  const current = (await win.innerSize()).toLogical(factor);
  const fromW = current.width;
  const fromH = current.height;
  if (Math.abs(fromW - targetWidth) < 1 && Math.abs(fromH - targetHeight) < 1) {
    return;
  }

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      void api.setWindowSize(
        fromW + (targetWidth - fromW) * eased,
        fromH + (targetHeight - fromH) * eased,
      );
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Opens the OS location-privacy settings pane directly. */
export async function openLocationSettings(): Promise<void> {
  const isMac = navigator.userAgent.includes("Mac");
  const isWin = navigator.userAgent.includes("Win");
  const url = isMac
    ? "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"
    : isWin
      ? "ms-settings:privacy-location"
      : "";
  if (url) await openUrl(url);
}

export function invokeErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong";
}
