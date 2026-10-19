import { useEffect, useState, type ReactNode } from "react";
import { alpha, token, type VoxColor } from "@/lib/theme";

type V3 = [number, number, number];

const CX = 280;
const LINE = alpha("ink", 62);
const FAINT = token("border-strong");
const SURFACE = token("surface");
const LABEL = alpha("ink", 90);

const at =
  (cy: number, cx = CX) =>
  ([x, y, z]: V3): [number, number] => [
    cx + (x - y) * 0.866,
    cy + (x + y) * 0.5 - z,
  ];

const fmt = (n: number) => Math.round(n * 10) / 10;

function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (time - last < 40) return;
      last = time;
      setT(time / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

function makeTrace(P: (p: V3) => [number, number]) {
  return (pts: V3[], close = false) =>
    pts
      .map((p, i) => {
        const [x, y] = P(p);
        return `${i ? "L" : "M"}${fmt(x)},${fmt(y)}`;
      })
      .join("") + (close ? "Z" : "");
}

const mixTo = (color: string, g: number, from = LINE) =>
  `color-mix(in srgb, ${color} ${Math.round(Math.min(1, g) * 100)}%, ${from})`;

const circle = (r: number, ox = 0, oy = 0, z = 0): V3[] =>
  Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z];
  });

function Box({
  trace,
  x = 0,
  y = 0,
  z,
  w,
  d,
  depth = 5,
  stroke = LINE,
  fill = SURFACE,
  top,
  dash,
  width = 0.85,
}: {
  trace: (pts: V3[], close?: boolean) => string;
  x?: number;
  y?: number;
  z: number;
  w: number;
  d: number;
  depth?: number;
  stroke?: string;
  fill?: string;
  top?: string;
  dash?: string;
  width?: number;
}) {
  const a: V3 = [x - w, y - d, z];
  const b: V3 = [x + w, y - d, z];
  const c: V3 = [x + w, y + d, z];
  const e: V3 = [x - w, y + d, z];
  const down = (p: V3): V3 => [p[0], p[1], p[2] - depth];
  return (
    <g
      strokeWidth={width}
      strokeLinejoin="round"
      strokeDasharray={dash}
      style={{ stroke, fill }}
    >
      <path d={trace([e, c, b, down(b), down(c), down(e)], true)} />
      <path d={trace([c, down(c)])} />
      <path
        d={trace([a, b, c, e], true)}
        style={top ? { fill: top } : undefined}
      />
    </g>
  );
}

function Callout({
  from,
  ex,
  ey,
  id,
  title,
  note,
  right = false,
  dot = LINE,
}: {
  from: [number, number];
  ex: number;
  ey: number;
  id: string;
  title: string;
  note: string;
  right?: boolean;
  dot?: string;
}) {
  const [ax, ay] = from;
  const knee = ax + (right ? 1 : -1) * Math.min(30, Math.abs(ey - ay));
  return (
    <g>
      <path
        d={`M${fmt(ax)},${fmt(ay)} L${fmt(knee)},${ey} H${ex}`}
        fill="none"
        strokeWidth="0.75"
        style={{ stroke: FAINT }}
      />
      <circle cx={ax} cy={ay} r="2" style={{ fill: dot }} />
      <g textAnchor={right ? "end" : "start"}>
        <text
          x={ex}
          y={ey - 30}
          fontSize="8"
          letterSpacing="1.5"
          style={{ fill: token("text-muted") }}
        >
          {id}
        </text>
        <text
          x={ex}
          y={ey - 17}
          fontSize="11"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
          style={{ fill: LABEL }}
        >
          {title}
        </text>
        <text
          x={ex}
          y={ey - 5}
          fontSize="8"
          style={{ fill: token("text-dim") }}
        >
          {note}
        </text>
      </g>
    </g>
  );
}

function Figure({
  label,
  width = 560,
  height = 570,
  children,
}: {
  label: string;
  width?: number;
  height?: number;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      fill="none"
      strokeLinecap="round"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
    >
      {children}
    </svg>
  );
}

