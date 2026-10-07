import type { ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Span } from "@/features/spans/types";
import {
  displayTitle,
  formatTime,
  isEstimated,
  spanCover,
  spanSubtitle,
} from "@/lib/span-format";
import { cn } from "@/lib/utils";

export function SpanHoverCard({
  span,
  children,
}: {
  span: Span;
  children: ReactNode;
}) {
  const cover = spanCover(span);
  const subtitle = spanSubtitle(span);
  const label = displayTitle(span);

  return (
    <HoverCard openDelay={80} closeDelay={60}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className="w-72 p-3"
      >
        <div className="flex items-center gap-3">
          {cover ? (
            <img
              src={cover}
              alt=""
              referrerPolicy="no-referrer"
              className={cn(
                "shrink-0 rounded-md object-cover",
                span.source === "youtube" ? "h-16 w-28" : "size-16",
              )}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{label}</p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {isEstimated(span) ? "≈ " : ""}
              {formatTime(span.start_at)}
              {span.end_at ? ` – ${formatTime(span.end_at)}` : ""}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
