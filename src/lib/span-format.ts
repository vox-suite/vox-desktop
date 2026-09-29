import { addDays, startOfDay } from "@/lib/span-layout";
import type { Span } from "@/lib/tauri";
import { schemaColorStyle } from "@/lib/schema-tokens";

export type CategoryStyle = {
  bg: string;
  border: string;
  dot: string;
  text: string;
  subtext: string;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  // Meetings / Calls (Deep Indigo / Violet)
  meeting: {
    bg: "rgba(35, 25, 72, 0.88)",
    border: "rgba(139, 92, 246, 0.35)",
    dot: "#a78bfa",
    text: "#ffffff",
    subtext: "rgba(196, 181, 253, 0.75)",
  },
  call: {
    bg: "rgba(35, 25, 72, 0.88)",
    border: "rgba(139, 92, 246, 0.35)",
    dot: "#a78bfa",
    text: "#ffffff",
    subtext: "rgba(196, 181, 253, 0.75)",
  },
  reminder: {
    bg: "rgba(35, 25, 72, 0.88)",
    border: "rgba(139, 92, 246, 0.35)",
    dot: "#a78bfa",
    text: "#ffffff",
    subtext: "rgba(196, 181, 253, 0.75)",
  },

  // Focus work & Commute & Travel (Deep Cobalt / Navy)
  commute: {
    bg: "rgba(20, 38, 70, 0.88)",
    border: "rgba(59, 130, 246, 0.35)",
    dot: "#60a5fa",
    text: "#ffffff",
    subtext: "rgba(147, 197, 253, 0.75)",
  },
  travel: {
    bg: "rgba(20, 38, 70, 0.88)",
    border: "rgba(59, 130, 246, 0.35)",
    dot: "#60a5fa",
    text: "#ffffff",
    subtext: "rgba(147, 197, 253, 0.75)",
  },
  driving: {
    bg: "rgba(20, 38, 70, 0.88)",
    border: "rgba(59, 130, 246, 0.35)",
    dot: "#60a5fa",
    text: "#ffffff",
    subtext: "rgba(147, 197, 253, 0.75)",
  },

  // Cycling & Outdoor (Forest / Emerald Green)
  cycling: {
    bg: "rgba(13, 48, 30, 0.88)",
    border: "rgba(16, 185, 129, 0.35)",
    dot: "#34d399",
    text: "#ffffff",
    subtext: "rgba(110, 231, 183, 0.75)",
  },
  ride: {
    bg: "rgba(13, 48, 30, 0.88)",
    border: "rgba(16, 185, 129, 0.35)",
    dot: "#34d399",
    text: "#ffffff",
    subtext: "rgba(110, 231, 183, 0.75)",
  },
  running: {
    bg: "rgba(13, 48, 30, 0.88)",
    border: "rgba(16, 185, 129, 0.35)",
    dot: "#34d399",
    text: "#ffffff",
    subtext: "rgba(110, 231, 183, 0.75)",
  },
  walking: {
    bg: "rgba(13, 48, 30, 0.88)",
    border: "rgba(16, 185, 129, 0.35)",
    dot: "#34d399",
    text: "#ffffff",
    subtext: "rgba(110, 231, 183, 0.75)",
  },

  // Social / Visits / Appointments (Deep Plum / Wine)
  visit: {
    bg: "rgba(60, 20, 38, 0.88)",
    border: "rgba(244, 63, 94, 0.35)",
    dot: "#fb7185",
    text: "#ffffff",
    subtext: "rgba(253, 164, 175, 0.75)",
  },
  appointment: {
    bg: "rgba(60, 20, 38, 0.88)",
    border: "rgba(244, 63, 94, 0.35)",
    dot: "#fb7185",
    text: "#ffffff",
    subtext: "rgba(253, 164, 175, 0.75)",
  },

  // Expenses & Shopping (Warm Amber / Ochre)
  expense: {
    bg: "rgba(58, 32, 10, 0.88)",
    border: "rgba(245, 158, 11, 0.35)",
    dot: "#fbbf24",
    text: "#ffffff",
    subtext: "rgba(253, 230, 138, 0.75)",
  },
  payment: {
    bg: "rgba(58, 32, 10, 0.88)",
    border: "rgba(245, 158, 11, 0.35)",
    dot: "#fbbf24",
    text: "#ffffff",
    subtext: "rgba(253, 230, 138, 0.75)",
  },
  delivery: {
    bg: "rgba(58, 32, 10, 0.88)",
    border: "rgba(245, 158, 11, 0.35)",
    dot: "#fbbf24",
    text: "#ffffff",
    subtext: "rgba(253, 230, 138, 0.75)",
  },

  // Food & Meals (Warm Terracotta / Burnt Orange)
  meal: {
    bg: "rgba(56, 26, 14, 0.88)",
    border: "rgba(249, 115, 22, 0.35)",
    dot: "#fb923c",
    text: "#ffffff",
    subtext: "rgba(254, 215, 170, 0.75)",
  },
  food: {
    bg: "rgba(56, 26, 14, 0.88)",
    border: "rgba(249, 115, 22, 0.35)",
    dot: "#fb923c",
    text: "#ffffff",
    subtext: "rgba(254, 215, 170, 0.75)",
  },

  // PS5 Gaming (Deep Violet / Neon Purple)
  game: {
    bg: "rgba(42, 18, 76, 0.88)",
    border: "rgba(168, 85, 247, 0.38)",
    dot: "#c084fc",
    text: "#ffffff",
    subtext: "rgba(233, 213, 255, 0.75)",
  },
  gaming: {
    bg: "rgba(42, 18, 76, 0.88)",
    border: "rgba(168, 85, 247, 0.38)",
    dot: "#c084fc",
    text: "#ffffff",
    subtext: "rgba(233, 213, 255, 0.75)",
  },

  // Tasks / Standups (Dark Zinc / Slate)
  todo: {
    bg: "rgba(24, 26, 32, 0.9)",
    border: "rgba(148, 163, 184, 0.25)",
    dot: "#94a3b8",
    text: "#ffffff",
    subtext: "rgba(203, 213, 225, 0.75)",
  },
};

/**
 * `schemaColorToken` (data_schemas.color_token, 0-23) takes priority when
 * present -- it's the live, LLM-assigned category color. The string-keyed
 * CATEGORY_STYLES map below is the pre-schema fallback, for spans with no
 * schema_id (manually created tasks, or spans predating the schema system).
 */
export function categoryStyle(
  category: string,
  schemaColorToken?: number | null,
): CategoryStyle {
  if (schemaColorToken !== null && schemaColorToken !== undefined) {
    return schemaColorStyle(schemaColorToken);
  }
  const known = CATEGORY_STYLES[category.toLowerCase()];
  if (known) return known;
  return {
    bg: "rgba(26, 30, 42, 0.88)",
    border: "rgba(100, 116, 139, 0.3)",
    dot: "#94a3b8",
    text: "#ffffff",
    subtext: "rgba(255, 255, 255, 0.65)",
  };
}

export function categoryColor(
  category: string,
  schemaColorToken?: number | null,
): string {
  return categoryStyle(category, schemaColorToken).dot;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatAmount(span: Span): string | null {
  const amount = span.data?.amount;
  if (typeof amount !== "number") return null;
  return formatMoney(
    amount,
    typeof span.data?.currency === "string" ? span.data.currency : "INR",
  );
}

export function daysFrom(start: Date, count: number): Date[] {
  const first = startOfDay(start);
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}
