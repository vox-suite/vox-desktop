import type { Measurement, PulseDefinition } from "./discovery-types";
export function defaultDefinition(
  m: Measurement,
  timezone: string,
): PulseDefinition {
  const dimension =
    m.default_dimension ??
    (m.buckets.length ? null : (m.dimensions[0] ?? null));
  return {
    version: 2,
    measurement_id: m.id,
    bucket: dimension ? null : (m.buckets[0] ?? null),
    dimension,
    period_days: 30,
    timezone,
    chart_type: "bar",
  };
}
export class LatestRequest {
  private generation = 0;
  start() {
    return ++this.generation;
  }
  isCurrent(ticket: number) {
    return ticket === this.generation;
  }
  cancel() {
    this.generation++;
  }
}

export function uniqueCharts<T extends { id: string }>(charts: T[]): T[] {
  return [...new Map(charts.map((chart) => [chart.id, chart])).values()];
}
