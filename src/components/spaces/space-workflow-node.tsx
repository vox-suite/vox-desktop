import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Compass,
  Database,
  Globe,
  Layers,
  Flag,
  LoaderCircle,
} from "lucide-react";
import type { SpaceNode } from "@/features/spaces/types";
export const SpaceWorkflowNode = memo(function SpaceWorkflowNode({
  data,
  selected,
}: NodeProps) {
  const { node } = data as unknown as { node: SpaceNode };
  const execution = node.data.execution as
    { status?: string; role?: string; error?: string } | undefined;
  const role = execution?.role ?? node.kind;
  const status = execution?.status ?? node.state;
  const Icon =
    node.kind === "goal"
      ? Compass
      : role === "user_data"
        ? Database
        : role === "web_search"
          ? Globe
          : role === "plan"
            ? Flag
            : Layers;
  return (
    <div className={`space-workflow-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} id="left" />
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-xs font-medium">
          {node.kind === "goal" ? "Your vision" : role.replaceAll("_", " ")}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {status === "running" && (
            <LoaderCircle className="size-3 animate-spin" />
          )}
          {status}
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-medium">{node.title}</h3>
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {execution?.error ?? node.body}
        </p>
      </div>
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
});
