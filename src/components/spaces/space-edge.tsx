import { getBezierPath, type EdgeProps } from "@xyflow/react";

export type FlowEdgeData = {
  from: string;
  to: string;
  flowing: boolean;
  active: boolean;
  dim: boolean;
};

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const { from, to, flowing, active, dim } = data as unknown as FlowEdgeData;
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.38,
  });
  const gradient = `space-edge-${id}`;
  return (
    <g className={dim ? "space-edge is-dim" : "space-edge"}>
      <defs>
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX + 0.01}
          y2={targetY}
        >
          <stop offset="0" style={{ stopColor: from }} />
          <stop offset="1" style={{ stopColor: to }} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
       
        strokeWidth={active ? 2 : 1.3}
        strokeOpacity={active ? 0.95 : 0.55}
        strokeLinecap="round"
        className={flowing ? "space-edge-line is-flowing" : "space-edge-line"} style={{ stroke: `url(#${gradient})` }}
      />
      {flowing &&
        [0, 1, 2].map((i) => (
          <circle key={i} r="2.4" className="space-edge-particle" style={{ fill: to }}>
            <animateMotion
              dur="2.6s"
              begin={`${i * 0.86}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        ))}
      <circle
        cx={targetX}
        cy={targetY}
        r="2.6"
       
        opacity={dim ? 0.2 : 0.9} style={{ fill: to }}
      />
    </g>
  );
}
