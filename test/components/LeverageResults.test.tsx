/**
 * The "Cash flow vs lump sum" card used to say, unconditionally, that the lump
 * sum's dollar figures are larger under both funds. That is false at inputs
 * the page invites ("test a flat decade"), so the sentence is now computed
 * from the simulated medians. These cases use the seeded engine at the
 * default inputs with only the expected index return changed.
 *
 * Medians at seed 20260812, 500 paths, $900/mo for 20 years + $5,000 start
 * ($221,000 contributed), 2x fund:
 *   return  index monthly  index lump  2x monthly  2x lump
 *   10%       ~$578k        ~$1,132k     ~$633k     ~$1,196k   both above
 *    2%       ~$242k          ~$250k     ~$132k        ~$58k   mixed
 *   -5%       ~$125k           ~$60k      ~$55k         ~$3k   both below
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toChartRow } from '@/app/tools/leverage-comparison/components/DcaPathChart';
import { LeverageResults } from '@/app/tools/leverage-comparison/components/LeverageResults';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { displayDollars } from '@/lib/utils/displayDollars';
import {
  dcaEffectSentence,
  lumpSumScaleSentence,
  relativeGapNoisePoints,
} from '@/lib/calculators/leverage/narrative';
import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  simulateDcaComparison,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

// The one site-wide dollar mode starts at its default ('today') in every test.
beforeEach(() => {
  window.localStorage.removeItem('bufo-preferences');
  usePreferencesStore.getState().setDisplayMode('today');
});

function atReturn(indexMeanReturn: number) {
  const inputs = { ...DEFAULT_DCA_COMPARISON_INPUTS, indexMeanReturn };
  return { inputs, result: simulateDcaComparison(inputs) };
}

describe('lumpSumScaleSentence', () => {
  it('says the lump sum is larger under both funds when both medians are larger (10% return)', () => {
    const { result } = atReturn(0.1);
    expect(result.index.lumpSum.p50).toBeGreaterThan(result.index.dca.p50);
    expect(result.leveraged.lumpSum.p50).toBeGreaterThan(result.leveraged.dca.p50);
    expect(result.index.lumpSum.p50).toBeCloseTo(1_131_634, -3);
    expect(result.leveraged.dca.p50).toBeCloseTo(632_905, -3);

    expect(lumpSumScaleSentence(result, '2x')).toMatch(/larger than the monthly median under both funds/);
  });

  it('describes a split when the index lump sum is larger but the 2x lump sum is smaller (2% return)', () => {
    const { result } = atReturn(0.02);
    expect(result.index.lumpSum.p50).toBeCloseTo(249_952, -3);
    expect(result.index.dca.p50).toBeCloseTo(242_455, -3);
    expect(result.leveraged.lumpSum.p50).toBeCloseTo(58_345, -3);
    expect(result.leveraged.dca.p50).toBeCloseTo(131_945, -3);

    const sentence = lumpSumScaleSentence(result, '2x');
    expect(sentence).toContain('ends above the monthly median for the index fund and below it for the 2x fund');
    expect(sentence).not.toMatch(/under both funds/);
  });

  it('says the lump sum is smaller under both funds when both medians are smaller (-5% return)', () => {
    const { result } = atReturn(-0.05);
    expect(result.index.lumpSum.p50).toBeCloseTo(60_301, -3);
    expect(result.index.dca.p50).toBeCloseTo(124_811, -3);
    expect(result.leveraged.lumpSum.p50).toBeCloseTo(3_396, -2);
    expect(result.leveraged.dca.p50).toBeCloseTo(55_059, -3);

    expect(lumpSumScaleSentence(result, '2x')).toMatch(/smaller than the monthly median under both funds/);
  });

  it('reports a tie when both framings end level', () => {
    const { result } = atReturn(0.1);
    const level: DcaComparisonResult = {
      ...result,
      index: { ...result.index, lumpSum: { ...result.index.lumpSum, p50: result.index.dca.p50 } },
      leveraged: {
        ...result.leveraged,
        lumpSum: { ...result.leveraged.lumpSum, p50: result.leveraged.dca.p50 + 0.25 },
      },
    };
    expect(lumpSumScaleSentence(level, '2x')).toMatch(/about the same median balance under both funds/);
  });
});

describe('LeverageResults lump-sum card', () => {
  it('does not claim the lump sum is larger in a falling market', () => {
    const { inputs, result } = atReturn(-0.05);
    render(<LeverageResults inputs={inputs} result={result} />);

    expect(screen.getByText(/smaller than the monthly median under both funds/)).toBeInTheDocument();
    expect(screen.queryByText(/dollar figures are larger under both funds/)).toBeNull();
  });
});

describe('relativeGapNoisePoints', () => {
  it('is 4 points at the defaults (2x, 20 years, 500 paths)', () => {
    expect(relativeGapNoisePoints(DEFAULT_DCA_COMPARISON_INPUTS)).toBeCloseTo(4, 10);
  });

  it('scales with leverage above 1x, the square root of the horizon, and 1/sqrt(paths)', () => {
    const base = { leverageRatio: 2, years: 20, paths: 500 };
    expect(relativeGapNoisePoints({ ...base, leverageRatio: 3 })).toBeCloseTo(8, 10);
    expect(relativeGapNoisePoints({ ...base, leverageRatio: 1.5 })).toBeCloseTo(2, 10);
    expect(relativeGapNoisePoints({ ...base, years: 5 })).toBeCloseTo(2, 10);
    expect(relativeGapNoisePoints({ ...base, paths: 2000 })).toBeCloseTo(2, 10);
  });

  it('is 0 at 1x, where the two funds differ only by fees, and for non-finite inputs', () => {
    expect(relativeGapNoisePoints({ leverageRatio: 1, years: 20, paths: 500 })).toBe(0);
    expect(relativeGapNoisePoints({ leverageRatio: Number.NaN, years: 20, paths: 500 })).toBe(0);
  });
});

describe('dcaEffectSentence', () => {
  function atLeverage(leverageRatio: number) {
    const inputs = { ...DEFAULT_DCA_COMPARISON_INPUTS, leverageRatio };
    return { inputs, result: simulateDcaComparison(inputs) };
  }

  it('calls the 3.8-point difference at the defaults sampling error rather than an effect', () => {
    // Seed 20260812: DCA gap +$54.8k (+9.5%), lump-sum gap +$64.3k (+5.7%),
    // difference 3.8 points, under the 4-point noise threshold.
    const { inputs, result } = atLeverage(2);
    const sentence = dcaEffectSentence(result, '2x', inputs);
    expect(sentence).toContain('(+9.5% of the index median)');
    expect(sentence).toContain('+$64.3k (+5.7%)');
    expect(sentence).toContain(
      'differ by 3.8 percentage points, which is within the sampling error of 500 simulated paths'
    );
    expect(sentence).not.toMatch(/comes from how the contribution pattern/);
    expect(sentence).not.toMatch(/rather than the leverage itself/);
  });

  it('attributes a difference well above the noise to the contribution pattern, with a sampling caveat (3x)', () => {
    // DCA gap +2.2%, lump-sum gap -20.5%: 22.7 points against an 8-point threshold.
    const { inputs, result } = atLeverage(3);
    const sentence = dcaEffectSentence(result, '3x', inputs);
    expect(sentence).toContain('(+22.7 percentage points) comes from how the contribution pattern interacts');
    expect(sentence).toContain('With 500 paths that figure still carries sampling error');
  });

  it('drops the sampling caveat at 1x, where the gap comes from fees alone', () => {
    // DCA gap -10.3%, lump-sum gap -15.8%: the lump sum pays fees on more money for longer.
    const { inputs, result } = atLeverage(1);
    const sentence = dcaEffectSentence(result, '1x', inputs);
    expect(sentence).toContain('(−10.3% of the index median)');
    expect(sentence).toContain('(+5.5 percentage points) comes from how the contribution pattern interacts');
    expect(sentence).not.toMatch(/sampling error/);
  });
});

describe('LeverageResults model and caveats', () => {
  it('discloses sampling error instead of claiming the draws remove luck', () => {
    const { inputs, result } = atReturn(0.1);
    render(<LeverageResults inputs={inputs} result={result} />);

    expect(screen.queryByText(/luck of the draw/)).toBeNull();
    expect(
      screen.getByText(/can still carry sampling error of a few\s+percentage points; a different seed would move them/)
    ).toBeInTheDocument();
  });
});

describe('LeverageResults announcements', () => {
  it('puts the headline figures, and only them, in a polite live region', () => {
    const { inputs, result } = atReturn(0.1);
    const { container } = render(<LeverageResults result={result} inputs={inputs} />);
    const live = container.querySelectorAll('[aria-live]');
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveAttribute('aria-live', 'polite');
    expect(live[0]).toHaveTextContent('Index fund, median ending balance');
    expect(live[0]).toHaveTextContent('Share of simulated paths where the 2x fund ends behind the index fund');
    expect(live[0]).not.toHaveTextContent('Cash flow vs lump sum');
  });
});

describe('LeverageResults dollar display mode', () => {
  /** "$578,082" or "$1.12M" or "$319k" -> dollars. */
  function amount(text: string): number {
    const match = /(-?)\$([\d,.]+)([kMB]?)/.exec(text);
    if (!match) throw new Error(`no amount in ${text}`);
    const scale = { '': 1, k: 1e3, M: 1e6, B: 1e9 }[match[3] as '' | 'k' | 'M' | 'B'];
    return (match[1] ? -1 : 1) * Number(match[2].replace(/,/g, '')) * scale;
  }

  function tileValue(name: string): number {
    // The hint ("10th to 90th: ...") follows the figure with no separator.
    const text = (screen.getByRole('group', { name }).textContent ?? '').slice(name.length);
    const figure = /^\$\d{1,3}(,\d{3})*/.exec(text)?.[0] ?? '';
    return Number(figure.replace(/[$,]/g, ''));
  }

  function cells(tableName: RegExp): string[][] {
    return within(screen.getByRole('table', { name: tableName }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent ?? ''));
  }

  // Defaults: 20 years, so balances deflate by 1.03^20 = 1.8061...
  const FACTOR = 1.03 ** 20;

  it('shows the toggle and names the basis in the caption, the chart caption and both table captions', () => {
    const { inputs, result } = atReturn(0.1);
    render(<LeverageResults inputs={inputs} result={result} />);
    expect(screen.getByRole('radiogroup', { name: 'Dollar display mode' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Adjusted to today's dollars (assumes 3% inflation). Contributions and the starting balance are shown as entered."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /^Balances in today's dollars\. Lines are the median balance/ })).toBeInTheDocument();
    expect(
      screen.getByRole('table', {
        name: "Median ending balances in today's dollars for the index fund and the 2x fund under monthly contributions and a lump sum; contributions as entered",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', {
        name: "Drawdown and low-percentile outcomes for the index fund and the 2x fund, balances in today's dollars",
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Future dollars' }));
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    expect(
      screen.getByText('Shown in future dollars. Contributions and the starting balance are shown as entered.')
    ).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /^Balances in future dollars\./ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /^Median ending balances in future dollars/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /balances in future dollars$/ })).toBeInTheDocument();
  });

  it('renders the same results with different figures in the two modes, apart by 1.03 per year', () => {
    const { inputs, result } = atReturn(0.1);
    render(<LeverageResults inputs={inputs} result={result} />);

    const todayIndex = tileValue('Index fund, median ending balance');
    const todayLev = tileValue('2x fund, median ending balance');
    expect(todayIndex).toBeCloseTo(result.index.dca.p50 / FACTOR, -1);
    expect(todayLev).toBeCloseTo(result.leveraged.dca.p50 / FACTOR, -1);
    const todayFraming = cells(/^Median ending balances/);
    const todayTail = cells(/^Drawdown and low-percentile/);
    const todaySentence = screen.getByText(/^With monthly contributions the 2x fund's median ends/).textContent;

    // Compact figures ("$320k") carry three significant digits: 0.5% tolerance.
    const near = (shown: number, expected: number) =>
      expect(Math.abs(shown - expected) / Math.abs(expected)).toBeLessThan(0.005);
    near(amount(todayFraming[0][1]), result.index.dca.p50 / FACTOR);
    near(amount(todayFraming[1][2]), result.leveraged.lumpSum.p50 / FACTOR);
    near(amount(todayFraming[0][3]), result.dcaEffect.dcaGap / FACTOR);
    near(amount(todayTail[1][1]), result.index.dca.p10 / FACTOR);
    near(amount(todayTail[2][2]), result.leveraged.dca.p90 / FACTOR);
    // The relative gap and the drawdowns do not depend on the mode.
    const relative = todayFraming[0][3].replace(/^[^$]*\$[\d,.]+[kMB]?/, '');

    act(() => usePreferencesStore.getState().setDisplayMode('nominal'));

    expect(tileValue('Index fund, median ending balance')).toBe(Math.round(result.index.dca.p50));
    expect(tileValue('2x fund, median ending balance')).toBe(Math.round(result.leveraged.dca.p50));
    expect(tileValue('Index fund, median ending balance')).not.toBe(todayIndex);
    const futureFraming = cells(/^Median ending balances/);
    const futureTail = cells(/^Drawdown and low-percentile/);
    near(amount(futureFraming[0][1]), result.index.dca.p50);
    near(amount(futureFraming[1][2]), result.leveraged.lumpSum.p50);
    near(amount(futureFraming[0][3]), result.dcaEffect.dcaGap);
    near(amount(futureTail[1][1]), result.index.dca.p10);
    near(amount(futureTail[2][2]), result.leveraged.dca.p90);
    expect(futureFraming[0][3].replace(/^[^$]*\$[\d,.]+[kMB]?/, '')).toBe(relative);
    expect(futureTail[0]).toEqual(todayTail[0]);
    // Amounts paid in stay as entered in both modes.
    expect(futureFraming.map((row) => row[0])).toEqual(todayFraming.map((row) => row[0]));
    expect(futureFraming[0][0]).toContain('$900/mo + $5.0k start');
    expect(futureFraming[1][0]).toContain('$221k at month 0');

    const futureSentence = screen.getByText(/^With monthly contributions the 2x fund's median ends/).textContent;
    expect(futureSentence).not.toBe(todaySentence);
    expect(todaySentence).toContain('by $30.4k (+9.5% of the index median)');
    expect(futureSentence).toContain('by $54.8k (+9.5% of the index median)');
    expect(todaySentence).toContain('Investing the same $221k at month 0');
    expect(futureSentence).toContain('Investing the same $221k at month 0');
  });

  it('converts every chart point at its own month', () => {
    const { result } = atReturn(0.1);
    const point = result.medianPath[120];
    expect(point.month).toBe(120);
    const today = toChartRow(point, (value, years) => displayDollars(value, 'today', 0.03, years));
    const future = toChartRow(point, (value, years) => displayDollars(value, 'nominal', 0.03, years));
    const factor = 1.03 ** 10;
    expect(today.years).toBe(10);
    expect(today.indexMedian).toBeCloseTo(point.indexDca / factor, 6);
    expect(today.leveragedMedian).toBeCloseTo(point.leveragedDca / factor, 6);
    expect(today.indexBand[0]).toBeCloseTo(point.indexDcaP10 / factor, 6);
    expect(today.leveragedBand[1]).toBeCloseTo(point.leveragedDcaP90 / factor, 6);
    expect(future).toEqual({
      years: 10,
      indexBand: [point.indexDcaP10, point.indexDcaP90],
      leveragedBand: [point.leveragedDcaP10, point.leveragedDcaP90],
      indexMedian: point.indexDca,
      leveragedMedian: point.leveragedDca,
    });
    // Month 0 is today in either mode.
    const start = toChartRow(result.medianPath[0], (value, years) => displayDollars(value, 'today', 0.03, years));
    expect(start.indexMedian).toBe(result.medianPath[0].indexDca);
  });
});
