/**
 * The shared chart scaffold: the frame, the tooltip card, the theme hook and
 * the pure Recharts prop helpers from lib/chart-theme.
 */

export { ChartFrame } from './ChartFrame';
export type { ChartFrameProps, ChartFrameHeight } from './ChartFrame';
export { ChartTooltipCard } from './ChartTooltipCard';
export type { ChartTooltipCardProps, ChartTooltipRow } from './ChartTooltipCard';
export { useChartTheme } from './useChartTheme';
export {
  chartAxisProps,
  chartGridProps,
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  thinPoints,
} from '@/lib/chart-theme';
export type { ChartTheme } from '@/lib/chart-theme';
