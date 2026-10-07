import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { pulseApi } from "@/features/pulse/api";
import type { ChartSuggestion, Schema } from "@/features/pulse/types";
import { SchemaSelectorStep } from "./board/schema-selector-step";
import { SuggestionsStep } from "./board/suggestions-step";

export function CreateBoardFlow({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (boardId: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [schemasError, setSchemasError] = useState("");
  const [selectedSchemaIds, setSelectedSchemaIds] = useState<Set<string>>(
    new Set(),
  );

  const [suggestions, setSuggestions] = useState<ChartSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [selectedSuggestionIndices, setSelectedSuggestionIndices] = useState<
    Set<number>
  >(new Set());

  const [boardName, setBoardName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let active = true;
    pulseApi
      .listSchemas()
      .then((data) => {
        if (!active) return;
        setSchemas(data);
        setSchemasLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setSchemasError(err instanceof Error ? err.message : String(err));
        setSchemasLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleSchema = (id: string) => {
    setSelectedSchemaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleProceedToStep2 = async () => {
    setStep(2);
    setSuggestionsLoading(true);
    setSuggestionsError("");
    try {
      const ids = Array.from(selectedSchemaIds);
      const results = await pulseApi.suggestCharts(ids);
      setSuggestions(results);
      setSelectedSuggestionIndices(
        new Set(results.map((_, index) => index)),
      );

      const chosenSchemas = schemas.filter((s) => selectedSchemaIds.has(s.id));
      if (chosenSchemas.length === 1) {
        setBoardName(`${chosenSchemas[0].name} Pulse`);
      } else if (chosenSchemas.length > 1) {
        setBoardName(
          `${chosenSchemas.map((s) => s.name).slice(0, 2).join(" & ")} Pulse`,
        );
      } else {
        setBoardName("Analytics Board");
      }
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSelectedSuggestionIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!boardName.trim() || selectedSuggestionIndices.size === 0) return;
    setCreating(true);
    setCreateError("");
    try {
      const chosenCharts = suggestions.filter((_, idx) =>
        selectedSuggestionIndices.has(idx),
      );
      const board = await pulseApi.createChartBoard(
        boardName.trim(),
        chosenCharts,
      );
      onCreated(board.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[85vh] max-h-[750px] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>
              {step === 1
                ? "Step 1: Choose Categories"
                : "Step 2: Suggested Charts"}
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 ? (
            <SchemaSelectorStep
              schemas={schemas}
              selectedSchemaIds={selectedSchemaIds}
              loading={schemasLoading}
              error={schemasError}
              onToggle={toggleSchema}
            />
          ) : (
            <SuggestionsStep
              boardName={boardName}
              onBoardNameChange={setBoardName}
              suggestions={suggestions}
              selectedIndices={selectedSuggestionIndices}
              loading={suggestionsLoading}
              error={suggestionsError}
              createError={createError}
              onToggle={toggleSuggestion}
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-card">
          {step === 1 ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleProceedToStep2}
                disabled={selectedSchemaIds.size === 0}
                className="bg-primary text-black hover:bg-primary gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={creating}
                className="text-muted-foreground hover:text-foreground gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={
                  !boardName.trim() ||
                  selectedSuggestionIndices.size === 0 ||
                  creating ||
                  suggestionsLoading
                }
                className="bg-primary text-black hover:bg-primary gap-1.5"
              >
                {creating ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Create Board</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
