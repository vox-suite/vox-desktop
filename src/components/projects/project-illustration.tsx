import { alpha, token } from "@/lib/theme";

type Point = [number, number, number];
const project = ([x, y, z]: Point) => [
  280 + (x - y) * 1.08,
  300 + (x + y) * 0.54 - z * 1.48,
];
const trace = (points: Point[], close = false) =>
  points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${project(p)
          .map((n) => n.toFixed(1))
          .join(",")}`,
    )
    .join(" ") + (close ? "Z" : "");
const line = alpha("ink", 65);
const faint = token("border-strong");
const accent = token("pink");

function Plate({
  x = 0,
  y = 0,
  z,
  w,
  h = w,
  depth = 5,
  highlight = false,
}: {
  x?: number;
  y?: number;
  z: number;
  w: number;
  h?: number;
  depth?: number;
  highlight?: boolean;
}) {
  const corners: Point[] = [
    [x - w, y - h, z],
    [x + w, y - h, z],
    [x + w, y + h, z],
    [x - w, y + h, z],
  ];
  return (
    <g
      strokeWidth="0.85"
      style={{ stroke: highlight ? accent : line, fill: token("surface") }}
    >
      <path
        d={trace(
          [
            corners[3],
            corners[2],
            corners[1],
            [x + w, y - h, z - depth],
            [x + w, y + h, z - depth],
            [x - w, y + h, z - depth],
          ],
          true,
        )}
      />
      <path d={trace([corners[2], [x + w, y + h, z - depth]])} />
      <path d={trace(corners, true)} />
      {highlight && (
        <path d={trace(corners, true)} style={{ fill: alpha("pink", 6) }} />
      )}
    </g>
  );
}

const MODULES = [
  { x: -103, y: 0, z: 24, label: "Sources", type: "source" },
  { x: 0, y: -103, z: 34, label: "Context", type: "context" },
  { x: 105, y: 0, z: 12, label: "Decisions", type: "decision" },
  { x: 0, y: 108, z: 0, label: "Next steps", type: "steps" },
] as const;

// A project as an assembled knowledge system: source modules feed a model,
// while decisions remain connected to the evidence beneath them.
export function ProjectIllustration() {
  return (
    <svg
      viewBox="0 0 560 570"
      aria-hidden="true"
      focusable="false"
      className="project-illustration"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <g strokeWidth="0.6" style={{ stroke: faint }}>
        {Array.from({ length: 13 }, (_, i) => {
          const n = -144 + i * 24;
          return (
            <path
              key={i}
              d={`${trace([
                [n, -144, -66],
                [n, 144, -66],
              ])} ${trace([
                [-144, n, -66],
                [144, n, -66],
              ])}`}
              opacity={i % 3 === 0 ? 0.8 : 0.35}
            />
          );
        })}
        <path
          d={trace(
            [
              [-155, -155, -66],
              [155, -155, -66],
              [155, 155, -66],
              [-155, 155, -66],
            ],
            true,
          )}
          strokeDasharray="2 5"
        />
        <path
          d={trace([
            [0, 0, -66],
            [0, 0, 150],
          ])}
          strokeDasharray="3 6"
        />
      </g>
      <Plate z={-45} w={119} depth={9} />
      <path
        d={trace(
          [
            [-105, -105, -44],
            [105, -105, -44],
            [105, 105, -44],
            [-105, 105, -44],
          ],
          true,
        )}
        strokeWidth=".6"
        style={{ stroke: faint }}
      />
      <g strokeWidth=".8" style={{ stroke: accent }}>
        {MODULES.map(({ x, y }, i) => (
          <g key={i}>
            <path
              d={trace([
                [x, y, -44],
                [x * 0.72, y * 0.72, -44],
                [x * 0.72, y * 0.72, -10],
                [0, 0, -10],
              ])}
              opacity=".45"
            />
            <path
              d={trace([
                [x, y, -44],
                [x * 0.72, y * 0.72, -44],
                [x * 0.72, y * 0.72, -10],
                [0, 0, -10],
              ])}
              className="project-evidence-flow"
              style={{ animationDelay: `${i * -2}s` }}
            />
          </g>
        ))}
      </g>
      {MODULES.slice(0, 2).map((m) => (
        <Module key={m.type} {...m} />
      ))}
      <g strokeWidth=".6" style={{ stroke: faint }}>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((y) => (
            <path
              key={`${x}${y}`}
              d={trace([
                [x * 48, y * 48, -39],
                [x * 48, y * 48, 119],
              ])}
              strokeDasharray="2 4"
            />
          )),
        )}
      </g>
      <Plate z={-9} w={48} depth={8} />
      <Plate z={19} w={48} depth={8} />
      <Plate z={47} w={48} depth={8} highlight />
      <g strokeWidth=".7" style={{ stroke: line }}>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <path
              d={trace([
                [-35, 48, 12 + i * 28],
                [-11, 48, 12 + i * 28],
              ])}
            />
            {[0, 1, 2, 3].map((j) => (
              <path
                key={j}
                d={trace([
                  [48, 5 + j * 9, 12 + i * 28],
                  [48, 5 + j * 9, 15 + i * 28],
                ])}
                style={{ stroke: i === 2 ? accent : faint }}
              />
            ))}
          </g>
        ))}
      </g>
      <Plate z={93} w={64} depth={3} />
      <g strokeWidth=".8" style={{ stroke: faint }}>
        <path
          d={trace(
            [
              [-50, -50, 94],
              [50, -50, 94],
              [50, 50, 94],
              [-50, 50, 94],
            ],
            true,
          )}
        />
        <path
          d={trace([
            [-28, -24, 94],
            [24, -24, 94],
            [24, 23, 94],
            [-25, 23, 94],
          ])}
        />
        <path
          d={trace([
            [0, -24, 94],
            [0, 23, 94],
            [-25, 23, 94],
          ])}
        />
      </g>
      {[
        [-28, -24],
        [24, -24],
        [24, 23],
        [-25, 23],
        [0, 0],
      ].map(([x, y], i) => (
        <Plate
          key={i}
          x={x}
          y={y}
          z={i === 4 ? 113 : 103}
          w={i === 4 ? 12 : 8}
          depth={i === 4 ? 16 : 8}
          highlight={i === 4}
        />
      ))}
      <g strokeWidth=".7" style={{ stroke: accent }}>
        <path
          d={trace([
            [0, 0, 114],
            [0, 0, 135],
            [30, 0, 135],
          ])}
        />
        <path
          d={trace([
            [30, 0, 129],
            [30, 0, 141],
          ])}
        />
        <path
          d={trace([
            [26, 0, 132],
            [34, 0, 138],
          ])}
        />
      </g>
      {MODULES.slice(2).map((m) => (
        <Module key={m.type} {...m} />
      ))}
      <g
        fontFamily="Inter, sans-serif"
        fontSize="10.5"
        style={{ fill: alpha("ink", 90) }}
      >
        <Callout
          anchor={[-105, 0, 28]}
          end={[28, 188]}
          title="Your sources"
          note="Code, files & notes"
        />
        <Callout
          anchor={[0, -103, 38]}
          end={[522, 154]}
          title="Shared context"
          note="The brief behind the work"
          right
        />
        <Callout
          anchor={[0, 0, 113]}
          end={[90, 65]}
          title="A connected model"
          note="See how everything fits"
        />
        <Callout
          anchor={[105, 0, 16]}
          end={[532, 280]}
          title="Grounded decisions"
          note="Linked to their evidence"
          right
        />
        <Callout
          anchor={[0, 108, 4]}
          end={[74, 520]}
          title="What comes next"
          note="From understanding to action"
        />
      </g>
    </svg>
  );
}

function Module({ x, y, z, type }: (typeof MODULES)[number]) {
  const on = (px: number, py: number, dz = 1): Point => [
    x + px,
    y + py,
    z + dz,
  ];
  return (
    <g>
      {[z - 18, z - 9, z].map((height, i) => (
        <Plate
          key={height}
          x={x}
          y={y}
          z={height}
          w={27}
          h={23}
          depth={3}
          highlight={i === 2 && type === "decision"}
        />
      ))}
      <g
        strokeWidth=".9"
        style={{ stroke: type === "decision" ? accent : line }}
      >
        {type === "source" ? (
          <>
            <path d={trace([on(-12, -11), on(-20, -3), on(-12, 5)])} />
            <path d={trace([on(12, -11), on(20, -3), on(12, 5)])} />
            <path d={trace([on(5, -14), on(-4, 10)])} />
          </>
        ) : type === "context" ? (
          <>
            <path d={trace([on(-16, -12), on(16, -12)])} />
            {[-4, 4, 12].map((n, i) => (
              <path
                key={n}
                d={trace([on(-16, n), on(14 - i * 5, n)])}
                style={{ stroke: faint }}
              />
            ))}
          </>
        ) : type === "decision" ? (
          <>
            <path
              d={trace([on(-12, 0), on(-4, 8), on(14, -10)])}
              strokeWidth="1.5"
            />
            <path
              d={trace([on(-16, 15), on(14, 15)])}
              style={{ stroke: faint }}
            />
          </>
        ) : (
          <>
            <path
              d={trace([
                on(-16, 8),
                on(-5, 8),
                on(-5, 0),
                on(7, 0),
                on(7, -8),
                on(18, -8),
              ])}
            />
            <path
              d={trace([on(12, -14), on(18, -8), on(12, -2)])}
              style={{ stroke: accent }}
            />
          </>
        )}
      </g>
      <path
        d={trace([
          [x, y, z - 22],
          [x, y, -43],
        ])}
        strokeWidth=".65"
        strokeDasharray="2 4"
        style={{ stroke: faint }}
      />
    </g>
  );
}

function Callout({
  anchor,
  end,
  title,
  note,
  right = false,
}: {
  anchor: Point;
  end: [number, number];
  title: string;
  note: string;
  right?: boolean;
}) {
  const [ax, ay] = project(anchor);
  const [ex, ey] = end;
  return (
    <g textAnchor={right ? "end" : "start"}>
      <path
        d={`M${ax},${ay} L${ax + (right ? 28 : -28)},${ey + 14} H${ex}`}
        fill="none"
        strokeWidth=".65"
        style={{ stroke: faint }}
      />
      <circle cx={ax} cy={ay} r="2" style={{ fill: accent }} />
      <text x={ex} y={ey}>
        {title}
      </text>
      <text x={ex} y={ey + 11} fontSize="8" style={{ fill: token("text-dim") }}>
        {note}
      </text>
    </g>
  );
}
