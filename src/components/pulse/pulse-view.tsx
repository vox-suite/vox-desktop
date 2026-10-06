import { useState } from "react";
import { ArrowRight, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePulseCanvas } from "@/hooks/use-pulse-canvas";
import { BoardView } from "./board-view";
import { AddPulseDialog } from "./add-pulse-dialog";
import { PulseChartCard } from "./chart-card";
export function PulseView() {
  const { canvas, loading, refreshing, error, reload } = usePulseCanvas();
  const [adding, setAdding] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  if (boardId)
    return (
      <BoardView
        boardId={boardId}
        onBack={() => {
          setBoardId(null);
          void reload();
        }}
      />
    );
  const empty =
    canvas?.charts.length === 0 && canvas.legacy_boards.length === 0;
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background p-4 text-foreground sm:p-6">
      {loading && !canvas ? (
        <div
          role="status"
          aria-label="Loading Pulse"
          className="flex flex-1 items-center justify-center"
        >
          <RotateCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error && !canvas ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3"
        >
          <p className="text-sm text-muted-foreground">Could not load Pulse.</p>
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div
            className={
              empty
                ? "flex flex-1 items-center justify-center"
                : "mb-5 flex items-center justify-between"
            }
          >
            {!empty && <h1 className="text-lg font-medium">Pulse</h1>}
            <div className="flex items-center gap-2">
              {!empty && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh charts"
                  disabled={refreshing}
                  onClick={() => void reload(true)}
                >
                  <RotateCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                aria-label="Add to Pulse"
                className={empty ? "h-12 w-12 rounded-full" : ""}
                onClick={() => setAdding(true)}
              >
                <Plus className={empty ? "h-5 w-5" : "h-4 w-4"} />
              </Button>
            </div>
          </div>
          {error && (
            <p role="alert" className="mb-4 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {canvas?.charts.map((chart) => (
              <PulseChartCard
                key={chart.id}
                title={chart.title}
                definition={chart.definition}
                result={chart.result}
              />
            ))}
          </div>
          {canvas?.next_cursor && (
            <Button
              variant="outline"
              className="mx-auto mt-4"
              disabled={refreshing}
              onClick={() =>
                void reload(false, canvas.next_cursor ?? undefined)
              }
            >
              Load more
            </Button>
          )}
          {!!canvas?.legacy_boards.length && (
            <div className="mt-6">
              <p className="mb-3 text-xs text-muted-foreground">Your boards</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {canvas.legacy_boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => setBoardId(board.id)}
                    className="flex items-center justify-between rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {board.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {board.chart_count} charts
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {adding && (
        <AddPulseDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void reload(true);
          }}
        />
      )}
    </div>
  );
}
