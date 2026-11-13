/**
 * The "Monthly vs start of each year" card compares the same yearly amount
 * invested monthly with the same amount invested at the start of each year.
 * Whether the start-of-year median is larger depends on the inputs, so the
 * sentence is computed from the simulated medians. These cases use the seeded
 * engine at the default inputs with only the expected index return changed.
 *
 * Medians at seed 20260812, 500 paths, $900/mo ($10,800 a year) for 20 years
 * + $5,000 start ($221,000 contributed to each), 2x fund:
 *   return  index monthly  index start-of-year  2x monthly  2x start-of-year
 *   10%       ~$578k         ~$596k               ~$633k     ~$657k   both above
 *    2%       ~$242k         ~$244k               ~$132k     ~$128k   mixed
 *   -5%       ~$125k         ~$122k                ~$55k      ~$50k   both below
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toChartRow } from '@/app/tools/leverage-comparison/components/DcaPathChart';
import { LeverageResults } from '@/app/tools/leverage-comparison/components/LeverageResults';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { displayDollars } from '@/lib/utils/displayDollars';
import { createSeededRng } from '@/lib/utils/random';
import {
  dcaEffectSentence,
  relativeGapNoisePoints,
  yearStartScaleSentence,
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

/** No sentence prints a month count: the average lead depends on the horizon. */
const MONTH_COUNT = /\d+(\.\d+)? months?/;

