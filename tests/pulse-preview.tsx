import { createRoot } from "react-dom/client";
import { PulseView } from "../src/components/pulse/pulse-view";
import { installPlatform } from "../src/platform";
import type { HttpRequest } from "../src/platform/ports";
import type {
  Measurement,
  PulseDefinition,
  PulseResult,
  SavedPulseChart,
} from "../src/features/pulse/discovery-types";
import "../src/index.css";
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const definition: PulseDefinition = {
  version: 2,
  measurement_id: "fixture-spotify",
  bucket: "day",
  dimension: null,
  period_days: 30,
  timezone,
  chart_type: "bar",
};
const measurement: Measurement = {
  id: "fixture-spotify",
  profile: {
    key: "fixture",
    schema_id: null,
    connection_id: null,
    source: "spotify",
    category: "music",
    action: "listen",
    timing: "provider_timestamp",
    currency: "",
    count: 6,
    dated_count: 6,
    first_at: "2026-10-01T12:00:00Z",
    last_at: "2026-10-05T12:00:00Z",
    known_intervals: 0,
    fields: { artist: "string" },
    samples: [],
  },
  title: "Recorded Spotify plays",
  description: "Counts recorded plays. Listening duration is unknown.",
  kind: "event_count",
  field: null,
  unit: "events",
  quality: "recorded",
  scale: 1,
  buckets: ["day", "week", "month"],
  dimensions: ["artist"],
  default_dimension: null,
};
const preview: PulseResult = {
  source: "spotify",
  points: [
    { label: "2026-10-01", value: 2 },
    { label: "2026-10-02", value: null },
    { label: "2026-10-03", value: 3 },
    { label: "2026-10-04", value: null },
    { label: "2026-10-05", value: 1 },
  ],
  unit: "events",
  quality: "recorded",
  description: measurement.description,
  record_count: 6,
  undated_count: 0,
  computed_at: new Date().toISOString(),
  data_as_of: measurement.profile.last_at,
  error: null,
};
const charts: SavedPulseChart[] = [];
const saves = new Map<string, SavedPulseChart>();
const mode = new URLSearchParams(location.search).get("mode");
installPlatform({
  http: {
    async request<T>(req: HttpRequest): Promise<T> {
      await new Promise((resolve) => setTimeout(resolve, 80));
      let result: unknown;
      if (mode === "error") throw new Error("Fixture network failure");
      if (req.path.endsWith("/canvas"))
        result = { charts: [...charts], legacy_boards: [], next_cursor: null };
      else if (req.path.endsWith("/measurements"))
        result = mode === "none" ? [] : [measurement];
      else if (req.path.endsWith("/suggestions"))
        result = {
          suggestions:
            mode === "none"
              ? []
              : [
                  {
                    title: measurement.title,
                    reason:
                      "Based on six recorded plays in this verification fixture.",
                    definition,
                    measurement,
                    preview,
                  },
                ],
          connections: [],
          source_count: 1,
          record_count: 6,
          profiled_days: 90,
          computed_at: new Date().toISOString(),
        };
      else if (req.path.endsWith("/preview")) result = preview;
      else if (req.path.endsWith("/charts")) {
        const body = req.body as {
          idempotency_key: string;
          title: string;
          definition: PulseDefinition;
        };
        let chart = saves.get(body.idempotency_key);
        if (!chart) {
          chart = {
            id: crypto.randomUUID(),
            title: body.title,
            definition: body.definition,
            created_at: new Date().toISOString(),
            result: preview,
          };
          charts.push(chart);
          saves.set(body.idempotency_key, chart);
        }
        result = chart;
      } else if (req.path.endsWith("/dismissals")) result = null;
      else throw new Error(`Unknown fixture request ${req.path}`);
      return result as T;
    },
  },
  live: { subscribe: () => () => {} },
});
createRoot(document.getElementById("root")!).render(
  <div style={{ height: "100vh" }}>
    <PulseView />
  </div>,
);
