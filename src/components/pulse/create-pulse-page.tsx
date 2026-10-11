import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeasurementsView } from "./measurements-view";
import { PulseShell } from "./pulse-shell";
import { SuggestionsView } from "./suggestions-view";

export function CreatePulsePage({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"measurements" | "suggestions">(
    "suggestions",
  );
  return (
    <PulseShell
      scroll={mode === "suggestions"}
      glow
      label="Create an Insights chart"
      header={
        <>
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft size={15} /> Insights
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
              aria-pressed={mode === "measurements"}
              onClick={() => setMode("measurements")}
            >
              Measurements
            </button>
          </div>
        </>
      }
    >
      <div
        className={
          mode !== "suggestions"
            ? "pulse-create-inner h-full"
            : "pulse-create-inner"
        }
        style={{
          paddingTop: 24,
          ...(mode !== "suggestions" ? { paddingBottom: 24 } : {}),
        }}
      >
        <div
          className={
            mode !== "suggestions"
              ? "pulse-create-content h-full"
              : "pulse-create-content"
          }
        >
          {mode === "measurements" ? (
            <MeasurementsView onSaved={onSaved} />
          ) : (
            <SuggestionsView onSaved={onSaved} />
          )}
        </div>
      </div>
    </PulseShell>
  );
}
