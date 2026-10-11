import type { PulseSeries } from "./discovery-types";

export type SeriesMode = "single" | "dual" | "relative";

export function seriesMode(series: PulseSeries[]): SeriesMode {
  const units = new Set(series.map((s) => s.unit));
  return units.size === 1 ? "single" : units.size === 2 ? "dual" : "relative";
}
