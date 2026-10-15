import type { ReactNode } from "react";
import type { VoxColor } from "@/lib/theme";

export function StateCard({
  accent,
  figure,
  kicker,
  title,
  text,
  action,
  loading = false,
  tall = false,
}: {
  accent: VoxColor;
  figure: ReactNode;
  kicker?: string;
  title: string;
  text: string;
  action?: ReactNode;
  loading?: boolean;
  tall?: boolean;
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
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground">
          {text}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
