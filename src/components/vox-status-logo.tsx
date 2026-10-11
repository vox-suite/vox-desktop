import { useEffect, useRef } from "react";
import { VoxLogo, VoxOrbSvg } from "@/components/vox-logo";
import {
  paintVoxLogo,
  readVoxLogo,
  type VoxStatusLogoStyle,
} from "./vox-logo-motion";
import { cn } from "@/lib/utils";
export type { VoxStatusLogoStyle } from "./vox-logo-motion";

export function VoxStatusLogo({
  state = "idle",
  variant,
  animateIdle = false,
  size = 24,
  className,
}: {
  state?: "idle" | "connecting" | "active" | "error";
  variant?: VoxStatusLogoStyle;
  animateIdle?: boolean;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const style = variant ?? (state === "connecting" ? "spiral" : "resonance");
  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg || (state !== "connecting" && state !== "active")) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    let last = 0;
    let time = 0;
    const from = readVoxLogo(svg);
    const tick = (now: number) => {
      if (!document.hidden && visible && !reduced.matches) {
        if (last && now - last >= 32) {
          time += Math.min((now - last) / 1000, 0.05);
          paintVoxLogo(svg, time, style, {
            from,
            progress: Math.min(1, time / 0.85),
          });
          last = now;
        } else if (!last) last = now;
      } else last = 0;
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(svg);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [state, style, animateIdle]);

  if (animateIdle && state === "idle") {
    return <VoxLogo animated size={size} state="idle" className={className} />;
  }
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <VoxOrbSvg size={size} />
    </span>
  );
}
