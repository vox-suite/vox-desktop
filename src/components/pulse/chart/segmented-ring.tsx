export function SegmentedRing({
  points,
  colors,
}: {
  points: { label: string; value?: number | null }[];
  colors: string[];
}) {
  if (points.some((p) => (p.value ?? 0) < 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        Signed values need a bar chart to compare.
      </p>
    );
  }

  const positive = points.filter((p) => (p.value ?? 0) > 0);
  const total = positive.reduce((sum, p) => sum + (p.value ?? 0), 0);
  if (!total) {
    return (
      <p className="text-xs text-muted-foreground">
        No positive values to compare
      </p>
    );
  }

  const largest = positive.reduce((best, p) =>
    (p.value ?? 0) > (best.value ?? 0) ? p : best,
  );

  const segments = positive.map((p, i) => ({
    ...p,
    color: colors[points.indexOf(p) % colors.length],
    end:
      positive
        .slice(0, i + 1)
        .reduce((sum, item) => sum + (item.value ?? 0), 0) / total,
  }));

  return (
    <svg
      viewBox="0 0 260 240"
      className="mx-auto h-full w-full"
      role="img"
      aria-label={`${largest.label}: ${Math.round(((largest.value ?? 0) / total) * 100)} percent of plotted total`}
    >
      {Array.from({ length: 72 }, (_, i) => {
        const segment =
          segments.find((s) => s.end >= (i + 0.5) / 72) ??
          segments[segments.length - 1];
        return (
          <line
            key={i}
            x1="130"
            y1="23"
            x2="130"
            y2="35"
            transform={`rotate(${i * 5} 130 120)`}
            stroke={segment.color}
            strokeWidth="3"
            strokeLinecap="round"
          >
            <title>
              {segment.label}: {segment.value}
            </title>
          </line>
        );
      })}
      <text
        x="130"
        y="117"
        textAnchor="middle"
        fill="#eeeeeb"
        fontSize="40"
        letterSpacing="-2"
      >
        {Math.round(((largest.value ?? 0) / total) * 100)}%
      </text>
      <text x="130" y="140" textAnchor="middle" fill="#a0a6a2" fontSize="11">
        of plotted total
      </text>
      <text x="130" y="158" textAnchor="middle" fill="#a0a6a2" fontSize="11">
        {largest.label.length > 24
          ? largest.label.slice(0, 23) + "…"
          : largest.label}
      </text>
    </svg>
  );
}
