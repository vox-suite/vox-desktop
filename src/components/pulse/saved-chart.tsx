import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { discoveryApi } from "@/features/pulse/api";
import type {
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";
import { ALL_TIME_DAYS, windowLabel } from "@/features/pulse/window";
import { PulseChartCard } from "./chart-card";

export function SavedChart({
  title,
  definition: initial,
  result: initialResult,
  onRemove,
}: {
  title: string;
  definition: PulseDefinition;
  result: PulseResult | null;
  onRemove: () => void;
}) {
  const [definition, setDefinition] = useState(initial);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);

  async function change(patch: Partial<PulseDefinition>) {
    const next = { ...definition, ...patch };
    const mine = ++ticket.current;
    setDefinition(next);
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (mine !== ticket.current) return;
    try {
      const fresh = await discoveryApi.preview(next);
      if (mine === ticket.current) setResult(fresh);
    } catch (e) {
      if (mine === ticket.current)
        setResult((r) => (r ? { ...r, error: String(e) } : r));
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  }

  const offset = definition.offset_days ?? 0;
  const allTime = definition.period_days >= ALL_TIME_DAYS;

  return (
    <div
      className={`min-w-0 ${loading ? "opacity-60 transition-opacity" : ""}`}
    >
      <PulseChartCard
        title={title}
        definition={definition}
        result={result}
        headerAction={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Chart options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={() => {
                  if (window.confirm(`Delete “${title}”?`)) onRemove();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        footerAction={
          definition.bucket && !allTime ? (
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  aria-label="Earlier"
                  onClick={() =>
                    void change({ offset_days: offset + definition.period_days })
                  }
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-[11px] leading-6">
                  {windowLabel(definition)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  aria-label="Later"
                  disabled={offset === 0}
                  onClick={() =>
                    void change({
                      offset_days: Math.max(0, offset - definition.period_days),
                    })
                  }
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
          ) : null
        }
      />
    </div>
  );
}
