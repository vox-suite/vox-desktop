import { useState } from "react";
import { StrataCanvas } from "./strata-canvas";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Users, RotateCcw } from "lucide-react";

export function StrataView() {
  const [interactive, setInteractive] = useState(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState(false);

  return (
    <div className="relative size-full overflow-hidden bg-[#0a0c0e]">
      {/* 3D WebGL Stepped Contour Terrain Canvas */}
      <StrataCanvas
        interactive={interactive}
        onTakeover={() => setInteractive(true)}
      />

      {/* Start Screen / Attract Mode Overlay */}
      {!interactive && (
        <div className="absolute inset-0 z-30 flex items-center justify-between px-16 pointer-events-none">
          <div className="max-w-md pointer-events-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-mono tracking-wider text-muted-foreground backdrop-blur-md">
              <Sparkles className="size-3 text-cyan-400" />
              VOX ENGINE // STRATA
            </div>

            <h1 className="mt-4 text-5xl font-bold tracking-tight text-white font-mono">
              STRATA
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Infinite stepped contour canyons, Star Wars repulsorcraft mechanics, and real-time multiplayer racing through carved valley gorges.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={() => setInteractive(true)}
                size="lg"
                className="gap-2.5 rounded-full bg-white text-black hover:bg-neutral-200 px-6 font-mono font-medium shadow-lg shadow-white/10"
              >
                <Play className="size-4 fill-black" />
                TAKE FLIGHT (WASD)
              </Button>

              <Button
                onClick={() => setMultiplayerRoom(!multiplayerRoom)}
                variant="outline"
                size="lg"
                className="gap-2 rounded-full border-white/10 bg-black/40 text-muted-foreground hover:text-white px-5 font-mono backdrop-blur-md"
              >
                <Users className="size-4" />
                {multiplayerRoom ? "ROOM: CANYON-01" : "MULTIPLAYER"}
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white">SPACE</kbd>
                Boost
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white">CTRL</kbd>
                Blaster
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white">ESC</kbd>
                Auto-Pilot
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Manual Flight HUD Actions */}
      {interactive && (
        <div className="absolute top-6 right-6 z-30 flex items-center gap-2">
          <Button
            onClick={() => setInteractive(false)}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full border-white/10 bg-black/60 text-xs font-mono text-muted-foreground hover:text-white backdrop-blur-md"
          >
            <RotateCcw className="size-3.5" />
            ATTRACT MODE
          </Button>
        </div>
      )}
    </div>
  );
}
