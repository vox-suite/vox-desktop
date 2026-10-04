import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpanCalendar } from "@/components/span-calendar";
import { SpanMonthView } from "@/components/span-month-view";
import { daysFrom } from "@/lib/span-format";
import { SpanDialog } from "@/components/span-dialog";
import { useSpans } from "@/hooks/use-spans";
import {
  addDays,
  addMonths,
  monthGridDays,
  startOfDay,
  startOfMonth,
} from "@/lib/span-layout";
import type { Collection, Span } from "@/features/spans/types";

export type ViewMode = "day" | "week" | "month";

function rangeLabel(mode: ViewMode, anchor: Date, days: Date[]): string {
  if (mode === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (mode === "month") {
    const start = days[0].toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const end = days[days.length - 1].toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} – ${end}`;
  }
  // Week mode
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const first = days[0].toLocaleDateString(undefined, opts);
  const last = days[days.length - 1].toLocaleDateString(undefined, {
    ...opts,
    year: "numeric",
  });
  return `${first} – ${last}`;
}

function initialAnchor(
  collection: Collection | null | undefined,
  mode: ViewMode,
): Date {
  if (collection?.starts_at) return startOfDay(new Date(collection.starts_at));
  const today = startOfDay(new Date());
  if (mode === "week") return addDays(today, -today.getDay());
  if (mode === "month") return startOfMonth(today);
  return today;
}

export function TimelineView({
  collection,
  collections,
  onBack,
}: {
  collection?: Collection | null;
  collections: Collection[];
  onBack?: () => void;
  onCollapse?: () => void;
}) {
  // One day view mode as default
  const [mode, setMode] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => initialAnchor(collection, "day"));
  const [selected, setSelected] = useState<Span | null>(null);

  const days = useMemo(() => {
    if (mode === "day") return [anchor];
    if (mode === "month") return monthGridDays(anchor);
    return daysFrom(anchor, 7);
  }, [anchor, mode]);

  const from = days[0].toISOString();
  const to = addDays(days[days.length - 1], 1).toISOString();

  const scheduled = useSpans({ from, to, collectionId: collection?.id });

  const reload = () => {
    void scheduled.reload();
  };

  const handleModeChange = (newMode: ViewMode) => {
    setMode(newMode);
    setAnchor((prev) => {
      const today = startOfDay(new Date());
      if (newMode === "day") return prev;
      if (newMode === "week") return addDays(prev, -prev.getDay());
      if (newMode === "month") return startOfMonth(prev);
      return today;
    });
  };

  const handlePrev = () => {
    if (mode === "day") setAnchor((a) => addDays(a, -1));
    else if (mode === "month") setAnchor((a) => addMonths(a, -1));
    else setAnchor((a) => addDays(a, -7));
  };

  const handleNext = () => {
    if (mode === "day") setAnchor((a) => addDays(a, 1));
    else if (mode === "month") setAnchor((a) => addMonths(a, 1));
    else setAnchor((a) => addDays(a, 7));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* View Header */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-background px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {onBack ? (
            <Button
              variant="secondary"
              size="icon"
              onClick={onBack}
              title="Back to Collections"
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}

          {/* Mini Calendar Date Badge as in Screenshot */}
          <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <span className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-destructive leading-none">
              {anchor.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="font-mono text-[14px] font-bold text-foreground leading-tight">
              {anchor.getDate()}
            </span>
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground leading-tight">
              {collection
                ? collection.name
                : anchor.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
            </h1>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground leading-tight">
              {rangeLabel(mode, anchor, days)}
            </p>
          </div>

          {collection ? (
            <Badge variant="outline" className="border-border text-muted-foreground">
              {collection.kind}
            </Badge>
          ) : null}
        </div>

        <div className="no-drag flex w-full items-center justify-between gap-2.5 sm:w-auto sm:justify-end">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void scheduled.reload()}
            disabled={scheduled.loading}
            title="Refresh"
          >
            <RotateCw
              className={`size-3.5 ${scheduled.loading ? "animate-spin" : ""}`}
            />
          </Button>

          {/* Segmented [ < ] | [ > ] Nav Group */}
          <div className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Previous"
              onClick={handlePrev}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <div className="w-px self-stretch bg-muted" />
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Next"
              onClick={handleNext}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          {/* Day / Week / Month Mode Tabs */}
          <Tabs
            value={mode}
            onValueChange={(v) => handleModeChange(v as ViewMode)}
          >
            <TabsList className="h-8 border border-border bg-card p-0.5">
              <TabsTrigger value="day" className="h-7 px-3 text-[11.5px]">
                Day
              </TabsTrigger>
              <TabsTrigger value="week" className="h-7 px-3 text-[11.5px]">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="h-7 px-3 text-[11.5px]">
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main Content Area - Full width without right To-do sidebar */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          data-no-drag
          className="no-drag flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {scheduled.error ? (
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-5 py-2">
              <p className="text-xs text-destructive">{scheduled.error}</p>
            </div>
          ) : null}

          {/* Calendar Body: Day/Week Grid or Month Grid */}
          <div
            data-no-drag
            className="flex flex-1 min-h-0 flex-col overflow-hidden"
          >
            {mode === "month" ? (
              <SpanMonthView
                anchorDate={anchor}
                spans={scheduled.spans}
                onSelectSpan={setSelected}
                onSelectDay={(day) => {
                  setMode("day");
                  setAnchor(startOfDay(day));
                }}
              />
            ) : (
              <SpanCalendar
                days={days}
                spans={scheduled.spans}
                onSelect={setSelected}
              />
            )}
          </div>
        </div>
      </div>

      <SpanDialog
        span={selected}
        draft={null}
        collections={collections}
        onClose={() => setSelected(null)}
        onSaved={reload}
      />
    </div>
  );
}
