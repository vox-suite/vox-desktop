import { createElement } from "react";
import { schemaIcon } from "@/lib/schema-tokens";
import type { Span } from "@/features/spans/types";
import { cn } from "@/lib/utils";

export function CategoryIndicator({
  span,
  color,
  dotSizeClass,
}: {
  span: Span;
  color: string;
  dotSizeClass: string;
}) {
  if (span.schema_icon_token !== null && span.schema_icon_token !== undefined) {
    return createElement(schemaIcon(span.schema_icon_token), {
      className: "size-3 shrink-0",
      style: { color },
    });
  }
  return (
    <span
      className={cn(dotSizeClass, "shrink-0 rounded-full")}
      style={{
        background: color,
        boxShadow: `0 0 5px color-mix(in srgb, ${color} 53%, transparent)`,
      }}
    />
  );
}
