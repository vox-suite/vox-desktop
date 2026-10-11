import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const CX = 280;
const T = 10;
const GAP = 118;
const LINE = "#9aa3ae";
const FAINT = "#3a4048";
const YELLOW = "#f5b83d";
const RED = "#ff5a67";

type Layer = {
  id: string;
  title: string;
  note: string;
  side: "left" | "right";
  w: number;
};

// Top to bottom: the stack narrows toward the plan, like a funnel.
const LAYERS: Layer[] = [
  {
    id: "04",
    title: "A clear plan",
    note: "Findings joined to a decision",
    side: "left",
    w: 96,
  },
  {
    id: "03",
    title: "Your context",
    note: "Data, files, preferences",
    side: "right",
    w: 118,
  },
  {
    id: "02",
    title: "Web research",
    note: "Agents search in parallel",
    side: "left",
    w: 140,
  },
  {
    id: "01",
    title: "Your vision",
    note: "What you want to explore",
    side: "right",
    w: 164,
  },
];

const cyOf = (i: number) => 76 + i * GAP;

const AMBER_HEX = "#f5b83d";
const BASE: [number, number, number] = [154, 163, 174];
const AMBER: [number, number, number] = [245, 184, 61];
const mix = (g: number, from = BASE) =>
  `rgb(${from.map((c, k) => Math.round(c + (AMBER[k] - c) * g)).join(",")})`;

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

function Plate({ cy, w, g }: { cy: number; w: number; g: number }) {
  const h = w / 2;
  return (
    <g
      fill="#0a0b0c"
      stroke={mix(g)}
      strokeWidth={0.8 + 0.6 * g}
      strokeLinejoin="round"
    >
      <path
        d={`M${CX - w},${cy} L${CX - w},${cy + T} L${CX},${cy + h + T} L${CX + w},${cy + T} L${CX + w},${cy} L${CX},${cy + h} Z`}
      />
      <path d={`M${CX},${cy + h} L${CX},${cy + h + T}`} />
      <path
        d={`M${CX},${cy - h} L${CX + w},${cy} L${CX},${cy + h} L${CX - w},${cy} Z`}
      />
      <path
        d={`M${CX},${cy - h + 9} L${CX + w - 18},${cy} L${CX},${cy + h - 9} L${CX - w + 18},${cy} Z`}
        stroke={FAINT}
      />
    </g>
  );
}

function Ring({
  cy,
  rx,
  stroke = LINE,
  dash,
}: {
  cy: number;
  rx: number;
  stroke?: string;
  dash?: string;
}) {
  return (
    <ellipse
      cx={CX}
      cy={cy}
      rx={rx}
      ry={rx / 2}
      fill="none"
      stroke={stroke}
      strokeWidth="0.8"
      strokeDasharray={dash}
    />
  );
}

function Vision({ cy, w }: { cy: number; w: number }) {
  return (
    <g>
      <Ring cy={cy} rx={w * 0.46} />
      <Ring cy={cy} rx={w * 0.3} dash="2 3" />
      <Ring cy={cy} rx={w * 0.14} />
      <path
        d={`M${CX - w * 0.6},${cy} H${CX + w * 0.6} M${CX},${cy - w * 0.3} V${cy + w * 0.3}`}
        stroke={FAINT}
        strokeWidth="0.8"
      />
      <path d={`M${CX},${cy - 9} l9,9 l-9,9 l-9,-9 Z`} fill={YELLOW} />
    </g>
  );
}

function Research({ cy, w }: { cy: number; w: number }) {
  const r = w * 0.44;
  const dots = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { x: CX + Math.cos(a) * r, y: cy + (Math.sin(a) * r) / 2 };
  });
  return (
    <g>
      <Ring cy={cy} rx={r} />
      <Ring cy={cy} rx={r * 0.5} stroke={FAINT} />
      {dots.map((d, i) => (
        <g key={i}>
          <line
            x1={CX}
            y1={cy}
            x2={d.x}
            y2={d.y}
            stroke={FAINT}
            strokeWidth="0.7"
          />
          <circle
            cx={d.x}
            cy={d.y}
            r={i % 4 === 0 ? 2.6 : 1.8}
            fill={i === 3 ? RED : LINE}
          />
        </g>
      ))}
    </g>
  );
}

function Context({ cy, w }: { cy: number; w: number }) {
  const rx = w * 0.26;
  const cube = (x: number, y: number) =>
    `M${x},${y - 5} L${x + 10},${y} L${x},${y + 5} L${x - 10},${y} Z M${x - 10},${y} V${y + 9} L${x},${y + 14} L${x + 10},${y + 9} V${y} M${x},${y + 5} V${y + 14}`;
  return (
    <g fill="none" stroke={LINE} strokeWidth="0.8">
      <path
        d={`M${CX - rx},${cy - 14} V${cy + 14} A${rx},${rx / 2} 0 0 0 ${CX + rx},${cy + 14} V${cy - 14}`}
      />
      <path
        d={`M${CX - rx},${cy} A${rx},${rx / 2} 0 0 0 ${CX + rx},${cy}`}
        stroke={FAINT}
      />
      <Ring cy={cy - 14} rx={rx} />
      <path d={cube(CX - w * 0.5, cy - 2)} stroke={FAINT} />
      <path d={cube(CX + w * 0.5, cy - 6)} stroke={FAINT} />
    </g>
  );
}

