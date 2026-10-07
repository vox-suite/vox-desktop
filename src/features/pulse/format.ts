const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const CHART_COLORS = [
  "#3ecf8e",
  "#a2aaa4",
  "#77b6a1",
  "#6b766e",
  "#d4dad6",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatTotal(value: number, unit: string) {
  const abs = Math.abs(value);
  const number = new Intl.NumberFormat(undefined, {
    notation: abs >= 10000 ? "compact" : "standard",
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  })
    .format(value)
    .replace(/K$/, "k");
  if (SYMBOLS[unit]) return { text: `${SYMBOLS[unit]}${number}`, unit: "" };
  const label =
    unit === "hours" ? "hrs" : value === 1 && unit === "events" ? "event" : unit;
  return { text: number, unit: label };
}

export function friendlyDate(label: unknown, long = false): string {
  const text = String(label ?? "");
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (day) {
    const d = new Date(+day[1], +day[2] - 1, +day[3]);
    return long
      ? d.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  const month = /^(\d{4})-(\d{2})$/.exec(text);
  if (month) return `${MONTHS[+month[2] - 1]} ${month[1]}`;
  return text;
}

export function clipText(value: unknown, max = 16): string {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
