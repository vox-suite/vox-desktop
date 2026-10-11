import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type V3 = [number, number, number];

const S = 3.1;
const SX = 280;
const SY = 300;
const K = 2.5;
const T = 20;
const SLICES = 13;
const N = 96;
const FLOOR = -50;
const LINE = "#c9d1da";
const FAINT = "#3a4048";
const GREEN = "#3ecf8e";

const P = ([x, y, z]: V3) =>
  [SX + (x - y) * 0.866 * S, SY + (x + y) * 0.5 * S - z * S] as const;
const fmt = (n: number) => Math.round(n * 10) / 10;
const path = (pts: V3[], close = false) =>
  pts
    .map((p, i) => {
      const [x, y] = P(p);
      return `${i ? "L" : "M"}${fmt(x)},${fmt(y)}`;
    })
    .join("") + (close ? "Z" : "");

const heart = (t: number) => [
  16 * Math.sin(t) ** 3,
  13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t) +
    2.5,
];
const at = (t: number, y: number, k: number): V3 => {
  const [hx, hy] = heart(t);
  const s = Math.pow(Math.max(0, 1 - (y / T) ** 2), 0.4);
  return [hx * K * k * s, y, hy * K * k * s];
};

const beat = (p: number) =>
  0.1 * Math.exp(-(((p - 0.18) / 0.03) ** 2)) -
  0.12 * Math.exp(-(((p - 0.43) / 0.012) ** 2)) +
  0.46 * Math.exp(-(((p - 0.47) / 0.011) ** 2)) -
  0.16 * Math.exp(-(((p - 0.51) / 0.013) ** 2)) +
  0.16 * Math.exp(-(((p - 0.7) / 0.04) ** 2));

const CALLOUTS = [
  {
    id: "01",
    name: "LISTENING",
    value: "52 hrs",
    label: "Music listened",
    t: Math.PI * 2 - 0.55,
    side: "left",
    ly: 78,
    pct: 72,
  },
  {
    id: "02",
    name: "GAMING",
    value: "34 hrs",
    label: "Play time tracked",
    t: 0.55,
    side: "right",
    ly: 60,
    pct: 89,
  },
  {
    id: "03",
    name: "SPEND",
    value: "₹18.4K",
    label: "Spending categorised",
    t: Math.PI * 2 - 1.55,
    side: "left",
    ly: 250,
    pct: 64,
  },
  {
    id: "04",
    name: "ACTIVITY",
    value: "8.2K steps",
    label: "Steps and movement",
    t: 1.55,
    side: "right",
    ly: 235,
    pct: 91,
  },
  {
    id: "05",
    name: "SLEEP",
    value: "7h 20m",
    label: "Rest and recovery",
    t: Math.PI,
    side: "right",
    ly: 460,
    pct: 83,
  },
] as const;

function useClock(interval = 50) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      if (time - last < interval) return;
      last = time;
      setT(time / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [interval]);
  return t;
}

