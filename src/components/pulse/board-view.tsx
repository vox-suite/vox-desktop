import { useMemo } from "react";
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
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Layers,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useChartBoardData } from "@/hooks/use-chart-board-data";
import type { Chart, ChartDataPoint, ChartDataResult } from "@/features/pulse/types";

const PIE_COLORS = [
  "#38bdf8",
  "#818cf8",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#a78bfa",
  "#f87171",
  "#2dd4bf",
  "#60a5fa",
];

const TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  borderColor: "#27272a",
  borderRadius: "8px",
  color: "#f4f4f5",
  fontSize: "12px",
};

function SingleChart({
  chart,
  result,
}: {
  chart: Chart;
  result?: ChartDataResult;
}) {
  const points: ChartDataPoint[] = result?.data_points ?? [];
  const hasError = Boolean(result?.error);
  const isEmpty = points.length === 0 && !hasError;

  return (
    <Card className="flex flex-col border border-border/40 bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {chart.title}
          </h3>
          <p className="text-xs text-muted-foreground capitalize">
            {chart.chart_type} chart
          </p>
        </div>
        <Badge variant="outline" className="border-border bg-card text-[10px] text-muted-foreground capitalize">
          {chart.chart_type}
        </Badge>
      </div>

      <div className="flex-1 min-h-[240px] w-full flex items-center justify-center">
        {hasError ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground/90">
            <AlertTriangle className="h-6 w-6" />
            <p className="text-xs font-medium">{result?.error}</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Layers className="h-6 w-6" />
            <p className="text-xs">No data points recorded yet</p>
          </div>
        ) : chart.chart_type === "line" ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 3, fill: "#38bdf8" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : chart.chart_type === "bar" ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : chart.chart_type === "area" ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#34d399"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${chart.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Pie
                data={points}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                paddingAngle={2}
              >
                {points.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

export function BoardView({
  boardId,
  onBack,
}: {
  boardId: string;
  onBack: () => void;
}) {
  const { board, data, loading, refreshing, error, reload } =
    useChartBoardData(boardId);

  const resultMap = useMemo(() => {
    const map = new Map<string, ChartDataResult>();
    for (const r of data) {
      map.set(r.chart_id, r);
    }
    return map;
  }, [data]);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-background p-4 text-foreground sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {board?.name ?? "Board"}
            </h1>
            {board && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Calendar className="h-3 w-3" />
                <span>
                  Created {new Date(board.created_at).toLocaleDateString()}
                </span>
                <span>•</span>
                <span>{board.charts.length} charts</span>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={loading || refreshing}
          className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground gap-2"
        >
          <RotateCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-destructive">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p className="text-sm font-semibold">Failed to load board</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      ) : board && board.charts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Layers className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">This board has no charts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          {board?.charts.map((chart) => (
            <SingleChart
              key={chart.id}
              chart={chart}
              result={resultMap.get(chart.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
