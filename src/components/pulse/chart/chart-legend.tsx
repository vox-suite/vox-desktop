export function ChartLegend({
  points,
  colors,
  unit,
}: {
  points: { label: string; value?: number | null }[];
  colors: string[];
  unit?: string;
}) {
  if (!points.length) return null;

  return (
    <>
      <div className="pulse-legend">
        {points.slice(0, 5).map((point, index) => (
          <div className="pulse-legend-row" key={point.label}>
            <i style={{ background: colors[index % colors.length] }} />
            <span>{point.label}</span>
            <b>
              {point.value?.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              {unit}
            </b>
          </div>
        ))}
      </div>
      {points.length > 5 && (
        <details className="pulse-chart-foot">
          <summary>All {points.length} groups</summary>
          <div className="pulse-legend">
            {points.slice(5).map((point, index) => (
              <div className="pulse-legend-row" key={point.label}>
                <i
                  style={{ background: colors[(index + 5) % colors.length] }}
                />
                <span>{point.label}</span>
                <b>
                  {point.value?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {unit}
                </b>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
