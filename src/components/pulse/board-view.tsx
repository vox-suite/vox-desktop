import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Layers,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChartBoardData } from "@/hooks/use-chart-board-data";
import type { ChartDataResult } from "@/features/pulse/types";
import { SingleChart } from "./board/single-chart";

export function BoardView({
  boardId,
  onBack,
}: {
  boardId: string;
  onBack: () => void;
}) {
  const { board, data, loading, refreshing, error, reload } =
    useChartBoardData(boardId);

  const resultMap = useMemo(() => {
    const map = new Map<string, ChartDataResult>();
    for (const r of data) {
      map.set(r.chart_id, r);
    }
    return map;
  }, [data]);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-background p-4 text-foreground sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {board?.name ?? "Board"}
            </h1>
            {board && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Calendar className="h-3 w-3" />
                <span>
                  Created {new Date(board.created_at).toLocaleDateString()}
                </span>
                <span>•</span>
                <span>{board.charts.length} charts</span>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={loading || refreshing}
          className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground gap-2"
        >
          <RotateCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-destructive">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p className="text-sm font-semibold">Failed to load board</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      ) : board && board.charts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Layers className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">This board has no charts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          {board?.charts.map((chart) => (
            <SingleChart
              key={chart.id}
              chart={chart}
              result={resultMap.get(chart.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
