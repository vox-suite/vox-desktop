import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Compass,
  Database,
  Flag,
  MapPin,
  RotateCw,
  Sparkles,
} from "lucide-react";
import type { SpaceNode } from "@/lib/spaces";

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
        border: "border-indigo-500/40 hover:border-indigo-400",
        badgeBg: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
        accent: "text-indigo-400",
      };
    case "data":
      return {
        icon: Database,
        badge: "Timeline Data",
        border: "border-emerald-500/40 hover:border-emerald-400",
        badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        accent: "text-emerald-400",
      };
    case "research":
      return {
        icon: Sparkles,
        badge: "Research",
        border: "border-amber-500/40 hover:border-amber-400",
        badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        accent: "text-amber-400",
      };
    case "option":
      return {
        icon: MapPin,
        badge: "Alternative",
        border: "border-sky-500/40 hover:border-sky-400",
        badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
        accent: "text-sky-400",
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
    case "limit":
      return {
        icon: AlertCircle,
        badge: "Limit",
        border: "border-rose-500/40 hover:border-rose-400",
        badgeBg: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        accent: "text-rose-400",
      };
    default:
      return {
        icon: BarChart3,
        badge: kind,
        border: "border-zinc-700 hover:border-zinc-500",
        badgeBg: "bg-zinc-800 text-zinc-300 border-zinc-700",
        accent: "text-zinc-400",
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
      onClick={() => nodeData.onSelectNode?.(node)}
      className={`group relative min-w-[260px] max-w-[340px] rounded-xl border bg-zinc-950/85 p-4 shadow-xl backdrop-blur-md transition-all duration-200 cursor-pointer ${
        cfg.border
      } ${
        isRejected ? "opacity-40 grayscale" : ""
      } ${
        isStale ? "border-dashed border-amber-500/50" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-zinc-900 !bg-zinc-400"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!h-2.5 !w-2.5 !border-2 !border-zinc-900 !bg-zinc-400"
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${cfg.badgeBg}`}
        >
          <Icon className="h-3 w-3" />
          {cfg.badge}
        </span>

        {isRunning && (
          <span className="flex items-center gap-1 text-[11px] text-amber-400 animate-pulse font-mono">
            <RotateCw className="h-3 w-3 animate-spin" />
            researching
          </span>
        )}
        {isStale && (
          <span className="text-[10px] text-amber-500/80 font-mono">
            stale
          </span>
        )}
        {node.state === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
        )}
      </div>

      <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors line-clamp-2">
        {node.title}
      </h3>

      {node.body && (
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 line-clamp-4">
          {node.body}
        </p>
      )}

      {node.data && Object.keys(node.data).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/60">
          {Object.entries(node.data)
            .slice(0, 3)
            .map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
              >
                {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </span>
            ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-zinc-900 !bg-zinc-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-2.5 !w-2.5 !border-2 !border-zinc-900 !bg-zinc-400"
      />
    </div>
  );
});
