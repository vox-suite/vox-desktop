import { useState, type ReactNode } from "react";
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
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  CHART_COLORS,
  clipText,
  formatTotal,
  friendlyDate,
  windowLabel,
} from "@/features/pulse";
import type {
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";
import { HairlineBar } from "./chart/hairline-bar";
import { SegmentedRing } from "./chart/segmented-ring";
import { ChartLegend } from "./chart/chart-legend";

export { PulseChartSkeleton } from "./chart/chart-skeleton";

export function PulseChartCard({
  title,
  definition,
  result,
  source,
  children,
  headerAction,
  footerAction,
  compact = !!children,
}: {
  title: string;
  definition: PulseDefinition;
  result: PulseResult | null;
  source?: string;
  children?: ReactNode;
  headerAction?: ReactNode;
  footerAction?: ReactNode;
  compact?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const allPoints = result?.points ?? [];
  const points =
    !definition.bucket && allPoints.length > (definition.top_n ?? 8)
      ? allPoints.slice(0, definition.top_n ?? 8)
      : allPoints;
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
  const isStat = definition.chart_type === "stat";
  const statValue =
    result?.total ?? (observed.reduce((sum, p) => sum + (p.value ?? 0), 0) || null);
  const headline = categorical ? largest : latest;
  const chartConfig = { value: { label: title, color: CHART_COLORS[0] } };

  const tooltip = (
    <ChartTooltip
      cursor={false}
      content={
        <ChartTooltipContent
          hideIndicator
          labelFormatter={(label) => friendlyDate(label, true)}
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
        tickFormatter={(v) => friendlyDate(v)}
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
                ? `${definition.period_days >= 3650 ? "all time" : `${definition.period_days} days`} · by ${definition.bucket}`
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
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {result && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="About this measurement"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 text-xs">
                <div className="space-y-2">
                  <p className="font-medium text-foreground">
                    About this measurement
                  </p>
                  {result.description && (
                    <p className="text-muted-foreground leading-relaxed">
                      {result.description}
                    </p>
                  )}
                  <div className="space-y-1 pt-1.5 text-[11px] text-muted-foreground/80 border-t border-border/50">
                    <p>
                      {result.record_count.toLocaleString()} dated entries ·
                      Updated{" "}
                      {new Date(result.computed_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p>
                      Missing capture periods appear as gaps.
                      {result.undated_count > 0 &&
                        ` ${result.undated_count} entries have no event date.`}
                      {result.data_as_of &&
                        ` Latest activity ${new Date(result.data_as_of).toLocaleDateString()}.`}
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {headerAction}
        </div>
      </header>

      <div className="pulse-chart-body">
        {headline && !result?.error && !isStat && (
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
          className={`min-w-0 ${isStat ? "flex flex-1 flex-col items-center justify-center text-center my-auto" : ""}`}
          style={{
            flexShrink: 0,
            height: isStat
              ? "100%"
              : categorical && definition.chart_type !== "pie"
                ? Math.max(192, observed.length * 28 + 36)
                : 192,
            minHeight: isStat ? 160 : undefined,
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
          ) : isStat && statValue !== null ? (
            <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
              <p className="font-mono text-5xl tracking-tight">
                {formatTotal(statValue, result?.unit ?? "").text}
                <span className="ml-2 text-xl text-[#d4dad6]">
                  {formatTotal(statValue, result?.unit ?? "").unit}
                </span>
              </p>
              {definition.bucket && (
                <p className="text-xs text-muted-foreground">
                  {windowLabel(definition)}
                </p>
              )}
            </div>
          ) : definition.chart_type === "pie" ? (
            <SegmentedRing points={observed} colors={CHART_COLORS} />
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-full w-full"
            >
              {definition.chart_type === "line" ? (
                <LineChart data={points}>
                  {axes}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS[0]}
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
                    stroke={CHART_COLORS[0]}
                    fill={CHART_COLORS[0]}
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
                    const label = state?.activeLabel;
                    setActive(label == null ? null : String(label));
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
                        tickFormatter={(v) => clipText(v)}
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
                    fill={CHART_COLORS[0]}
                    shape={(p: object & { payload?: { label?: string } }) => (
                      <HairlineBar
                        {...p}
                        horizontal={categorical}
                        dimmed={active !== null && active !== p.payload?.label}
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
          <ChartLegend
            points={observed}
            colors={CHART_COLORS}
            unit={result?.unit}
          />
        )}

        {!compact && (result || footerAction) && (
          <footer className="pulse-chart-foot">
            <div className="flex items-center justify-between gap-2">
              {result ? (
                <p>
                  {result.record_count.toLocaleString()} dated entries · Updated{" "}
                  {new Date(result.computed_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : (
                <div />
              )}
              {footerAction && (
                <div className="ml-auto shrink-0">{footerAction}</div>
              )}
            </div>
          </footer>
        )}
        {children && <div className="pulse-chart-actions">{children}</div>}
      </div>
    </Card>
  );
}
