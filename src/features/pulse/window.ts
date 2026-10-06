import type { PulseDefinition } from "./discovery-types";

const fmt = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const ALL_TIME_DAYS = 3650;
export function windowLabel(d: PulseDefinition) {
  if (d.period_days >= ALL_TIME_DAYS) return "All time";
  const end = new Date();
  end.setDate(end.getDate() - (d.offset_days ?? 0));
  const start = new Date(end);
  start.setDate(start.getDate() - (d.period_days - 1));
  return `${fmt(start)} – ${fmt(end)}`;
}
