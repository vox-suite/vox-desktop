import { useSyncExternalStore } from "react";
import { VOX_COLORS, type VoxBrand, type VoxColor } from "@/styles/vox-tokens";

export type { VoxColor };
export type ThemePref = "auto" | "light" | "dark";
export type Theme = "light" | "dark";
export type VoxColors = Record<VoxColor, string>;

const STORAGE_KEY = "vox-theme";
const root = () => document.documentElement;

export function getThemePref(): ThemePref {
  const pref = root().dataset.themePref;
  return pref === "light" || pref === "dark" ? pref : "auto";
}

export function setThemePref(pref: ThemePref) {
  const system = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root().dataset.themePref = pref;
  root().dataset.theme = pref === "auto" ? system : pref;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage can be unavailable; the choice still applies for this session.
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ["data-theme", "data-theme-pref"] });
  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => (root().dataset.theme === "light" ? "light" : "dark"));
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref);
}

/** CSS reference to a token, for inline styles: `token("coral")` → `var(--vox-coral)`. */
export const token = (name: VoxColor) => `var(--vox-${name})`;

/** CSS reference to a brand color (theme-independent): `brandToken("spotify")`. */
export const brandToken = (name: VoxBrand) => `var(--vox-brand-${name})`;

/** Any CSS color with transparency, for colors that are already `var(...)` references. */
export const fade = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/** A token with transparency, for inline styles: `alpha("coral", 12)`. */
export const alpha = (name: VoxColor, percent: number) =>
  `color-mix(in srgb, var(--vox-${name}) ${percent}%, transparent)`;

/** Resolved token value, for canvas, WebGL, map styles and SVG attributes that cannot read CSS variables. */
export function readToken(name: VoxColor): string {
  return getComputedStyle(root()).getPropertyValue(`--vox-${name}`).trim();
}

export function readColors(): VoxColors {
  const style = getComputedStyle(root());
  return Object.fromEntries(
    VOX_COLORS.map((name) => [name, style.getPropertyValue(`--vox-${name}`).trim()]),
  ) as VoxColors;
}

const colorCache = new Map<string, VoxColors>();

function colorsSnapshot(): VoxColors {
  const theme = root().dataset.theme ?? "dark";
  let colors = colorCache.get(theme);
  if (!colors) {
    colors = readColors();
    colorCache.set(theme, colors);
  }
  return colors;
}

/** Resolved token values that update when the theme changes. */
export function useVoxColors(): VoxColors {
  return useSyncExternalStore(subscribe, colorsSnapshot);
}

/** Resolved token value with transparency, e.g. for canvas: `withAlpha(colors.ink, 0.09)`. */
export function withAlpha(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

export type TintStyle = { bg: string; border: string; dot: string; text: string; subtext: string };

/** Category chip/block colors derived from one hue, blended with the current theme's surface and text. */
export function tintStyle(color: string): TintStyle {
  return {
    bg: `color-mix(in srgb, ${color} 22%, var(--vox-surface-raised))`,
    border: `color-mix(in srgb, ${color} 35%, transparent)`,
    dot: color,
    text: token("text"),
    subtext: `color-mix(in srgb, ${color} 65%, var(--vox-text))`,
  };
}

/** Mask color at a given opacity; masks and compositing read alpha only, so the hue is irrelevant. */
export const maskAlpha = (opacity: number) => `rgb(0 0 0 / ${opacity})`;

/** Top-to-bottom fade for `mask-image`. */
export function fadeMask(solidUntil: number, endOpacity = 0) {
  const image = `linear-gradient(to bottom, ${maskAlpha(1)} 0%, ${maskAlpha(1)} ${solidUntil}%, ${maskAlpha(endOpacity)} 100%)`;
  return { maskImage: image, WebkitMaskImage: image };
}
