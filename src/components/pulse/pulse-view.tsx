import { useState } from "react";
import { ArrowRight, Music2, Gamepad2, Plus, RotateCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePulseCanvas } from "@/hooks/use-pulse-canvas";
import { BoardView } from "./board-view";
import { CreatePulsePage, PulseOrbit } from "./create-pulse-page";
import { PulseShell } from "./pulse-shell";
import { PulseChartSkeleton } from "./chart-card";
import { SavedChart } from "./saved-chart";
export function PulseView() {
  const { canvas, loading, refreshing, error, reload } = usePulseCanvas();
  const [adding, setAdding] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  if (adding)
    return (
      <CreatePulsePage
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          void reload(true);
        }}
      />
    );
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
    <PulseShell
      header={
        <>
          <h1 className="text-sm font-medium">Pulse</h1>
          {!empty && (
            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                size="icon"
                aria-label="Add to Pulse"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      }
    >
      <div className="flex min-h-full flex-col p-4 sm:p-6">
      {loading && !canvas ? (
        <div
          role="status"
          aria-label="Loading Pulse"
          className="pulse-chart-grid"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <PulseChartSkeleton key={i} />
          ))}
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
          {empty ? (
            <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <PulseOrbit />
              <div>
                <h2 className="text-xl font-medium">No charts yet</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Pulse turns your connected apps into small, living charts —
                  what you listen to, what you play, where your money goes.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                {[
                  [Music2, "Top artists this month"],
                  [Gamepad2, "Hours played per week"],
                  [Wallet, "Spend by category"],
                ].map(([Icon, label]) => (
                  <span
                    key={label as string}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {label as string}
                  </span>
                ))}
              </div>
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add your first chart
              </Button>
            </div>
          ) : null}
          {error && (
            <p role="alert" className="mb-4 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="pulse-chart-grid">
            {canvas?.charts.map((chart) => (
              <SavedChart
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
      </div>
    </PulseShell>
  );
}
