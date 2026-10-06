const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
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
