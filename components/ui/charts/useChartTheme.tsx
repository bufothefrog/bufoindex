'use client';

import { useSyncExternalStore } from 'react';
import {
  getChartThemeForMode,
  getServerThemeModeSnapshot,
  getThemeModeSnapshot,
  subscribeToThemeChanges,
  type ChartTheme,
} from '@/lib/chart-theme';

/**
 * The current chart colors, re-read whenever the theme class on <html>
 * changes. It replaces the per-chart useState + MutationObserver copies.
 *
 * It subscribes to the document class rather than reading ThemeContext
 * during render: ThemeProvider swaps the class in an effect, and the colors
 * are computed CSS variables, so a render-time context read would still see
 * the previous theme's values. It also works outside a ThemeProvider.
 */
export function useChartTheme(): ChartTheme {
  const mode = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeModeSnapshot,
    getServerThemeModeSnapshot
  );
  return getChartThemeForMode(mode);
}

export default useChartTheme;