describe('yearStartScaleSentence', () => {
  it('says the start-of-year median is larger under both funds when both medians are larger (10% return)', () => {
    const { result } = atReturn(0.1);
    expect(result.index.yearStart.p50).toBeCloseTo(596_437, -3);
    expect(result.index.dca.p50).toBeCloseTo(578_082, -3);
    expect(result.leveraged.yearStart.p50).toBeCloseTo(657_361, -3);
    expect(result.leveraged.dca.p50).toBeCloseTo(632_905, -3);

    const sentence = yearStartScaleSentence(result, '2x');
    expect(sentence).toBe(
      "Each year's amount goes in at the start of the year, before most of the monthly amounts, and at these settings that makes its median balance larger than the monthly median under both funds."
    );
    expect(sentence).not.toMatch(MONTH_COUNT);
  });

  it('describes a split when the index start-of-year median is larger but the 2x one is smaller (2% return)', () => {
    const { result } = atReturn(0.02);
    expect(result.index.yearStart.p50).toBeCloseTo(243_674, -3);
    expect(result.index.dca.p50).toBeCloseTo(242_455, -3);
    expect(result.leveraged.yearStart.p50).toBeCloseTo(128_420, -3);
    expect(result.leveraged.dca.p50).toBeCloseTo(131_945, -3);

    const sentence = yearStartScaleSentence(result, '2x');
    expect(sentence).toBe(
      "At these settings the start-of-year median ends above the monthly median for the index fund and below it for the 2x fund: the two funds' typical paths grow at different rates, and money that goes in earlier spends longer exposed to that difference."
    );
    expect(sentence).not.toMatch(/under both funds/);
    expect(sentence).not.toMatch(MONTH_COUNT);
  });

  it('says the start-of-year median is smaller under both funds when both medians are smaller (-5% return)', () => {
    const { result } = atReturn(-0.05);
    expect(result.index.yearStart.p50).toBeCloseTo(121_769, -3);
    expect(result.index.dca.p50).toBeCloseTo(124_811, -3);
    expect(result.leveraged.yearStart.p50).toBeCloseTo(50_188, -3);
    expect(result.leveraged.dca.p50).toBeCloseTo(55_059, -3);

    const sentence = yearStartScaleSentence(result, '2x');
    expect(sentence).toBe(
      'At these settings the start-of-year median balance is smaller than the monthly median under both funds: when the typical path grows slowly or falls, money that goes in earlier has more time to lose ground.'
    );
    expect(sentence).not.toMatch(MONTH_COUNT);
  });

  it('reports a tie when both timings end level', () => {
    const { result } = atReturn(0.1);
    const level: DcaComparisonResult = {
      ...result,
      index: { ...result.index, yearStart: { ...result.index.yearStart, p50: result.index.dca.p50 } },
      leveraged: {
        ...result.leveraged,
        yearStart: { ...result.leveraged.yearStart, p50: result.leveraged.dca.p50 + 0.25 },
      },
    };
    expect(yearStartScaleSentence(level, '2x')).toBe(
      'At these settings the two timings end at about the same median balance under both funds.'
    );
  });

  it('E15: a 6-month horizon gives the larger-median text, with no month count', () => {
    const inputs = {
      ...DEFAULT_DCA_COMPARISON_INPUTS,
      monthlyContribution: 100,
      startingBalance: 0,
      years: 0.5,
      leverageRatio: 1,
      indexVolatility: 0,
      financingRate: 0,
      expenseRatio: 0,
      indexExpenseRatio: 0,
    };
    const result = simulateDcaComparison(inputs);
    // monthly 616.9700, start of year 600 x 1.1^0.5 = 629.2853
    expect(result.index.dca.p50).toBeCloseTo(616.97, 3);
    expect(result.index.yearStart.p50).toBeCloseTo(629.2853, 3);
    const sentence = yearStartScaleSentence(result, '1x');
    expect(sentence).toMatch(/^Each year's amount goes in at the start of the year/);
    expect(sentence).not.toMatch(MONTH_COUNT);
  });
});

describe('LeverageResults start-of-year card', () => {
  it('does not claim the start-of-year median is larger in a falling market', () => {
    const { inputs, result } = atReturn(-0.05);
    render(<LeverageResults inputs={inputs} result={result} />);

    expect(screen.getByText(/smaller than the monthly median under both funds/)).toBeInTheDocument();
    expect(screen.queryByText(/dollar figures are larger under both funds/)).toBeNull();
  });

  it('names the card, the timing column and both rows, and renders no lump-sum wording', () => {
    const { inputs, result } = atReturn(0.1);
    const { container } = render(<LeverageResults inputs={inputs} result={result} />);

    expect(screen.getByText('Monthly vs start of each year')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /^Median ending balances/ });
    expect(within(table).getByRole('columnheader', { name: 'Timing' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Framing' })).toBeNull();
    expect(within(table).getByRole('rowheader', { name: 'Monthly$900/mo + $5.0k start' })).toBeInTheDocument();
    expect(
      within(table).getByRole('rowheader', { name: 'Start of each year$10.8k/yr + $5.0k start' })
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(
      'Paths where the 2x fund ends behind: 43% with monthly contributions, 43% at the start of each year.'
    );
    expect(container).toHaveTextContent(
      'which is part of why monthly and start-of-year contributions end at different balances.'
    );
    expect(container).toHaveTextContent('Both funds, and both contribution timings, use the same draws');
    expect(container.textContent ?? '').not.toMatch(/lump|framing/i);
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

  it('calls the 0.7-point difference at the defaults sampling error rather than an effect', () => {
    // Seed 20260812: monthly gap +$54.8k (+9.5%), start-of-year gap +$60.9k
    // (+10.2%), difference 0.7 points, under the 4-point noise threshold.
    const { inputs, result } = atLeverage(2);
    const sentence = dcaEffectSentence(result, '2x', inputs);
    expect(sentence).toBe(
      "With monthly contributions the 2x fund's median ends above the index fund's median by $54.8k (+9.5% of the index median). " +
        'Investing the same $10.8k a year at the start of each year gives a gap of +$60.9k (+10.2%). ' +
        'The two relative gaps differ by 0.7 percentage points, which is within the sampling error of 500 simulated paths, ' +
        'so at these settings this run does not separate the two timings.'
    );
  });

  it('attributes a difference above the noise to when the money goes in, with a sampling caveat (3x)', () => {
    // A real form input reaches this branch: 3x, 30 years, index return 10%, volatility 5%,
    // $500 a month, $25,000 start. The two relative gaps differ by 16.4 points, above the
    // 3x noise threshold.
    const inputs = {
      ...DEFAULT_DCA_COMPARISON_INPUTS,
      leverageRatio: 3,
      years: 30,
      indexVolatility: 0.05,
      indexMeanReturn: 0.1,
      monthlyContribution: 500,
      startingBalance: 25000,
    };
    const sentence = dcaEffectSentence(simulateDcaComparison(inputs), '3x', inputs);
    expect(relativeGapNoisePoints(inputs)).toBeLessThan(16.4);
    expect(sentence).toContain(
      'Both timings use the same simulated markets, so the difference between the two relative gaps ' +
        "(\u221216.4 percentage points) comes from when the money goes in, interacting with the funds' different growth rates."
    );
    expect(sentence).toContain('With 500 paths that figure still carries sampling error');
  });

  it('drops the sampling caveat at 1x, where the gap comes from fees alone', () => {
    // Monthly gap -10.3%, start-of-year gap -10.7%: 0.4 points, noise threshold 0 at 1x.
    const { inputs, result } = atLeverage(1);
    const sentence = dcaEffectSentence(result, '1x', inputs);
    expect(sentence).toContain('(\u221210.3% of the index median)');
    expect(sentence).toContain('gives a gap of \u2212$63.7k (\u221210.7%)');
    expect(sentence).toContain('(+0.4 percentage points) comes from when the money goes in, interacting');
    expect(sentence).not.toMatch(/sampling error/);
  });

  it('does not attribute a difference that prints as 0.0 points to timing', () => {
    // 1x has no noise threshold. A start-of-year gap with the same relative size as the
    // monthly one leaves a difference of 0.0 points.
    const { inputs, result } = atLeverage(1);
    const dcaRel = result.dcaEffect.dcaGap / result.index.dca.p50;
    const same: DcaComparisonResult = {
      ...result,
      dcaEffect: { ...result.dcaEffect, yearStartGap: dcaRel * result.index.yearStart.p50 },
    };
    const sentence = dcaEffectSentence(same, '1x', inputs);
    expect(sentence).toContain(
      'The two relative gaps are the same to one decimal place, so at these settings the timing does not change the comparison.'
    );
    expect(sentence).not.toMatch(/0\.0 percentage points|comes from when the money goes in/);
  });

  it('does not call two gaps that print 0.1 apart the same (1x, $100 a month, 10 years)', () => {
    // A real form input, default seed and 500 paths: the gaps print as -6.0% and -6.1%. Their
    // unrounded difference is under 0.05 points, but the sentence may only state what the two
    // printed numbers show.
    const inputs = {
      ...DEFAULT_DCA_COMPARISON_INPUTS,
      leverageRatio: 1,
      monthlyContribution: 100,
      years: 10,
      startingBalance: 5000,
      indexMeanReturn: 0.1,
      indexVolatility: 0.16,
    };
    const sentence = dcaEffectSentence(simulateDcaComparison(inputs), '1x', inputs);
    expect(sentence).toContain('(−6.0% of the index median)');
    expect(sentence).toContain('gives a gap of −$1.9k (−6.1%)');
    expect(sentence).toContain(
      'The two relative gaps differ by about 0.1 percentage points, so at these settings the timing barely changes the comparison.'
    );
    expect(sentence).not.toMatch(/gaps are the same|does not change the comparison|comes from when the money goes in/);
  });

  it('says the same to one decimal place when both gaps print the same (1x, $100 a month, 5 years)', () => {
    // A real form input, default seed and 500 paths: both gaps print as -3.3%.
    const inputs = {
      ...DEFAULT_DCA_COMPARISON_INPUTS,
      leverageRatio: 1,
      monthlyContribution: 100,
      years: 5,
      startingBalance: 5000,
      indexMeanReturn: 0.1,
      indexVolatility: 0.16,
    };
    const sentence = dcaEffectSentence(simulateDcaComparison(inputs), '1x', inputs);
    expect(sentence).toContain('(−3.3% of the index median)');
    expect(sentence).toContain('(−3.3%). The two relative gaps are the same to one decimal place');
  });

  it('never says the gaps are the same when the two printed gaps differ (seeded grid at 1x)', () => {
    // 1x has no noise threshold, so near-equal gaps reach the near-zero branch. 120 seeded
    // inputs across the form's ranges, 200 paths each.
    const rng = createSeededRng(5150);
    const printed = (sentence: string) => {
      const toNumber = (text: string) => Number(text.replace('−', '-').replace('+', ''));
      const monthly = sentence.match(/\(([+−]?\d+\.\d)% of the index median\)/);
      const yearStart = sentence.match(/gives a gap of [^(]*\(([+−]?\d+\.\d)%\)/);
      return { monthly: monthly![1], yearStart: yearStart![1], points: Math.abs(toNumber(monthly![1]) - toNumber(yearStart![1])) };
    };
    let same = 0;
    let aboutOneTenth = 0;
    for (let k = 0; k < 120; k++) {
      const inputs = {
        ...DEFAULT_DCA_COMPARISON_INPUTS,
        leverageRatio: 1,
        paths: 200,
        seed: 1 + Math.floor(rng() * 1e6),
        years: 1 + Math.floor(rng() * 40),
        monthlyContribution: 50 + Math.floor(rng() * 2000),
        startingBalance: Math.floor(rng() * 50000),
        indexMeanReturn: -0.05 + rng() * 0.17,
        indexVolatility: 0.02 + rng() * 0.3,
      };
      const sentence = dcaEffectSentence(simulateDcaComparison(inputs), '1x', inputs);
      const gaps = printed(sentence);
      if (gaps.monthly !== gaps.yearStart) {
        expect(sentence, JSON.stringify(inputs)).not.toMatch(/gaps are the same|does not change the comparison/);
      }
      if (sentence.includes('the same to one decimal place')) {
        same++;
        expect(gaps.monthly, JSON.stringify(inputs)).toBe(gaps.yearStart);
      }
      if (sentence.includes('differ by about 0.1 percentage points')) {
        aboutOneTenth++;
        expect(gaps.points, JSON.stringify(inputs)).toBeCloseTo(0.1, 9);
      }
    }
    // The grid reaches both wordings of the near-zero branch.
    expect(same).toBeGreaterThan(0);
    expect(aboutOneTenth).toBeGreaterThan(0);
  });

  it('says the two timings are the same when the monthly contribution is 0', () => {
    const inputs = { ...DEFAULT_DCA_COMPARISON_INPUTS, leverageRatio: 1, years: 4, monthlyContribution: 0 };
    const sentence = dcaEffectSentence(simulateDcaComparison(inputs), '1x', inputs);
    expect(sentence).toMatch(
      /^With no monthly contribution the two timings are the same: under both, the 1x fund's median ends (above|below) the index fund's median by /
    );
    expect(sentence).not.toMatch(/\$0 a year|comes from when the money goes in|percentage points/);
  });

  it('says the funds produce the same balances under both timings when both gaps are zero', () => {
    const { inputs, result } = atLeverage(2);
    const zero: DcaComparisonResult = { ...result, dcaEffect: { dcaGap: 0, yearStartGap: 0.25 } };
    expect(dcaEffectSentence(zero, '2x', inputs)).toBe(
      'At these settings the 2x fund and the index fund produce the same balances under both timings.'
    );
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
    expect(live[0]).not.toHaveTextContent('Monthly vs start of each year');
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
        name: "Median ending balances in today's dollars for the index fund and the 2x fund with the same yearly amount invested monthly or at the start of each year; contributions as entered",
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
    const todayTiming = cells(/^Median ending balances/);
    const todayTail = cells(/^Drawdown and low-percentile/);
    const todaySentence = screen.getByText(/^With monthly contributions the 2x fund's median ends/).textContent;

    // Compact figures ("$320k") carry three significant digits: 0.5% tolerance.
    const near = (shown: number, expected: number) =>
      expect(Math.abs(shown - expected) / Math.abs(expected)).toBeLessThan(0.005);
    near(amount(todayTiming[0][1]), result.index.dca.p50 / FACTOR);
    near(amount(todayTiming[1][2]), result.leveraged.yearStart.p50 / FACTOR);
    near(amount(todayTiming[1][3]), result.dcaEffect.yearStartGap / FACTOR);
    near(amount(todayTiming[0][3]), result.dcaEffect.dcaGap / FACTOR);
    near(amount(todayTail[1][1]), result.index.dca.p10 / FACTOR);
    near(amount(todayTail[2][2]), result.leveraged.dca.p90 / FACTOR);
    // The relative gap and the drawdowns do not depend on the mode.
    const relative = todayTiming[0][3].replace(/^[^$]*\$[\d,.]+[kMB]?/, '');

    act(() => usePreferencesStore.getState().setDisplayMode('nominal'));

    expect(tileValue('Index fund, median ending balance')).toBe(Math.round(result.index.dca.p50));
    expect(tileValue('2x fund, median ending balance')).toBe(Math.round(result.leveraged.dca.p50));
    expect(tileValue('Index fund, median ending balance')).not.toBe(todayIndex);
    const futureTiming = cells(/^Median ending balances/);
    const futureTail = cells(/^Drawdown and low-percentile/);
    near(amount(futureTiming[0][1]), result.index.dca.p50);
    near(amount(futureTiming[1][2]), result.leveraged.yearStart.p50);
    near(amount(futureTiming[1][3]), result.dcaEffect.yearStartGap);
    near(amount(futureTiming[0][3]), result.dcaEffect.dcaGap);
    near(amount(futureTail[1][1]), result.index.dca.p10);
    near(amount(futureTail[2][2]), result.leveraged.dca.p90);
    expect(futureTiming[0][3].replace(/^[^$]*\$[\d,.]+[kMB]?/, '')).toBe(relative);
    expect(futureTail[0]).toEqual(todayTail[0]);
    // Amounts paid in stay as entered in both modes.
    expect(futureTiming.map((row) => row[0])).toEqual(todayTiming.map((row) => row[0]));
    expect(futureTiming[0][0]).toContain('$900/mo + $5.0k start');
    expect(futureTiming[1][0]).toBe('Start of each year$10.8k/yr + $5.0k start');

    const futureSentence = screen.getByText(/^With monthly contributions the 2x fund's median ends/).textContent;
    expect(futureSentence).not.toBe(todaySentence);
    expect(todaySentence).toContain('by $30.4k (+9.5% of the index median)');
    expect(futureSentence).toContain('by $54.8k (+9.5% of the index median)');
    expect(todaySentence).toContain('Investing the same $10.8k a year at the start of each year');
    expect(futureSentence).toContain('Investing the same $10.8k a year at the start of each year');
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
