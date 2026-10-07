import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-container";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Collection } from "@/features/spans/types";
import { rangeLabel, type ViewMode } from "./range-utils";

export function TimelineHeader({
  collection,
  anchor,
  days,
  mode,
  onModeChange,
  onPrev,
  onNext,
  onBack,
  onReload,
  loading,
}: {
  collection?: Collection | null;
  anchor: Date;
  days: Date[];
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack?: () => void;
  onReload: () => void;
  loading: boolean;
}) {
  return (
    <PageHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-background px-3 py-2.5 sm:px-6 sm:py-3">
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
          <Badge
            variant="outline"
            className="border-border text-muted-foreground"
          >
            {collection.kind}
          </Badge>
        ) : null}
      </div>

      <div className="no-drag flex w-full items-center justify-between gap-2.5 sm:w-auto sm:justify-end">
        <Button
          variant="secondary"
          size="icon"
          onClick={onReload}
          disabled={loading}
          title="Refresh"
        >
          <RotateCw
            className={`size-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </Button>

        <div className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Previous"
            onClick={onPrev}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <div className="w-px self-stretch bg-muted" />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Next"
            onClick={onNext}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

        <Tabs
          value={mode}
          onValueChange={(v) => onModeChange(v as ViewMode)}
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
    </PageHeader>
  );
}
