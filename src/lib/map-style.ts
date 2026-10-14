import type { maplibregl } from "@/lib/maplibre";
import { readColors, readToken } from "@/lib/theme";

export const BUILDINGS_LAYER = "vox-3d-buildings";

export function findBuildingSource(map: maplibregl.Map): string | null {
  const style = map.getStyle();
  if (!style?.sources) return null;
  for (const [id, source] of Object.entries(style.sources)) {
    if ((source as { type?: string }).type !== "vector") continue;
    if (
      id.includes("openmaptiles") ||
      id.includes("protomaps") ||
      id === "composite"
    ) {
      return id;
    }
  }
  const vector = Object.entries(style.sources).find(
    ([, s]) => (s as { type?: string }).type === "vector",
  );
  return vector?.[0] ?? null;
}

type Paint = Record<string, unknown>;
const ORIGINAL_PAINT = new WeakMap<maplibregl.Map, Map<string, Paint>>();
const ROAD = /road|street|path|bridge|tunnel/;
const ROAD_LIGHT = /road|street|path|bridge|tunnel|highway/;

/** The style's own paint colors, captured once so each theme starts from the same base. */
function originalPaint(map: maplibregl.Map): Map<string, Paint> {
  let paint = ORIGINAL_PAINT.get(map);
  if (paint) return paint;
  paint = new Map();
  for (const layer of map.getStyle()?.layers ?? []) {
    const props = (layer as { paint?: Paint }).paint ?? {};
    const colors = Object.fromEntries(Object.entries(props).filter(([key]) => key.endsWith("-color") || key === "line-opacity"));
    paint.set(layer.id, colors);
  }
  ORIGINAL_PAINT.set(map, paint);
  return paint;
}

function rgba(color: string): [number, number, number, number] | null {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = color;
  const parsed = ctx.fillStyle;
  if (parsed.startsWith("#")) {
    const n = Number.parseInt(parsed.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const parts = parsed.match(/[\d.]+/g)?.map(Number);
  return parts && parts.length >= 3 ? [parts[0], parts[1], parts[2], parts[3] ?? 1] : null;
}

/** Re-expresses a dark-style color in the light theme: its lightness picks a point between the map base and text tokens. */
function toLight(value: unknown, base: [number, number, number, number], ink: [number, number, number, number]): unknown {
  if (Array.isArray(value)) return value.map((v) => toLight(v, base, ink));
  if (typeof value !== "string") return value;
  const c = rgba(value);
  if (!c) return value;
  const l = (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 510;
  const mixed = [0, 1, 2].map((i) => Math.round(base[i] + (ink[i] - base[i]) * l));
  return `rgba(${mixed.join(", ")}, ${c[3]})`;
}

/** Paints the base map from the current theme's map tokens; call again after a theme change. */
export function ensureMissionControlLook(map: maplibregl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;
  const c = readColors();
  const light = document.documentElement.dataset.theme === "light";
  const base = rgba(c.map);
  const ink = rgba(c.text);
  const original = originalPaint(map);
  if (map.getLayer(BUILDINGS_LAYER))
    map.setPaintProperty(BUILDINGS_LAYER, "fill-extrusion-color", c["map-building"]);

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();
    try {
      for (const [prop, value] of Object.entries(original.get(layer.id) ?? {})) {
        const restored = light && base && ink && prop.endsWith("-color") ? toLight(value, base, ink) : value;
        map.setPaintProperty(layer.id, prop as Parameters<typeof map.setPaintProperty>[1], restored as never);
      }
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", c.map);
      }
      if (id.includes("water") && layer.type === "fill") {
        map.setPaintProperty(layer.id, "fill-color", c["map-water"]);
      }
      if (
        (id.includes("land") ||
          id.includes("landcover") ||
          id.includes("landuse")) &&
        layer.type === "fill"
      ) {
        map.setPaintProperty(layer.id, "fill-color", c["map-land"]);
      }
      const road = light ? ROAD_LIGHT.test(id) && !id.includes("casing") : ROAD.test(id);
      if (road && layer.type === "line") {
        map.setPaintProperty(layer.id, "line-color", c["map-road"]);
        map.setPaintProperty(layer.id, "line-opacity", 0.75);
      }
      // Hide flat 2D building fills AND any base-style extrusions — they
      // z-fight with our custom vox-3d-buildings layer during camera movement.
      if (
        id.includes("building") &&
        (layer.type === "fill" ||
          layer.type === "line" ||
          layer.type === "fill-extrusion")
      ) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    } catch {
      /* style property may not apply to this layer */
    }
  }
}

// Insert 3D layers above all road/rail lines (otherwise flat lines paint over
// the extrusions) but below the first label that follows them.
export function extrusionBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  let lastLine = -1;
  layers.forEach((l, i) => {
    if (l.type === "line") lastLine = i;
  });
  return layers.slice(lastLine + 1).find((l) => l.type === "symbol")?.id;
}

export function ensure3dBuildings(map: maplibregl.Map) {
  if (map.getLayer(BUILDINGS_LAYER)) return;
  const sourceId = findBuildingSource(map);
  if (!sourceId) return;

  const beforeId = extrusionBeforeId(map);

  map.addLayer(
    {
      id: BUILDINGS_LAYER,
      source: sourceId,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": readToken("map-building"),
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          14.2,
          ["coalesce", ["get", "render_height"], ["get", "height"], 12],
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": 1,
        "fill-extrusion-vertical-gradient": false,
      },
    },
    beforeId,
  );
}