// Convex outline of a set of screen points (monotone chain).
function hull(pts: [number, number][]) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (
        out.length > 1 &&
        cross(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  const h = [...half(s), ...half([...s].reverse())];
  return (
    h.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)},${fmt(y)}`).join("") + "Z"
  );
}

// A roller lying along y: its body as one outline, its front end as a disc.
function Roller({
  P,
  trace,
  x,
  z,
  r,
  y0,
  y1,
  stroke = LINE,
  fill = SURFACE,
  cap = alpha("ink", 4),
  hub = 0,
}: {
  P: (p: V3) => [number, number];
  trace: (pts: V3[], close?: boolean) => string;
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  stroke?: string;
  fill?: string;
  cap?: string;
  hub?: number;
}) {
  const ring = (y: number, rr = r): V3[] =>
    Array.from({ length: 33 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr];
    });
  return (
    <g strokeWidth="0.85" strokeLinejoin="round" style={{ stroke }}>
      <path d={hull([...ring(y0), ...ring(y1)].map(P))} style={{ fill }} />
      <path
        d={trace(ring(y1), true)}
        style={{ fill: `color-mix(in srgb, ${cap}, ${fill})` }}
      />
      {hub > 0 && (
        <>
          <path
            d={trace(ring(y1, hub), true)}
            strokeWidth="0.7"
            style={{ fill }}
          />
          <circle
            cx={P([x, y1, z])[0]}
            cy={P([x, y1, z])[1]}
            r="0.9"
            style={{ fill: stroke, stroke: "none" }}
          />
        </>
      )}
    </g>
  );
}

// Text lying in a face of the figure: "front" is the x–z plane, "top" x–y.
const faceMatrix = (
  P: (p: V3) => [number, number],
  o: V3,
  plane: "front" | "top",
) => {
  const [ox, oy] = P(o);
  return plane === "front"
    ? `matrix(0.866 0.5 0 1 ${fmt(ox)} ${fmt(oy)})`
    : `matrix(0.866 0.5 -0.866 0.5 ${fmt(ox)} ${fmt(oy)})`;
};

// Four pens, one lane each on the paper.
const PENS: { color: VoxColor; y: number }[] = [
  { color: "gold", y: -19 },
  { color: "mint", y: -10 },
  { color: "sky", y: -1 },
  { color: "violet", y: 8 },
];

// What the day records, as [lane, start hour, end hour].
const MARKS: [number, number, number][] = [
  [2, 0.6, 2.4],
  [0, 3.2, 4.6],
  [1, 6.4, 8.8],
  [2, 9.5, 12.2],
  [3, 10.6, 11.4],
  [0, 13.0, 14.0],
  [3, 15.2, 17.8],
  [1, 18.4, 19.6],
  [2, 20.5, 23.2],
];

// A strip-chart recorder: a day of paper runs from the supply roll to the
// take-up roll, and a pen carriage on the gantry (now) inks each entry into
// its category's lane as the hours pass.
export function TimelineFigure({ loading = false }: { loading?: boolean }) {
  const t = useClock() * (loading ? 2.2 : 1);
  const P = at(168, 288);
  const trace = makeTrace(P);
  const face = (pts: V3[]) => trace(pts, true);
  const quad = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z: number,
  ): V3[] => [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
  const red = token("danger");
  const today = new Date();

  // World plan: base, platen, paper, drums, gantry.
  const top = 12;
  const bed = 24;
  const paper = { y0: -26, y1: 14 };
  const span = { from: -96, to: 96 };
  const xOf = (hour: number) => span.from + (hour / 24) * (span.to - span.from);
  const realHour = today.getHours() + today.getMinutes() / 60;
  const cycle = 12;
  const phase = (t % cycle) / cycle;
  const hour = t > 0 ? phase * 24 : realHour;
  const nowX = xOf(hour);
  const ink = t > 0 ? 1 - ease((phase - 0.93) / 0.07) : 1;
  const railZ = 58;

  const carriage = { w: 7, y: -36 };
  const writing = MARKS.filter(([, a, b]) => hour >= a && hour <= b).map(
    ([lane]) => lane,
  );

  return (
    <Figure
      height={286}
      label="A strip-chart recorder: today's date on a flip counter, a day of paper marked hour by hour, and a pen carriage inking each entry in its category's colour as the day goes on"
    >
      <path
        d={face([
          [-132, -38, 0],
          [140, -38, 0],
          [140, 52, 0],
          [-132, 52, 0],
        ])}
        style={{ fill: alpha("ink", 4) }}
      />

      {/* Feet and base */}
      {[
        [-136, -30],
        [136, -30],
        [-136, 34],
        [136, 34],
      ].map(([x, y]) => (
        <Box
          key={`${x},${y}`}
          trace={trace}
          x={x}
          y={y}
          z={4}
          w={7}
          d={6}
          depth={4}
          fill={alpha("ink", 8)}
        />
      ))}
      <Box trace={trace} y={2} z={top} w={150} d={42} depth={8} />
      <path
        d={face(quad(-144, 144, -36, 40, top))}
        strokeWidth="0.6"
        style={{ stroke: FAINT }}
      />
      {[
        [-147, -37],
        [147, -37],
        [-147, 41],
        [147, 41],
      ].map(([x, y]) => {
        const [sx, sy] = P([x, y, top]);
        return (
          <g key={`s${x},${y}`}>
            <circle
              cx={sx}
              cy={sy}
              r="1.3"
              strokeWidth="0.5"
              style={{ stroke: LINE, fill: SURFACE }}
            />
            <circle cx={sx} cy={sy} r="0.45" style={{ fill: LINE }} />
          </g>
        );
      })}

      {/* Hour ruler along the front of the base */}
      <path
        d={face(quad(span.from - 4, span.to + 4, 22, 30, top))}
        strokeWidth="0.6"
        style={{ stroke: FAINT, fill: alpha("ink", 4) }}
      />
      {Array.from({ length: 25 }, (_, i) => {
        const x = xOf(i);
        const major = i % 6 === 0;
        return (
          <path
            key={`t${i}`}
            d={trace([
              [x, 22, top],
              [x, major ? 28 : 25, top],
            ])}
            strokeWidth={major ? 0.8 : 0.55}
            style={{ stroke: major ? LINE : FAINT }}
          />
        );
      })}
      {["12a", "6a", "12p", "6p", "12a"].map((label, i) => (
        <text
          key={`l${i}`}
          transform={faceMatrix(P, [xOf(i * 6), 31, top], "top")}
          y="4.4"
          fontSize="5.2"
          textAnchor="middle"
          style={{ fill: token("text-dim") }}
        >
          {label}
        </text>
      ))}
      <path
        d={face([
          [nowX, 21.5, top],
          [nowX - 2.2, 18, top],
          [nowX + 2.2, 18, top],
        ])}
        style={{ fill: red }}
      />

      <path
        d={face(quad(104, 128, 32, 41, top))}
        strokeWidth="0.6"
        style={{ stroke: LINE, fill: alpha("ink", 5) }}
      />
      {[34.5, 36.5, 38.5].map((y, i) => (
        <path
          key={`plate${y}`}
          d={trace([
            [107, y, top],
            [i === 2 ? 117 : 125, y, top],
          ])}
          strokeWidth="0.45"
          style={{ stroke: FAINT }}
        />
      ))}
      {[105.4, 126.6].map((x) =>
        [33.2, 39.8].map((y) => {
          const [sx, sy] = P([x, y, top]);
          return (
            <circle
              key={`ps${x}${y}`}
              cx={sx}
              cy={sy}
              r="0.45"
              style={{ fill: LINE }}
            />
          );
        }),
      )}
      <Box trace={trace} x={139} y={36} z={top + 3} w={5} d={4} depth={3} />
      {(() => {
        const [lx, ly] = P([139, 36, top + 3]);
        const on = t > 0 ? 0.35 + 0.65 * ((Math.sin(t * 4) + 1) / 2) : 1;
        return (
          <g>
            <circle
              cx={lx}
              cy={ly}
              r="3.4"
              style={{ fill: alpha("danger", 18), opacity: on }}
            />
            <circle
              cx={lx}
              cy={ly}
              r="1.5"
              style={{ fill: red, opacity: 0.4 + on * 0.6 }}
            />
          </g>
        );
      })()}
      {/* Gantry: posts and rail behind the platen */}
      {[-110, 110].map((x) => (
        <g key={`p${x}`}>
          <Box
            trace={trace}
            x={x}
            y={-36}
            z={top + 2}
            w={6}
            d={5}
            depth={2}
            fill={alpha("ink", 6)}
          />
          <Box
            trace={trace}
            x={x}
            y={-36}
            z={railZ + 4}
            w={2.5}
            d={2.5}
            depth={railZ + 4 - top - 2}
          />
        </g>
      ))}
      <Box
        trace={trace}
        y={-36}
        z={railZ + 3}
        w={107.5}
        d={2}
        depth={5}
        fill={alpha("ink", 5)}
      />
      <path
        d={trace([
          [-107.5, -34, railZ + 0.5],
          [107.5, -34, railZ + 0.5],
        ])}
        strokeWidth="0.5"
        style={{ stroke: FAINT }}
      />

      {/* Back brackets, drums and platen */}
      {[-122, 122].map((x) => (
        <Box
          key={`bb${x}`}
          trace={trace}
          x={x}
          y={-30}
          z={top + 6}
          w={3}
          d={1}
          depth={6}
        />
      ))}
      {[-122, 122].map((x) => (
        <path
          key={`slot${x}`}
          d={face(quad(x - 10, x + 10, -29, 17, top))}
          strokeWidth="0.6"
          style={{ stroke: LINE, fill: alpha("ink", 14) }}
        />
      ))}
      <Roller
        P={P}
        trace={trace}
        x={-122}
        z={bed - 9}
        r={9}
        y0={-29}
        y1={17}
        hub={3.2}
      />
      <Roller
        P={P}
        trace={trace}
        x={122}
        z={bed - 9}
        r={9}
        y0={-29}
        y1={17}
        hub={3.2}
      />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={`ring${i}`}
          d={trace(
            circle(4.6 + i * 1.1, 0, 0).map(
              ([cx, cz]) => [122 + cx, 17, bed - 9 + cz] as V3,
            ),
            true,
          )}
          strokeWidth="0.45"
          style={{ stroke: token(PENS[i].color), opacity: 0.7 }}
        />
      ))}
      <Box
        trace={trace}
        x={0}
        y={-6}
        z={bed}
        w={118}
        d={24}
        depth={bed - top}
      />

      {/* Paper: one day, with hour rules and sprocket holes */}
      <path
        d={face(quad(-122, 122, paper.y0, paper.y1, bed + 0.2))}
        strokeWidth="0.75"
        style={{ stroke: LINE, fill: SURFACE }}
      />
      {Array.from({ length: 25 }, (_, i) => (
        <path
          key={`h${i}`}
          d={trace([
            [xOf(i), paper.y0 + 3.5, bed + 0.2],
            [xOf(i), paper.y1 - 3.5, bed + 0.2],
          ])}
          strokeWidth={i % 6 === 0 ? 0.6 : 0.4}
          style={{ stroke: i % 6 === 0 ? FAINT : alpha("ink", 12) }}
        />
      ))}
      {[paper.y0 + 1.8, paper.y1 - 1.8].map((y) => (
        <path
          key={`e${y}`}
          d={trace([
            [-122, y + (y < 0 ? 1.7 : -1.7), bed + 0.2],
            [122, y + (y < 0 ? 1.7 : -1.7), bed + 0.2],
          ])}
          strokeWidth="0.4"
          style={{ stroke: alpha("ink", 12) }}
        />
      ))}
      {Array.from({ length: 31 }, (_, i) =>
        [paper.y0 + 1.8, paper.y1 - 1.8].map((y) => {
          const [sx, sy] = P([-120 + i * 8, y, bed + 0.2]);
          return (
            <circle
              key={`k${i}${y}`}
              cx={sx}
              cy={sy}
              r="0.7"
              style={{ fill: alpha("ink", 22) }}
            />
          );
        }),
      )}

      {PENS.map((pen) => (
        <path
          key={`key${pen.y}`}
          d={face(
            quad(
              span.from - 9,
              span.from - 4,
              pen.y - 2.5,
              pen.y + 2.5,
              bed + 0.3,
            ),
          )}
          strokeWidth="0.6"
          style={{ stroke: token(pen.color), fill: token(pen.color) }}
        />
      ))}
      {/* Ink: what has been recorded so far */}
      <g opacity={ink}>
        {MARKS.map(([lane, a, b], i) => {
          const x0 = xOf(a);
          const x1 = Math.min(xOf(b), nowX);
          if (x1 <= x0) return null;
          const pen = PENS[lane];
          return (
            <path
              key={`m${i}`}
              d={face(quad(x0, x1, pen.y - 2.6, pen.y + 2.6, bed + 0.3))}
              strokeWidth="0.7"
              style={{
                stroke: token(pen.color),
                fill: `color-mix(in srgb, ${token(pen.color)} 38%, ${SURFACE})`,
              }}
            />
          );
        })}
      </g>
      <path
        d={trace([
          [nowX, paper.y0, bed + 0.3],
          [nowX, paper.y1, bed + 0.3],
        ])}
        strokeWidth="0.8"
        style={{ stroke: alpha("danger", 70) }}
      />

      {/* Front brackets and the take-up crank */}
      {[-122, 122].map((x) => (
        <Box
          key={`fb${x}`}
          trace={trace}
          x={x}
          y={18.5}
          z={top + 6}
          w={3}
          d={1}
          depth={6}
        />
      ))}
      {[-122, 122].map((x) => {
        const [sx, sy] = P([x, 19.5, bed - 9]);
        return (
          <circle
            key={`ax${x}`}
            cx={sx}
            cy={sy}
            r="1.4"
            strokeWidth="0.6"
            style={{ stroke: LINE, fill: alpha("ink", 10) }}
          />
        );
      })}
      <Roller
        P={P}
        trace={trace}
        x={122}
        z={bed - 9}
        r={3.5}
        y0={19.5}
        y1={24}
        hub={1.6}
      />

      {/* Pen carriage on the rail, its arm and four pens */}
      <Box
        trace={trace}
        x={nowX}
        y={carriage.y}
        z={railZ + 8}
        w={carriage.w}
        d={5}
        depth={14}
        stroke={red}
        top={alpha("danger", 10)}
      />
      {[-4.5, 4.5].map((dx) => {
        const [sx, sy] = P([nowX + dx, carriage.y + 5, railZ + 5]);
        return (
          <circle
            key={`cs${dx}`}
            cx={sx}
            cy={sy}
            r="0.6"
            style={{ fill: red }}
          />
        );
      })}
      <Box
        trace={trace}
        x={nowX}
        y={-11}
        z={railZ + 4}
        w={2.6}
        d={20}
        depth={3.5}
        stroke={red}
      />
      {PENS.map((pen, lane) => {
        const down = writing.includes(lane);
        const tip = down ? bed + 0.3 : bed + 5;
        const color = token(pen.color);
        return (
          <g key={`pen${lane}`}>
            <Box
              trace={trace}
              x={nowX}
              y={pen.y}
              z={railZ + 0.5}
              w={1.8}
              d={1.8}
              depth={railZ + 0.5 - tip - 6}
              stroke={color}
              top={alpha(pen.color, 40)}
            />
            <path
              d={trace([
                [nowX, pen.y, tip + 6],
                [nowX, pen.y, tip],
              ])}
              strokeWidth="1"
              style={{ stroke: color }}
            />
            {down && (
              <circle
                cx={P([nowX, pen.y, tip])[0]}
                cy={P([nowX, pen.y, tip])[1]}
                r="1.4"
                style={{ fill: color }}
              />
            )}
          </g>
        );
      })}
      {(() => {
        const [px, py] = P([nowX, carriage.y, railZ + 8]);
        return (
          <g>
            <rect
              x={px - 14}
              y={py - 22}
              width="28"
              height="13"
              rx="6.5"
              style={{ fill: red }}
            />
            <text
              x={px}
              y={py - 12.6}
              textAnchor="middle"
              fontSize="7.5"
              fontFamily="Inter, sans-serif"
              fontWeight="600"
              style={{ fill: token("on-accent") }}
            >
              Now
            </text>
          </g>
        );
      })()}

      {/* Flip-date counter on the front corner */}
      <Box
        trace={trace}
        x={-132}
        y={33}
        z={top + 18}
        w={12}
        d={8}
        depth={18}
        top={alpha("sky", 12)}
        stroke={token("sky")}
      />
      <path
        d={face(
          quad(-140, -124, 41, 41, 0).map(
            ([x, y], i) => [x, y, i < 2 ? top + 4 : top + 15] as V3,
          ),
        )}
        strokeWidth="0.7"
        style={{ stroke: token("sky"), fill: SURFACE }}
      />
      <path
        d={trace([
          [-140, 41, top + 9.5],
          [-124, 41, top + 9.5],
        ])}
        strokeWidth="0.5"
        style={{ stroke: alpha("sky", 50) }}
      />
      <text
        transform={faceMatrix(P, [-132, 41, top + 6.2], "front")}
        textAnchor="middle"
        fontSize="9"
        fontFamily="Inter, sans-serif"
        fontWeight="600"
        style={{ fill: token("sky") }}
      >
        {String(today.getDate()).padStart(2, "0")}
      </text>
      <text
        transform={faceMatrix(P, [-132, 37, top + 18], "top")}
        textAnchor="middle"
        fontSize="4.6"
        letterSpacing="0.8"
        style={{ fill: token("sky") }}
      >
        {today.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
      </text>

      <Callout
        from={P([-144, 41, top + 10])}
        ex={20}
        ey={170}
        id="TODAY"
        title={`${today.toLocaleDateString(undefined, { weekday: "long" })}, ${today.getDate()}`}
        note="Opens on the current day"
        dot={token("sky")}
      />
      <Callout
        from={P([span.from - 6.5, PENS[0].y, bed + 0.3])}
        ex={20}
        ey={74}
        id="03 · CATEGORIES"
        title="A pen for each kind"
        note="Finance, activity, work, health"
        dot={token("gold")}
      />
      <Callout
        from={P([xOf(18), 30, top])}
        ex={540}
        ey={276}
        id="01 · DAY"
        title="Hour by hour"
        note="Midnight to midnight"
        right
      />
      <Callout
        from={P([xOf(21), PENS[0].y, bed + 0.3])}
        ex={540}
        ey={98}
        id="02 · ENTRIES"
        title="Filled as you go"
        note="From your connected sources"
        right
        dot={token("mint")}
      />
    </Figure>
  );
}

type Glyph = "attention" | "briefing" | "email" | "connection" | "plan";

const BINS: {
  id: string;
  title: string;
  note: string;
  color: VoxColor;
  glyph: Glyph;
}[] = [
  {
    id: "01 · ATTENTION",
    title: "Needs attention",
    note: "Anything waiting on you",
    color: "danger",
    glyph: "attention",
  },
  {
    id: "02 · BRIEFINGS",
    title: "Briefings",
    note: "Morning summaries",
    color: "gold",
    glyph: "briefing",
  },
  {
    id: "03 · EMAIL",
    title: "Email",
    note: "Notices worth reading",
    color: "sky",
    glyph: "email",
  },
  {
    id: "04 · CONNECTIONS",
    title: "Connections",
    note: "Apps that need a nudge",
    color: "mint",
    glyph: "connection",
  },
  {
    id: "05 · PLANS",
    title: "Plans",
    note: "Daily plans when ready",
    color: "violet",
    glyph: "plan",
  },
];

const ease = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

// A sorting rack: each kind of update has its own bin, and new ones drop in
// from above, light their bin, and settle. While loading, the rack sorts
// faster and the signal reads as a check in progress.
export function UpdatesFigure({ loading = false }: { loading?: boolean }) {
  const t = useClock();
  const P = at(178, 310);
  const trace = makeTrace(P);
  const W = 20;
  const D = 30;
  const H = 24;
  const xs = BINS.map((_, i) => -104 + i * 52);
  const step = loading ? 0.9 : 1.8;
  const k = Math.floor(t / step) % BINS.length;
  const u = (t % step) / step;
  const cardZ = 96 - ease((u - 0.15) / 0.5) * 84;
  const cardOpacity =
    t > 0 ? Math.min(1, u / 0.12) * (1 - ease((u - 0.72) / 0.2)) : 0;
  const landed = ease((u - 0.6) / 0.12) * (1 - ease((u - 0.8) / 0.2));
  const ringing = t > 0 ? Math.max(0, 1 - u * 5) : 0;

  const glyph = (kind: Glyph, ox: number, z: number, color: string) => {
    const s = 0.5;
    const p = (a: number, b: number): V3 => [ox + a * s, b * s, z];
    const ring = (r: number, a: number, b: number) =>
      trace(circle(r * s, ox + a * s, b * s, z));
    const style = { stroke: color };
    switch (kind) {
      case "attention":
        return (
          <g strokeWidth="1" strokeLinejoin="round" style={style}>
            <path d={trace([p(-14, 10), p(0, -14), p(14, 10)], true)} />
            <path d={trace([p(-1, -4), p(-1, 3)])} />
          </g>
        );
      case "briefing":
        return (
          <g strokeWidth="0.9" style={style}>
            {[-12, -4, 4].map((v, i) => (
              <path key={v} d={trace([p(-24, v), p(i === 2 ? 2 : 10, v)])} />
            ))}
            <path d={ring(7, 22, -6)} />
          </g>
        );
      case "email":
        return (
          <g strokeWidth="0.9" strokeLinejoin="round" style={style}>
            <path
              d={trace([p(-24, -14), p(24, -14), p(24, 14), p(-24, 14)], true)}
            />
            <path d={trace([p(-24, -14), p(0, 3), p(24, -14)])} />
          </g>
        );
      case "connection":
        return (
          <g strokeWidth="0.9" style={style}>
            <path d={ring(6, -18, 0)} />
            <path d={ring(6, 18, 0)} />
            <path d={trace([p(-12, 0), p(12, 0)])} strokeDasharray="2 2.5" />
          </g>
        );
      case "plan":
        return (
          <g strokeWidth="0.9" strokeLinejoin="round" style={style}>
            <path d={trace([p(-16, 12), p(-16, -16)])} />
            <path d={trace([p(-16, -16), p(8, -10), p(-16, -4)], true)} />
          </g>
        );
    }
  };

  const face = (pts: V3[]) => trace(pts, true);
  const [bx, by] = P([-122, -30, 62]);
  const orange = token("orange");

  return (
    <Figure
      height={300}
      label="A sorting rack with bins for needs attention, briefings, email, connections and plans, with new updates dropping into place"
    >
      <Box trace={trace} z={0} w={134} d={42} depth={8} />
      <path
        d={trace([
          [-134, 0, 0],
          [134, 0, 0],
        ])}
        strokeWidth="0.6"
        strokeDasharray="2 4"
        style={{ stroke: FAINT }}
      />

      <path
        d={trace([
          [-122, -30, 0],
          [-122, -30, 44],
        ])}
        strokeWidth="0.85"
        style={{ stroke: LINE }}
      />
      <g transform={`translate(${fmt(bx)} ${fmt(by)}) scale(0.62)`}>
        <path
          d="M-19,0 C-19,-30 -13,-42 0,-42 C13,-42 19,-30 19,0 Z"
          strokeWidth="1.3"
          strokeLinejoin="round"
          style={{ stroke: LINE, fill: SURFACE }}
        />
        <path
          d="M-23,0 C-12,7 12,7 23,0"
          strokeWidth="1.3"
          style={{ stroke: LINE }}
        />
        <circle
          cx="0"
          cy="-45"
          r="3"
          strokeWidth="1.3"
          style={{ stroke: LINE, fill: SURFACE }}
        />
        <circle cx="0" cy="7" r="4" style={{ fill: orange }} />
        {[1, 2].map((n) => (
          <g
            key={n}
            strokeWidth="1.4"
            opacity={ringing * (n === 1 ? 1 : 0.55)}
            style={{ stroke: orange }}
          >
            <path d={`M${-26 - n * 7},-32 q-${5 + n * 2},13 0,26`} />
            <path d={`M${26 + n * 7},-32 q${5 + n * 2},13 0,26`} />
          </g>
        ))}
      </g>
      <Callout
        from={[bx - 12, by - 12]}
        ex={28}
        ey={64}
        id={loading ? "CHECKING" : "SIGNAL"}
        title={loading ? "Looking for new updates" : "New updates ring in"}
        note={
          loading ? "Sorting each one by kind" : "Vox files each one by kind"
        }
        dot={orange}
      />

      {BINS.map((b, i) => {
        const x = xs[i];
        const g = i === k ? landed : 0;
        const color = token(b.color);
        const edge = mixTo(color, 0.35 + g * 0.65);
        const left = i % 2 === 0;
        return (
          <g key={b.id}>
            <g strokeWidth="0.7" strokeLinejoin="round">
              <path
                d={face([
                  [x - W, -D, 0],
                  [x + W, -D, 0],
                  [x + W, -D, H],
                  [x - W, -D, H],
                ])}
                style={{ stroke: FAINT, fill: alpha("ink", 3) }}
              />
              <path
                d={face([
                  [x - W, -D, 0],
                  [x - W, D, 0],
                  [x - W, D, H],
                  [x - W, -D, H],
                ])}
                style={{ stroke: FAINT, fill: alpha("ink", 5) }}
              />
              <path
                d={face([
                  [x - W, -D, 0],
                  [x + W, -D, 0],
                  [x + W, D, 0],
                  [x - W, D, 0],
                ])}
                style={{
                  stroke: FAINT,
                  fill: alpha(b.color, Math.round(4 + g * 20)),
                }}
              />
            </g>
            {i === k && (
              <g opacity={cardOpacity}>
                <Box
                  trace={trace}
                  x={x}
                  z={cardZ}
                  w={15}
                  d={22}
                  depth={2}
                  stroke={color}
                  top={alpha(b.color, 14)}
                />
                {glyph(b.glyph, x, cardZ, color)}
              </g>
            )}
            <g
              strokeWidth={0.85 + g * 0.4}
              strokeLinejoin="round"
              style={{ stroke: edge, fill: SURFACE }}
            >
              <path
                d={face([
                  [x - W, D, 0],
                  [x + W, D, 0],
                  [x + W, D, H],
                  [x - W, D, H],
                ])}
              />
              <path
                d={face([
                  [x + W, -D, 0],
                  [x + W, D, 0],
                  [x + W, D, H],
                  [x + W, -D, H],
                ])}
              />
            </g>
            <path
              d={face([
                [x - 11, D, 9],
                [x + 11, D, 9],
                [x + 11, D, 16],
                [x - 11, D, 16],
              ])}
              strokeWidth="0.7"
              style={{
                stroke: color,
                fill: alpha(b.color, Math.round(18 + g * 50)),
              }}
            />
            <Callout
              from={P(left ? [x - W, D, 13] : [x + W, 0, 20])}
              ex={left ? 28 : 532}
              ey={Math.round(
                P(left ? [x - W, D, 13] : [x + W, 0, 20])[1] + (left ? 22 : -4),
              )}
              id={b.id}
              title={b.title}
              note={b.note}
              right={!left}
              dot={color}
            />
          </g>
        );
      })}
    </Figure>
  );
}

const OUTPUTS: VoxColor[] = ["sky", "gold", "violet"];

// The agents as one machine: connected sources drop work into a hopper, a
// belt carries it into the Vox engine, and finished work is sorted out into
// three trays (timeline, updates, plans). The flywheel runs faster during a
// call and the lamp lights while Vox speaks.
export function AgentsFigure({
  sources,
  active = false,
  speaking = false,
}: {
  sources: string[];
  active?: boolean;
  speaking?: boolean;
}) {
  const t = useClock();
  const P = at(108, 166);
  const trace = makeTrace(P);
  const face = (pts: V3[]) => trace(pts, true);
  const quad = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z: number,
  ): V3[] => [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
  const top = 8;
  const beltZ = 20;
  const belt = { from: -88, to: 16 };
  const hop = { x: -76, mouth: 38 };
  const engine = { x: 42, w: 24, d: 22, z: 56 };
  const step = 1.6;
  const n = Math.floor(t / step);
  const u = (t % step) / step;
  const colors = sources.length
    ? sources
    : ["sky", "mint", "gold", "violet"].map((c) => token(c as VoxColor));
  const chips = [0, 1, 2, 3].map((k) => {
    const age = u + k;
    const color =
      colors[(((n - k) % colors.length) + colors.length) % colors.length];
    const fall = Math.min(1, age / 0.25);
    const x = hop.x + Math.max(0, age - 0.25) * 36;
    const z =
      fall < 1
        ? hop.mouth - 2 - ease(fall) * (hop.mouth - 2 - beltZ - 3)
        : beltZ + 3;
    return { k, x, z, color, show: t > 0 && x < engine.x - engine.w + 3 };
  });
  const spin = t * (speaking ? 4.5 : active ? 2.4 : 0.8);
  const lamp = speaking
    ? 0.6 + 0.4 * Math.abs(Math.sin(t * 6))
    : active
      ? 0.35
      : 0.12;
  const tray = (i: number) => -18 + i * 18;
  const out = n % 3;
  const cardX = 70 + ease(u / 0.6) * 24;
  const cardZ = 26 - ease((u - 0.35) / 0.4) * 13;
  const cardY = tray(out) * ease(u / 0.5);
  const ring = (r: number, y: number, cx: number, cz: number): V3[] =>
    circle(r).map(([a, b]) => [cx + a, y, cz + b] as V3);
  const fw = { x: engine.x - 2, z: 31, y: engine.d + 0.2 };

  return (
    <Figure
      width={330}
      height={206}
      label="Your agents as one machine: connected sources drop work into a hopper, a belt carries it into Vox, and finished work is sorted into timeline, updates and plans"
    >
      <path
        d={face(quad(-128, 140, -30, 44, 0))}
        style={{ fill: alpha("ink", 4) }}
      />
      {[
        [-118, -26],
        [118, -26],
        [-118, 26],
        [118, 26],
      ].map(([x, y]) => (
        <Box
          key={`f${x}${y}`}
          trace={trace}
          x={x}
          y={y}
          z={3}
          w={5}
          d={5}
          depth={3}
          fill={alpha("ink", 8)}
        />
      ))}
      <Box trace={trace} z={top} w={130} d={34} depth={5} />
      <path
        d={face(quad(-125, 125, -29, 29, top))}
        strokeWidth="0.5"
        style={{ stroke: FAINT }}
      />
      {[
        [-127, -31],
        [127, -31],
        [-127, 31],
        [127, 31],
      ].map(([x, y]) => {
        const [sx, sy] = P([x, y, top]);
        return (
          <circle
            key={`s${x}${y}`}
            cx={sx}
            cy={sy}
            r="0.5"
            style={{ fill: LINE }}
          />
        );
      })}

      {/* Hopper on two posts */}
      {[-84, -68].map((x) => (
        <Box
          key={`hp${x}`}
          trace={trace}
          x={x}
          y={-12}
          z={hop.mouth + 10}
          w={1.4}
          d={1.4}
          depth={hop.mouth + 10 - top}
        />
      ))}
      <g strokeWidth="0.85" strokeLinejoin="round" style={{ stroke: LINE }}>
        <path
          d={face([
            [hop.x - 4, 4, hop.mouth],
            [hop.x + 4, 4, hop.mouth],
            [hop.x + 11, 11, hop.mouth + 16],
            [hop.x - 11, 11, hop.mouth + 16],
          ])}
          style={{ fill: SURFACE }}
        />
        <path
          d={face([
            [hop.x + 4, -4, hop.mouth],
            [hop.x + 4, 4, hop.mouth],
            [hop.x + 11, 11, hop.mouth + 16],
            [hop.x + 11, -11, hop.mouth + 16],
          ])}
          style={{ fill: `color-mix(in srgb, ${LINE} 8%, ${SURFACE})` }}
        />
        <path
          d={face(quad(hop.x - 11, hop.x + 11, -11, 11, hop.mouth + 16))}
          style={{ fill: alpha("ink", 16) }}
        />
        <path
          d={face(quad(hop.x - 8.5, hop.x + 8.5, -8.5, 8.5, hop.mouth + 16))}
          strokeWidth="0.5"
          style={{ fill: "none", stroke: FAINT }}
        />
      </g>
      {colors.slice(0, 4).map((color, i) => {
        const [sx, sy] = P([hop.x - 6 + i * 4, -2 + i * 2, hop.mouth + 16]);
        return (
          <circle
            key={`hc${i}`}
            cx={sx}
            cy={sy}
            r="1.6"
            style={{ fill: color }}
          />
        );
      })}

      {/* Conveyor: frame, rollers, belt with moving cleats */}
      <Box
        trace={trace}
        x={(belt.from + belt.to) / 2}
        y={-11}
        z={beltZ - 3}
        w={(belt.to - belt.from) / 2}
        d={1}
        depth={beltZ - 3 - top}
        fill={alpha("ink", 5)}
      />
      <Roller
        P={P}
        trace={trace}
        x={belt.from}
        z={beltZ - 3}
        r={3}
        y0={-10}
        y1={10}
        hub={1}
      />
      <Roller
        P={P}
        trace={trace}
        x={belt.to}
        z={beltZ - 3}
        r={3}
        y0={-10}
        y1={10}
        hub={1}
      />
      <path
        d={face(quad(belt.from, belt.to, -10, 10, beltZ))}
        strokeWidth="0.8"
        style={{
          stroke: LINE,
          fill: `color-mix(in srgb, ${LINE} 6%, ${SURFACE})`,
        }}
      />
      {Array.from({ length: 14 }, (_, i) => {
        const x =
          belt.from +
          2 +
          ((i * 8 + ((t * 36) % 8)) % (belt.to - belt.from - 4));
        return (
          <path
            key={`cl${i}`}
            d={trace([
              [x, -10, beltZ],
              [x, 10, beltZ],
            ])}
            strokeWidth="0.45"
            style={{ stroke: FAINT }}
          />
        );
      })}
      <Box
        trace={trace}
        x={(belt.from + belt.to) / 2}
        y={11}
        z={beltZ - 3}
        w={(belt.to - belt.from) / 2}
        d={1}
        depth={beltZ - 3 - top}
      />
      {[belt.from + 10, belt.to - 10].map((x) =>
        [11.5].map((y) => {
          const [sx, sy] = P([x, y, beltZ - 6]);
          return (
            <circle
              key={`bs${x}`}
              cx={sx}
              cy={sy}
              r="0.5"
              style={{ fill: LINE }}
            />
          );
        }),
      )}

      {chips.map(
        (c) =>
          c.show && (
            <Box
              key={`chip${c.k}`}
              trace={trace}
              x={c.x}
              y={0}
              z={c.z}
              w={3.2}
              d={3.2}
              depth={3}
              stroke={c.color}
              top={`color-mix(in srgb, ${c.color} 45%, ${SURFACE})`}
              fill={`color-mix(in srgb, ${c.color} 14%, ${SURFACE})`}
            />
          ),
      )}

      {/* The Vox engine */}
      <Box
        trace={trace}
        x={engine.x}
        z={engine.z}
        w={engine.w}
        d={engine.d}
        depth={engine.z - top}
      />
      <path
        d={face(
          quad(
            engine.x - engine.w + 3,
            engine.x + engine.w - 3,
            -engine.d + 3,
            engine.d - 3,
            engine.z,
          ),
        )}
        strokeWidth="0.5"
        style={{ stroke: FAINT }}
      />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b]) => {
        const [sx, sy] = P([
          engine.x + a * (engine.w - 1.6),
          b * (engine.d - 1.6),
          engine.z,
        ]);
        return (
          <circle
            key={`es${a}${b}`}
            cx={sx}
            cy={sy}
            r="0.5"
            style={{ fill: LINE }}
          />
        );
      })}
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={`gr${i}`}
          d={trace([
            [engine.x + engine.w, -14, 36 + i * 3],
            [engine.x + engine.w, 14, 36 + i * 3],
          ])}
          strokeWidth="1.1"
          style={{
            stroke: speaking
              ? alpha("violet", Math.round(40 + 50 * lamp))
              : FAINT,
          }}
        />
      ))}
      <g strokeWidth="0.8" style={{ stroke: LINE }}>
        <path
          d={trace(ring(13, fw.y, fw.x, fw.z), true)}
          style={{ fill: SURFACE }}
        />
        <path
          d={trace(ring(10.5, fw.y, fw.x, fw.z), true)}
          strokeWidth="0.5"
          style={{ fill: "none" }}
        />
        {Array.from({ length: 5 }, (_, i) => {
          const a = spin + (i / 5) * Math.PI * 2;
          return (
            <path
              key={`sp${i}`}
              d={trace([
                [fw.x + Math.cos(a) * 2.6, fw.y, fw.z + Math.sin(a) * 2.6],
                [fw.x + Math.cos(a) * 10.5, fw.y, fw.z + Math.sin(a) * 10.5],
              ])}
              strokeWidth="0.9"
            />
          );
        })}
        <path
          d={trace(ring(2.6, fw.y, fw.x, fw.z), true)}
          style={{ fill: alpha("violet", 30), stroke: token("violet") }}
        />
      </g>
      <text
        transform={(() => {
          const [ox, oy] = P([engine.x + 4, -8, engine.z]);
          return `matrix(0.866 0.5 -0.866 0.5 ${fmt(ox)} ${fmt(oy)})`;
        })()}
        fontSize="7"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        letterSpacing="2"
        textAnchor="middle"
        style={{ fill: alpha("ink", 45) }}
      >
        VOX
      </text>
      <Box
        trace={trace}
        x={engine.x + 10}
        y={12}
        z={engine.z + 3}
        w={3}
        d={3}
        depth={3}
      />
      {(() => {
        const [lx, ly] = P([engine.x + 10, 12, engine.z + 5]);
        return (
          <g>
            <circle
              cx={lx}
              cy={ly}
              r="7"
              style={{ fill: alpha("violet", 22), opacity: lamp }}
            />
            <circle
              cx={lx}
              cy={ly - 1}
              r="2.8"
              strokeWidth="0.7"
              style={{
                stroke: token("violet"),
                fill: `color-mix(in srgb, ${token("violet")} ${Math.round(lamp * 100)}%, ${SURFACE})`,
              }}
            />
          </g>
        );
      })()}

      {/* Out ledge and three trays */}
      <Box
        trace={trace}
        x={engine.x + engine.w + 6}
        z={beltZ + 4}
        w={6}
        d={20}
        depth={2}
      />
      {OUTPUTS.map((color, i) => {
        const y = tray(i);
        const c = token(color);
        const landing = i === out && t > 0 && u > 0.7;
        return (
          <g key={`tr${color}`}>
            <path
              d={face(quad(86, 104, y - 7, y + 7, top))}
              style={{ fill: alpha(color, 10) }}
            />
            {[0, 1, 2].slice(0, landing ? 3 : 2).map((k) => (
              <path
                key={`st${k}`}
                d={face(quad(89, 101, y - 5, y + 5, top + 1 + k * 1.5))}
                strokeWidth="0.6"
                style={{
                  stroke: c,
                  fill: `color-mix(in srgb, ${c} 22%, ${SURFACE})`,
                }}
              />
            ))}
            <g
              strokeWidth="0.85"
              strokeLinejoin="round"
              style={{ stroke: c, fill: SURFACE }}
            >
              <path
                d={face([
                  [86, y + 7, top],
                  [104, y + 7, top],
                  [104, y + 7, top + 6],
                  [86, y + 7, top + 6],
                ])}
              />
              <path
                d={face([
                  [104, y - 7, top],
                  [104, y + 7, top],
                  [104, y + 7, top + 6],
                  [104, y - 7, top + 6],
                ])}
                style={{ fill: alpha(color, 12) }}
              />
            </g>
          </g>
        );
      })}
      {t > 0 && u < 0.75 && (
        <Box
          trace={trace}
          x={cardX}
          y={cardY}
          z={cardZ}
          w={6}
          d={5}
          depth={1.2}
          stroke={token(OUTPUTS[out])}
          top={`color-mix(in srgb, ${token(OUTPUTS[out])} 30%, ${SURFACE})`}
        />
      )}
    </Figure>
  );
}
