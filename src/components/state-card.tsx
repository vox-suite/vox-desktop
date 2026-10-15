import type { ReactNode } from "react";
import type { VoxColor } from "@/lib/theme";

export function StateCard({
  accent,
  figure,
  kicker,
  title,
  text,
  loadingText,
  action,
  loading = false,
  tall = false,
  reserveAction = false,
}: {
  accent: VoxColor;
  figure: ReactNode;
  kicker?: string;
  title: string;
  text: string;
  loadingText?: string;
  action?: ReactNode;
  loading?: boolean;
  tall?: boolean;
  reserveAction?: boolean;
}) {
  return (
    <div
      role={loading ? "status" : undefined}
      aria-live={loading ? "polite" : undefined}
      className={`start-tile empty-card${loading ? " is-loading" : ""}${tall ? " is-tall" : ""}`}
      style={{ ["--start-accent" as string]: `var(--vox-${accent})` }}
    >
      <div className="start-tile-art" aria-hidden={loading || undefined}>
        {figure}
      </div>
      <div className="empty-card-body">
        {kicker && <p className="start-kicker">{kicker}</p>}
        <h2 className="mt-2 text-lg font-medium tracking-tight">{title}</h2>
        {/* Keep the final copy in layout so wrapping cannot move the artwork. */}
        <p className="mx-auto mt-1.5 grid max-w-xs text-sm leading-6 text-muted-foreground">
          <span
            className={`col-start-1 row-start-1${loading && loadingText ? " invisible" : ""}`}
            aria-hidden={(loading && !!loadingText) || undefined}
          >
            {text}
          </span>
          {loading && loadingText && (
            <span className="col-start-1 row-start-1">{loadingText}</span>
          )}
        </p>
        {(action || reserveAction) && (
          <div className="mt-4 min-h-7">{action}</div>
        )}
      </div>
    </div>
  );
}
