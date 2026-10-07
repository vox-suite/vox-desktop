import {
  Activity,
  AlertTriangle,
  BarChart2,
  Check,
  Hash,
  PieChart as PieIcon,
  RotateCw,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ChartSuggestion, ChartType } from "@/features/pulse/types";

function getChartIcon(type: ChartType): LucideIcon {
  switch (type) {
    case "line":
      return TrendingUp;
    case "bar":
      return BarChart2;
    case "area":
      return Activity;
    case "pie":
      return PieIcon;
    case "stat":
      return Hash;
  }
}

export function SuggestionsStep({
  boardName,
  onBoardNameChange,
  suggestions,
  selectedIndices,
  loading,
  error,
  createError,
  onToggle,
}: {
  boardName: string;
  onBoardNameChange: (name: string) => void;
  suggestions: ChartSuggestion[];
  selectedIndices: Set<number>;
  loading: boolean;
  error: string;
  createError: string;
  onToggle: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Board Name
        </label>
        <Input
          value={boardName}
          onChange={(e) => onBoardNameChange(e.target.value)}
          placeholder="Enter a board name"
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
        />
      </div>

      {loading ? (
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
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-destructive">
          <AlertTriangle className="h-6 w-6 mb-2" />
          <p className="text-xs font-medium">{error}</p>
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
            <span>Select the charts to include on your new board:</span>
            <span>
              {selectedIndices.size} of {suggestions.length} selected
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {suggestions.map((suggestion, idx) => {
              const isSelected = selectedIndices.has(idx);
              const ChartIcon = getChartIcon(suggestion.chart_type);

              return (
                <div
                  key={idx}
                  onClick={() => onToggle(idx)}
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
                      <span>
                        Metric:{" "}
                        <span className="text-muted-foreground font-mono">
                          {suggestion.query_spec.metric_field}
                        </span>
                      </span>
                      <span>•</span>
                      <span>
                        Agg:{" "}
                        <span className="text-muted-foreground font-mono">
                          {suggestion.query_spec.aggregation}
                        </span>
                      </span>
                      <span>•</span>
                      <span>
                        Group:{" "}
                        <span className="text-muted-foreground font-mono">
                          {suggestion.query_spec.group_by}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
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
        </div>
      )}

      {createError && (
        <div className="p-3 rounded border border-destructive/50 bg-destructive/30 text-xs text-destructive">
          {createError}
        </div>
      )}
    </div>
  );
}
