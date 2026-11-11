'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { getChartTheme, type ChartTheme } from '@/lib/chart-theme';

interface ThemeSnapshot {
  resolvedTheme: 'light' | 'dark';
  theme: ChartTheme;
}

/**
 * The chart palette for the current light or dark theme. Re-reads
 * getChartTheme() whenever ThemeContext resolves to a new theme.
 *
 * ThemeProvider swaps the <html> class in its own passive effect, and parent
 * effects run after child effects, so the CSS variables are read in a
 * microtask once the whole commit has flushed.
 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [snapshot, setSnapshot] = useState<ThemeSnapshot>(() => ({
    resolvedTheme,
    theme: getChartTheme(),
  }));

  useEffect(() => {
    if (snapshot.resolvedTheme === resolvedTheme) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSnapshot({ resolvedTheme, theme: getChartTheme() });
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedTheme, snapshot.resolvedTheme]);

  return snapshot.theme;
}

export default useChartTheme;