function PulseHeart() {
  const t = useClock();
  const cycle = (t % 1.2) / 1.2;
  const beatPulse =
    Math.exp(-(((cycle - 0.1) / 0.06) ** 2)) +
    0.5 * Math.exp(-(((cycle - 0.3) / 0.07) ** 2));
  const k = 1 + 0.045 * beatPulse;
  const sweep = (cycle - 0.04) / 0.8;
  const ys = Array.from(
    { length: SLICES },
    (_, i) => -T + (2 * T * (i + 0.5)) / SLICES,
  );
  const reds = ys.map((_, i) => {
    const dist = Math.abs(i - (SLICES - 1) / 2) / ((SLICES - 1) / 2);
    return (
      Math.exp(-(((sweep - dist) / 0.12) ** 2)) *
      (sweep > -0.2 && sweep < 1.2 ? 1 : 0)
    );
  });
  const slices = ys.map((y) => ({
    y,
    d: path(
      Array.from({ length: N }, (_, i) => at((i / N) * Math.PI * 2, y, k)),
      true,
    ),
  }));
  const ribs = Array.from({ length: 28 }, (_, r) => {
    const tt = (r / 28) * Math.PI * 2;
    return path([-T, ...ys, T].map((y) => at(tt, y, k)));
  }).join("");
  const ecg = Array.from({ length: 120 }, (_, i): V3 => {
    const x = -72 + (i / 119) * 144;
    const phase = (((((x + 72) / 144) * 1.3 - t * 0.12) % 1) + 1) % 1;
    return [x, 0, beat(phase) * 70];
  });
  const [fx, fy] = P([0, 0, FLOOR]);
  return (
    <svg
      viewBox="0 0 560 570"
      role="img"
      aria-label="A wireframe heart with a heartbeat line through it and metrics for music, gaming, spending, activity and sleep"
      className="w-full"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
    >
      <ellipse
        cx={fx}
        cy={fy}
        rx="74"
        ry="40"
        fill="none"
        stroke={FAINT}
        strokeWidth="0.7"
        strokeDasharray="2 5"
      />
      <path
        d={path([
          [0, 0, FLOOR],
          [0, 0, at(Math.PI, 0, 1)[2]],
        ])}
        stroke={FAINT}
        strokeWidth="0.7"
        strokeDasharray="3 4"
      />
      <path
        d={ribs}
        fill="none"
        stroke={LINE}
        strokeWidth="0.45"
        opacity="0.28"
      />
      {slices.map(({ y, d }, i) => {
        const g = reds[i];
        const depth = 0.2 + 0.7 * ((y + T) / (2 * T));
        const r = Math.round(201 + 54 * g);
        const gr = Math.round(209 - 119 * g);
        const bl = Math.round(218 - 115 * g);
        return (
          <path
            key={y}
            d={d}
            fill="none"
            stroke={`rgb(${r},${gr},${bl})`}
            strokeWidth={0.7 + 0.5 * g}
            strokeLinejoin="round"
            opacity={Math.min(1, depth + 0.6 * g)}
          />
        );
      })}
      <path
        d={path(ecg)}
        fill="none"
        stroke={GREEN}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {CALLOUTS.map((c, n) => {
        const [ax, ay] = P(at(c.t, 0, k));
        const right = c.side === "right";
        const ex = right ? 532 : 28;
        const dir = right ? 1 : -1;
        const ex1 = ax + dir * Math.abs(c.ly - ay);
        const pct = Math.max(
          1,
          Math.min(100, c.pct + Math.round(2 * Math.sin(t * 0.8 + n * 2))),
        );
        const x0 = right ? ex - 72 : ex;
        return (
          <g key={c.id}>
            <path
              d={`M${fmt(ax)},${fmt(ay)} L${fmt(ex1)},${c.ly} H${ex}`}
              fill="none"
              stroke="#e8eaed"
              strokeWidth="0.9"
            />
            <circle cx={ax} cy={ay} r="2.2" fill="#e8eaed" />
            <g textAnchor={right ? "end" : "start"}>
              <text
                x={ex}
                y={c.ly - 22}
                fill="#8a929c"
                fontSize="8.5"
                letterSpacing="1.4"
              >
                {c.id} · {c.name}
              </text>
              <text
                x={ex}
                y={c.ly - 8}
                fill="#e8eaed"
                fontSize="11"
                fontFamily="Inter, sans-serif"
                fontWeight="500"
              >
                {c.label}
              </text>
            </g>
            <rect
              x={x0}
              y={c.ly + 6}
              width="72"
              height="14"
              fill="#3ecf8e1a"
              stroke="#3ecf8e55"
              strokeWidth="0.6"
            />
            <rect
              x={x0}
              y={c.ly + 6}
              width={(72 * pct) / 100}
              height="14"
              fill="#3ecf8e40"
            />
            <text x={x0 + 6} y={c.ly + 16.5} fill={GREEN} fontSize="9">
              {c.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PulseIntroduction({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="relative isolate -m-4 flex flex-1 overflow-hidden sm:-m-6">
      <div
        aria-hidden="true"
        className="pulse-dots pointer-events-none absolute inset-0 -z-10"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 items-center px-12 py-12">
        <div className="relative z-10 flex max-w-sm flex-col items-start text-left">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            PULSE
          </span>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight">
            Your life, as a living chart.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pulse turns your connected apps into small, live charts — what you
            listen to, what you play, where your money goes.
          </p>
          <Button
            onClick={onCreate}
            size="lg"
            className="mt-7 gap-2 rounded-full px-6"
          >
            <Plus className="size-4" />
            Add your first chart
          </Button>
        </div>
        <div className="pointer-events-none absolute -right-4 top-1/2 z-0 w-[min(620px,56%)] -translate-y-1/2 [mask-image:linear-gradient(to_right,transparent,black_14%)]">
          <PulseHeart />
        </div>
      </div>
    </section>
  );
}
