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
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  dcaEffectSentence,
  LeverageResults,
  lumpSumScaleSentence,
  relativeGapNoisePoints,
} from '@/app/tools/leverage-comparison/components/LeverageResults';
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

afterEach(() => {
  cleanup();
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
