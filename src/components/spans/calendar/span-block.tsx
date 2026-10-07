import { CategoryIndicator } from "@/components/category-indicator";
import type { PlacedSpan } from "@/lib/span-layout";
import type { Span } from "@/features/spans/types";
import {
  displayTitle,
  formatAmount,
  formatTime,
  isEstimated,
  spanCover,
  spanStyle,
} from "@/lib/span-format";
import { cn } from "@/lib/utils";
import { INDENT_PX, PX_PER_MIN } from "./constants";
import { SpanHoverCard } from "./span-hover-card";

export function SpanBlock({
  placed,
  hasChildren,
  onSelect,
}: {
  placed: PlacedSpan;
  hasChildren: boolean;
  onSelect: (span: Span) => void;
}) {
  const { span, top, height, left, width, depth } = placed;
  const style = spanStyle(span);
  const inset = depth * INDENT_PX;
  const heightPx = Math.max(height * PX_PER_MIN - 2, 22);
  const amount = formatAmount(span);
  const estimated = isEstimated(span);
  const muted = span.status === "cancelled";
  const showTime = heightPx >= 48;

  const card = !!spanCover(span);
  const block = (
    <button
      type="button"
      data-no-drag
      title={
        card
          ? undefined
          : `${displayTitle(span)}${estimated ? " (estimated)" : ""} · ${formatTime(span.start_at)}${
              span.end_at ? `–${formatTime(span.end_at)}` : ""
            }${amount ? ` · ${amount}` : ""}`
      }
      onClick={(e) => {
        e.stopPropagation();
        onSelect(span);
      }}
      className={cn(
        "group absolute flex flex-col overflow-hidden rounded-lg text-left shadow-md transition duration-150 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        showTime ? "justify-between p-2.5" : "justify-center px-2 py-1",
        muted && "opacity-40 line-through",
        span.status === "active" &&
          "ring-1 ring-border shadow-[0_0_14px_rgba(255,255,255,0.2)]",
        span.status === "failed" && "ring-1 ring-destructive",
      )}
      style={{
        top: top * PX_PER_MIN + 2,
        height: heightPx,
        left: `calc(${left * 100}% + ${inset + 3}px)`,
        width: `calc(${width * 100}% - ${inset + 6}px)`,
        zIndex: depth + 1,
        backgroundColor: hasChildren
          ? `color-mix(in srgb, ${style.bg} 60%, #111215)`
          : style.bg,
        border: `1px ${estimated ? "dashed" : "solid"} ${style.border}`,
      }}
    >
      <div className="flex w-full items-center gap-1 overflow-hidden">
        <div className="mr-1">
          <CategoryIndicator
            span={span}
            color={style.dot}
            dotSizeClass="size-1.5"
          />
        </div>
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold leading-tight text-foreground">
          {displayTitle(span)}
        </p>
      </div>
      {showTime ? (
        <div className="mt-1 flex items-center gap-1.5 overflow-hidden font-mono text-[10px]">
          <span className="truncate" style={{ color: style.subtext }}>
            {estimated ? "≈ " : ""}
            {formatTime(span.start_at)}
            {span.end_at ? ` – ${formatTime(span.end_at)}` : ""}
          </span>
          {amount ? (
            <span className="ml-auto shrink-0 rounded bg-muted px-1 py-0.2 text-[9px] font-semibold text-foreground">
              {amount}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );

  return card ? <SpanHoverCard span={span}>{block}</SpanHoverCard> : block;
}
