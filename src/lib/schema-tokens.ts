import {
  Wallet,
  HeartPulse,
  Utensils,
  Car,
  Home,
  Briefcase,
  Plane,
  Dumbbell,
  BookOpen,
  Music,
  Film,
  Camera,
  Gamepad2,
  ShoppingBag,
  Coffee,
  Pill,
  Moon,
  CloudSun,
  PhoneCall,
  MessageCircle,
  MapPin,
  PartyPopper,
  Users,
  Laptop,
  type LucideIcon,
} from "lucide-react";

/**
 * The canonical 24-slot color/icon palette for data_schemas.color_token/
 * icon_token. Must stay in sync with vox-shared's src/schema_tokens.rs,
 * which is the source of truth for the (L, C, H) values and icon names --
 * this file just renders them for the web (native CSS oklch()) instead of
 * needing the conversion math vox-shared's Rust/Kotlin ports need.
 */
export type Oklch = { l: number; c: number; h: number };

const PALETTE_L = 0.72;
const PALETTE_C = 0.14;

export const COLOR_TOKENS: Oklch[] = [
  20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245,
  260, 275, 290, 305, 320, 335, 350, 5,
].map((h) => ({ l: PALETTE_L, c: PALETTE_C, h }));

export const ICON_TOKEN_NAMES = [
  "wallet",
  "heart-pulse",
  "utensils",
  "car",
  "home",
  "briefcase",
  "plane",
  "dumbbell",
  "book-open",
  "music",
  "film",
  "camera",
  "gamepad-2",
  "shopping-bag",
  "coffee",
  "pill",
  "moon",
  "cloud-sun",
  "phone-call",
  "message-circle",
  "map-pin",
  "party-popper",
  "users",
  "laptop",
] as const;

const ICON_COMPONENTS: LucideIcon[] = [
  Wallet,
  HeartPulse,
  Utensils,
  Car,
  Home,
  Briefcase,
  Plane,
  Dumbbell,
  BookOpen,
  Music,
  Film,
  Camera,
  Gamepad2,
  ShoppingBag,
  Coffee,
  Pill,
  Moon,
  CloudSun,
  PhoneCall,
  MessageCircle,
  MapPin,
  PartyPopper,
  Users,
  Laptop,
];

function oklchCss({ l, c, h }: Oklch, lOverride?: number, alpha?: number): string {
  const lightness = Math.round((lOverride ?? l) * 100);
  return alpha === undefined
    ? `oklch(${lightness}% ${c} ${h})`
    : `oklch(${lightness}% ${c} ${h} / ${alpha})`;
}

export type SchemaCategoryStyle = {
  bg: string;
  border: string;
  dot: string;
  text: string;
  subtext: string;
};

/** `token` is the 0-23 index from `data_schemas.color_token`. */
export function schemaColorStyle(token: number): SchemaCategoryStyle {
  const t = COLOR_TOKENS[token] ?? COLOR_TOKENS[0];
  return {
    bg: oklchCss(t, 0.22, 0.9),
    border: oklchCss(t, undefined, 0.35),
    dot: oklchCss(t),
    text: "#ffffff",
    subtext: oklchCss(t, undefined, 0.75),
  };
}

/** `token` is the 0-23 index from `data_schemas.icon_token`. */
export function schemaIcon(token: number): LucideIcon {
  return ICON_COMPONENTS[token] ?? ICON_COMPONENTS[0];
}
