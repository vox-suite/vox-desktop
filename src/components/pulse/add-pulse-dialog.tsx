import { useState } from "react";
import { ArrowLeft, PenLine, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ManualChartFlow } from "./manual-chart-flow";
import { SuggestionsView } from "./suggestions-view";
export function AddPulseDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"manual" | "suggestions" | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={
          mode ? "max-h-[85vh] overflow-y-auto sm:max-w-4xl" : "sm:max-w-sm"
        }
      >
        <DialogTitle>
          {mode === "manual"
            ? "Create manually"
            : mode === "suggestions"
              ? "Suggestions"
              : "Add to Pulse"}
        </DialogTitle>
        <DialogDescription>
          {mode === "suggestions"
            ? "Charts drawn from the activity you have recorded."
            : mode === "manual"
              ? "Choose a measurement, preview your chart, then add it."
              : "Choose how you want to create a chart."}
        </DialogDescription>
        {mode && (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setMode(null)}
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </Button>
        )}
        {mode === "manual" ? (
          <ManualChartFlow onSaved={onSaved} />
        ) : mode === "suggestions" ? (
          <SuggestionsView onSaved={onSaved} />
        ) : (
          <div className="grid gap-2 py-2">
            <Button
              variant="outline"
              className="h-12 justify-start gap-3"
              onClick={() => setMode("manual")}
            >
              <PenLine className="h-4 w-4" />
              Create manually
            </Button>
            <Button
              variant="outline"
              className="h-12 justify-start gap-3"
              onClick={() => setMode("suggestions")}
            >
              <Sparkles className="h-4 w-4" />
              Suggestions
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
