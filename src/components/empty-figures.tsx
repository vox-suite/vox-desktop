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
  { color: "gold", x: -82, w: 12, h: 18 },
  { color: "mint", x: -32, w: 14, h: 28 },
  { color: "sky", x: 18, w: 12, h: 20 },
  { color: "violet", x: 66, w: 14, h: 32 },
  { color: "coral", x: 114, w: 11, h: 16 },
];

// A day laid out as a track: today's date at the start, hours along the
// edge, and a Now gate that records entries as it passes.
export function TimelineFigure({ loading = false }: { loading?: boolean }) {
  const t = useClock() * (loading ? 2.2 : 1);
  const P = at(172, 300);
  const trace = makeTrace(P);
  const L = 150;
  const D = 24;
  const top = 8;
  const span = { from: -112, to: 146 };
  const cycle = (t % 10) / 10;
  const nowX = t > 0 ? span.from + cycle * (span.to - span.from) : 34;
  const red = token("danger");
  const sky = token("sky");
  const gateH = 58;
  const face = (pts: V3[]) => trace(pts, true);
  const [px, py] = P([nowX, 0, top + gateH]);
  const [cx, cy] = P([-131, 0, top + 22]);

  const gate = (
    <g key="gate">
      <path
        d={face([
          [nowX, -D - 6, top],
          [nowX, D + 6, top],
          [nowX, D + 6, top + gateH],
          [nowX, -D - 6, top + gateH],
        ])}
        style={{ fill: alpha("danger", 5), stroke: "none" }}
      />
      <path
        d={trace([
          [nowX, -D - 6, top],
          [nowX, -D - 6, top + gateH],
          [nowX, D + 6, top + gateH],
          [nowX, D + 6, top],
        ])}
        strokeWidth="1.1"
        strokeLinejoin="round"
        style={{ stroke: red }}
      />
      <path
        d={trace([
          [nowX, -D, top],
          [nowX, D, top],
        ])}
        strokeWidth="1.4"
        style={{ stroke: red }}
      />
      <rect
        x={px - 14}
        y={py - 19}
        width="28"
        height="13"
        rx="6.5"
        style={{ fill: red }}
      />
      <text
        x={px}
        y={py - 9.6}
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

  const entries = ENTRIES.map((b) => {
    const done = b.x + b.w < nowX;
    return {
      key: b.x,
      node: done ? (
        <Box
          key={b.x}
          trace={trace}
          x={b.x}
          z={top + b.h}
          w={b.w}
          d={12}
          depth={b.h}
          stroke={token(b.color)}
          fill={`color-mix(in srgb, ${token(b.color)} 8%, ${SURFACE})`}
          top={`color-mix(in srgb, ${token(b.color)} 24%, ${SURFACE})`}
          width={0.9}
        />
      ) : (
        <path
          key={b.x}
          d={face([
            [b.x - b.w, -12, top],
            [b.x + b.w, -12, top],
            [b.x + b.w, 12, top],
            [b.x - b.w, 12, top],
          ])}
          strokeWidth="0.7"
          strokeDasharray="2 2.5"
          style={{ stroke: alpha("ink", 32) }}
        />
      ),
    };
  });
  const scene = [...entries, { key: nowX, node: gate }].sort(
    (a, b) => a.key - b.key,
  );

  return (
    <Figure
      height={300}
      label="A day laid out as a track: today's date, the hours of the day, and a Now gate recording entries as it moves along"
    >
      <Box trace={trace} z={top} w={L} d={D} depth={9} />
      <path
        d={trace([
          [-L + 4, -D + 4, top],
          [L - 4, -D + 4, top],
        ])}
        strokeWidth="0.6"
        strokeDasharray="2 4"
        style={{ stroke: FAINT }}
      />
      {Array.from({ length: 25 }, (_, i) => {
        const x = span.from + (i / 24) * (span.to - span.from);
        const major = i % 6 === 0;
        return (
          <path
            key={i}
            d={trace([
              [x, D, top],
              [x, D - (major ? 9 : 5), top],
            ])}
            strokeWidth="0.7"
            style={{ stroke: major ? LINE : FAINT }}
          />
        );
      })}
      {["12a", "6a", "12p", "6p"].map((label, i) => {
        const [x, y] = P([span.from + (i / 4) * (span.to - span.from), D, 0]);
        return (
          <text
            key={i}
            x={x - 8}
            y={y + 12}
            fontSize="7"
            textAnchor="middle"
            style={{ fill: token("text-dim") }}
          >
            {label}
          </text>
        );
      })}

      <Box
        trace={trace}
        x={-131}
        z={top + 22}
        w={14}
        d={18}
        depth={22}
        stroke={sky}
        top={`color-mix(in srgb, ${sky} 16%, ${SURFACE})`}
      />
      <path
        d={face([
          [-145, -18, top + 22],
          [-117, -18, top + 22],
          [-117, -10, top + 22],
          [-145, -10, top + 22],
        ])}
        strokeWidth="0.7"
        style={{ stroke: sky, fill: alpha("sky", 40) }}
      />
      <text
        x={cx + 2}
        y={cy + 6}
        textAnchor="middle"
        fontSize="10"
        fontFamily="Inter, sans-serif"
        fontWeight="600"
        style={{ fill: sky }}
      >
        15
      </text>
      <g className="figure-float">
        <Box
          trace={trace}
          x={-131}
          z={top + 44}
          w={14}
          d={18}
          depth={2}
          stroke={alpha("ink", 32)}
          dash="2 2.5"
          fill="transparent"
        />
      </g>

      {scene.map((item) => item.node)}

      <Callout
        from={P([-131, 18, top + 12])}
        ex={28}
        ey={122}
        id="TODAY"
        title="Thursday, 15"
        note="Opens on the current day"
        dot={sky}
      />
      <Callout
        from={P([-60, D, top - 4])}
        ex={28}
        ey={196}
        id="03 · CATEGORIES"
        title="Colour by kind"
        note="Finance, activity, work, health"
      />
      <Callout
        from={P([L, -D, top - 4])}
        ex={532}
        ey={196}
        id="01 · DAY"
        title="Hour by hour"
        note="Midnight to midnight"
        right
      />
      <Callout
        from={P([132, D, top - 4])}
        ex={532}
        ey={268}
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
