import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import {
  VoxStatusLogo,
  type VoxStatusLogoStyle,
} from "../../src/components/vox-status-logo";
import "../../src/index.css";
const variants: [VoxStatusLogoStyle, string, string][] = [
  ["spiral", "Spiral", "Dots wind into the center while Vox connects."],
  [
    "resonance",
    "Resonance",
    "A traveling wave changes the height of the internal lines.",
  ],
];
export function ConnectionDemo() {
  const [state, setState] = useState<"idle" | "connecting" | "active">("idle");
  useEffect(() => {
    if (state !== "connecting") return;
    const timer = setTimeout(() => setState("active"), 4000);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <button
      className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-3"
      onClick={() => setState(state === "idle" ? "connecting" : "idle")}
    >
      <VoxStatusLogo animateIdle state={state} size={48} />
      <span>
        {state === "idle"
          ? "Talk to Vox · click to preview"
          : state === "connecting"
            ? "Connecting…"
            : "Listening · click to reset"}
      </span>
    </button>
  );
}
createRoot(document.getElementById("root")!).render(
  <main className="h-screen overflow-auto bg-[#0d0e11] p-10 text-[#dedee5]">
    <h1 className="text-2xl font-medium">Motion inside the Vox logo</h1>
    <ConnectionDemo />
    <p className="mt-3 text-sm text-[#9898a4]">
      566 dots. Uniform spiral dots and spacing. Connecting and listening.
    </p>
    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
      {variants.map(([variant, name, description]) => (
        <section
          key={variant}
          className="flex flex-col items-center rounded-2xl border border-[#2c2c35] bg-[#14151a] p-7 text-center"
        >
          <VoxStatusLogo state="active" variant={variant} size={180} />
          <h2 className="mt-6 text-base font-medium">{name}</h2>
          <p className="mt-3 min-h-16 text-xs leading-relaxed text-[#9898a4]">
            {description}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <VoxStatusLogo state="active" variant={variant} size={24} />
            <span className="text-xs">
              {variant === "spiral" ? "Connecting…" : "Listening"}
            </span>
          </div>
        </section>
      ))}
    </div>
    <p className="mt-6 text-xs text-[#9898a4]">
      Reduced motion shows the unchanged static SVG.
    </p>
  </main>,
);
