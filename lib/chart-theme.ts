/**
 * Chart Theme Utility for BufoIndex
 *
 * Theme-aware colors and shared Recharts props. Colors come from the CSS
 * custom properties in app/globals.css, so charts follow light/dark mode.
 * Components normally reach this through `useChartTheme()` from
 * `@/components/ui/charts`, which calls getChartTheme() underneath.
 */

import { Global } from 'recharts';

// Recharts 3 connects every chart to the Redux DevTools extension unless this
// is off, including in production. Every chart imports this module (directly
// or through useChartTheme), so the switch is set before any chart mounts.
Global.devToolsEnabled = false;

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
  /** Monospace font stack for axis ticks and legends (the --font-mono token). */
  fontMono: string;
}

/** Same stack as the --font-mono token in app/globals.css. */
export const FONT_MONO_FALLBACK =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

/**
 * Sage color variants for consistent theming
 */
export const getSageVariants = () => ({
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
      fontMono: FONT_MONO_FALLBACK
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
    fontMono: style.getPropertyValue('--font-mono').trim() || FONT_MONO_FALLBACK
  };
};

// ---------------------------------------------------------------------------
// Theme-change subscription (one MutationObserver shared by every chart)
// ---------------------------------------------------------------------------

export type ChartThemeMode = 'light' | 'dark';

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

/**
 * Calls `callback` after the `class` attribute of <html> changes. Charts read
 * computed CSS variables, so they must re-read after ThemeProvider's effect
 * has swapped the class (a render-time context read would see the old values).
 */
export const subscribeToThemeChanges = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  themeListeners.add(callback);
  if (!themeObserver) {
    themeObserver = new MutationObserver(() => {
      themeListeners.forEach((listener) => listener());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  return () => {
    themeListeners.delete(callback);
    if (themeListeners.size === 0 && themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  };
};

/** Snapshot for useSyncExternalStore: the theme class currently on <html>. */
export const getThemeModeSnapshot = (): ChartThemeMode =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';

let cachedTheme: { mode: ChartThemeMode; theme: ChartTheme } | null = null;

/**
 * getChartTheme() cached per theme mode, so every chart on the page shares one
 * object (stable for React.memo) and getComputedStyle runs once per switch.
 * Never caches the server fallback.
 */
export const getChartThemeForMode = (mode: ChartThemeMode): ChartTheme => {
  if (typeof window === 'undefined') return getChartTheme();
  if (cachedTheme?.mode !== mode) {
    cachedTheme = { mode, theme: getChartTheme() };
  }
  return cachedTheme.theme;
};

/** Server snapshot: the server always renders the light fallback. */
export const getServerThemeModeSnapshot = (): ChartThemeMode => 'light';

// ---------------------------------------------------------------------------
// Shared Recharts props
// ---------------------------------------------------------------------------

/** Chart margins. `compact` fits tick labels only; `labeled` leaves room for axis titles. */
export const CHART_MARGINS = {
  compact: { top: 8, right: 8, left: 0, bottom: 0 },
  labeled: { top: 20, right: 30, left: 20, bottom: 60 }
} as const;

export type ChartMarginKey = keyof typeof CHART_MARGINS;

/** Axis tick font size, in px. */
export const CHART_TICK_FONT_SIZE = 12;

/**
 * Spread into every Area/Line/Bar: animation is off by default. Recharts'
 * default JS animation replays on each data change (about 1.5 s), which made
 * every keystroke re-animate the retirement charts.
 */
export const CHART_SERIES_DEFAULTS = { isAnimationActive: false } as const;

/** Spread into XAxis / YAxis. Pass a series color to tint a secondary axis. */
export const chartAxisProps = (theme: ChartTheme, color: string = theme.muted) => ({
  stroke: color,
  tick: { fill: color, fontSize: CHART_TICK_FONT_SIZE, fontFamily: theme.fontMono }
});

/** Spread into CartesianGrid. */
export const chartGridProps = (theme: ChartTheme) => ({
  strokeDasharray: '3 3',
  stroke: theme.grid,
  opacity: 0.4
});

/** Legend wrapper style in the theme's text color and mono font. */
export const chartLegendStyle = (theme: ChartTheme) => ({
  fontSize: CHART_TICK_FONT_SIZE,
  fontFamily: theme.fontMono,
  color: theme.text
});

/** Default upper bound on plotted points per series (keeps phones responsive). */
export const MAX_CHART_POINTS = 120;

/**
 * Thins a series to at most `max` points on a regular stride, always keeping
 * the first and last point. Returns the input array unchanged when it is
 * already short enough. `max` below 2 is treated as 2.
 */
export function thinPoints<T>(points: readonly T[], max: number = MAX_CHART_POINTS): T[] {
  const limit = Math.max(2, Math.floor(max));
  if (points.length <= limit) return points as T[];

  const lastIndex = points.length - 1;
  // Smallest stride s with ceil(lastIndex / s) + 1 <= limit.
  const step = Math.ceil(lastIndex / (limit - 1));
  const out: T[] = [];
  for (let i = 0; i < lastIndex; i += step) out.push(points[i]);
  out.push(points[lastIndex]);
  return out;
}
