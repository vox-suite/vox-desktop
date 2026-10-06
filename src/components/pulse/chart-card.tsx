import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import type {
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";

const colors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"];
export function PulseChartCard({
  title,
  definition,
  result,
  source,
  children,
}: {
  title: string;
  definition: PulseDefinition;
  result: PulseResult | null;
  source?: string;
  children?: ReactNode;
}) {
  const points = result?.points ?? [];
  const observed = points.filter((p) => p.value !== null);
  const tooltip = (
    <Tooltip
      contentStyle={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 12,
      }}
      formatter={(value) => [
        `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${result?.unit ?? ""}`,
        title,
      ]}
    />
  );
  const axes = (
    <>
      <CartesianGrid
        stroke="var(--border)"
        vertical={false}
        strokeDasharray="3 5"
      />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        axisLine={false}
        tickLine={false}
        minTickGap={28}
      />
      <YAxis
        width={40}
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        axisLine={false}
        tickLine={false}
      />
      {tooltip}
    </>
  );
  return (
    <article className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {[source ?? result?.source, result?.unit]
              .filter(Boolean)
              .join(" · ")
              .replaceAll("_", " ")}{" "}
            {result?.quality &&
              !["recorded", "measured"].includes(result.quality) &&
              `· ${result.quality.replaceAll("_", " ")}`}
          </p>
        </div>
      </div>
      <div className="h-48 min-w-0" aria-label={`${title} chart`}>
        {result?.error ? (
          <div className="flex h-full items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {result.error}
          </div>
        ) : !observed.length ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No recorded values in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {definition.chart_type === "line" ? (
              <LineChart data={points}>
                {axes}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors[0]}
                  strokeWidth={2}
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
            ) : definition.chart_type === "pie" ? (
              <PieChart>
                {tooltip}
                <Pie
                  data={observed}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={45}
                  outerRadius={75}
                  isAnimationActive={false}
                >
                  {observed.map((p, i) => (
                    <Cell key={p.label} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={points}>
                {axes}
                <Bar
                  dataKey="value"
                  fill={colors[0]}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      {result && (
        <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
          <p>{result.description}</p>
          <p>
            {result.record_count.toLocaleString()} dated source entries
            {result.undated_count > 0 &&
              ` · ${result.undated_count} source entries without event dates`}
            . Missing capture periods appear as gaps.
          </p>
          <p>
            Updated{" "}
            {new Date(result.computed_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {result.data_as_of &&
              ` · Latest activity ${new Date(result.data_as_of).toLocaleDateString()}`}
          </p>
        </div>
      )}
      {children && (
        <div className="mt-4 border-t border-border pt-3">{children}</div>
      )}
    </article>
  );
}
