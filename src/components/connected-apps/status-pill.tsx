import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusPill({
  synced,
  attention,
}: {
  synced: boolean;
  attention: boolean;
}) {
  if (!synced && !attention) {
    return (
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Not synced
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        attention
          ? "bg-amber-300/15 text-amber-200"
          : "bg-emerald-400/15 text-emerald-300",
      )}
    >
      {attention ? (
        <AlertTriangle className="size-3" />
      ) : (
        <Check className="size-3" />
      )}
      {attention ? "Needs attention" : "Synced"}
    </span>
  );
}
