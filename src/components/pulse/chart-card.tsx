import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ChartNoAxesCombined,
  Music2,
  Gamepad2,
  Wallet,
  Play,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type {
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";

const colors = ["#3ecf8e", "#a2aaa4", "#77b6a1", "#6b766e", "#d4dad6"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function friendly(label: unknown, long = false) {
  const text = String(label ?? "");
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (day) {
    const d = new Date(+day[1], +day[2] - 1, +day[3]);
    return long
      ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  const month = /^(\d{4})-(\d{2})$/.exec(text);
  if (month) return `${MONTHS[+month[2] - 1]} ${month[1]}`;
  return text;
}
const clip = (value: unknown, max = 16) => {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
};

function HairlineBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  horizontal: boolean;
  fill?: string;
  dimmed?: boolean;
}) {
  const { x = 0, y = 0, width = 0, height = 0, horizontal, fill, dimmed } = props;
  if (width <= 0 || height <= 0) return null;
  const gap = 4;
  const thick = Math.min(horizontal ? height : width, 14);
  const lines = [];
  if (horizontal) {
    const cy = y + height / 2;
    for (let px = x + 0.5; px <= x + width; px += gap)
      lines.push(<line key={px} x1={px} x2={px} y1={cy - thick / 2} y2={cy + thick / 2} />);
  } else {
    const cx = x + width / 2;
    for (let py = y + height - 0.5; py >= y; py -= gap)
      lines.push(<line key={py} y1={py} y2={py} x1={cx - thick / 2} x2={cx + thick / 2} />);
  }
  return (
    <g
      stroke={fill}
      strokeWidth={1}
      shapeRendering="crispEdges"
      opacity={dimmed ? 0.2 : 1}
      style={{ transition: "opacity 120ms" }}
    >
      {lines}
    </g>
  );
}
export function PulseChartSkeleton() {
  return (
    <Card className="pulse-chart h-full" aria-hidden="true">
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-4">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="pulse-chart-body space-y-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-8 w-28" />
      </div>
    </Card>
  );
}

export function PulseChartCard({
  title,
  definition,
  result,
  source,
  children,
  compact = !!children,
}: {
  title: string;
  definition: PulseDefinition;
  result: PulseResult | null;
  source?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const allPoints = result?.points ?? [];
  const points =
    !definition.bucket && allPoints.length > 8 ? allPoints.slice(0, 8) : allPoints;
  const observed = points.filter(
    (p) => typeof p.value === "number" && Number.isFinite(p.value),
  );
  const sourceName = source ?? result?.source ?? "";
  const Icon =
    sourceName === "spotify"
      ? Music2
      : sourceName === "playstation"
        ? Gamepad2
        : sourceName === "youtube"
          ? Play
          : result?.unit && ["INR", "USD", "EUR", "GBP"].includes(result.unit)
            ? Wallet
            : ChartNoAxesCombined;
  const latest = observed.at(-1);
  const categorical = !definition.bucket;
  const largest = observed.reduce<(typeof observed)[number] | undefined>(
    (best, point) =>
      !best || (point.value ?? 0) > (best.value ?? 0) ? point : best,
    undefined,
  );
  const headline = categorical ? largest : latest;
  const chartConfig = { value: { label: title, color: colors[0] } };
  const tooltip = (
    <ChartTooltip
      cursor={{ fill: "rgba(255,255,255,0.04)" }}
      content={
        <ChartTooltipContent
          hideIndicator
          labelFormatter={(label) => friendly(label, true)}
          formatter={(value) => (
            <span className="font-mono">
              {Number(value).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              {result?.unit}
            </span>
          )}
        />
      }
    />
  );
  const axes = (
    <>
      <CartesianGrid stroke="#1f1f1f" vertical={false} strokeDasharray="3 5" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fill: "#a0a6a2" }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => friendly(v)}
        minTickGap={28}
      />
      <YAxis
        width={40}
        tick={{ fontSize: 10, fill: "#a0a6a2" }}
        axisLine={false}
        tickLine={false}
      />
      {tooltip}
    </>
  );
  return (
    <Card className="pulse-chart h-full overflow-visible">
      <header className="pulse-chart-header">
        <div className="pulse-source-icon">
          <Icon size={17} aria-hidden="true" />
        </div>
        <div>
          <h3>{title}</h3>
          <p>
            {[
              sourceName.replaceAll("_", " "),
              definition.bucket
                ? `${definition.period_days} days · by ${definition.bucket}`
                : definition.dimension?.replaceAll("_", " "),
              result?.quality &&
              !["recorded", "measured"].includes(result.quality)
                ? result.quality.replaceAll("_", " ")
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>
      <div className="pulse-chart-body">
        {headline && !result?.error && (
          <div className="pulse-chart-stat">
            <strong>
              {headline.value?.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-[#d4dad6]">
                {headline.value === 1 && result?.unit === "events"
                  ? "event"
                  : result?.unit}
              </span>
            </strong>
            <span>{categorical ? headline.label : "latest recorded"}</span>
          </div>
        )}
        <div
          className="min-w-0"
          style={{
            flexShrink: 0,
            height: categorical && definition.chart_type !== "pie"
              ? Math.max(192, observed.length * 28 + 36)
              : 192,
          }}
          aria-label={`${title} chart`}
        >
          {result?.error ? (
            <div className="flex h-full items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {result.error}
            </div>
          ) : !observed.length ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No recorded values in this period
            </div>
          ) : definition.chart_type === "pie" ? (
            <SegmentedRing points={observed} colors={colors} />
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
              {definition.chart_type === "line" ? (
                <LineChart data={points}>
                  {axes}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={colors[0]}
                    strokeWidth={1}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : definition.chart_type === "area" ? (
                <AreaChart data={points}>
                  {axes}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors[0]}
                    fill={colors[0]}
                    fillOpacity={0.12}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={points}
                  layout={categorical ? "vertical" : "horizontal"}
                  onMouseMove={(state) => {
                    const i = Number(state?.activeTooltipIndex);
                    setActive(Number.isFinite(i) ? i : null);
                  }}
                  onMouseLeave={() => setActive(null)}
                >
                  {categorical ? (
                    <>
                      <CartesianGrid
                        stroke="#1f1f1f"
                        horizontal={false}
                        strokeDasharray="3 5"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "#a0a6a2" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tickFormatter={(v) => clip(v)}
                        tick={{ fontSize: 10, fill: "#a0a6a2" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      {tooltip}
                    </>
                  ) : (
                    axes
                  )}
                  <Bar
                    dataKey="value"
                    fill={colors[0]}
                    shape={(p: object & { index?: number }) => (
                      <HairlineBar
                        {...p}
                        horizontal={categorical}
                        dimmed={active !== null && active !== p.index}
                      />
                    )}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ChartContainer>
          )}
        </div>
        {!compact && categorical && observed.length > 0 && (
          <div className="pulse-legend">
            {observed.slice(0, 5).map((point, index) => (
              <div className="pulse-legend-row" key={point.label}>
                <i style={{ background: colors[index % colors.length] }} />
                <span>{point.label}</span>
                <b>
                  {point.value?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {result?.unit}
                </b>
              </div>
            ))}
          </div>
        )}
        {!compact && categorical && observed.length > 5 && (
          <details className="pulse-chart-foot">
            <summary>All {observed.length} groups</summary>
            <div className="pulse-legend">
              {observed.slice(5).map((point, index) => (
                <div className="pulse-legend-row" key={point.label}>
                  <i
                    style={{ background: colors[(index + 5) % colors.length] }}
                  />
                  <span>{point.label}</span>
                  <b>
                    {point.value?.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {result?.unit}
                  </b>
                </div>
              ))}
            </div>
          </details>
        )}
        {!compact && result && (
          <footer className="pulse-chart-foot">
            <p>
              {result.record_count.toLocaleString()} dated entries · Updated{" "}
              {new Date(result.computed_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <details>
              <summary>About this measurement</summary>
              <p>{result.description}</p>
              <p>
                Missing capture periods appear as gaps.
                {result.undated_count > 0 &&
                  ` ${result.undated_count} entries have no event date.`}
                {result.data_as_of &&
                  ` Latest activity ${new Date(result.data_as_of).toLocaleDateString()}.`}
              </p>
            </details>
          </footer>
        )}
        {children && <div className="pulse-chart-actions">{children}</div>}
      </div>
    </Card>
  );
}

function SegmentedRing({
  points,
  colors,
}: {
  points: { label: string; value?: number | null }[];
  colors: string[];
}) {
  if (points.some((p) => (p.value ?? 0) < 0))
    return (
      <p className="text-xs text-muted-foreground">
        Signed values need a bar chart to compare.
      </p>
    );
  const positive = points.filter((p) => (p.value ?? 0) > 0);
  const total = positive.reduce((sum, p) => sum + (p.value ?? 0), 0);
  if (!total)
    return (
      <p className="text-xs text-muted-foreground">
        No positive values to compare
      </p>
    );
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
