/**
 * Chart scaffold. Note: ChartFrame imports Recharts. A module that lazily
 * loads a chart should import ChartPlaceholder / chartLoading /
 * ChartViewportMount from './ChartPlaceholder' directly, not from this
 * barrel, so Recharts stays out of the page's first-load chunk.
 */
export { ChartFrame, type ChartFrameProps } from './ChartFrame';
export {
  ChartPlaceholder,
  ChartViewportMount,
  chartLoading,
  type ChartPlaceholderProps,
  type ChartViewportMountProps,
} from './ChartPlaceholder';
export { ChartTooltipCard, type ChartTooltipCardProps, type ChartTooltipRow } from './ChartTooltipCard';
export { useChartTheme } from './useChartTheme';
export { CHART_HEIGHT_CLASS, type ChartHeight } from './sizes';
export {
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  CHART_TICK_FONT_SIZE,
  MAX_CHART_POINTS,
  chartAxisProps,
  chartGridProps,
  chartLegendStyle,
  getChartTheme,
  thinPoints,
  type ChartMarginKey,
  type ChartTheme,
} from '@/lib/chart-theme';
