export type ViewMode = "day" | "week" | "month";

export function rangeLabel(mode: ViewMode, anchor: Date, days: Date[]): string {
  if (mode === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (mode === "month") {
    const start = days[0].toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const end = days[days.length - 1].toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} – ${end}`;
  }
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const first = days[0].toLocaleDateString(undefined, opts);
  const last = days[days.length - 1].toLocaleDateString(undefined, {
    ...opts,
    year: "numeric",
  });
  return `${first} – ${last}`;
}

