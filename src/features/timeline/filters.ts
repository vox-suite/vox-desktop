import type { TimelineFilter } from "../desktop-control/types.ts";
function dateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
function shift(day: string, n: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
function midnight(day: string, timezone: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
  )
    throw new Error("Invalid date");
  const target = Date.parse(`${day}T00:00:00Z`);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const get = (k: string) => parts.find((p) => p.type === k)!.value;
    const shown = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    const next = candidate + target - shown;
    if (next === candidate) return new Date(candidate).toISOString();
    candidate = next;
  }
  throw new Error("This local date boundary is ambiguous");
}
export function resolveTimelineFilter(
  input: Record<string, unknown>,
  now = new Date(),
): TimelineFilter {
  const timezone =
    typeof input.timezone === "string"
      ? input.timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dateParts(now, timezone);
  let start = today,
    end = today;
  switch (input.range) {
    case "today":
      break;
    case "yesterday":
      start = end = shift(today, -1);
      break;
    case "this_week":
    case "last_week": {
      const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
      const back = input.range === "last_week" ? 7 : 0;
      start = shift(today, -weekday - back);
      end = shift(start, 6);
      break;
    }
    case "custom":
      start = String(input.startDate ?? "");
      end = String(input.endDate ?? "");
      break;
    default:
      throw new Error(
        "Choose today, yesterday, this week, last week, or a custom date range",
      );
  }
  const startAt = midnight(start, timezone);
  const endAt = midnight(shift(end, 1), timezone);
  if (
    Date.parse(startAt) >= Date.parse(endAt) ||
    Date.parse(endAt) - Date.parse(startAt) > 367 * 86400000
  )
    throw new Error("Choose a valid range of up to one year");
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    startAt,
    endAt,
    timezone,
    spendingOnly: true,
    merchant: text(input.merchant),
    category: text(input.category),
  };
}
