/**
 * Chart Theme Utility for BufoIndex
 * Provides theme-aware colors for Recharts components
 * Uses CSS custom properties for automatic dark mode switching
 */

export interface ChartTheme {
  primary: string;
  secondary: string;
  tertiary: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  grid: string;
  background: string;
  muted: string;
  accent: string;
  /** Monospace font stack for axis ticks, labels and legends (--font-mono). */
  fontMono: string;
}

/**
 * Fallback for the --font-mono token in app/globals.css (Tailwind's default
 * mono stack): used on the server and wherever the variable is not emitted.
 */
export const CHART_FONT_MONO_FALLBACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/**
 * Sage color variants for consistent theming
 */
const getSageVariants = () => ({
  sage50: '#f6f7f6',
  sage100: '#e3e8e3',
  sage200: '#c7d1c7',
  sage300: '#9fb09f',
  sage400: '#7fb069', // Main brand color
  sage500: '#5e8b4e',
  sage600: '#4a6d3c', // Primary in CSS custom properties
  sage700: '#3d5732',
  sage800: '#334729',
  sage900: '#2d3d24'
});

/**
 * Gets theme-aware colors for charts
 * These colors automatically adapt to light/dark mode via CSS custom properties
 */
export const getChartTheme = (): ChartTheme => {
  const sage = getSageVariants();

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side fallback colors (light theme)
    return {
      primary: sage.sage600,
      secondary: sage.sage300,
      tertiary: sage.sage500,
      success: 'hsl(142 76% 36%)', // --success, light theme
      warning: 'hsl(38 92% 50%)', // --warning, light theme
      danger: '#EF4444',
      text: '#1a202c',
      grid: '#e2e8f0',
      background: '#ffffff',
      muted: '#64748b',
      accent: sage.sage400,
      fontMono: CHART_FONT_MONO_FALLBACK
    };
  }

  // Get computed CSS custom property values
  const style = getComputedStyle(document.documentElement);

  return {
    primary: `hsl(${style.getPropertyValue('--primary').trim()})`,
    secondary: `hsl(${style.getPropertyValue('--secondary').trim()})`,
    tertiary: sage.sage500, // brand scale is intentionally theme-invariant
    success: `hsl(${style.getPropertyValue('--success').trim()})`,
    warning: `hsl(${style.getPropertyValue('--warning').trim()})`,
    danger: `hsl(${style.getPropertyValue('--destructive').trim()})`,
    text: `hsl(${style.getPropertyValue('--foreground').trim()})`,
    grid: `hsl(${style.getPropertyValue('--border').trim()})`,
    background: `hsl(${style.getPropertyValue('--background').trim()})`,
    muted: `hsl(${style.getPropertyValue('--muted-foreground').trim()})`,
    accent: sage.sage400, // main brand color
    fontMono: style.getPropertyValue('--font-mono').trim() || CHART_FONT_MONO_FALLBACK
  };
};

/** Axis font size in px, shared by every chart. */
const AXIS_FONT_SIZE = 12;

/**
 * Props for every XAxis and YAxis: muted stroke and ticks in the mono font.
 * Charts spread these and add dataKey, ticks, formatters and labels.
 */
export const chartAxisProps = (theme: ChartTheme) => ({
  stroke: theme.muted,
  fontSize: AXIS_FONT_SIZE,
  fontFamily: theme.fontMono,
  tick: { fill: theme.muted }
});

/** Props for CartesianGrid: dashed lines in the border color. */
export const chartGridProps = (theme: ChartTheme) => ({
  strokeDasharray: '3 3',
  stroke: theme.grid,
  opacity: 0.3
});

/**
 * Chart margins. `labeled` leaves room for rotated axis titles and a legend
 * under the plot (the retirement charts); `compact` is for charts without
 * axis titles (the leverage path chart).
 */
export const CHART_MARGINS = {
  labeled: { top: 20, right: 30, left: 20, bottom: 60 },
  compact: { top: 8, right: 8, left: 0, bottom: 0 }
} as const;

/**
 * Spread on every Area, Line and Bar: charts do not animate. Recharts'
 * default tween restarts on each data change and dominates the cost of a
 * results update.
 */
export const CHART_SERIES_DEFAULTS = { isAnimationActive: false } as const;

/**
 * Downsamples `points` to at most `max` entries at an even index step,
 * always keeping the first and the last point. Arrays that already fit come
 * back as a copy. `max` must be an integer of at least 2.
 */
export function thinPoints<T>(points: readonly T[], max: number): T[] {
  if (!Number.isInteger(max) || max < 2) {
    throw new RangeError(`thinPoints: max must be an integer >= 2, got ${max}`);
  }
  if (points.length <= max) return points.slice();
  const lastIndex = points.length - 1;
  const step = Math.ceil(lastIndex / (max - 1));
  const thinned: T[] = [];
  for (let i = 0; i < lastIndex; i += step) thinned.push(points[i]);
  thinned.push(points[lastIndex]);
  return thinned;
}
