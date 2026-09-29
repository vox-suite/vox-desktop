import { schemaIcon } from "@/lib/schema-tokens";
import type { Span } from "@/lib/tauri";
import { cn } from "@/lib/utils";

/**
 * Renders a span's category icon (from data_schemas.icon_token) when
 * present, falling back to a plain colored dot for spans with no schema
 * (manually created tasks, or spans predating the schema system).
 */
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
    const Icon = schemaIcon(span.schema_icon_token);
    return <Icon className="size-3 shrink-0" style={{ color }} />;
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
