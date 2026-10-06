import { platform } from "@/platform";
import type {
  ChartBoard,
  ChartBoardDetails,
  ChartDataResult,
  ChartSuggestion,
  Schema,
} from "@/features/pulse/types";

export const pulseApi = {
  listSchemas: () =>
    platform().http.request<Schema[]>({
      method: "GET",
      path: "/v1/me/schemas",
    }),
  suggestCharts: (schemaIds: string[]) =>
    platform().http.request<ChartSuggestion[]>({
      method: "POST",
      path: "/v1/me/charts/suggest",
      body: { schema_ids: schemaIds },
    }),
  createChartBoard: (name: string, charts: ChartSuggestion[]) =>
    platform().http.request<ChartBoardDetails>({
      method: "POST",
      path: "/v1/me/charts/boards",
      body: { name, charts },
    }),
  listChartBoards: () =>
    platform().http.request<ChartBoard[]>({
      method: "GET",
      path: "/v1/me/charts/boards",
    }),
  getChartBoard: (id: string) =>
    platform().http.request<ChartBoardDetails>({
      method: "GET",
      path: `/v1/me/charts/boards/${id}`,
    }),
  getChartBoardData: (id: string) =>
    platform().http.request<ChartDataResult[]>({
      method: "GET",
      path: `/v1/me/charts/boards/${id}/data`,
    }),
};

import type {
  CanvasResponse,
  DiscoveryResponse,
  Measurement,
  PulseDefinition,
  PulseResult,
  SavedPulseChart,
} from "./discovery-types";
export const pulseTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
export const discoveryApi = {
  getCanvas: (refresh = false, cursor?: string) =>
    platform().http.request<CanvasResponse>({
      method: "GET",
      path: "/v1/me/pulse/canvas",
      query: {
        timezone: pulseTimezone(),
        refresh: String(refresh),
        ...(cursor ? { cursor } : {}),
      },
    }),
  listMeasurements: () =>
    platform().http.request<Measurement[]>({
      method: "GET",
      path: "/v1/me/pulse/measurements",
      query: { timezone: pulseTimezone() },
    }),
  discover: (opts: { refresh?: boolean; more?: boolean; prompt?: string } = {}) =>
    platform().http.request<DiscoveryResponse>({
      method: "POST",
      path: "/v1/me/pulse/suggestions",
      body: { timezone: pulseTimezone(), refresh: false, ...opts },
      timeoutMs: 200000,
    }),
  preview: (definition: PulseDefinition) =>
    platform().http.request<PulseResult>({
      method: "POST",
      path: "/v1/me/pulse/preview",
      body: definition,
    }),
  save: (title: string, definition: PulseDefinition, idempotencyKey: string) =>
    platform().http.request<SavedPulseChart>({
      method: "POST",
      path: "/v1/me/pulse/charts",
      body: { title, definition, idempotency_key: idempotencyKey },
    }),
  dismiss: (definition: PulseDefinition) =>
    platform().http.request<void>({
      method: "POST",
      path: "/v1/me/pulse/dismissals",
      body: definition,
    }),
};
