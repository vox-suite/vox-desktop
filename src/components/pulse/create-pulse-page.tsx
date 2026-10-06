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
    <section
      className="pulse-surface pulse-create h-full overflow-y-auto"
      aria-label="Create a Pulse chart"
    >
      <div className="pulse-create-inner">
        <Button variant="ghost" className="pulse-back" onClick={onClose}>
          <ArrowLeft size={15} /> Back to Pulse
        </Button>
        <div className="flex items-center justify-between py-6">
          <h1 className="text-xl font-medium">Add a chart</h1>
          <div className="pulse-seg" role="group" aria-label="Chart creation options">
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
        </div>
        <div className="pulse-create-content">
          {mode === "ask" ? (
            <AskView onSaved={onSaved} />
          ) : (
            <SuggestionsView onSaved={onSaved} />
          )}
        </div>
      </div>
    </section>
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
