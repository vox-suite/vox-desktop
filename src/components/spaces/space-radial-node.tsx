import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Compass,
  RotateCw,
  Database,
  MapPin,
  Flag,
  Sparkles,
} from "lucide-react";
import type { SpaceNode } from "@/features/spaces/types";

export const SpaceRadialNode = memo(function SpaceRadialNode({
  data,
  selected,
}: NodeProps) {
  const { node, central } = data as unknown as {
    node: SpaceNode;
    central: boolean;
  };
  const Icon =
    node.kind === "option"
      ? MapPin
      : ["plan", "step", "decision"].includes(node.kind)
        ? Flag
        : node.kind === "data"
          ? Database
          : Sparkles;
  return (
    <div
      className={`space-radial-node ${central ? "space-radial-goal" : ""} ${selected ? "is-selected" : ""} state-${node.state}`}
      title={node.title}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ left: central ? "50%" : 16, top: "50%" }}
      />
      {central ? (
        <Compass className="size-7" strokeWidth={1} />
      ) : (
        <span className="space-radial-icon">
          <Icon size={16} strokeWidth={1.5} />
        </span>
      )}
      <div className="space-radial-label">
        <span className="space-radial-kind">
          {central ? "Your goal" : node.kind}
        </span>
        <h3>{node.title}</h3>
        {!central && node.body && (
          <p className="space-radial-summary">{node.body}</p>
        )}
        {node.state !== "done" && (
          <span className="space-radial-status">
            {node.state === "running" && (
              <RotateCw className="size-3 animate-spin" />
            )}
            {node.state}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ left: central ? "50%" : 16, right: "auto", top: "50%" }}
      />
    </div>
  );
});

export function SpaceOrbitNode({ data }: NodeProps) {
  const radius = data.radius as number;
  return (
    <svg
      className="space-orbits"
      width={radius * 2}
      height={radius * 2}
      aria-hidden="true"
    >
      {[125, 300].map((r) => (
        <circle
          key={r}
          cx={radius}
          cy={radius}
          r={r}
          fill="none"
          stroke="#252525"
          strokeWidth="1"
          strokeDasharray={r === 300 ? "2 12" : undefined}
        />
      ))}
      {[
        { text: "Research", x: -340, y: -290 },
        { text: "Options", x: 195, y: -400 },
        { text: "Plan", x: 195, y: 400 },
      ].map(({ text, x, y }) => (
        <text
          key={text}
          x={radius + x}
          y={radius + y}
          fill="#888"
          fontSize="15"
          textAnchor="middle"
        >
          {text}
        </text>
      ))}
    </svg>
  );
}
