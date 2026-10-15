import { useEffect, useState, type ReactNode } from "react";
import { alpha, token, type VoxColor } from "@/lib/theme";

type V3 = [number, number, number];

const CX = 280;
const LINE = alpha("ink", 62);
const FAINT = token("border-strong");
const SURFACE = token("surface");
const LABEL = alpha("ink", 90);
const K = 0.78;

const at =
  (cy: number) =>
  ([x, y, z]: V3): [number, number] => [
    CX + (x - y) * 0.866,
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

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 560 570"
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

type Card = {
  id: string;
  title: string;
  note: string;
  color: VoxColor;
  glyph: "attention" | "briefing" | "email" | "connection" | "plan";
};

const CARDS: Card[] = [
  {
    id: "05 · PLANS",
    title: "Plans",
    note: "Daily plans when they are ready",
    color: "violet",
    glyph: "plan",
  },
  {
    id: "04 · CONNECTIONS",
    title: "Connections",
    note: "Apps that need a nudge",
    color: "mint",
    glyph: "connection",
  },
  {
    id: "03 · EMAIL",
    title: "Email",
    note: "Notices worth reading",
    color: "sky",
    glyph: "email",
  },
  {
    id: "02 · BRIEFINGS",
    title: "Briefings",
    note: "Morning summaries",
    color: "gold",
    glyph: "briefing",
  },
  {
    id: "01 · ATTENTION",
    title: "Needs attention",
    note: "Anything waiting on you",
    color: "danger",
    glyph: "attention",
  },
];

// An inbox taken apart: every kind of update has its own layer, and each one
// drops through the stack into the tray until nothing is left waiting.
export function UpdatesFigure() {
  const t = useClock();
  const P = at(470);
  const trace = makeTrace(P);
  const gap = 60;
  const z0 = 66;
  const bellZ = z0 + gap * CARDS.length + 26;
  const cycle = (t % 4.2) / 4.2;
  const dropZ = bellZ - 18 - cycle * (bellZ - 26);
  const glow = (z: number) => Math.exp(-(((dropZ - z) / 22) ** 2));
  const ringing = Math.max(0, 1 - cycle * 4);
  const settled = Math.exp(-(((cycle - 0.97) / 0.05) ** 2));
  const fade = Math.sin(Math.PI * cycle);

  const glyph = (c: Card, z: number, g: number) => {
    const p = (u: number, v: number): V3 => [u * K, v * K, z];
    const s = { stroke: mixTo(token(c.color), 0.55 + g * 0.45, FAINT) };
    switch (c.glyph) {
      case "attention":
        return (
          <g strokeWidth="1" strokeLinejoin="round" style={s}>
            <path d={trace([p(-14, 10), p(0, -14), p(14, 10)], true)} />
            <path d={trace([p(-1, -4), p(-1, 3)])} strokeWidth="1.4" />
            <path d={trace([p(-1, 6.5), p(-1, 7)])} strokeWidth="1.8" />
          </g>
        );
      case "briefing":
        return (
          <g strokeWidth="0.9" style={s}>
            {[-12, -4, 4].map((v, i) => (
              <path key={v} d={trace([p(-24, v), p(i === 2 ? 2 : 10, v)])} />
            ))}
            <path d={trace(circle(7 * K, 22 * K, -6 * K, z))} />
          </g>
        );
      case "email":
        return (
          <g strokeWidth="0.9" strokeLinejoin="round" style={s}>
            <path
              d={trace([p(-24, -14), p(24, -14), p(24, 14), p(-24, 14)], true)}
            />
            <path d={trace([p(-24, -14), p(0, 3), p(24, -14)])} />
          </g>
        );
      case "connection":
        return (
          <g strokeWidth="0.9" style={s}>
            <path d={trace(circle(6 * K, -18 * K, 0, z))} />
            <path d={trace(circle(6 * K, 18 * K, 0, z))} />
            <path d={trace([p(-12, 0), p(12, 0)])} strokeDasharray="2 2.5" />
          </g>
        );
      case "plan":
        return (
          <g strokeWidth="0.9" strokeLinejoin="round" style={s}>
            <path d={trace([p(-16, 12), p(-16, -16)])} />
            <path d={trace([p(-16, -16), p(8, -10), p(-16, -4)], true)} />
            <path d={trace([p(-4, 12), p(22, 12)])} strokeDasharray="2 3" />
          </g>
        );
    }
  };

  const [bx, by] = P([0, 0, bellZ]);
  const [dx, dy] = P([0, 0, dropZ]);
  const [kx, ky] = P([0, 56, 14]);

  return (
    <Figure label="An exploded inbox: needs attention, briefings, email, connections and plans stacked above an empty tray">
      <g strokeWidth="0.7" strokeDasharray="3 4" style={{ stroke: FAINT }}>
        <path
          d={trace([
            [0, 0, 22],
            [0, 0, bellZ - 4],
          ])}
        />
        {[
          [-54, -36],
          [54, -36],
          [54, 36],
          [-54, 36],
        ].map(([x, y]) => (
          <path
            key={`${x}${y}`}
            d={trace([
              [x, y, 22],
              [x, y, z0 + gap * (CARDS.length - 1)],
            ])}
          />
        ))}
      </g>

      <g>
        <Box trace={trace} z={22} w={74} d={56} depth={24} />
        <path
          d={trace(
            [
              [-64, -46, 22],
              [64, -46, 22],
              [64, 46, 22],
              [-64, 46, 22],
            ],
            true,
          )}
          strokeWidth="0.7"
          style={{ stroke: LINE, fill: alpha("ink", 4) }}
        />
        <path
          d={trace([
            [-64, 46, 22],
            [-64, 46, 6],
            [-64, -46, 6],
            [64, -46, 6],
            [64, -46, 22],
          ])}
          strokeWidth="0.6"
          style={{ stroke: FAINT }}
        />
        <g opacity={0.4 + settled * 0.6}>
          <circle cx={kx} cy={ky - 4} r="10" style={{ fill: token("mint") }} />
          <path
            d={`M${fmt(kx - 4.2)},${fmt(ky - 4)} l3,3 l5.6,-6`}
            strokeWidth="1.6"
            strokeLinejoin="round"
            style={{ stroke: token("on-accent") }}
          />
        </g>
        <Callout
          from={P([74, 0, 10])}
          ex={532}
          ey={514}
          id="INBOX"
          title="All caught up"
          note="Read items settle here"
          right
          dot={token("mint")}
        />
      </g>

      {CARDS.map((c, i) => {
        const z = z0 + i * gap;
        const g = glow(z);
        const right = i % 2 === 1;
        const base = c.glyph === "attention" ? 0.7 : 0;
        return (
          <g
            key={c.id}
            className="figure-float"
            style={{ animationDelay: `${i * -0.7}s` }}
          >
            <Box
              trace={trace}
              z={z}
              w={54}
              d={36}
              depth={5}
              stroke={mixTo(token(c.color), g * 0.9 + base)}
              top={alpha(c.color, Math.round(3 + g * 12))}
              width={0.85 + g * 0.5}
            />
            {glyph(c, z, Math.max(g, base))}
            <Callout
              from={P(right ? [54, 8, z] : [-8, 36, z])}
              ex={right ? 532 : 28}
              ey={Math.round(P([0, 0, z])[1] + (right ? -2 : 24))}
              id={c.id}
              title={c.title}
              note={c.note}
              right={right}
              dot={mixTo(token(c.color), 0.5 + g * 0.5, FAINT)}
            />
          </g>
        );
      })}

      <path
        d={`M${fmt(dx)},${fmt(dy - 9)} V${fmt(dy + 9)}`}
        strokeWidth="1.2"
        opacity={fade}
        style={{ stroke: token("orange") }}
      />
      <circle
        cx={dx}
        cy={dy}
        r="3"
        opacity={fade}
        style={{ fill: token("orange") }}
      />

      <g>
        <path
          d={trace(circle(22, 0, 0, bellZ))}
          strokeWidth="0.85"
          style={{ stroke: LINE, fill: SURFACE }}
        />
        <path
          d={`M${bx - 19},${by} C${bx - 19},${by - 30} ${bx - 13},${by - 42} ${bx},${by - 42} C${bx + 13},${by - 42} ${bx + 19},${by - 30} ${bx + 19},${by} Z`}
          strokeWidth="0.85"
          strokeLinejoin="round"
          style={{ stroke: LINE, fill: SURFACE }}
        />
        <path
          d={`M${bx - 19},${by} C${bx - 10},${by + 6} ${bx + 10},${by + 6} ${bx + 19},${by}`}
          strokeWidth="0.85"
          style={{ stroke: LINE }}
        />
        <circle
          cx={bx}
          cy={by - 45}
          r="2.4"
          strokeWidth="0.85"
          style={{ stroke: LINE, fill: SURFACE }}
        />
        <circle cx={bx} cy={by + 6} r="3" style={{ fill: token("orange") }} />
        {[1, 2].map((k) => (
          <g
            key={k}
            strokeWidth="0.9"
            opacity={ringing * (k === 1 ? 1 : 0.55)}
            style={{ stroke: token("orange") }}
          >
            <path d={`M${bx - 26 - k * 6},${by - 30} q-${5 + k * 2},12 0,24`} />
            <path d={`M${bx + 26 + k * 6},${by - 30} q${5 + k * 2},12 0,24`} />
          </g>
        ))}
        <Callout
          from={[bx - 19, by - 16]}
          ex={28}
          ey={Math.round(by - 20)}
          id="SIGNAL"
          title="New updates ring in"
          note="Vox files each one by kind"
          dot={token("orange")}
        />
      </g>
    </Figure>
  );
}
