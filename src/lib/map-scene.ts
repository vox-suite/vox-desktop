import { setHighlights } from "@/lib/map-highlight";
import { extrusionBeforeId } from "@/lib/map-style";
import type { maplibregl } from "@/lib/maplibre";

export type PinKind = "place" | "task" | "spend";

export type MapScene = {
  rev: number;
  camera?: {
    lng: number;
    lat: number;
    zoom?: number;
    pitch?: number;
    bearing?: number;
    durationMs?: number;
  };
  pins: {
    id: string;
    lng: number;
    lat: number;
    label?: string;
    kind: PinKind;
    state?: string;
    spanId?: string;
  }[];
  arcs: {
    id: string;
    from: [number, number];
    to: [number, number];
    label?: string;
    delayMs: number;
  }[];
  columns: {
    id: string;
    lng: number;
    lat: number;
    value: number;
    label?: string;
  }[];
  highlights: { id: string; lng: number; lat: number }[];
  narrationHint?: string;
};

const PIN_SOURCE = "vox-scene-pins";
const ARC_SOURCE = "vox-scene-arcs";
const COLUMN_SOURCE = "vox-scene-columns";
const ARC_MS = 1200;
const ARC_STEPS = 40;
const COLUMN_HALF_M = 12;
const COLUMN_MIN_H = 30;
const COLUMN_MAX_H = 300;
const HIGHLIGHT_RETRY_MS = [0, 800, 1800, 3200];

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const valid = (lng: number, lat: number) =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  Math.abs(lng) <= 180 &&
  Math.abs(lat) <= 90;

function arcPath(
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
): number[][] {
  const cx = (x1 + x2) / 2 - (y2 - y1) * 0.25;
  const cy = (y1 + y2) / 2 + (x2 - x1) * 0.25;
  return Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = i / ARC_STEPS;
    const u = 1 - t;
    return [
      u * u * x1 + 2 * u * t * cx + t * t * x2,
      u * u * y1 + 2 * u * t * cy + t * t * y2,
    ];
  });
}

function square(lng: number, lat: number): number[][][] {
  const dLat = COLUMN_HALF_M / 111320;
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  return [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ];
}

function isActive(scene: MapScene) {
  return Boolean(
    scene.camera ||
    scene.pins.length ||
    scene.arcs.length ||
    scene.columns.length ||
    scene.highlights.length,
  );
}

