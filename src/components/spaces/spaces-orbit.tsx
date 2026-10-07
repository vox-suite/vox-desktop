const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const TAGS = [
  "IDEA",
  "OPTION",
  "PLAN",
  "BUDGET",
  "RISK",
  "TRIP",
  "ROUTINE",
  "DECISION",
];
const DOTS = ["#cfe3f1", "#cfe3f1", "#cfe3f1", "#ff5a67", "#f5b83d"];
const CX = 560;
const CY = 500;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};

/** Decorative hairline orbit: rings, a month arc, tick marks and a scatter of labelled points. */
export function SpacesOrbit() {
  const random = rng(7);
  const spokes = Array.from({ length: 70 }, (_, i) => {
    const deg = (i / 70) * 360 + random() * 3;
    const inner = 120 + random() * 30;
    const outer = inner + 40 + random() * 230;
    return {
      deg,
      inner,
      outer,
      color: DOTS[Math.floor(random() * DOTS.length)],
      tag: random() > 0.72,
    };
  });
  return (
    <svg
      viewBox="0 0 1120 1000"
      aria-hidden="true"
      className="pointer-events-none absolute -right-[18%] top-1/2 h-[135%] -translate-y-1/2 opacity-60"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
    >
      <defs>
        <path
          id="orbit-month-arc"
          d={`M ${CX} ${CY - 345} A 345 345 0 1 1 ${CX - 0.01} ${CY - 345}`}
        />
      </defs>
      <circle
        cx={CX}
        cy={CY}
        r="108"
        fill="#050608"
        stroke="#2c3138"
        strokeWidth="0.6"
      />
      <circle
        cx={CX}
        cy={CY}
        r="96"
        fill="none"
        stroke="#c9792c"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {[150, 215, 318, 372].map((r) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="#2c3138"
          strokeWidth="0.5"
        />
      ))}
      <circle
        cx={CX}
        cy={CY}
        r="326"
        fill="none"
        stroke="#3a4048"
        strokeWidth="0.5"
      />
      {Array.from({ length: 180 }, (_, i) => {
        const major = i % 5 === 0;
        const [x1, y1] = polar(318, i * 2);
        const [x2, y2] = polar(major ? 332 : 326, i * 2);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#5a626c"
            strokeWidth="0.5"
          />
        );
      })}
      {spokes.map((s, i) => {
        const [x1, y1] = polar(s.inner, s.deg);
        const [x2, y2] = polar(s.outer, s.deg);
        const [tx, ty] = polar(s.outer + 8, s.deg);
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={s.color}
              strokeWidth="0.5"
              opacity="0.55"
            />
            <circle
              cx={x2}
              cy={y2}
              r={s.color === "#cfe3f1" ? 2.2 : 2.8}
              fill={s.color}
            />
            {s.tag && (
              <text
                x={tx}
                y={ty}
                fill="#7a838e"
                fontSize="7"
                letterSpacing="1.2"
                transform={`rotate(${s.deg > 180 ? s.deg + 90 : s.deg - 90} ${tx} ${ty})`}
                textAnchor={s.deg > 180 ? "end" : "start"}
              >
                {TAGS[i % TAGS.length]}{" "}
                {String(10 + ((i * 7) % 90)).padStart(2, "0")}
              </text>
            )}
          </g>
        );
      })}
      <text fill="#aeb7c2" fontSize="11" letterSpacing="10">
        <textPath href="#orbit-month-arc" startOffset="2%">
          {MONTHS.join("        ")}
        </textPath>
      </text>
    </svg>
  );
}
