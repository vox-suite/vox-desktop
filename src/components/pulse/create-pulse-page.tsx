import { useState } from "react";
import { ArrowLeft, ArrowUpRight, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualChartFlow } from "./manual-chart-flow";
import { SuggestionsView } from "./suggestions-view";

export function CreatePulsePage({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"manual" | "suggestions">("suggestions");
  return (
    <section
      className="pulse-surface pulse-create h-full overflow-y-auto"
      aria-label="Create a Pulse chart"
    >
      <div className="pulse-create-inner">
        <Button variant="ghost" className="pulse-back" onClick={onClose}>
          <ArrowLeft size={15} /> Back to Pulse
        </Button>
        <header className="pulse-create-heading">
          <div>
            <h1>What’s your day made of?</h1>
            <p>
              Music on repeat. Time spent playing. Where your money goes.
              <br className="hidden sm:block" /> Find a pattern worth keeping in
              view.
            </p>
          </div>
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
                  stroke={i < 17 ? "#52e2ac" : "#3b3d3c"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            <Sparkles size={27} />
          </div>
        </header>
        <div
          className="pulse-create-navigation"
          aria-label="Chart creation options"
        >
          <button
            className={mode === "suggestions" ? "is-selected" : ""}
            aria-pressed={mode === "suggestions"}
            onClick={() => setMode("suggestions")}
          >
            <Sparkles size={18} />
            <span>
              <strong>Suggestions</strong>
              <small>Ideas from your activity</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
          <button
            className={mode === "manual" ? "is-selected" : ""}
            aria-pressed={mode === "manual"}
            onClick={() => setMode("manual")}
          >
            <PenLine size={18} />
            <span>
              <strong>Create manually</strong>
              <small>Start with a measurement</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="pulse-create-content">
          {mode === "manual" ? (
            <ManualChartFlow onSaved={onSaved} />
          ) : (
            <SuggestionsView onSaved={onSaved} />
          )}
        </div>
      </div>
    </section>
  );
}
