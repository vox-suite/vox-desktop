import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskView } from "./ask-view";
import { SuggestionsView } from "./suggestions-view";

export function CreatePulsePage({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"ask" | "suggestions">("suggestions");
  return (
    <div className="pulse-surface relative h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 100% 0%, #3ecf8e55 0%, #3ecf8e22 40%, #3ecf8e0a 65%, transparent 85%)",
        }}
      />
      <section
        className="pulse-create relative h-full overflow-y-auto"
        aria-label="Create a Pulse chart"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/70 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft size={15} /> Pulse
            </Button>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-medium">Add a chart</h1>
          </div>
          <div
            className="pulse-seg"
            role="group"
            aria-label="Chart creation options"
          >
            <button
              aria-pressed={mode === "suggestions"}
              onClick={() => setMode("suggestions")}
            >
              Suggestions
            </button>
            <button
              aria-pressed={mode === "ask"}
              onClick={() => setMode("ask")}
            >
              Ask Pulse
            </button>
          </div>
        </header>
        <div className="pulse-create-inner" style={{ paddingTop: 24 }}>
          <div className="pulse-create-content">
            {mode === "ask" ? (
              <AskView onSaved={onSaved} />
            ) : (
              <SuggestionsView onSaved={onSaved} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function PulseOrbit() {
  return (
    <div className="pulse-orbit" aria-hidden="true">
      <svg viewBox="0 0 180 180">
        {Array.from({ length: 48 }, (_, i) => (
          <line
            key={i}
            x1="90"
            y1="22"
            x2="90"
            y2={i % 6 === 0 ? 9 : 15}
            transform={`rotate(${i * 7.5} 90 90)`}
            stroke={i < 17 ? "#3ecf8e" : "#2a2a2a"}
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <Sparkles size={27} />
    </div>
  );
}