function ensureLayers(map: maplibregl.Map) {
  if (map.getSource(PIN_SOURCE)) return;
  for (const id of [PIN_SOURCE, ARC_SOURCE, COLUMN_SOURCE]) {
    map.addSource(id, { type: "geojson", data: EMPTY });
  }
  map.addLayer(
    {
      id: "vox-scene-columns",
      type: "fill-extrusion",
      source: COLUMN_SOURCE,
      paint: {
        "fill-extrusion-color": "#ff6363",
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.85,
      },
    },
    extrusionBeforeId(map),
  );
  map.addLayer({
    id: "vox-scene-arcs",
    type: "line",
    source: ARC_SOURCE,
    layout: { "line-cap": "round" },
    paint: { "line-color": "#ff6363", "line-width": 2.5, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "vox-scene-pin-halo",
    type: "circle",
    source: PIN_SOURCE,
    paint: {
      "circle-radius": 14,
      "circle-color": ["get", "color"],
      "circle-opacity": 0.25,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "vox-scene-pin-dot",
    type: "circle",
    source: PIN_SOURCE,
    paint: {
      "circle-radius": 6,
      "circle-color": ["get", "color"],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "vox-scene-pin-label",
    type: "symbol",
    source: PIN_SOURCE,
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-offset": [0, 1.4],
      "text-anchor": "top",
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#050607",
      "text-halo-width": 1.5,
    },
  });
}

const PIN_COLORS: Record<string, string> = {
  place: "#4cc9f0",
  task: "#ffd166",
  spend: "#ff6363",
};

export function createSceneLayer(
  map: maplibregl.Map,
  opts: {
    onActiveChange: (active: boolean) => void;
    onCamera: () => void;
    onHomeAnchor?: (anchor: [number, number]) => void;
  },
) {
  ensureLayers(map);
  let home: [number, number] | null = null;
  let lastRev = -1;
  let active = false;
  let highlights: [number, number][] = [];
  let raf: number | null = null;
  let startedAt = 0;
  let arcs: { points: number[][]; delayMs: number }[] = [];
  const timers: number[] = [];

  const paintHighlights = () => {
    timers.splice(0).forEach(clearTimeout);
    const paint = () => {
      const anchors = setHighlights(
        map,
        home ? [home, ...highlights] : highlights,
      );
      if (home && anchors[0]) opts.onHomeAnchor?.(anchors[0]);
    };
    map.once("idle", paint);
    for (const ms of HIGHLIGHT_RETRY_MS)
      timers.push(window.setTimeout(paint, ms));
  };

  const frame = (now: number) => {
    const elapsed = now - startedAt;
    let running = false;
    const features: GeoJSON.Feature[] = arcs.map(({ points, delayMs }) => {
      const progress = Math.min(1, Math.max(0, (elapsed - delayMs) / ARC_MS));
      if (progress < 1) running = true;
      const count = Math.max(2, Math.ceil(progress * ARC_STEPS) + 1);
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: progress > 0 ? points.slice(0, count) : [],
        },
      };
    });
    (map.getSource(ARC_SOURCE) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    raf = running ? requestAnimationFrame(frame) : null;
  };

  return {
    apply(scene: MapScene) {
      if (scene.rev < lastRev) return;
      const changed = scene.rev !== lastRev;
      lastRev = scene.rev;

      const pinFeatures = scene.pins
        .filter((p) => valid(p.lng, p.lat))
        .map((p) => ({
          type: "Feature" as const,
          properties: {
            id: p.id,
            label: p.state ? `${p.label ?? ""} · ${p.state}` : (p.label ?? ""),
            color: PIN_COLORS[p.kind] ?? PIN_COLORS.place,
            state: p.state ?? "",
          },
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        }));
      (map.getSource(PIN_SOURCE) as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: pinFeatures,
      });

      const goodColumns = scene.columns.filter((c) => valid(c.lng, c.lat));
      const max = Math.max(1, ...goodColumns.map((c) => c.value));
      (map.getSource(COLUMN_SOURCE) as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: goodColumns.map((c) => ({
          type: "Feature" as const,
          properties: {
            h: COLUMN_MIN_H + (COLUMN_MAX_H - COLUMN_MIN_H) * (c.value / max),
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: square(c.lng, c.lat),
          },
        })),
      });

      arcs = scene.arcs
        .filter((a) => valid(...a.from) && valid(...a.to))
        .map((a) => ({ points: arcPath(a.from, a.to), delayMs: a.delayMs }));
      if (changed) startedAt = performance.now();
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);

      highlights = scene.highlights
        .filter((h) => valid(h.lng, h.lat))
        .map((h) => [h.lng, h.lat]);
      paintHighlights();

      const nowActive = isActive(scene);
      if (nowActive !== active) {
        active = nowActive;
        opts.onActiveChange(nowActive);
      }
      if (
        changed &&
        scene.camera &&
        valid(scene.camera.lng, scene.camera.lat)
      ) {
        const c = scene.camera;
        opts.onCamera();
        map.flyTo({
          center: [c.lng, c.lat],
          zoom: c.zoom ?? 16,
          pitch: c.pitch ?? 60,
          bearing: c.bearing ?? map.getBearing(),
          duration: c.durationMs ?? 2500,
          essential: true,
        });
      }
    },
    setHome(point: [number, number]) {
      home = point;
      paintHighlights();
    },
    destroy() {
      if (raf != null) cancelAnimationFrame(raf);
      timers.splice(0).forEach(clearTimeout);
    },
  };
}