function Plan({ cy }: { cy: number }) {
  return (
    <g fill="none" strokeWidth="0.8">
      <path d={`M${CX},${cy + 6} V${cy - 30}`} stroke={LINE} />
      <path
        d={`M${CX},${cy - 30} L${CX + 20},${cy - 23} L${CX},${cy - 16} Z`}
        fill={YELLOW}
        stroke="none"
      />
      {[0, 1, 2].map((k) => {
        const x = CX - 26 - k * 9;
        const y = cy - 2 + k * 4.5;
        return (
          <g key={k} stroke={k === 0 ? LINE : FAINT}>
            <path d={`M${x - 12},${y - 6} l6,3 l6,-3 l-6,-3 Z`} />
            <path d={`M${x},${y} l${34 - k * 6},${(34 - k * 6) / 2}`} />
          </g>
        );
      })}
    </g>
  );
}

const CONTENT = [Plan, Context, Research, Vision];

export function SpacesIntroduction({ onCreate }: { onCreate: () => void }) {
  const t = useClock();
  const sweep = ((t % 4.5) / 4.5) * 1.5 - 0.15;
  const glow = (i: number) => Math.exp(-(((sweep - (3 - i) / 3) / 0.14) ** 2));
  return (
    <section className="relative isolate -m-6 flex flex-1 overflow-hidden">
      <div
        aria-hidden="true"
        className="spaces-dots pointer-events-none absolute inset-0 -z-10"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 items-center px-12 py-12">
        <div className="relative z-10 flex max-w-md flex-col items-start text-left">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            SPACES
          </span>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Think it through, layer by layer.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Start with a vision. Agents research in parallel, build on each
            other’s findings, and stack everything into a plan you can act on.
          </p>
          <Button
            onClick={onCreate}
            size="lg"
            className="mt-7 gap-2 rounded-full px-6"
          >
            <Plus className="size-4" />
            Create a space
          </Button>
        </div>

        <div className="pointer-events-none absolute -right-4 top-1/2 z-0 w-[min(640px,58%)] [mask-image:linear-gradient(to_right,transparent,black_28%)] -translate-y-1/2">
          <svg
            viewBox="0 0 560 570"
            role="img"
            aria-label="Exploded view of a space: vision, web research, context and plan stacked as layers"
            className="w-full"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            <defs>
              <marker
                id="spaces-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M0 0 L10 5 L0 10"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.4"
                />
              </marker>
            </defs>
            <g
              stroke={FAINT}
              strokeWidth="0.7"
              strokeDasharray="3 4"
              fill="none"
            >
              <path
                d={`M${CX},${cyOf(0) - LAYERS[0].w / 2} V${cyOf(3) + LAYERS[3].w / 2 + T}`}
              />
              {[0, 1, 2].flatMap((i) =>
                [-1, 1].map((sign) => (
                  <path
                    key={`${i}${sign}`}
                    d={`M${CX + sign * LAYERS[i].w},${cyOf(i)} L${CX + sign * LAYERS[i + 1].w},${cyOf(i + 1)}`}
                  />
                )),
              )}
            </g>
            {(t > 0 ? [0, 1, 2] : []).flatMap((i) =>
              [-1, 0, 1].flatMap((sign) =>
                [0, 1].map((n) => {
                  const u =
                    (((t * 0.32 + (n * 0.5 + sign * 0.17 + i * 0.23)) % 1) +
                      1) %
                    1;
                  const lx = (k: number) =>
                    CX +
                    sign *
                      (LAYERS[i + 1].w + (LAYERS[i].w - LAYERS[i + 1].w) * k);
                  const ly = (k: number) =>
                    cyOf(i + 1) + (cyOf(i) - cyOf(i + 1)) * k;
                  const tail = Math.max(0, u - 0.07);
                  return (
                    <g key={`${i}${sign}${n}`} opacity={Math.sin(Math.PI * u)}>
                      <path
                        d={`M${lx(tail)},${ly(tail)} L${lx(u)},${ly(u)}`}
                        stroke={AMBER_HEX}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        opacity="0.5"
                      />
                      <circle cx={lx(u)} cy={ly(u)} r="2" fill={AMBER_HEX} />
                    </g>
                  );
                }),
              ),
            )}
            {[3, 2, 1, 0].map((i) => {
              const layer = LAYERS[i];
              const cy = cyOf(i);
              const Content = CONTENT[i];
              const left = layer.side === "left";
              const vx = left ? CX - layer.w : CX + layer.w;
              const ex = left ? 28 : 532;
              return (
                <g
                  key={layer.id}
                  className="spaces-float"
                  style={{ animationDelay: `${i * -1.1}s` }}
                >
                  <Plate cy={cy} w={layer.w} g={glow(i)} />
                  <Content cy={cy} w={layer.w} />
                  <path
                    d={`M${vx},${cy} L${vx + (left ? -26 : 26)},${cy - 26} H${ex}`}
                    fill="none"
                    stroke={FAINT}
                    strokeWidth="0.8"
                  />
                  <circle cx={vx} cy={cy} r="2" fill={mix(glow(i))} />
                  <g textAnchor={left ? "start" : "end"}>
                    <text
                      x={ex}
                      y={cy - 58}
                      fill={mix(glow(i), [138, 146, 156])}
                      fontSize="8"
                      letterSpacing="1.5"
                    >
                      {layer.id}
                    </text>
                    <text
                      x={ex}
                      y={cy - 45}
                      fill="#e8eaed"
                      fontSize="11"
                      fontFamily="Inter, sans-serif"
                      fontWeight="500"
                    >
                      {layer.title}
                    </text>
                    <text x={ex} y={cy - 33} fill="#7a838e" fontSize="8">
                      {layer.note}
                    </text>
                  </g>
                </g>
              );
            })}
            <path
              className="spaces-flow"
              pathLength="1"
              d={`M${CX + 36},${cyOf(3) - 8} C${CX + 170},${cyOf(3) - 70} ${CX + 170},${cyOf(1) + 10} ${CX + 20},${cyOf(0) + 12}`}
              fill="none"
              stroke="#fff"
              strokeWidth="1.2"
              markerEnd="url(#spaces-arrow)"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
