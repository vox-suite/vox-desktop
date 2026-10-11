import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import { desktopActions } from "@/features/desktop-control/action-state";
import { useEffect, useState } from "react";
import { Activity, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePulseCanvas } from "@/hooks/use-pulse-canvas";
import { CreatePulsePage } from "./create-pulse-page";
import { PulseIntroduction } from "./pulse-introduction";
import { PulseShell } from "./pulse-shell";
import { PulseChartSkeleton } from "./chart-card";
import { SavedChart } from "./saved-chart";
import { discoveryApi } from "@/features/pulse/api";
export function PulseView() {
  const { canvas, loading, refreshing, error, reload } = usePulseCanvas();
  const context = useDesktopContext();
  useEffect(
    () =>
      desktopActions.subscribe(() => {
        const values = Object.values(desktopActions.snapshot());
        if (
          values.some(
            (action) =>
              action.phase === "completed" && action.action.endsWith("pulse"),
          )
        )
          void reload(true);
      }),
    [reload],
  );
  const [adding, setAdding] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
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
  const empty =
    canvas?.charts.filter((chart) => !removed.includes(chart.id)).length === 0;
  return (
    <PulseShell
      scroll={!empty}
      header={
        <>
          <div className="flex items-center gap-3.5">
            <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
              <Activity className="size-[18px] text-[#3ecf8e]" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight">Insights</h1>
              <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                {empty
                  ? "No charts yet"
                  : `${canvas?.charts.length ?? 0} live charts`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!empty && (
              <Button
                variant="secondary"
                size="icon"
                className="size-8 rounded-lg"
                aria-label="Refresh charts"
                disabled={refreshing}
                onClick={() => void reload(true)}
              >
                <RotateCw
                  className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-3 text-xs"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5" />
              Add chart
            </Button>
          </div>
        </>
      }
    >
      <div
        className={`relative flex flex-col p-4 sm:p-6 ${empty ? "h-full" : "min-h-full"}`}
      >
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
            <p className="text-sm text-muted-foreground">
              Could not load Pulse.
            </p>
            <p className="text-xs text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {empty ? (
              <PulseIntroduction onCreate={() => setAdding(true)} />
            ) : null}
            {(error || actionError) && (
              <p role="alert" className="mb-4 text-xs text-destructive">
                {actionError || error}
              </p>
            )}
            <div className="pulse-chart-grid">
              {canvas?.charts
                .filter((chart) => !removed.includes(chart.id))
                .map((chart) => (
                  <div
                    key={chart.id}
                    onClick={() => desktopStore.patch({ pulseId: chart.id })}
                    className={
                      context.pulseId === chart.id
                        ? "rounded-lg ring-1 ring-foreground/50"
                        : ""
                    }
                  >
                    <SavedChart
                      key={chart.id}
                      onRemove={() => {
                        setActionError("");
                        void discoveryApi
                          .deleteChart(chart.id)
                          .then(() => setRemoved((ids) => [...ids, chart.id]))
                          .catch((err: unknown) =>
                            setActionError(
                              `Could not delete chart: ${err instanceof Error ? err.message : String(err)}`,
                            ),
                          );
                      }}
                      title={chart.title}
                      definition={chart.definition}
                      result={chart.result}
                      pending={!chart.result}
                    />
                  </div>
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
          </>
        )}
      </div>
    </PulseShell>
  );
}
