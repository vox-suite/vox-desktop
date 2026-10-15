import { useEffect, useState } from "react";
import { Activity, ArrowRight, Plug } from "lucide-react";
import { desktopStore } from "@/features/desktop-control/store";
import { alpha, token } from "@/lib/theme";

type V3 = [number, number, number];

const S = 3.1;
const SX = 280;
const SY = 300;
const K = 2.5;
const T = 20;
const SLICES = 13;
const N = 96;
const FLOOR = -50;
const LINE = alpha("ink", 80);
const FAINT = token("border-strong");
const GREEN = token("mint");
const LABEL = alpha("ink", 90);

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

export function PulseHeart({ speed = 1 }: { speed?: number }) {
  const t = useClock() * speed;
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

        strokeWidth="0.7"
        strokeDasharray="2 5"
        style={{ stroke: FAINT }}
      />
      <path
        d={path([
          [0, 0, FLOOR],
          [0, 0, at(Math.PI, 0, 1)[2]],
        ])}

        strokeWidth="0.7"
        strokeDasharray="3 4"
        style={{ stroke: FAINT }}
      />
      <path
        d={ribs}
        fill="none"

        strokeWidth="0.45"
        opacity="0.28"
        style={{ stroke: LINE }}
      />
      {slices.map(({ y, d }, i) => {
        const g = reds[i];
        const depth = 0.2 + 0.7 * ((y + T) / (2 * T));
        return (
          <path
            key={y}
            d={d}
            fill="none"

            strokeWidth={0.7 + 0.5 * g}
            strokeLinejoin="round"
            opacity={Math.min(1, depth + 0.6 * g)}
            style={{
              stroke: `color-mix(in srgb, var(--vox-danger) ${Math.round(g * 100)}%, ${LINE})`,
            }}
          />
        );
      })}
      <path
        d={path(ecg)}
        fill="none"

        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ stroke: GREEN }}
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

              strokeWidth="0.9"
              style={{ stroke: LABEL }}
            />
            <circle cx={ax} cy={ay} r="2.2" style={{ fill: LABEL }} />
            <g textAnchor={right ? "end" : "start"}>
              <text
                x={ex}
                y={c.ly - 22}

                fontSize="8.5"
                letterSpacing="1.4"
                style={{ fill: token("text-muted") }}
              >
                {c.id} · {c.name}
              </text>
              <text
                x={ex}
                y={c.ly - 8}

                fontSize="11"
                fontFamily="Inter, sans-serif"
                fontWeight="500"
                style={{ fill: LABEL }}
              >
                {c.label}
              </text>
            </g>
            <rect
              x={x0}
              y={c.ly + 6}
              width="72"
              height="14"

              strokeWidth="0.6"
              style={{ fill: alpha("mint", 10), stroke: alpha("mint", 33) }}
            />
            <rect
              x={x0}
              y={c.ly + 6}
              width={(72 * pct) / 100}
              height="14"
              style={{ fill: alpha("mint", 25) }}
            />
            <text
              x={x0 + 6}
              y={c.ly + 16.5}
              fontSize="9"
              style={{ fill: GREEN }}
            >
              {c.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const BARS = [38, 62, 46, 80, 54, 92, 70];

export function PulseIntroduction({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="start [--start-accent:var(--vox-mint)]">
      <header className="start-head">
        <div>
          <p className="start-kicker">Insights</p>
          <h2 className="mt-3 text-[28px] font-medium leading-tight tracking-tight">
            Your life, as a living chart.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Insights turn your connected apps into small, live charts — what you
          listen to, what you play, where your money goes.
        </p>
      </header>
      <div className="start-bento">
        <button className="start-tile start-tile-feature" onClick={onCreate}>
          <div className="start-tile-art">
            <PulseHeart />
          </div>
          <div className="start-tile-body">
            <span className="start-tile-icon">
              <Activity className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-medium">Ask for a chart</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Describe what you want to track. Vox builds a live chart from
                your connected apps and keeps it up to date.
              </p>
            </div>
            <span className="start-tile-cta start-tile-cta-primary">
              Add your first chart
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </button>
        <button
          className="start-tile"
          onClick={() => desktopStore.navigate("connections")}
        >
          <div className="start-panel" aria-hidden="true">
            <span className="start-panel-title">Sources</span>
            {["Music", "Games", "Spending", "Health"].map((name, i) => (
              <span key={name} className="flex items-center gap-2 text-xs">
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    background:
                      i < 2 ? "var(--vox-mint)" : "var(--vox-border-strong)",
                  }}
                />
                <span className={i < 2 ? "" : "text-muted-foreground"}>
                  {name}
                </span>
              </span>
            ))}
          </div>
          <span className="start-tile-icon">
            <Plug className="size-4" />
          </span>
          <h3 className="mt-4 text-base font-medium">Connect your apps</h3>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Charts draw from the apps you connect. The more you link, the more
            Vox can show you.
          </p>
          <span className="start-tile-cta mt-5">
            Connected apps
            <ArrowRight className="size-3.5" />
          </span>
        </button>
        <div className="start-tile start-tile-preview">
          <div className="grid grid-cols-2 gap-2" aria-hidden="true">
            {[0, 1].map((n) => (
              <div key={n} className="start-ghost flex-col items-stretch">
                <span className="start-line w-[60%]" />
                <div className="mt-3 flex h-12 items-end gap-1">
                  {BARS.map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${n ? 100 - h + 20 : h}%`,
                        background:
                          "color-mix(in oklab, var(--vox-mint) 22%, transparent)",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Your charts will live here and refresh on their own.
          </p>
        </div>
      </div>
    </div>
  );
}
