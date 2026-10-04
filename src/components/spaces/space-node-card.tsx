import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Compass,
  Database,
  Flag,
  ListOrdered,
  MapPin,
  RotateCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { SpaceNode } from "@/features/spaces/types";

export interface SpaceNodeData {
  node: SpaceNode;
  onSelectNode?: (node: SpaceNode) => void;
}

function getKindConfig(kind: string) {
  const k = kind.toLowerCase();
  switch (k) {
    case "goal":
      return {
        icon: Compass,
        badge: "Goal",
        border: "border-ring hover:border-ring",
        badgeBg: "bg-primary/15 text-foreground border-ring",
        accent: "text-foreground",
      };
    case "data":
      return {
        icon: Database,
        badge: "Timeline Data",
        border: "border-border hover:border-border",
        badgeBg: "bg-muted text-muted-foreground border-border",
        accent: "text-muted-foreground",
      };
    case "research":
      return {
        icon: Sparkles,
        badge: "Research",
        border: "border-border hover:border-border",
        badgeBg: "bg-muted text-muted-foreground border-border",
        accent: "text-muted-foreground",
      };
    case "option":
      return {
        icon: MapPin,
        badge: "Alternative",
        border: "border-primary/40 hover:border-primary",
        badgeBg: "bg-primary/15 text-foreground border-primary/30",
        accent: "text-foreground",
      };
    case "decision":
    case "plan":
      return {
        icon: Flag,
        badge: k === "decision" ? "Decision" : "Plan",
        border: "border-fuchsia-500/50 hover:border-fuchsia-400",
        badgeBg: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
        accent: "text-fuchsia-400",
      };
    case "step":
      return {
        icon: ListOrdered,
        badge: "Step",
        border: "border-teal-500/40 hover:border-teal-400",
        badgeBg: "bg-teal-500/15 text-teal-300 border-teal-500/30",
        accent: "text-teal-400",
      };
    case "budget":
      return {
        icon: Wallet,
        badge: "Budget",
        border: "border-border hover:border-border",
        badgeBg: "bg-muted text-muted-foreground border-border",
        accent: "text-muted-foreground",
      };
    case "risk":
      return {
        icon: AlertTriangle,
        badge: "Risk",
        border: "border-destructive/50 hover:border-destructive",
        badgeBg: "bg-destructive/15 text-destructive border-destructive/30",
        accent: "text-destructive",
      };
    case "limit":
      return {
        icon: AlertCircle,
        badge: "Limit",
        border: "border-destructive/40 hover:border-destructive",
        badgeBg: "bg-destructive/15 text-destructive border-destructive/30",
        accent: "text-destructive",
      };
    default:
      return {
        icon: BarChart3,
        badge: kind,
        border: "border-border hover:border-border",
        badgeBg: "bg-card text-muted-foreground border-border",
        accent: "text-muted-foreground",
      };
  }
}

export const SpaceNodeCard = memo(function SpaceNodeCard({
  data,
}: NodeProps) {
  const nodeData = data as unknown as SpaceNodeData;
  const node = nodeData.node;
  const cfg = getKindConfig(node.kind);
  const Icon = cfg.icon;

  const isRunning = node.state === "running";
  const isStale = node.state === "stale";
  const isRejected = node.state === "rejected";

  return (
    <div
      className={`group relative min-w-[260px] max-w-[340px] rounded-xl border bg-card p-4 shadow-xl backdrop-blur-md transition-all duration-200 cursor-pointer ${
        cfg.border
      } ${
        isRejected
          ? "opacity-35 grayscale border-dashed border-destructive/60 bg-destructive/10 hover:opacity-50"
          : ""
      } ${
        isStale ? "border-dashed border-border" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-border !bg-zinc-400"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!h-2.5 !w-2.5 !border-2 !border-border !bg-zinc-400"
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${cfg.badgeBg}`}
        >
          <Icon className="h-3 w-3" />
          {cfg.badge}
        </span>

        {isRunning && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse font-mono">
            <RotateCw className="h-3 w-3 animate-spin" />
            researching
          </span>
        )}
        {isStale && (
          <span className="text-[10px] text-muted-foreground/80 font-mono">
            stale
          </span>
        )}
        {isRejected && (
          <span className="text-[10px] text-destructive/90 font-mono rounded bg-destructive/80 border border-destructive/40 px-1.5 py-0.5 uppercase tracking-wider">
            rejected
          </span>
        )}
        {node.state === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
        )}
      </div>

      <h3
        className={`text-sm font-semibold text-foreground group-hover:text-foreground transition-colors line-clamp-2 ${
          isRejected ? "line-through text-muted-foreground" : ""
        }`}
      >
        {node.title}
      </h3>

      {node.body && (
        <p
          className={`mt-1.5 text-xs leading-relaxed line-clamp-4 ${
            isRejected ? "text-muted-foreground line-through" : "text-muted-foreground"
          }`}
        >
          {node.body}
        </p>
      )}

      {node.data && Object.keys(node.data).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border">
          {Object.entries(node.data)
            .slice(0, 3)
            .map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-card border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
              >
                {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-border !bg-zinc-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-2.5 !w-2.5 !border-2 !border-border !bg-zinc-400"
      />
    </div>
  );
});
