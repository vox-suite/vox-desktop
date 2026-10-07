import type { ReactElement } from "react";
import type { Span } from "@/features/spans/types";
import { CategoryIndicator } from "@/components/category-indicator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  displayTitle,
  formatAmount,
  formatTime,
  isEstimated,
  spanStyle,
  spanSubtitle,
} from "@/lib/span-format";

export function SpanInfoTooltip({
  span,
  children,
}: {
  span: Span;
  children: ReactElement;
}) {
  const amount = formatAmount(span);
  const subtitle = spanSubtitle(span);
  const status =
    span.status === "done" ? "Done" : span.status.replaceAll("_", " ");
  const date = span.start_at
    ? new Date(span.start_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  return (
    <Tooltip delayDuration={180}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="block w-72 max-w-[calc(100vw-24px)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl [&>svg]:bg-popover [&>svg]:fill-popover"
      >
        <div className="flex items-start gap-2">
          <CategoryIndicator
            span={span}
            color={spanStyle(span).dot}
            dotSizeClass="size-1.5"
          />
          <p className="min-w-0 break-words text-xs font-semibold leading-relaxed">
            {displayTitle(span)}
          </p>
        </div>
        {subtitle && (
          <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>{span.source.replaceAll("_", " ")}</span>
          {span.category && <span>{span.category.replaceAll("_", " ")}</span>}
          <span className="rounded bg-muted px-1.5 py-0.5 capitalize text-foreground">
            {status}
          </span>
        </div>
        {date && (
          <p className="mt-2 text-[11px]">
            {date} · {formatTime(span.start_at)}
            {span.end_at
              ? ` – ${new Date(span.end_at).toLocaleDateString() !== new Date(span.start_at!).toLocaleDateString() ? new Date(span.end_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " : ""}${formatTime(span.end_at)}`
              : ""}
            {isEstimated(span) ? " (estimated)" : ""}
          </p>
        )}
        {amount && <p className="mt-1 text-xs font-medium">{amount}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
