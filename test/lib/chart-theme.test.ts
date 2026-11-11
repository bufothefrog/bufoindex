import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHART_FONT_MONO_FALLBACK,
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  chartAxisProps,
  chartGridProps,
  getChartTheme,
  subscribeToThemeChanges,
  thinPoints,
  type ChartTheme,
} from '@/lib/chart-theme';

const THEME: ChartTheme = {
  primary: 'hsl(1 1% 1%)',
  secondary: 'hsl(2 2% 2%)',
  tertiary: '#5e8b4e',
  success: 'hsl(3 3% 3%)',
  warning: 'hsl(4 4% 4%)',
  danger: 'hsl(5 5% 5%)',
  text: 'hsl(6 6% 6%)',
  grid: 'hsl(7 7% 7%)',
  background: 'hsl(8 8% 8%)',
  muted: 'hsl(9 9% 9%)',
  accent: '#7fb069',
  fontMono: 'TestMono, monospace',
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('getChartTheme', () => {
  const root = document.documentElement;

  afterEach(() => {
    root.removeAttribute('style');
  });

  it('wraps the CSS custom properties in hsl() and keeps the brand scale fixed', () => {
    root.style.setProperty('--primary', '106 29% 32%');
    root.style.setProperty('--border', '214.3 31.8% 91.4%');
    root.style.setProperty('--muted-foreground', '0 0% 65%');
    const theme = getChartTheme();
    expect(theme.primary).toBe('hsl(106 29% 32%)');
    expect(theme.grid).toBe('hsl(214.3 31.8% 91.4%)');
    expect(theme.muted).toBe('hsl(0 0% 65%)');
    expect(theme.tertiary).toBe('#5e8b4e');
    expect(theme.accent).toBe('#7fb069');
  });

  it('reads the mono font from --font-mono', () => {
    root.style.setProperty('--font-mono', ' Menlo, monospace ');
    expect(getChartTheme().fontMono).toBe('Menlo, monospace');
  });

  it('falls back to the default mono stack when --font-mono is not set', () => {
    expect(getChartTheme().fontMono).toBe(CHART_FONT_MONO_FALLBACK);
    expect(CHART_FONT_MONO_FALLBACK.endsWith(', monospace')).toBe(true);
  });
});

describe('subscribeToThemeChanges', () => {
  it('calls back when the <html> class changes and stops after unsubscribe', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToThemeChanges(callback);
    document.documentElement.classList.add('dark');
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    document.documentElement.classList.remove('dark');
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('chartAxisProps', () => {
  it('takes stroke, tick fill and font from the theme', () => {
    expect(chartAxisProps(THEME)).toEqual({
      stroke: 'hsl(9 9% 9%)',
      fontSize: 12,
      fontFamily: 'TestMono, monospace',
      tick: { fill: 'hsl(9 9% 9%)' },
    });
  });
});

describe('chartGridProps', () => {
  it('draws dashed lines in the theme grid color', () => {
    expect(chartGridProps(THEME)).toEqual({
      strokeDasharray: '3 3',
      stroke: 'hsl(7 7% 7%)',
      opacity: 0.3,
    });
  });
});

describe('chart constants', () => {
  it('keeps the margins of the existing charts', () => {
    expect(CHART_MARGINS.labeled).toEqual({ top: 20, right: 30, left: 20, bottom: 60 });
    expect(CHART_MARGINS.compact).toEqual({ top: 8, right: 8, left: 0, bottom: 0 });
  });

  it('turns series animation off', () => {
    expect(CHART_SERIES_DEFAULTS).toEqual({ isAnimationActive: false });
  });
});

describe('thinPoints', () => {
  it('returns a copy when the points already fit', () => {
    const points = [1, 2, 3];
    const thinned = thinPoints(points, 3);
    expect(thinned).toEqual([1, 2, 3]);
    expect(thinned).not.toBe(points);
    expect(thinPoints([], 5)).toEqual([]);
  });

  it('keeps both endpoints at an even step', () => {
    // 11 points, max 4: step = ceil(10 / 3) = 4 -> indices 0, 4, 8, then 10.
    expect(thinPoints(range(11), 4)).toEqual([0, 4, 8, 10]);
    // 10 points, max 4: step = ceil(9 / 3) = 3 -> indices 0, 3, 6, then 9.
    expect(thinPoints(range(10), 4)).toEqual([0, 3, 6, 9]);
    // max 2 keeps only the endpoints.
    expect(thinPoints(range(7), 2)).toEqual([0, 6]);
  });

  it('never returns more than max points', () => {
    for (const n of [3, 10, 121, 122, 241, 480, 481, 1000]) {
      for (const max of [2, 3, 7, 50, 120, 121]) {
        const thinned = thinPoints(range(n), max);
        expect(thinned.length).toBeLessThanOrEqual(max);
        expect(thinned[0]).toBe(0);
        expect(thinned[thinned.length - 1]).toBe(n - 1);
      }
    }
  });

  it('matches the leverage chart sampling (at most ~120 steps) with max = 121', () => {
    // DcaPathChart today: step = ceil(lastIndex / 120), every step, plus the last point.
    const legacy = (n: number) => {
      const lastIndex = n - 1;
      const step = Math.max(1, Math.ceil(lastIndex / 120));
      const rows: number[] = [];
      for (let i = 0; i <= lastIndex; i += step) rows.push(i);
      if (lastIndex % step !== 0) rows.push(lastIndex);
      return rows;
    };
    for (const n of [2, 61, 121, 122, 241, 361, 362, 481, 601]) {
      expect(thinPoints(range(n), 121)).toEqual(legacy(n));
    }
  });

  it('rejects a max below 2 or a fractional max', () => {
    expect(() => thinPoints(range(5), 1)).toThrow(RangeError);
    expect(() => thinPoints(range(5), 2.5)).toThrow(RangeError);
  });
});
