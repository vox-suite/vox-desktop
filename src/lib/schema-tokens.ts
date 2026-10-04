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

import tokens from "@/features/pulse/schema-tokens.gen.json";

export type Oklch = { l: number; c: number; h: number };

export const COLOR_TOKENS: Oklch[] = tokens.color_tokens;

export const ICON_TOKEN_NAMES: string[] = tokens.icon_tokens;

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  "wallet": Wallet,
  "heart-pulse": HeartPulse,
  "utensils": Utensils,
  "car": Car,
  "home": Home,
  "briefcase": Briefcase,
  "plane": Plane,
  "dumbbell": Dumbbell,
  "book-open": BookOpen,
  "music": Music,
  "film": Film,
  "camera": Camera,
  "gamepad-2": Gamepad2,
  "shopping-bag": ShoppingBag,
  "coffee": Coffee,
  "pill": Pill,
  "moon": Moon,
  "cloud-sun": CloudSun,
  "phone-call": PhoneCall,
  "message-circle": MessageCircle,
  "map-pin": MapPin,
  "party-popper": PartyPopper,
  "users": Users,
  "laptop": Laptop,
};

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
  return ICON_COMPONENTS[ICON_TOKEN_NAMES[token]] ?? Wallet;
}
