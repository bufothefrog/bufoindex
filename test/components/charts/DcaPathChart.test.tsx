/**
 * The leverage comparison's balance-path chart follows the shared dollar
 * display mode: the rows it plots are converted at each point's own month
 * (3% a year in today's mode, as entered in future mode), and the legend
 * names the basis.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { MedianPathPoint } from '@/lib/calculations/leverageComparison';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import type { ChartRow } from '@/app/tools/leverage-comparison/components/DcaPathChart';

// The rows the chart hands to Recharts, captured from its ComposedChart.
const plotted = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const ComposedChart = (props: React.ComponentProps<typeof actual.ComposedChart>) => {
    plotted.rows = (props.data ?? []) as unknown[];
    return <actual.ComposedChart {...props} />;
  };
  return { ...actual, ComposedChart };
});

const { default: DcaPathChart } = await import('@/app/tools/leverage-comparison/components/DcaPathChart');
const { ResponsiveContainer } = await import('recharts');

// Two points: today and ten years out (month 120), where 3% a year divides by
// 1.03^10 = 1.343916.
const POINTS: MedianPathPoint[] = [
  { month: 0, indexDca: 1000, leveragedDca: 1000, indexDcaP10: 1000, indexDcaP90: 1000, leveragedDcaP10: 1000, leveragedDcaP90: 1000 },
  {
    month: 120,
    indexDca: 134391.64,
    leveragedDca: 268783.28,
    indexDcaP10: 100000,
    indexDcaP90: 200000,
    leveragedDcaP10: 50000,
    leveragedDcaP90: 400000,
  },
];

function draw() {
  render(
    <ThemeProvider>
      <ResponsiveContainer width={400} height={300}>
        <DcaPathChart points={POINTS} leverageRatio={2} />
      </ResponsiveContainer>
    </ThemeProvider>
  );
  return plotted.rows as ChartRow[];
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  window.localStorage.removeItem('bufo-preferences');
  plotted.rows = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  usePreferencesStore.getState().setDisplayMode('today');
});

describe('DcaPathChart dollar display', () => {
  it("plots today's dollars and says so in the legend", () => {
    usePreferencesStore.getState().setDisplayMode('today');
    const rows = draw();
    expect(rows).toHaveLength(2);
    expect(rows[0].indexMedian).toBeCloseTo(1000, 6);
    expect(rows[1].years).toBe(10);
    expect(rows[1].indexMedian).toBeCloseTo(100000, 0);
    expect(rows[1].leveragedMedian).toBeCloseTo(200000, 0);
    expect(rows[1].indexBand[0]).toBeCloseTo(100000 / 1.343916, 0);
    expect(screen.getByText("Index fund (median) (today's $)")).toBeInTheDocument();
    expect(screen.getByText("2x fund (median) (today's $)")).toBeInTheDocument();
  });

  it('plots future dollars as the engine gives them and says so in the legend', () => {
    usePreferencesStore.getState().setDisplayMode('nominal');
    const rows = draw();
    expect(rows[1].indexMedian).toBeCloseTo(134391.64, 6);
    expect(rows[1].leveragedBand[1]).toBeCloseTo(400000, 6);
    expect(screen.getByText('Index fund (median) (future $)')).toBeInTheDocument();
    expect(screen.queryByText(/\(today's \$\)/)).not.toBeInTheDocument();
  });
});
