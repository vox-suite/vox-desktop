import { STATIC_ORB_DOTS } from "./vox-logo-dots";

export type VoxStatusLogoStyle = "resonance" | "spiral";

// Sample the spiral by arc length so dot gaps stay equal from rim to core.
const vortexArc = [{ radius: 4, length: 0 }];
for (let i = 1; i <= 256; i++) {
  const radius = 4 + (23 * i) / 256;
  const previous = vortexArc[i - 1];
  const midpoint = (radius + previous.radius) / 2;
  vortexArc.push({
    radius,
    length:
      previous.length +
      (radius - previous.radius) * Math.sqrt(1 + (midpoint * 0.18) ** 2),
  });
}
const vortexLength = vortexArc[256].length;
// Match the original logo's typical spacing along a dotted strand.
const vortexDotsPerArm = Math.floor(vortexLength / 2.18);
function vortexRadius(length: number) {
  let low = 0;
  let high = 256;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (vortexArc[middle].length < length) low = middle;
    else high = middle;
  }
  const a = vortexArc[low];
  const b = vortexArc[high];
  return (
    a.radius +
    ((b.radius - a.radius) * (length - a.length)) / (b.length - a.length)
  );
}

export type VoxDotFrame = [number, number, number, number];

export function readVoxLogo(svg: SVGSVGElement): VoxDotFrame[] {
  return Array.from(
    svg.querySelectorAll("circle"),
    (dot) =>
      ["cx", "cy", "r", "opacity"].map((attribute) =>
        Number(dot.getAttribute(attribute)),
      ) as VoxDotFrame,
  );
}

export function paintVoxLogo(
  svg: SVGSVGElement,
  time: number,
  variant: VoxStatusLogoStyle,
  transition?: { from: VoxDotFrame[]; progress: number },
) {
  const dots = svg.querySelectorAll("circle");
  STATIC_ORB_DOTS.forEach(([cx, cy, radius, opacity], index) => {
    const dot = dots[index];
    if (!dot) return;
    const x = cx - 32;
    const y = cy - 32;
    const edge = Math.max(0, 1 - Math.hypot(x, y) / 30);
    let dx = 0;
    let dy = 0;
    let light = 0;
    let visibility = 1;
    let depthLight = 1;
    switch (variant) {
      case "spiral": {
        // Nine distinct, equally separated dotted strands.
        const arm = index % 9;
        const step = Math.floor(index / 9);
        const count = vortexDotsPerArm;
        const flow = (step / count + time / 5) % 1;
        const distance = vortexRadius((1 - flow) * vortexLength);
        const angle = arm * ((Math.PI * 2) / 9) - distance * 0.18 - time * 0.35;
        const worldX = Math.cos(angle) * distance;
        const worldY = Math.sin(angle) * distance;
        const worldZ = -18 * Math.pow(1 - distance / 27, 1.4);
        // Orthographic projection keeps dot sizes fixed while the tilted
        // funnel and depth shading give the inward flow a three-dimensional shape.
        const tilt = 0.62 + Math.sin(time * 0.45) * 0.06;
        const vx = worldX;
        const vy = worldY * Math.cos(tilt) - worldZ * Math.sin(tilt) - 4;
        const depth = worldY * Math.sin(tilt) + worldZ * Math.cos(tilt);
        depthLight = 0.48 + 0.52 * Math.max(0, Math.min(1, (depth + 25) / 42));
        const entrance = Math.min(1, time / 0.9);
        const easedEntrance = entrance * entrance * (3 - 2 * entrance);
        dx = (vx - x) * easedEntrance;
        dy = (vy - y) * easedEntrance;
        light = 0.55;
        // Fade only at the rim/core seam so the inward flow loops seamlessly.
        visibility =
          1 -
          easedEntrance +
          easedEntrance *
            (step < count ? Math.min(1, flow / 0.06, (1 - flow) / 0.06) : 0);
        break;
      }
      case "resonance": {
        const wave = Math.sin(x * 0.23 - time * 2.2);
        dy = y * wave * 0.48 * edge;
        dx = Math.cos(y * 0.17 + time * 1.4) * edge * 0.7;
        light = (wave + 1) * 0.22;
        break;
      }
    }
    const target: VoxDotFrame = [
      cx + dx,
      cy + dy,
      variant === "spiral" ? 0.53 : radius,
      (variant === "spiral" ? 0.85 : Math.min(1, opacity * (0.8 + light))) *
        visibility *
        depthLight,
    ];
    const from = transition?.from[index];
    const progress = transition?.progress ?? 1;
    const eased = progress * progress * (3 - 2 * progress);
    ["cx", "cy", "r", "opacity"].forEach((attribute, i) => {
      dot.setAttribute(
        attribute,
        String(from ? from[i] + (target[i] - from[i]) * eased : target[i]),
      );
    });
  });
}
