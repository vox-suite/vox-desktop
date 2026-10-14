import { addDays, startOfDay } from "@/lib/span-layout";
import type { Span } from "@/features/spans/types";
import { schemaColorStyle } from "@/lib/schema-tokens";
import { tintStyle, token, type TintStyle, type VoxColor } from "@/lib/theme";

export type CategoryStyle = TintStyle;

const tint = (hue: VoxColor): CategoryStyle => tintStyle(token(hue));

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  // Meetings / Calls (Deep Indigo / Violet)
  meeting: tint("violet"),
  call: tint("violet"),
  reminder: tint("violet"),

  // Focus work & Commute & Travel (Deep Cobalt / Navy)
  commute: tint("sky"),
  travel: tint("sky"),
  driving: tint("sky"),

  // Cycling & Outdoor (Forest / Emerald Green)
  cycling: tint("mint"),
  ride: tint("mint"),
  running: tint("mint"),
  walking: tint("mint"),

  // Social / Visits / Appointments (Deep Plum / Wine)
  visit: tint("pink"),
  appointment: tint("pink"),

  // Expenses & payments (Emerald); deliveries stay Warm Amber / Ochre
  expense: tint("mint"),
  payment: tint("mint"),
  delivery: tint("gold"),

  // Food & Meals (Warm Terracotta / Burnt Orange)
  meal: tint("orange"),
  food: tint("orange"),
  dining: tint("orange"),
  food_delivery: tint("orange"),

  // PS5 Gaming (Deep Violet / Neon Purple)
  game: tint("violet"),
  gaming: tint("violet"),

  // Tasks / Standups (Dark Zinc / Slate)
  todo: tint("slate"),
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
  return tint("slate");
}

const SPOTIFY_STYLE: CategoryStyle = tint("mint");

const PLAYSTATION_STYLE: CategoryStyle = tint("sky");

const MAPS_STYLE: CategoryStyle = tint("success");

const YOUTUBE_STYLE: CategoryStyle = tint("danger");

const MONEY_STYLE: CategoryStyle = tint("mint");

// Subscriptions are tracked on their own, so they keep their warm amber.
const SUBSCRIPTION_STYLE: CategoryStyle = tint("gold");

const SUBSCRIPTION_RE = /subscri|recurring|renewal|membership/i;
const FINANCE_RE =
  /expense|payment|financ|bill|invoice|transaction|purchase|refund|salary|transfer|bank/i;

export function moneyKind(span: Span): "subscription" | "financial" | null {
  if (SUBSCRIPTION_RE.test(span.category)) return "subscription";
  if (FINANCE_RE.test(span.category) || formatAmount(span) !== null)
    return "financial";
  return null;
}

export function spanStyle(span: Span): CategoryStyle {
  if (span.source === "google_maps") return MAPS_STYLE;
  const money = moneyKind(span);
  if (money && !["spotify", "youtube", "playstation"].includes(span.source))
    return money === "subscription" ? SUBSCRIPTION_STYLE : MONEY_STYLE;
  if (span.source === "spotify") return SPOTIFY_STYLE;
  if (span.source === "youtube") return YOUTUBE_STYLE;
  if (span.source === "playstation") return PLAYSTATION_STYLE;
  return categoryStyle(span.category, span.schema_color_token);
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
  const amount = span.data?.total_amount ?? span.data?.amount;
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

export function displayTitle(span: Span): string {
  return span.source === "playstation"
    ? span.title.replace(/^PlayStation:\s*/, "")
    : span.title;
}

type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function spanCover(span: Span): string | undefined {
  const data = span.data as Loose | undefined;
  if (span.source === "spotify") {
    const images = data?.provider_data?.album?.images as
      { url?: string }[] | undefined;
    return images?.[1]?.url ?? images?.[0]?.url;
  }
  if (span.source === "playstation") {
    return typeof data?.image_url === "string" ? data.image_url : undefined;
  }
  if (span.source === "youtube") {
    const id = data?.provider_data?.video_id;
    return typeof id === "string" && id
      ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
      : undefined;
  }
  return undefined;
}

export function spanSubtitle(span: Span): string | undefined {
  const data = span.data as Loose | undefined;
  if (span.source === "spotify") {
    const artists = data?.provider_data?.artists as
      { name?: string }[] | undefined;
    const names = artists
      ?.map((a) => a.name)
      .filter(Boolean)
      .join(", ");
    return names || undefined;
  }
  if (span.source === "playstation") {
    return typeof data?.platform === "string" ? data.platform : undefined;
  }
  if (span.source === "youtube") {
    const action = data?.provider_data?.action;
    if (action === "watch") return "Watched on YouTube";
    if (action === "like") return "Liked on YouTube";
    if (action === "playlist_addition") return "Added to a playlist";
  }
  return undefined;
}

export function isEstimated(span: Span): boolean {
  return (span.data as { estimated?: boolean } | undefined)?.estimated === true;
}
