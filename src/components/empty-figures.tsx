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

const OUTPUTS: { color: VoxColor; x: number; y: number }[] = [
  { color: "sky", x: 102, y: -6 },
  { color: "gold", x: 104, y: 14 },
  { color: "violet", x: 90, y: 31 },
];

// An upright cylinder: one outline for the body, a lit disc on top.
function Can({
  P,
  trace,
  x,
  y,
  z0,
  z1,
  r,
  stroke = LINE,
  fill = SURFACE,
  top,
  width = 0.85,
}: {
  P: (p: V3) => [number, number];
  trace: (pts: V3[], close?: boolean) => string;
  x: number;
  y: number;
  z0: number;
  z1: number;
  r: number;
  stroke?: string;
  fill?: string;
  top?: string;
  width?: number;
}) {
  return (
    <g strokeWidth={width} strokeLinejoin="round" style={{ stroke }}>
      <path
        d={hull([...circle(r, x, y, z0), ...circle(r, x, y, z1)].map(P))}
        style={{ fill }}
      />
      <path
        d={trace(circle(r, x, y, z1), true)}
        style={{ fill: top ?? `color-mix(in srgb, ${LINE} 5%, ${fill})` }}
      />
    </g>
  );
}

// The front half of a ring around an upright cylinder (a band or seam).
const frontArc = (r: number, x: number, y: number, z: number): V3[] =>
  Array.from({ length: 17 }, (_, i) => {
    const a = -Math.PI / 4 + (i / 16) * Math.PI;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
  });

