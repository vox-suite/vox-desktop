import { useMemo, useState } from "react";
import {
  PageContainer,
  PageBody,
} from "@/components/ui/page-container";
import { PlanningTimeline } from "@/components/planning-timeline";
import { daysFrom } from "@/lib/span-format";
import { SpanPanel } from "@/components/span-panel";
import { useDayCounts, useDayItems } from "@/hooks/use-span-days";
import { SpanMonthCounts } from "@/components/span-month-counts";
import {
  addDays,
  addMonths,
  monthGridDays,
  startOfDay,
  startOfMonth,
} from "@/lib/span-layout";
import { spanDays } from "@/features/spans/day-store";
import type { Collection, Span } from "@/features/spans/types";
import {
  TimelineHeader,
  initialAnchor,
  type ViewMode,
} from "./spans";

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
  const [mode, setMode] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => initialAnchor(collection, "day"));
  const [selected, setSelected] = useState<Span | null>(null);

  const days = useMemo(() => {
    if (mode === "day") return [anchor];
    if (mode === "month") {
      const first = startOfMonth(anchor);
      const count = new Date(
        first.getFullYear(),
        first.getMonth() + 1,
        0,
      ).getDate();
      return daysFrom(first, count);
    }
    return daysFrom(anchor, 7);
  }, [anchor, mode]);

  const scope = collection?.id ?? "";
  const monthGrid = useMemo(() => monthGridDays(anchor), [anchor]);
  const counts = useDayCounts(monthGrid, scope, mode === "month");
  const items = useDayItems(days, scope, mode !== "month");
  const scheduled = {
    spans: items.spans,
    loading: mode === "month" ? counts.loading : items.loading,
    error: items.error,
    reload: async () => spanDays.invalidate(),
  };

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
    <PageContainer>
      <TimelineHeader
        collection={collection}
        anchor={anchor}
        days={days}
        mode={mode}
        onModeChange={handleModeChange}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={onBack}
        onReload={reload}
        loading={scheduled.loading}
      />

      <PageBody scroll={false} className="flex">
        <div
          data-no-drag
          className="no-drag flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {scheduled.error ? (
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-5 py-2">
              <p className="text-xs text-destructive">{scheduled.error}</p>
            </div>
          ) : null}

          <div
            data-no-drag
            className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background"
          >
            {mode === "month" ? (
              <SpanMonthCounts
                anchorDate={anchor}
                counts={counts.byDay}
                loading={counts.loading}
                onSelectDay={(day) => {
                  setMode("day");
                  setAnchor(startOfDay(day));
                }}
              />
            ) : (
              <PlanningTimeline
                days={days}
                spans={scheduled.spans}
                onSelect={setSelected}
                loading={scheduled.loading}
                frontiers={items.frontiers}
                onLoadMore={items.loadMore}
              />
            )}
          </div>
        </div>
      </PageBody>

      <SpanPanel
        span={selected}
        collections={collections}
        onClose={() => setSelected(null)}
        onSaved={reload}
      />
    </PageContainer>
  );
}
