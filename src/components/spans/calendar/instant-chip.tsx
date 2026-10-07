import { CategoryIndicator } from "@/components/category-indicator";
import type { Span } from "@/features/spans/types";
import {
  displayTitle,
  formatAmount,
  formatTime,
  spanCover,
  spanStyle,
} from "@/lib/span-format";
import { cn } from "@/lib/utils";
import { INSTANT_HEIGHT_PX } from "./constants";
import { SpanHoverCard } from "./span-hover-card";

export function InstantChip({
  span,
  onSelect,
}: {
  span: Span;
  onSelect: (span: Span) => void;
}) {
  const style = spanStyle(span);
  const cover = spanCover(span);
  const amount = formatAmount(span);
  const label = displayTitle(span);
  const iconOnly = span.source === "spotify" || span.source === "youtube";
  const hasCard = iconOnly || !!cover;

  const chip = (
    <button
      type="button"
      data-no-drag
      aria-label={label}
      title={
        hasCard
          ? undefined
          : `${label} · ${formatTime(span.start_at)}${amount ? ` · ${amount}` : ""}`
      }
      onClick={(e) => {
        e.stopPropagation();
        onSelect(span);
      }}
      className={cn(
        "pointer-events-auto flex shrink-0 items-center rounded-full border shadow-md transition duration-150 hover:scale-105 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        iconOnly ? "justify-center" : "max-w-64 gap-2 px-3.5",
        span.status === "cancelled" && "opacity-40",
      )}
      style={{
        height: INSTANT_HEIGHT_PX,
        width: iconOnly ? INSTANT_HEIGHT_PX : undefined,
        backgroundColor: style.bg,
        borderColor: style.border,
      }}
    >
      <CategoryIndicator
        span={span}
        color={style.dot}
        dotSizeClass="size-1.5"
      />
      {iconOnly ? null : (
        <span className="truncate text-[13px] font-medium leading-none text-foreground">
          {label}
        </span>
      )}
      {!iconOnly && amount ? (
        <span className="shrink-0 rounded bg-muted px-1 font-mono text-[9px] font-semibold text-foreground">
          {amount}
        </span>
      ) : null}
    </button>
  );

  if (!hasCard) return chip;
  return <SpanHoverCard span={span}>{chip}</SpanHoverCard>;
}
