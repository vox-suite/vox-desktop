import { CHART_TOKENS, SERIES_TOKENS } from "@/features/pulse/format";
import { useVoxColors } from "@/lib/theme";

/** Resolved chart colors for Recharts and SVG attributes, updated when the theme changes. */
export function useChartPalette() {
  const colors = useVoxColors();
  const series = SERIES_TOKENS.map((name) => colors[name]);
  return {
    series,
    seriesAt: (i: number) => series[i % series.length],
    chart: CHART_TOKENS.map((name) => colors[name]),
    grid: colors.border,
    cursor: colors["border-strong"],
    axis: colors["text-muted"],
    label: colors.text,
  };
}
