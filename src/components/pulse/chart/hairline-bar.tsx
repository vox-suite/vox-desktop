export function HairlineBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  horizontal: boolean;
  fill?: string;
  dimmed?: boolean;
}) {
  const { x = 0, y = 0, width = 0, height = 0, horizontal, fill, dimmed } = props;
  if (width <= 0 || height <= 0) return null;
  const gap = 4;
  const thick = Math.min(horizontal ? height : width, 14);
  const lines = [];
  if (horizontal) {
    const cy = y + height / 2;
    for (let px = x + 0.5; px <= x + width; px += gap)
      lines.push(
        <line
          key={px}
          x1={px}
          x2={px}
          y1={cy - thick / 2}
          y2={cy + thick / 2}
        />,
      );
  } else {
    const cx = x + width / 2;
    for (let py = y + height - 0.5; py >= y; py -= gap)
      lines.push(
        <line
          key={py}
          y1={py}
          y2={py}
          x1={cx - thick / 2}
          x2={cx + thick / 2}
        />,
      );
  }
  return (
    <g
      stroke={fill}
      strokeWidth={1}
      shapeRendering="crispEdges"
      opacity={dimmed ? 0.2 : 1}
      style={{ transition: "opacity 120ms" }}
    >
      {lines}
    </g>
  );
}
