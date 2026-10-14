import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import {
  clipText,
  formatTotal,
  friendlyDate,
} from "@/features/pulse";
import { useChartPalette } from "./use-chart-palette";
import type { PulseSeries } from "@/features/pulse/discovery-types";
import { seriesMode } from "@/features/pulse/series";

export function MultiSeriesChart({
  series,
  type,
}: {
  series: PulseSeries[];
  type: "line" | "area" | "bar";
}) {
  const palette = useChartPalette();
  const axisTick = { fontSize: 10, fill: palette.axis };
  const mode = seriesMode(series);
  const units = [...new Set(series.map((s) => s.unit))];
  const peaks = series.map((s) =>
    Math.max(1e-9, ...s.points.map((p) => Math.abs(p.value ?? 0))),
  );
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  const data = labels.map((label, row) => {
    const entry: Record<string, string | number | null> = { label };
    series.forEach((s, i) => {
      const value = s.points[row]?.value ?? null;
      entry[`s${i}`] =
        value === null
          ? null
          : mode === "relative"
            ? (value / peaks[i]) * 100
            : value;
    });
    return entry;
  });
  const axisFor = (i: number) =>
    mode === "dual" && series[i].unit === units[1] ? "right" : "left";
  const config = Object.fromEntries(
    series.map((s, i) => [
      `s${i}`,
      { label: s.title, color: palette.seriesAt(i) },
    ]),
  );
  const common = (
    <>
      <CartesianGrid stroke={palette.grid} vertical={false} strokeDasharray="3 5" />
      <XAxis
        dataKey="label"
        tick={axisTick}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => friendlyDate(v)}
        minTickGap={28}
      />
      <YAxis
        yAxisId="left"
        width={40}
        tick={axisTick}
        axisLine={false}
        tickLine={false}
        hide={mode === "relative"}
      />
      {mode === "dual" && (
        <YAxis
          yAxisId="right"
          orientation="right"
          width={40}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
        />
      )}
      <Tooltip
        cursor={{ stroke: palette.cursor }}
        content={({ active, label, payload }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md">
              <p className="mb-1.5 text-muted-foreground">
                {friendlyDate(String(label), true)}
              </p>
              {series.map((s, i) => {
                const raw = s.points.find((p) => p.label === label)?.value;
                return (
                  <p key={s.measurement_id} className="flex items-center gap-2">
                    <i
                      className="size-2 rounded-full"
                      style={{
                        background: palette.seriesAt(i),
                      }}
                    />
                    <span className="text-muted-foreground">
                      {clipText(s.title)}
                    </span>
                    <span className="ml-auto font-mono">
                      {raw == null
                        ? "—"
                        : `${raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${s.unit}`}
                    </span>
                  </p>
                );
              })}
            </div>
          );
        }}
      />
    </>
  );
  const color = palette.seriesAt;
  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      {type === "bar" ? (
        <BarChart data={data}>
          {common}
          {series.map((s, i) => (
            <Bar
              key={s.measurement_id}
              dataKey={`s${i}`}
              yAxisId={axisFor(i)}
              fill={color(i)}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      ) : type === "area" ? (
        <AreaChart data={data}>
          {common}
          {series.map((s, i) => (
            <Area
              key={s.measurement_id}
              dataKey={`s${i}`}
              yAxisId={axisFor(i)}
              type="monotone"
              stroke={color(i)}
              fill={color(i)}
              fillOpacity={0.1}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data}>
          {common}
          {series.map((s, i) => (
            <Line
              key={s.measurement_id}
              dataKey={`s${i}`}
              yAxisId={axisFor(i)}
              type="monotone"
              stroke={color(i)}
              strokeWidth={1.4}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </ChartContainer>
  );
}

export function MultiSeriesLegend({ series }: { series: PulseSeries[] }) {
  const palette = useChartPalette();
  const mode = seriesMode(series);
  return (
    <>
      <div className="pulse-legend">
        {series.map((s, i) => {
          const total =
            s.total === null || s.total === undefined
              ? null
              : formatTotal(s.total, s.unit);
          return (
            <div className="pulse-legend-row" key={s.measurement_id}>
              <i
                style={{ background: palette.seriesAt(i) }}
              />
              <span>{s.title}</span>
              <b>
                {total
                  ? `${total.text}${total.unit ? ` ${total.unit}` : ""}`
                  : "—"}
              </b>
            </div>
          );
        })}
      </div>
      {mode !== "single" && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {mode === "dual"
            ? "Two units: the left axis and the right axis use different scales."
            : "Different units: each series is scaled to its own peak (100%)."}
        </p>
      )}
    </>
  );
}
