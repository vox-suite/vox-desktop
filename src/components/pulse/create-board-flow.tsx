import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Check,
  CheckCircle2,
  PieChart as PieIcon,
  RotateCw,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { schemaColorStyle, schemaIcon } from "@/lib/schema-tokens";
import { pulseApi } from "@/features/pulse/api";
import type { ChartSuggestion, ChartType, Schema } from "@/features/pulse/types";

function getChartIcon(type: ChartType) {
  switch (type) {
    case "line":
      return TrendingUp;
    case "bar":
      return BarChart2;
    case "area":
      return Activity;
    case "pie":
      return PieIcon;
  }
}

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
      const board = await pulseApi.createChartBoard(boardName.trim(), chosenCharts);
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
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Select one or more of your categories to discover analytics and
                visualizations powered by your real data.
              </p>

              {schemasLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <RotateCw className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-xs">Loading categories...</p>
                </div>
              ) : schemasError ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-destructive">
                  <AlertTriangle className="h-6 w-6 mb-2" />
                  <p className="text-xs">{schemasError}</p>
                </div>
              ) : schemas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No categories found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add spans or ingest events first to create categories.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {schemas.map((s) => {
                    const isSelected = selectedSchemaIds.has(s.id);
                    const colorStyle = schemaColorStyle(s.color_token);
                    const IconComp = schemaIcon(s.icon_token);

                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleSchema(s.id)}
                        className={`group relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                          isSelected
                            ? "border-primary/80 bg-primary/20"
                            : "border-border bg-card hover:border-border hover:bg-accent"
                        }`}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                          style={{
                            backgroundColor: colorStyle.bg,
                            borderColor: colorStyle.border,
                            color: colorStyle.dot,
                          }}
                        >
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-xs font-semibold text-muted-foreground truncate">
                            {s.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {s.namespace}
                          </p>
                          {s.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                              {s.description}
                            </p>
                          )}
                        </div>
                        <div
                          className={`absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-primary bg-primary text-black"
                              : "border-border bg-card"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Board Name
                </label>
                <Input
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  placeholder="Enter a board name"
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
              </div>

              {suggestionsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                  <RotateCw className="h-7 w-7 animate-spin text-primary mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Generating chart suggestions...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Analyzing your category structures and sample data to propose
                    optimal metrics and aggregations.
                  </p>
                </div>
              ) : suggestionsError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-destructive">
                  <AlertTriangle className="h-6 w-6 mb-2" />
                  <p className="text-xs font-medium">{suggestionsError}</p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <p className="text-xs">
                    No suggestions could be generated for the selected categories.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Select the charts to include on your new board:
                    </span>
                    <span>
                      {selectedSuggestionIndices.size} of {suggestions.length} selected
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {suggestions.map((suggestion, idx) => {
                      const isSelected = selectedSuggestionIndices.has(idx);
                      const ChartIcon = getChartIcon(suggestion.chart_type);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleSuggestion(idx)}
                          className={`flex cursor-pointer items-start gap-3.5 rounded-lg border p-3.5 transition-all ${
                            isSelected
                              ? "border-primary/80 bg-primary/20"
                              : "border-border bg-card opacity-60 hover:border-border hover:opacity-100"
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-card text-primary border border-border">
                            <ChartIcon className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold text-foreground truncate">
                                {suggestion.title}
                              </h4>
                              <Badge
                                variant="outline"
                                className="border-border bg-card text-[10px] text-muted-foreground capitalize"
                              >
                                {suggestion.chart_type}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {suggestion.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                              <span>Metric: <span className="text-muted-foreground font-mono">{suggestion.query_spec.metric_field}</span></span>
                              <span>•</span>
                              <span>Agg: <span className="text-muted-foreground font-mono">{suggestion.query_spec.aggregation}</span></span>
                              <span>•</span>
                              <span>Group: <span className="text-muted-foreground font-mono">{suggestion.query_spec.group_by}</span></span>
                            </div>
                          </div>

                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-black"
                                : "border-border bg-card"
                            }`}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 stroke-[3]" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {createError && (
                <div className="p-3 rounded border border-destructive/50 bg-destructive/30 text-xs text-destructive">
                  {createError}
                </div>
              )}
            </div>
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
