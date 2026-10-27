import { CHART_TOKENS, SERIES_TOKENS } from "@/features/pulse/format";
import { token } from "@/lib/theme";

/** SVG and HTML resolve these tokens directly, including after theme changes.
 * Avoid caching computed colors before the theme stylesheet is available.
 */
export function useChartPalette() {
  const series = SERIES_TOKENS.map(token);
  return {
    series,
    seriesAt: (i: number) => series[i % series.length],
    chart: CHART_TOKENS.map(token),
    grid: token("border"),
    cursor: token("border-strong"),
    axis: token("text-muted"),
    label: token("text"),
  };
}
