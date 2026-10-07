import { AlertTriangle, Check, RotateCw } from "lucide-react";
import { schemaColorStyle, schemaIcon } from "@/lib/schema-tokens";
import type { Schema } from "@/features/pulse/types";

export function SchemaSelectorStep({
  schemas,
  selectedSchemaIds,
  loading,
  error,
  onToggle,
}: {
  schemas: Schema[];
  selectedSchemaIds: Set<string>;
  loading: boolean;
  error: string;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Select one or more of your categories to discover analytics and
        visualizations powered by your real data.
      </p>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="h-6 w-6 animate-spin mb-2" />
          <p className="text-xs">Loading categories...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-destructive">
          <AlertTriangle className="h-6 w-6 mb-2" />
          <p className="text-xs">{error}</p>
        </div>
      ) : schemas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-sm font-medium">No categories found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add spans or ingest events first to create categories.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {schemas.map((s) => {
            const isSelected = selectedSchemaIds.has(s.id);
            const colorStyle = schemaColorStyle(s.color_token);
            const IconComp = schemaIcon(s.icon_token);

            return (
              <div
                key={s.id}
                onClick={() => onToggle(s.id)}
                className={`group relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                  isSelected
                    ? "border-primary/80 bg-primary/20"
                    : "border-border bg-card hover:border-border hover:bg-accent"
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                  style={{
                    backgroundColor: colorStyle.bg,
                    borderColor: colorStyle.border,
                    color: colorStyle.dot,
                  }}
                >
                  <IconComp className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-xs font-semibold text-muted-foreground truncate">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {s.namespace}
                  </p>
                  {s.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                      {s.description}
                    </p>
                  )}
                </div>
                <div
                  className={`absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-black"
                      : "border-border bg-card"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
