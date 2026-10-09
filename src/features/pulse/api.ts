import { platform } from "@/platform";
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
      timeoutMs: 60000,
    }),
  listMeasurements: () =>
    platform().http.request<Measurement[]>({
      method: "GET",
      path: "/v1/me/pulse/measurements",
      query: { timezone: pulseTimezone() },
    }),
  discover: (
    opts: { refresh?: boolean; more?: boolean; prompt?: string } = {},
  ) =>
    platform().http.request<DiscoveryResponse>({
      method: "POST",
      path: "/v1/me/pulse/suggestions",
      body: { timezone: pulseTimezone(), refresh: opts.refresh ?? opts.more ?? false },
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
  deleteChart: (id: string) =>
    platform().http.request<void>({
      method: "DELETE",
      path: `/v1/me/pulse/charts/${id}`,
    }),
  dismiss: (definition: PulseDefinition) =>
    platform().http.request<void>({
      method: "POST",
      path: "/v1/me/pulse/dismissals",
      body: definition,
    }),
};