// A gear in a vertical x–z plane.
const gear = (
  cx: number,
  y: number,
  cz: number,
  r: number,
  teeth: number,
  turn: number,
): V3[] =>
  Array.from({ length: teeth * 4 + 1 }, (_, i) => {
    const a = turn + (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : r * 0.8;
    return [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr];
  });

// The agents as one plant: each connected source has a canister that drops
// work onto a belt, a bucket elevator lifts it into the Vox engine, the
// engine keeps what it learns in a memory tank, and a turntable sorts the
// finished work into timeline, updates and plans. The flywheel runs faster
// during a call and the mast signals while Vox speaks.
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
  const P = at(126, 172);
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
  const dot = (p: V3, r = 0.5, fill = LINE, key?: string) => {
    const [x, y] = P(p);
    return <circle key={key} cx={x} cy={y} r={r} style={{ fill }} />;
  };
  const top = 8;
  const pace = speaking ? 2.2 : active ? 1.5 : 1;
  const run = t * pace;
  const colors = (
    sources.length
      ? sources
      : ["sky", "mint", "gold", "violet"].map((c) => token(c as VoxColor))
  ).slice(0, 4);
  const cans = colors.map((color, i) => ({ color, x: -108 + i * 15 }));

  // Back belt A along x, the elevator, the engine, belt B and the turntable.
  const A = { from: -118, to: -42, y: -24, z: 16 };
  const lift = { x: -36, y: -24, z0: 12, z1: 70 };
  const eng = { x: 10, w: 22, d: 20, z: 50 };
  const B = { from: 34, to: 66, y: 10, z: 18 };
  const tt = { x: 80, y: 10, z: 15, r: 11 };
  const spin = run * 1.6;
  const lamp = speaking
    ? 0.6 + 0.4 * Math.abs(Math.sin(t * 6))
    : active
      ? 0.4
      : 0.15;

  // One piece of work leaves a canister every step and is followed through.
  const step = 1.5;
  const n = Math.floor(run / step);
  const u = (run % step) / step;
  const out = n % 3;
  const target = OUTPUTS[out];
  const aim = Math.atan2(target.y - tt.y, target.x - tt.x);
  const prevAim = (() => {
    const p = OUTPUTS[(out + 2) % 3];
    return Math.atan2(p.y - tt.y, p.x - tt.x);
  })();
  const arm = prevAim + (aim - prevAim) * ease(u / 0.4);

  const cleats = (x0: number, x1: number, y: number, z: number, w: number) =>
    Array.from({ length: Math.floor((x1 - x0) / 7) }, (_, i) => {
      const x = x0 + 2 + ((i * 7 + ((run * 22) % 7)) % (x1 - x0 - 4));
      return (
        <path
          key={`c${x0}${i}`}
          d={trace([
            [x, y - w, z],
            [x, y + w, z],
          ])}
          strokeWidth="0.4"
          style={{ stroke: FAINT }}
        />
      );
    });

  const beltX = (b: typeof A | typeof B, w: number, key: string) => (
    <g key={key}>
      <Box
        trace={trace}
        x={(b.from + b.to) / 2}
        y={b.y - w - 1}
        z={b.z - 2}
        w={(b.to - b.from) / 2}
        d={0.8}
        depth={b.z - 2 - top}
        fill={alpha("ink", 5)}
      />
      <Roller
        P={P}
        trace={trace}
        x={b.from}
        z={b.z - 2.5}
        r={2.5}
        y0={b.y - w}
        y1={b.y + w}
        hub={0.8}
      />
      <Roller
        P={P}
        trace={trace}
        x={b.to}
        z={b.z - 2.5}
        r={2.5}
        y0={b.y - w}
        y1={b.y + w}
        hub={0.8}
      />
      <path
        d={face(quad(b.from, b.to, b.y - w, b.y + w, b.z))}
        strokeWidth="0.75"
        style={{
          stroke: LINE,
          fill: `color-mix(in srgb, ${LINE} 6%, ${SURFACE})`,
        }}
      />
      {cleats(b.from, b.to, b.y, b.z, w)}
    </g>
  );
  const beltFront = (b: typeof A | typeof B, w: number) => (
    <Box
      trace={trace}
      x={(b.from + b.to) / 2}
      y={b.y + w + 1}
      z={b.z - 2}
      w={(b.to - b.from) / 2}
      d={0.8}
      depth={b.z - 2 - top}
    />
  );

  // Chips riding belt A from each canister to the elevator boot.
  const chipsA = [0, 1, 2, 3, 4].map((k) => {
    const age = (u + k) * step;
    const src = cans[(((n - k) % cans.length) + cans.length) % cans.length];
    const fall = Math.min(1, age / 0.3);
    const x = src.x + Math.max(0, age - 0.3) * 18;
    const z = A.z + 2.5 + (1 - ease(fall)) * 10;
    return { k, x, z, color: src.color, show: t > 0 && x < lift.x - 5 };
  });
  // Buckets on the elevator, coloured by what they carry.
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const z = lift.z0 + 4 + ((i * 10 + run * 16) % (lift.z1 - lift.z0 - 8));
    return { i, z, color: cans[(i + n) % cans.length].color };
  });
  // The chute from the elevator head to the engine's hopper.
  const chuteA: V3 = [lift.x + 4, lift.y + 3, lift.z1 - 6];
  const chuteB: V3 = [eng.x - 6, -8, eng.z + 12];
  const slide = (((run / 0.9) % 1) + 1) % 1;
  const chuteChip: V3 = [
    chuteA[0] + (chuteB[0] - chuteA[0]) * slide,
    chuteA[1] + (chuteB[1] - chuteA[1]) * slide,
    chuteA[2] + (chuteB[2] - chuteA[2]) * slide + 2,
  ];
  // Finished work: along belt B, onto the turntable, out to a tray.
  const cardOnB = u < 0.45;
  const cardPos: V3 = cardOnB
    ? [B.from + (u / 0.45) * (B.to - B.from + 6), B.y, B.z + 1.5]
    : (() => {
        const v = ease((u - 0.45) / 0.4);
        return [
          tt.x + (target.x - tt.x) * v,
          tt.y + (target.y - tt.y) * v,
          tt.z + 1.5 - v * 5,
        ];
      })();

  const tank = { x: 60, y: -18, r: 9, z1: 44 };
  const pipe: V3[] = [
    [eng.x + 14, -12, eng.z],
    [eng.x + 14, -12, eng.z + 8],
    [tank.x, -12, eng.z + 8],
    [tank.x, -12, tank.z1 + 3],
  ];
  const fw = { x: eng.x - 6, y: eng.d + 0.2, z: 30 };
  const mast = { x: eng.x + 14, y: 12 };
  const [mx, my] = P([mast.x, mast.y, eng.z + 22]);

  return (
    <Figure
      width={340}
      height={228}
      label="Your agents as one plant: each connected source feeds a belt, an elevator lifts the work into Vox, Vox keeps what it learns in a memory tank, and a turntable sorts finished work into timeline, updates and plans"
    >
      <path
        d={face(quad(-122, 120, -38, 44, 0))}
        style={{ fill: alpha("ink", 5) }}
      />
      {[
        [-114, -30],
        [108, -30],
        [-114, 32],
        [108, 32],
      ].map(([x, y]) => (
        <Box
          key={`f${x}${y}`}
          trace={trace}
          x={x}
          y={y}
          z={3}
          w={4}
          d={4}
          depth={3}
          fill={alpha("ink", 8)}
        />
      ))}
      <Box trace={trace} x={-4} z={top} w={122} d={38} depth={5} />
      <path
        d={face(quad(-122, 114, -34, 34, top))}
        strokeWidth="0.45"
        style={{ stroke: FAINT }}
      />
      {[
        [-124, -36],
        [116, -36],
        [-124, 36],
        [116, 36],
      ].map(([x, y]) => dot([x, y, top], 0.55, LINE, `s${x}${y}`))}
      {/* Floor markings: the path work takes */}
      <path
        d={trace([
          [-118, -14, top],
          [-46, -14, top],
          [-46, 4, top],
          [-16, 4, top],
        ])}
        strokeWidth="0.5"
        strokeDasharray="2 2.5"
        style={{ stroke: alpha("ink", 20) }}
      />

      {/* Operator console, cabled to the engine */}
      <path
        d={trace([
          [-78, 22, top],
          [-50, 22, top],
          [-30, 14, top],
          [eng.x - eng.w - 4, 14, top],
        ])}
        strokeWidth="1.6"
        strokeLinejoin="round"
        style={{ stroke: LINE }}
      />
      <path
        d={trace([
          [-78, 22, top],
          [-50, 22, top],
          [-30, 14, top],
          [eng.x - eng.w - 4, 14, top],
        ])}
        strokeWidth="0.6"
        strokeLinejoin="round"
        style={{ stroke: SURFACE }}
      />
      <Box trace={trace} x={-92} y={22} z={top + 12} w={14} d={8} depth={12} />
      {(() => {
        const scr = (x: number, y: number): V3 => [x, y, top + 12];
        const pts: V3[] = Array.from({ length: 21 }, (_, i) => {
          const x = -102 + i * 1;
          const amp = speaking ? 2.4 : active ? 1.2 : 0.3;
          const y =
            20 + Math.sin(i * 0.9 + t * 8) * amp * Math.sin((i / 20) * Math.PI);
          return scr(x, y);
        });
        return (
          <g>
            <path
              d={face([
                scr(-103, 16.5),
                scr(-81, 16.5),
                scr(-81, 23.5),
                scr(-103, 23.5),
              ])}
              strokeWidth="0.6"
              style={{ stroke: LINE, fill: alpha("ink", 12) }}
            />
            <path
              d={trace(pts)}
              strokeWidth="0.7"
              style={{ stroke: token("violet") }}
            />
            {cans.map((c, i) =>
              dot(scr(-101 + i * 6, 27.2), 1.1, c.color, `btn${i}`),
            )}
          </g>
        );
      })()}

      {/* Belt A under the source rack */}
      {beltX(A, 4, "A")}
      {chipsA.map(
        (c) =>
          c.show && (
            <Box
              key={`ca${c.k}`}
              trace={trace}
              x={c.x}
              y={A.y}
              z={c.z}
              w={2.2}
              d={2.2}
              depth={2.2}
              stroke={c.color}
              top={`color-mix(in srgb, ${c.color} 45%, ${SURFACE})`}
              fill={`color-mix(in srgb, ${c.color} 14%, ${SURFACE})`}
              width={0.7}
            />
          ),
      )}
      {beltFront(A, 4)}

      {/* Source rack: a shelf on legs, one canister per source */}
      {[-116, -60].map((x) => (
        <Box
          key={`rl${x}`}
          trace={trace}
          x={x}
          y={-33}
          z={30}
          w={1.2}
          d={1.2}
          depth={30 - top}
        />
      ))}
      <Box
        trace={trace}
        x={-88}
        y={-26}
        z={31}
        w={30}
        d={8}
        depth={2}
        fill={alpha("ink", 5)}
      />
      {cans.map((c, i) => (
        <g key={`can${i}`}>
          <path
            d={trace([
              [c.x, -24, 29],
              [c.x, -24, 25],
            ])}
            strokeWidth="1.4"
            style={{ stroke: c.color }}
          />
          <Can
            P={P}
            trace={trace}
            x={c.x}
            y={-26}
            z0={31}
            z1={45}
            r={5}
            stroke={c.color}
            fill={`color-mix(in srgb, ${c.color} 10%, ${SURFACE})`}
            top={`color-mix(in srgb, ${c.color} 35%, ${SURFACE})`}
          />
          <path
            d={trace(frontArc(5, c.x, -26, 35))}
            strokeWidth="0.45"
            style={{ stroke: c.color }}
          />
          {dot([c.x, -26, 45], 1, c.color)}
        </g>
      ))}

      {/* Memory tank behind the engine, with bands and a level window */}
      <Can
        P={P}
        trace={trace}
        x={tank.x}
        y={tank.y}
        z0={top}
        z1={tank.z1}
        r={tank.r}
      />
      {[16, 26, 36].map((z) => (
        <path
          key={`tb${z}`}
          d={trace(frontArc(tank.r, tank.x, tank.y, z))}
          strokeWidth="0.45"
          style={{ stroke: FAINT }}
        />
      ))}
      {(() => {
        const wx = tank.x + tank.r * 0.707;
        const wy = tank.y + tank.r * 0.707;
        const level = 18 + 6 * (0.5 + 0.5 * Math.sin(t * 0.6));
        return (
          <g strokeWidth="0.6" strokeLinejoin="round">
            <path
              d={face([
                [wx - 1.4, wy + 1.4, 14],
                [wx + 1.4, wy - 1.4, 14],
                [wx + 1.4, wy - 1.4, 38],
                [wx - 1.4, wy + 1.4, 38],
              ])}
              style={{ stroke: LINE, fill: SURFACE }}
            />
            <path
              d={face([
                [wx - 1.4, wy + 1.4, 14],
                [wx + 1.4, wy - 1.4, 14],
                [wx + 1.4, wy - 1.4, level],
                [wx - 1.4, wy + 1.4, level],
              ])}
              style={{ stroke: "none", fill: alpha("violet", 45) }}
            />
          </g>
        );
      })()}

      {/* Bucket elevator: two rails, head and boot pulleys, moving buckets */}
      {[lift.x - 4, lift.x + 4].map((x) => (
        <Box
          key={`lr${x}`}
          trace={trace}
          x={x}
          y={lift.y}
          z={lift.z1}
          w={1}
          d={2.5}
          depth={lift.z1 - top}
        />
      ))}
      <Roller
        P={P}
        trace={trace}
        x={lift.x}
        z={lift.z1 - 3}
        r={3.2}
        y0={lift.y - 2.5}
        y1={lift.y + 3}
        hub={1}
      />
      <Roller
        P={P}
        trace={trace}
        x={lift.x}
        z={lift.z0 + 2}
        r={3.2}
        y0={lift.y - 2.5}
        y1={lift.y + 3}
        hub={1}
      />
      {[lift.x - 3, lift.x + 3].map((x) => (
        <path
          key={`lb${x}`}
          d={trace([
            [x, lift.y + 2.6, lift.z0 + 2],
            [x, lift.y + 2.6, lift.z1 - 3],
          ])}
          strokeWidth="0.5"
          style={{ stroke: FAINT }}
        />
      ))}
      {buckets.map((b) => (
        <Box
          key={`bk${b.i}`}
          trace={trace}
          x={lift.x}
          y={lift.y + 4}
          z={b.z + 2}
          w={2.6}
          d={1.4}
          depth={2}
          stroke={b.color}
          top={`color-mix(in srgb, ${b.color} 40%, ${SURFACE})`}
          width={0.6}
        />
      ))}
      {[22, 40, 58].map((z) => (
        <Box
          key={`brace${z}`}
          trace={trace}
          x={lift.x}
          y={lift.y - 2}
          z={z}
          w={4}
          d={0.6}
          depth={1}
        />
      ))}

      {/* The Vox engine on its plinth */}
      <Box
        trace={trace}
        x={eng.x}
        z={top + 4}
        w={eng.w + 4}
        d={eng.d + 4}
        depth={4}
        fill={alpha("ink", 6)}
      />
      <Box
        trace={trace}
        x={eng.x}
        z={eng.z}
        w={eng.w}
        d={eng.d}
        depth={eng.z - top - 4}
      />
      <path
        d={face(
          quad(
            eng.x - eng.w + 3,
            eng.x + eng.w - 3,
            -eng.d + 3,
            eng.d - 3,
            eng.z,
          ),
        )}
        strokeWidth="0.45"
        style={{ stroke: FAINT }}
      />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b]) =>
        dot(
          [eng.x + a * (eng.w - 1.5), b * (eng.d - 1.5), eng.z],
          0.5,
          LINE,
          `es${a}${b}`,
        ),
      )}
      {/* Front: flywheel, meshing gear, gauge */}
      <g strokeWidth="0.8" strokeLinejoin="round" style={{ stroke: LINE }}>
        <path
          d={trace(
            circle(11).map(([a, b]) => [fw.x + a, fw.y, fw.z + b] as V3),
            true,
          )}
          style={{ fill: SURFACE }}
        />
        <path
          d={trace(
            circle(8.8).map(([a, b]) => [fw.x + a, fw.y, fw.z + b] as V3),
            true,
          )}
          strokeWidth="0.45"
          style={{ fill: "none" }}
        />
        {Array.from({ length: 6 }, (_, i) => {
          const a = spin + (i / 6) * Math.PI * 2;
          return (
            <path
              key={`sp${i}`}
              d={trace([
                [fw.x + Math.cos(a) * 2.2, fw.y, fw.z + Math.sin(a) * 2.2],
                [fw.x + Math.cos(a) * 8.8, fw.y, fw.z + Math.sin(a) * 8.8],
              ])}
            />
          );
        })}
        <path
          d={trace(
            circle(2.2).map(([a, b]) => [fw.x + a, fw.y, fw.z + b] as V3),
            true,
          )}
          style={{ fill: alpha("violet", 30), stroke: token("violet") }}
        />
        <path
          d={face(gear(eng.x + 10, fw.y, 41, 5.4, 10, -spin * 2))}
          style={{ fill: `color-mix(in srgb, ${LINE} 8%, ${SURFACE})` }}
        />
        {dot([eng.x + 10, fw.y, 41], 0.9)}
      </g>
      {(() => {
        const g = { x: eng.x + 12, z: 22 };
        const needle =
          -Math.PI * 0.8 +
          (speaking ? 0.85 : active ? 0.6 : 0.25) * Math.PI * 0.6 +
          Math.sin(t * 3) * 0.04;
        return (
          <g strokeLinejoin="round">
            <path
              d={trace(
                circle(4.4).map(([a, b]) => [g.x + a, fw.y, g.z + b] as V3),
                true,
              )}
              strokeWidth="0.7"
              style={{ stroke: LINE, fill: SURFACE }}
            />
            {Array.from({ length: 7 }, (_, i) => {
              const a =
                -Math.PI * 0.8 + (i / 6) * Math.PI * 0.6 + Math.PI * 0.3;
              return (
                <path
                  key={`gt${i}`}
                  d={trace([
                    [g.x + Math.cos(a) * 3.2, fw.y, g.z - Math.sin(a) * 3.2],
                    [g.x + Math.cos(a) * 4.2, fw.y, g.z - Math.sin(a) * 4.2],
                  ])}
                  strokeWidth="0.4"
                  style={{ stroke: LINE }}
                />
              );
            })}
            <path
              d={trace([
                [g.x, fw.y, g.z],
                [
                  g.x + Math.cos(needle + Math.PI * 1.1) * 3.4,
                  fw.y,
                  g.z - Math.sin(needle + Math.PI * 1.1) * 3.4,
                ],
              ])}
              strokeWidth="0.7"
              style={{ stroke: token("danger") }}
            />
            {dot([g.x, fw.y, g.z], 0.6)}
          </g>
        );
      })()}
      {/* Side: grille */}
      {Array.from({ length: 7 }, (_, i) => (
        <path
          key={`gr${i}`}
          d={trace([
            [eng.x + eng.w, -13, 22 + i * 3.4],
            [eng.x + eng.w, 9, 22 + i * 3.4],
          ])}
          strokeWidth="1"
          style={{
            stroke: speaking
              ? alpha("violet", Math.round(35 + 55 * lamp))
              : FAINT,
          }}
        />
      ))}
      {/* Top: engraved name, hopper, mast */}
      <text
        transform={(() => {
          const [ox, oy] = P([eng.x - 4, 10, eng.z]);
          return `matrix(0.866 0.5 -0.866 0.5 ${fmt(ox)} ${fmt(oy)})`;
        })()}
        fontSize="5.5"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        letterSpacing="1.6"
        textAnchor="middle"
        style={{ fill: alpha("ink", 40) }}
      >
        VOX
      </text>
      <g strokeWidth="0.8" strokeLinejoin="round" style={{ stroke: LINE }}>
        {(() => {
          const h = { x: eng.x - 6, y: -8, z: eng.z };
          return (
            <>
              <path
                d={face([
                  [h.x - 3, h.y + 3, h.z],
                  [h.x + 3, h.y + 3, h.z],
                  [h.x + 7, h.y + 7, h.z + 10],
                  [h.x - 7, h.y + 7, h.z + 10],
                ])}
                style={{ fill: SURFACE }}
              />
              <path
                d={face([
                  [h.x + 3, h.y - 3, h.z],
                  [h.x + 3, h.y + 3, h.z],
                  [h.x + 7, h.y + 7, h.z + 10],
                  [h.x + 7, h.y - 7, h.z + 10],
                ])}
                style={{ fill: `color-mix(in srgb, ${LINE} 8%, ${SURFACE})` }}
              />
              <path
                d={face(quad(h.x - 7, h.x + 7, h.y - 7, h.y + 7, h.z + 10))}
                style={{ fill: alpha("ink", 16) }}
              />
            </>
          );
        })()}
      </g>
      {/* Chute from the elevator head into the hopper */}
      <path
        d={face([
          [chuteA[0], chuteA[1] - 2, chuteA[2]],
          [chuteB[0], chuteB[1] - 2, chuteB[2]],
          [chuteB[0], chuteB[1] + 2, chuteB[2]],
          [chuteA[0], chuteA[1] + 2, chuteA[2]],
        ])}
        strokeWidth="0.75"
        strokeLinejoin="round"
        style={{
          stroke: LINE,
          fill: `color-mix(in srgb, ${LINE} 6%, ${SURFACE})`,
        }}
      />
      {t > 0 && (
        <Box
          trace={trace}
          x={chuteChip[0]}
          y={chuteChip[1]}
          z={chuteChip[2]}
          w={1.8}
          d={1.8}
          depth={1.8}
          stroke={cans[n % cans.length].color}
          top={`color-mix(in srgb, ${cans[n % cans.length].color} 45%, ${SURFACE})`}
          width={0.6}
        />
      )}
      {/* Pipe to the memory tank, with flow */}
      <path
        d={trace(pipe)}
        strokeWidth="3.2"
        strokeLinejoin="round"
        style={{ stroke: LINE }}
      />
      <path
        d={trace(pipe)}
        strokeWidth="1.8"
        strokeLinejoin="round"
        style={{ stroke: SURFACE }}
      />
      <path
        d={trace(pipe)}
        strokeWidth="1"
        strokeDasharray="1.5 3.5"
        strokeDashoffset={-t * 9 * pace}
        style={{ stroke: token("violet") }}
      />
      {[pipe[1], pipe[2]].map((p, i) => dot(p, 1.7, LINE, `pj${i}`))}
      {/* Mast and signal */}
      <path
        d={trace([
          [mast.x, mast.y, eng.z],
          [mast.x, mast.y, eng.z + 22],
        ])}
        strokeWidth="1"
        style={{ stroke: LINE }}
      />
      <Box
        trace={trace}
        x={mast.x}
        y={mast.y}
        z={eng.z + 2}
        w={2.4}
        d={2.4}
        depth={2}
      />
      <circle
        cx={mx}
        cy={my}
        r="6"
        style={{ fill: alpha("violet", 22), opacity: lamp }}
      />
      <circle
        cx={mx}
        cy={my}
        r="2"
        strokeWidth="0.7"
        style={{
          stroke: token("violet"),
          fill: `color-mix(in srgb, ${token("violet")} ${Math.round(lamp * 100)}%, ${SURFACE})`,
        }}
      />
      {speaking &&
        [1, 2, 3].map((k) => {
          const ph = (t * 1.4 + k / 3) % 1;
          const r = 4 + ph * 12;
          return (
            <g
              key={`sig${k}`}
              fill="none"
              strokeWidth="0.8"
              opacity={1 - ph}
              style={{ stroke: token("violet") }}
            >
              <path
                d={`M${fmt(mx - r)},${fmt(my - r * 0.5)} A${r},${r} 0 0 1 ${fmt(mx - r)},${fmt(my + r * 0.5)}`}
              />
              <path
                d={`M${fmt(mx + r)},${fmt(my - r * 0.5)} A${r},${r} 0 0 0 ${fmt(mx + r)},${fmt(my + r * 0.5)}`}
              />
            </g>
          );
        })}

      {/* Belt B out of the engine */}
      {beltX(B, 4, "B")}
      {t > 0 && cardOnB && (
        <Box
          trace={trace}
          x={cardPos[0]}
          y={cardPos[1]}
          z={cardPos[2] + 1}
          w={3.4}
          d={2.6}
          depth={1}
          stroke={token(target.color)}
          top={`color-mix(in srgb, ${token(target.color)} 30%, ${SURFACE})`}
          width={0.6}
        />
      )}
      {beltFront(B, 4)}

      {/* Sorter: turntable with a swinging deflector */}
      <Can
        P={P}
        trace={trace}
        x={tt.x}
        y={tt.y}
        z0={top}
        z1={tt.z - 3}
        r={4}
        fill={alpha("ink", 6)}
      />
      <Can
        P={P}
        trace={trace}
        x={tt.x}
        y={tt.y}
        z0={tt.z - 3}
        z1={tt.z}
        r={tt.r}
      />
      {Array.from({ length: 12 }, (_, i) => {
        const a = spin * 0.3 + (i / 12) * Math.PI * 2;
        return (
          <path
            key={`tt${i}`}
            d={trace([
              [
                tt.x + Math.cos(a) * (tt.r - 2.2),
                tt.y + Math.sin(a) * (tt.r - 2.2),
                tt.z,
              ],
              [
                tt.x + Math.cos(a) * (tt.r - 0.6),
                tt.y + Math.sin(a) * (tt.r - 0.6),
                tt.z,
              ],
            ])}
            strokeWidth="0.4"
            style={{ stroke: LINE }}
          />
        );
      })}
      <path
        d={trace([
          [tt.x, tt.y, tt.z + 2],
          [
            tt.x + Math.cos(arm) * (tt.r + 2),
            tt.y + Math.sin(arm) * (tt.r + 2),
            tt.z + 2,
          ],
        ])}
        strokeWidth="1.6"
        style={{ stroke: token(target.color) }}
      />
      {dot([tt.x, tt.y, tt.z + 2], 1.8, LINE)}

      {/* Trays */}
      {OUTPUTS.map((o, i) => {
        const c = token(o.color);
        const landing = i === out && t > 0 && u > 0.85;
        return (
          <g key={`tray${o.color}`}>
            <path
              d={face(quad(o.x - 7, o.x + 7, o.y - 6, o.y + 6, top))}
              style={{ fill: alpha(o.color, 12) }}
            />
            {[0, 1, 2].slice(0, landing ? 3 : 2).map((k) => (
              <path
                key={`st${k}`}
                d={face(
                  quad(
                    o.x - 4.5,
                    o.x + 4.5,
                    o.y - 3.8,
                    o.y + 3.8,
                    top + 1 + k * 1.3,
                  ),
                )}
                strokeWidth="0.55"
                style={{
                  stroke: c,
                  fill: `color-mix(in srgb, ${c} 22%, ${SURFACE})`,
                }}
              />
            ))}
            <g
              strokeWidth="0.8"
              strokeLinejoin="round"
              style={{ stroke: c, fill: SURFACE }}
            >
              <path
                d={face([
                  [o.x - 7, o.y + 6, top],
                  [o.x + 7, o.y + 6, top],
                  [o.x + 7, o.y + 6, top + 5],
                  [o.x - 7, o.y + 6, top + 5],
                ])}
              />
              <path
                d={face([
                  [o.x + 7, o.y - 6, top],
                  [o.x + 7, o.y + 6, top],
                  [o.x + 7, o.y + 6, top + 5],
                  [o.x + 7, o.y - 6, top + 5],
                ])}
                style={{ fill: alpha(o.color, 14) }}
              />
            </g>
          </g>
        );
      })}
      {t > 0 && !cardOnB && u < 0.88 && (
        <Box
          trace={trace}
          x={cardPos[0]}
          y={cardPos[1]}
          z={cardPos[2] + 1}
          w={3.4}
          d={2.6}
          depth={1}
          stroke={token(target.color)}
          top={`color-mix(in srgb, ${token(target.color)} 30%, ${SURFACE})`}
          width={0.6}
        />
      )}
    </Figure>
  );
}
