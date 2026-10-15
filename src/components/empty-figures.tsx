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
  height = 570,
  children,
}: {
  label: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 560 ${height}`}
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

const ENTRIES: { color: VoxColor; x: number; w: number; h: number }[] = [
  { color: "slate", x: -128, w: 9, h: 10 },
  { color: "gold", x: -102, w: 6, h: 18 },
  { color: "mint", x: -78, w: 12, h: 26 },
  { color: "sky", x: -44, w: 16, h: 14 },
  { color: "sky", x: -12, w: 8, h: 22 },
  { color: "violet", x: 14, w: 10, h: 30 },
  { color: "gold", x: 40, w: 6, h: 12 },
  { color: "mint", x: 64, w: 11, h: 20 },
  { color: "coral", x: 92, w: 8, h: 16 },
  { color: "violet", x: 118, w: 12, h: 24 },
];

// A day pulled apart: the month it sits in, the hours that fill it, and the
// moment entries arrive.
export function TimelineFigure() {
  const t = useClock();
  const P = at(418);
  const trace = makeTrace(P);
  const cycle = (t % 9) / 9;
  const nowX = -140 + cycle * 280;
  const dayZ = 196;
  const dialZ = 312;
  const sky = token("sky");
  const red = token("danger");

  const month = { w: 122, d: 90 };
  const cols = 7;
  const rows = 5;
  const cw = (2 * month.w - 24) / cols;
  const ch = (2 * month.d - 24) / rows;
  const origin = (c: number, r: number) =>
    [-month.w + 12 + c * cw + 2, -month.d + 12 + r * ch + 2] as const;
  const cell = (c: number, r: number): V3[] => {
    const [x0, y0] = origin(c, r);
    return [
      [x0, y0, 0],
      [x0 + cw - 4, y0, 0],
      [x0 + cw - 4, y0 + ch - 4, 0],
      [x0, y0 + ch - 4, 0],
    ];
  };
  const today = { c: 3, r: 2 };
  const busy = new Set([
    "0,1",
    "1,0",
    "2,2",
    "4,1",
    "5,3",
    "1,3",
    "6,0",
    "2,4",
    "0,3",
  ]);
  const hand = (len: number, turns: number) => {
    const a = turns * Math.PI * 2 - Math.PI / 2;
    return trace([
      [0, 0, dialZ],
      [Math.cos(a) * len, Math.sin(a) * len, dialZ],
    ]);
  };
  const [ncx, ncy] = P([nowX, 30, dayZ + 36]);
  const [hx, hy] = P([0, 0, dialZ]);
  const [tx, ty] = origin(today.c, today.r);
  const [lx, ly] = P([tx + cw / 2 - 2, ty + ch / 2 - 2, 0]);
  const lift = (n: number) => Math.sin(t * 0.9 + n) * 2.5;

  return (
    <Figure label="An exploded view of a day: a month grid, an hour-by-hour strip filling with entries, and a clock marking now">
      <g strokeWidth="0.7" strokeDasharray="3 4" style={{ stroke: FAINT }}>
        {[
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([sx, sy]) => (
          <path
            key={`${sx}${sy}`}
            d={trace([
              [sx * 146, sy * 30, dayZ - 7],
              [sx * month.w, sy * month.d, 0],
            ])}
          />
        ))}
        <path
          d={trace([
            [0, 0, 0],
            [0, 0, dialZ],
          ])}
        />
      </g>

      <g transform={`translate(0 ${lift(0)})`}>
        <Box trace={trace} z={0} w={month.w} d={month.d} depth={9} />
        {Array.from({ length: cols * rows }, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const isToday = c === today.c && r === today.r;
          const has = busy.has(`${c},${r}`);
          return (
            <path
              key={i}
              d={trace(cell(c, r), true)}
              strokeWidth={isToday ? 1.2 : 0.6}
              style={{
                stroke: isToday ? sky : has ? LINE : FAINT,
                fill: isToday
                  ? alpha("sky", 18)
                  : has
                    ? alpha("ink", 5)
                    : "none",
              }}
            />
          );
        })}
        <text
          x={lx}
          y={ly + 3}
          textAnchor="middle"
          fontSize="8"
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          style={{ fill: sky }}
        >
          15
        </text>
        <Callout
          from={P([-month.w, 0, 0])}
          ex={28}
          ey={470}
          id="01 · MONTH"
          title="Every day at a glance"
          note="Busy days stand out"
        />
        <Callout
          from={P([tx + cw - 4, ty, 0])}
          ex={532}
          ey={420}
          id="TODAY"
          title="Thursday, 15"
          note="Opens on the current day"
          right
          dot={sky}
        />
      </g>

      <g transform={`translate(0 ${lift(1.6)})`}>
        <Box trace={trace} z={dayZ} w={146} d={30} depth={7} />
        {Array.from({ length: 25 }, (_, i) => {
          const x = -140 + i * (280 / 24);
          return (
            <path
              key={i}
              d={trace([
                [x, -30, dayZ],
                [x, i % 6 === 0 ? -18 : -24, dayZ],
              ])}
              strokeWidth="0.6"
              style={{ stroke: i % 6 === 0 ? LINE : FAINT }}
            />
          );
        })}
        {ENTRIES.map((b, i) => {
          const done = b.x + b.w < nowX;
          return (
            <Box
              key={i}
              trace={trace}
              x={b.x}
              y={4}
              z={dayZ + (done ? b.h : 3)}
              w={b.w}
              d={9}
              depth={done ? b.h : 3}
              stroke={done ? token(b.color) : FAINT}
              fill={done ? SURFACE : "transparent"}
              top={done ? alpha(b.color, 22) : undefined}
              dash={done ? undefined : "2 2.5"}
              width={done ? 0.9 : 0.7}
            />
          );
        })}
        <path
          d={trace([
            [nowX, -30, dayZ],
            [nowX, 30, dayZ],
          ])}
          strokeWidth="1.2"
          style={{ stroke: red }}
        />
        <path
          d={trace([
            [nowX, 30, dayZ],
            [nowX, 30, dayZ + 30],
          ])}
          strokeWidth="1"
          style={{ stroke: red }}
        />
        <rect
          x={ncx - 13}
          y={ncy - 12}
          width="26"
          height="12"
          rx="6"
          style={{ fill: red }}
        />
        <text
          x={ncx}
          y={ncy - 3.4}
          textAnchor="middle"
          fontSize="7"
          fontFamily="Inter, sans-serif"
          fontWeight="600"
          style={{ fill: token("on-accent") }}
        >
          Now
        </text>
        <Callout
          from={P([146, 0, dayZ])}
          ex={532}
          ey={250}
          id="02 · DAY"
          title="Hour by hour"
          note="Finance, activity, work, health"
          right
        />
        <Callout
          from={P([-146, 0, dayZ - 4])}
          ex={28}
          ey={318}
          id="03 · ENTRIES"
          title="Filled as you go"
          note="From your connected sources"
          dot={token("mint")}
        />
      </g>

      <g transform={`translate(0 ${lift(3.2)})`}>
        <Box trace={trace} z={dialZ} w={50} d={50} depth={8} />
        <path
          d={trace(circle(40, 0, 0, dialZ))}
          strokeWidth="0.8"
          style={{ stroke: LINE }}
        />
        <path
          d={trace(circle(30, 0, 0, dialZ))}
          strokeWidth="0.6"
          strokeDasharray="2 3"
          style={{ stroke: FAINT }}
        />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <path
              key={i}
              d={trace([
                [Math.cos(a) * 34, Math.sin(a) * 34, dialZ],
                [Math.cos(a) * 40, Math.sin(a) * 40, dialZ],
              ])}
              strokeWidth={i % 3 === 0 ? 1.1 : 0.6}
              style={{ stroke: LINE }}
            />
          );
        })}
        <path d={hand(20, t / 60)} strokeWidth="1.6" style={{ stroke: LINE }} />
        <path d={hand(30, t / 9)} strokeWidth="1" style={{ stroke: red }} />
        <circle cx={hx} cy={hy} r="2.2" style={{ fill: red }} />
        <Callout
          from={P([-50, 0, dialZ])}
          ex={28}
          ey={128}
          id="04 · NOW"
          title="Entries land as they happen"
          note="Nothing recorded yet"
          dot={red}
        />
      </g>
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
