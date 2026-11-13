/**
 * Leverage Comparison Test Suite
 *
 * Covers simulateDcaComparison (monthly lognormal model with common random
 * numbers across index DCA, leveraged DCA, and the index and leveraged
 * start-of-year streams), estimateAnnualDrag, horizonMonths and
 * percentileSorted.
 *
 * Model under test, per month:
 *   z ~ Normal((ln(1 + mu) - sigma^2 / 2) / 12, sigma / sqrt(12))
 *   index log return     = z - indexExpenseRatio / 12
 *   leveraged log return = L z + ((L - L^2) / 2) sigma^2 / 12
 *                          - ((L - 1) financingRate + expenseRatio) / 12
 *   DCA balance          = (balance + contribution) * exp(log return)
 *   start-of-year balance = (balance + yearStartDeposit(12 c, m - 1, months)) * exp(log return)
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  estimateAnnualDrag,
  horizonMonths,
  percentileSorted,
  simulateDcaComparison,
  type DcaComparisonInputs,
  type PathStats,
} from '@/lib/calculations/leverageComparison';
import {
  DEFAULT_FINANCING_RATE,
  INDEX_FUND_EXPENSE_RATIO,
  PROSHARES_SSO_EXPENSE_RATIO,
} from '@/lib/constants/leverage';

function makeInputs(overrides: Partial<DcaComparisonInputs> = {}): DcaComparisonInputs {
  return { ...DEFAULT_DCA_COMPARISON_INPUTS, paths: 200, ...overrides };
}

/** Closed-form DCA ending balance for a constant monthly log return g. */
function closedFormDca(contribution: number, start: number, g: number, months: number): number {
  let total = start * Math.exp(months * g);
  for (let k = 1; k <= months; k++) total += contribution * Math.exp(k * g);
  return total;
}

function expectAllEqual(stats: PathStats, value: number, digits = 6) {
  expect(stats.p10).toBeCloseTo(value, digits);
  expect(stats.p50).toBeCloseTo(value, digits);
  expect(stats.p90).toBeCloseTo(value, digits);
  expect(stats.mean).toBeCloseTo(value, digits);
}

describe('defaults and constants', () => {
  it('uses the sourced constants and the pinned contract defaults', () => {
    expect(DEFAULT_DCA_COMPARISON_INPUTS).toEqual({
      monthlyContribution: 900,
      years: 20,
      startingBalance: 5000,
      leverageRatio: 2,
      indexMeanReturn: 0.1,
      indexVolatility: 0.16,
      financingRate: 0.045,
      expenseRatio: 0.0089,
      indexExpenseRatio: 0.0003,
      paths: 500,
      seed: 20260812,
    });
    expect(DEFAULT_FINANCING_RATE).toBeCloseTo(0.045, 12);
    expect(PROSHARES_SSO_EXPENSE_RATIO).toBe(0.0089);
    expect(INDEX_FUND_EXPENSE_RATIO).toBe(0.0003);
  });
});

describe('horizonMonths', () => {
  it('converts years to whole months with a one-month floor', () => {
    expect(horizonMonths(20)).toBe(240);
    expect(horizonMonths(1.5)).toBe(18);
    expect(horizonMonths(0)).toBe(1);
    expect(horizonMonths(-3)).toBe(1);
    expect(horizonMonths(Number.NaN)).toBe(1);
  });
});

describe('percentileSorted', () => {
  it('interpolates linearly between ranks', () => {
    const sorted = [10, 20, 30, 40, 50];
    // rank = p * (n - 1): p10 -> 0.4 -> 10 + 0.4 * 10 = 14
    expect(percentileSorted(sorted, 0.1)).toBeCloseTo(14, 12);
    expect(percentileSorted(sorted, 0.5)).toBe(30);
    // p90 -> rank 3.6 -> 40 + 0.6 * 10 = 46
    expect(percentileSorted(sorted, 0.9)).toBeCloseTo(46, 12);
  });

  it('handles empty, single-element and out-of-range inputs', () => {
    expect(percentileSorted([], 0.5)).toBe(0);
    expect(percentileSorted([7], 0.9)).toBe(7);
    expect(percentileSorted([1, 2, 3], -1)).toBe(1);
    expect(percentileSorted([1, 2, 3], 2)).toBe(3);
  });
});

describe('estimateAnnualDrag', () => {
  it('(e) L=2, sigma 0.16, financing 0.045, expense 0.0089 -> 0.0795', () => {
    // ((4 - 2) / 2) * 0.16^2 = 0.0256; (2 - 1) * 0.045 = 0.045; + 0.0089
    // 0.0256 + 0.045 + 0.0089 = 0.0795
    expect(estimateAnnualDrag(2, 0.16, 0.045, 0.0089)).toBeCloseTo(0.0795, 12);
  });

  it('L=3 triples the decay term relative to L=2', () => {
    // ((9 - 3) / 2) * 0.0256 = 0.0768; 2 * 0.045 = 0.09; + 0.0089 = 0.1757
    expect(estimateAnnualDrag(3, 0.16, 0.045, 0.0089)).toBeCloseTo(0.1757, 12);
  });

  it('L=1 leaves only the expense ratio', () => {
    expect(estimateAnnualDrag(1, 0.16, 0.045, 0.0089)).toBeCloseTo(0.0089, 12);
  });

  it('is reported on the simulation result', () => {
    const result = simulateDcaComparison(makeInputs({ paths: 10 }));
    expect(result.annualDragEstimate).toBeCloseTo(0.0795, 12);
  });
});

describe('simulateDcaComparison: deterministic (zero volatility)', () => {
  const inputs = makeInputs({
    monthlyContribution: 100,
    startingBalance: 0,
    years: 1,
    leverageRatio: 2,
    indexMeanReturn: 0.1,
    indexVolatility: 0,
    financingRate: 0.045,
    expenseRatio: 0.0089,
    indexExpenseRatio: 0,
    paths: 25,
  });
  const result = simulateDcaComparison(inputs);

  // Monthly leveraged log return with sigma = 0:
  //   g = 2 * ln(1.1) / 12 - (0.045 + 0.0089) / 12 = 2 * ln(1.1) / 12 - 0.0539 / 12
  const g = (2 * Math.log(1.1)) / 12 - 0.0539 / 12;
  const gIndex = Math.log(1.1) / 12;

  it('(a) leveraged DCA matches 100 * sum_{k=1..12} exp(k g) for every percentile', () => {
    const expected = closedFormDca(100, 0, g, 12);
    expectAllEqual(result.leveraged.dca, expected, 6);
    expect(result.leveraged.dca.p10).toBe(result.leveraged.dca.p90);
  });

  it('(a) leveraged DCA ending balance equals the hand-computed 1293.2413', () => {
    // Hand arithmetic:
    //   ln(1.1) = 0.0953102, so 12 g = 2 ln(1.1) - 0.0539 = 0.1367204
    //   exp(12 g) = 1.21 * exp(-0.0539) = 1.21 * 0.9475268 = 1.1465075
    //   exp(g)    = exp(0.0113934) = 1.0114585
    //   sum_{k=1..12} exp(k g) = exp(g) (exp(12 g) - 1) / (exp(g) - 1)
    //                          = 1.0114585 * 0.1465075 / 0.0114585 = 12.932413
    //   ending balance = 100 * 12.932413 = 1293.2413
    expect(result.leveraged.dca.p50).toBeCloseTo(1293.2413, 3);
  });

  it('(a) index DCA follows the same closed form with g = ln(1.1) / 12', () => {
    // 100 * sum_{k=1..12} 1.1^(k/12) = 1264.0537 (index returns 10% a year, no costs)
    expectAllEqual(result.index.dca, closedFormDca(100, 0, gIndex, 12), 6);
    expect(result.index.dca.p50).toBeCloseTo(1264.0537, 3);
  });

  it('(a) the start-of-year stream puts the one yearly amount in at month 0 and grows it twelve months', () => {
    // One year: 12 * 100 = 1200 at month index 0.
    // index: 1200 * 1.1 = 1320; leveraged: 1200 * 1.21 * exp(-0.0539) = 1375.8090
    expectAllEqual(result.index.yearStart, 1320, 6);
    expectAllEqual(result.leveraged.yearStart, 1200 * Math.exp(12 * g), 6);
    expect(result.leveraged.yearStart.p50).toBeCloseTo(1375.809, 2);
  });

  it('has no drawdowns, never trails, and reports the gaps exactly', () => {
    expect(result.medianMaxDrawdown).toEqual({ index: 0, leveraged: 0 });
    expect(result.medianMonthsBehind).toBe(0);
    expect(result.probLeveragedBehindDca).toBe(0);
    expect(result.probLeveragedBehindYearStart).toBe(0);
    expect(result.dcaEffect.dcaGap).toBeCloseTo(
      closedFormDca(100, 0, g, 12) - closedFormDca(100, 0, gIndex, 12),
      6,
    );
    expect(result.dcaEffect.yearStartGap).toBeCloseTo(1200 * Math.exp(12 * g) - 1320, 6);
  });

  it('median path at month 1 is one contribution grown one month', () => {
    expect(result.medianPath[0].leveragedDca).toBe(0);
    expect(result.medianPath[1].leveragedDca).toBeCloseTo(100 * Math.exp(g), 9);
    expect(result.medianPath[1].indexDcaP10).toBeCloseTo(100 * Math.exp(gIndex), 9);
    expect(result.medianPath[12].leveragedDcaP90).toBeCloseTo(closedFormDca(100, 0, g, 12), 6);
  });

  it('starting balance compounds for the full horizon', () => {
    const withStart = simulateDcaComparison({ ...inputs, startingBalance: 1000 });
    expect(withStart.leveraged.dca.p50).toBeCloseTo(closedFormDca(100, 1000, g, 12), 6);
    expect(withStart.totalContributed).toBe(2200);
    // Start-of-year: (1000 + 1200) grown twelve months; index 2200 * 1.1 = 2420.
    expectAllEqual(withStart.index.yearStart, 2420, 6);
    expectAllEqual(withStart.leveraged.yearStart, 2200 * Math.exp(12 * g), 6);
  });

  it('a falling index produces a measurable drawdown and leveraged trailing', () => {
    const falling = simulateDcaComparison({ ...inputs, indexMeanReturn: -0.1 });
    // Index price after 12 months: 0.9, so max drawdown = 1 - 0.9 = 0.1
    expect(falling.medianMaxDrawdown.index).toBeCloseTo(0.1, 9);
    // Leveraged price: 0.81 * exp(-0.0539) = 0.767497, drawdown = 0.232503
    expect(falling.medianMaxDrawdown.leveraged).toBeCloseTo(1 - 0.81 * Math.exp(-0.0539), 9);
    expect(falling.medianMonthsBehind).toBe(12);
    expect(falling.probLeveragedBehindDca).toBe(1);
    expect(falling.probLeveragedBehindYearStart).toBe(1);
  });
});

describe('simulateDcaComparison: equivalences and reproducibility', () => {
  it('(b) L=1 with equal expense ratios gives leveraged == index for every stat', () => {
    const result = simulateDcaComparison(
      makeInputs({ leverageRatio: 1, expenseRatio: 0.0003, indexExpenseRatio: 0.0003 }),
    );
    expect(result.leveraged.dca).toEqual(result.index.dca);
    expect(result.leveraged.yearStart).toEqual(result.index.yearStart);
    expect(result.medianMaxDrawdown.leveraged).toBe(result.medianMaxDrawdown.index);
    expect(result.probLeveragedBehindDca).toBe(0);
    expect(result.probLeveragedBehindYearStart).toBe(0);
    expect(result.medianMonthsBehind).toBe(0);
    expect(result.dcaEffect).toEqual({ dcaGap: 0, yearStartGap: 0 });
    for (const point of result.medianPath) {
      expect(point.leveragedDca).toBe(point.indexDca);
      expect(point.leveragedDcaP10).toBe(point.indexDcaP10);
      expect(point.leveragedDcaP90).toBe(point.indexDcaP90);
    }
    expect(result.annualDragEstimate).toBeCloseTo(0.0003, 12);
  });

  it('(c) the same seed reproduces results exactly', () => {
    const a = simulateDcaComparison(makeInputs());
    const b = simulateDcaComparison(makeInputs());
    expect(a).toEqual(b);
  });

  it('(c) a different seed changes the median', () => {
    const a = simulateDcaComparison(makeInputs({ seed: 1 }));
    const b = simulateDcaComparison(makeInputs({ seed: 2 }));
    expect(a.leveraged.dca.p50).not.toBe(b.leveraged.dca.p50);
    expect(a.index.dca.p50).not.toBe(b.index.dca.p50);
  });

  it('(d) totalContributed is start + contribution * months, the same for both timings', () => {
    const inputs = makeInputs({ startingBalance: 5000, monthlyContribution: 900, years: 20 });
    const result = simulateDcaComparison(inputs);
    // 5000 + 900 * 240 = 221000
    expect(result.totalContributed).toBe(221000);

    // With zero volatility and zero return/costs both timings end at the total:
    // 5000 + 20 yearly amounts of 10,800 = 221000.
    const flat = simulateDcaComparison({
      ...inputs,
      indexMeanReturn: 0,
      indexVolatility: 0,
      financingRate: 0,
      expenseRatio: 0,
      indexExpenseRatio: 0,
      paths: 5,
    });
    expectAllEqual(flat.index.yearStart, 221000, 6);
    expectAllEqual(flat.leveraged.yearStart, 221000, 6);
    expectAllEqual(flat.index.dca, 221000, 6);
  });

  it('clamps negative contributions, balances and fractional path counts', () => {
    const result = simulateDcaComparison(
      makeInputs({ monthlyContribution: -50, startingBalance: -10, paths: 3.7, years: 1 }),
    );
    expect(result.totalContributed).toBe(0);
    expect(result.index.dca.p50).toBe(0);
    expect(result.medianPath).toHaveLength(13);
  });

  it('falls back to a single path when paths is not finite', () => {
    const result = simulateDcaComparison(makeInputs({ paths: Number.NaN, years: 1 }));
    expect(result.probLeveragedBehindDca === 0 || result.probLeveragedBehindDca === 1).toBe(true);
  });
});

describe('simulateDcaComparison: default inputs', () => {
  const result = simulateDcaComparison(DEFAULT_DCA_COMPARISON_INPUTS);

  it('(f) probabilities and drawdowns are fractions, medianPath has months + 1 points', () => {
    for (const p of [result.probLeveragedBehindDca, result.probLeveragedBehindYearStart]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    for (const d of [result.medianMaxDrawdown.index, result.medianMaxDrawdown.leveraged]) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(1);
    }
    expect(result.medianPath).toHaveLength(241);
    expect(result.medianPath[0].month).toBe(0);
    expect(result.medianPath[240].month).toBe(240);
    expect(result.medianMonthsBehind).toBeGreaterThanOrEqual(0);
    expect(result.medianMonthsBehind).toBeLessThanOrEqual(240);
  });

  it('(g) leveraged DCA has a lower 10th percentile than index DCA', () => {
    expect(result.leveraged.dca.p10).toBeLessThan(result.index.dca.p10);
  });

  it('leveraged outcomes are more dispersed and draw down further', () => {
    const leveragedSpread = result.leveraged.dca.p90 - result.leveraged.dca.p10;
    const indexSpread = result.index.dca.p90 - result.index.dca.p10;
    expect(leveragedSpread).toBeGreaterThan(indexSpread);
    expect(result.medianMaxDrawdown.leveraged).toBeGreaterThan(result.medianMaxDrawdown.index);
  });

  it('percentiles are ordered and the final median-path point matches the ending stats', () => {
    for (const stats of [result.index.dca, result.leveraged.dca, result.index.yearStart, result.leveraged.yearStart]) {
      expect(stats.p10).toBeLessThanOrEqual(stats.p50);
      expect(stats.p50).toBeLessThanOrEqual(stats.p90);
    }
    const last = result.medianPath[240];
    expect(last.indexDca).toBe(result.index.dca.p50);
    expect(last.leveragedDca).toBe(result.leveraged.dca.p50);
    expect(last.leveragedDcaP10).toBe(result.leveraged.dca.p10);
    expect(last.indexDcaP90).toBe(result.index.dca.p90);
    expect(result.dcaEffect.dcaGap).toBe(result.leveraged.dca.p50 - result.index.dca.p50);
    expect(result.dcaEffect.yearStartGap).toBe(result.leveraged.yearStart.p50 - result.index.yearStart.p50);
  });

  it('the index DCA median is near the deterministic median-growth path', () => {
    // Median monthly log return of the index fund: (ln 1.1 - 0.0128) / 12 - 0.0003 / 12
    const gMedian = (Math.log(1.1) - 0.0128 - 0.0003) / 12;
    const deterministic = closedFormDca(900, 5000, gMedian, 240);
    // A sum of lognormals has a median above the median-path value but in the
    // same neighbourhood; allow a 15% band.
    expect(result.index.dca.p50 / deterministic).toBeGreaterThan(0.9);
    expect(result.index.dca.p50 / deterministic).toBeLessThan(1.15);
  });

  // Regression guard against an accidental O(paths^2) or per-step allocation
  // blow-up. The bound is loose on purpose: CI runs the suite under coverage
  // instrumentation on shared runners, where a tight limit would flake.
  it('runs 500 paths x 240 months in well under 2 seconds', () => {
    simulateDcaComparison(DEFAULT_DCA_COMPARISON_INPUTS); // warm up the JIT
    const t0 = performance.now();
    simulateDcaComparison(DEFAULT_DCA_COMPARISON_INPUTS);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(2000);
  });
});

/**
 * Contract section 11, E11 and E15: L = 1, a 10% index return, no costs, no
 * volatility, no starting balance, 100 a month. Each month grows by
 * g = 1.1^(1/12) (the log drift ln(1.1) / 12).
 */
describe('simulateDcaComparison: start of each year against monthly (E11, E15)', () => {
  const base = makeInputs({
    monthlyContribution: 100,
    startingBalance: 0,
    leverageRatio: 1,
    indexMeanReturn: 0.1,
    indexVolatility: 0,
    financingRate: 0,
    expenseRatio: 0,
    indexExpenseRatio: 0,
    paths: 5,
  });
  const g = Math.pow(1.1, 1 / 12);
  const dcaClosedForm = (months: number) => (100 * g * (Math.pow(g, months) - 1)) / (g - 1);

  it('E11, 24 months: monthly 2654.5127, start of each year 1200 x 1.21 + 1200 x 1.1 = 2772.00', () => {
    const result = simulateDcaComparison({ ...base, years: 2 });
    expect(dcaClosedForm(24)).toBeCloseTo(2654.5127, 3);
    expectAllEqual(result.index.dca, 2654.5127, 3);
    expectAllEqual(result.leveraged.dca, 2654.5127, 3);
    expectAllEqual(result.index.yearStart, 2772, 6);
    expectAllEqual(result.leveraged.yearStart, 2772, 6);
    expect(result.totalContributed).toBe(2400);
  });

  it('E11, 18 months: the final yearly amount is prorated (1200 at month 0, 600 at month 12)', () => {
    const result = simulateDcaComparison({ ...base, years: 1.5 });
    // (1200 x 1.1 + 600) x 1.1^0.5 = 1920 x 1.0488088 = 2013.7130
    expectAllEqual(result.index.dca, 1942.7207, 3);
    expectAllEqual(result.index.yearStart, 2013.713, 3);
    expect(result.index.yearStart.p50).toBeCloseTo(1920 * Math.sqrt(1.1), 6);
    expect(result.totalContributed).toBe(1800);
    // With no growth both timings pay in the same 1,800.
    const flat = simulateDcaComparison({ ...base, years: 1.5, indexMeanReturn: 0 });
    expectAllEqual(flat.index.yearStart, 1800, 9);
    expectAllEqual(flat.index.dca, 1800, 9);
  });

  it('E15, 6 months: one prorated deposit of 600 at month 0', () => {
    const result = simulateDcaComparison({ ...base, years: 0.5 });
    // monthly 100 g (g^6 - 1) / (g - 1) = 616.9700; start of year 600 x 1.1^0.5 = 629.2853
    expectAllEqual(result.index.dca, 616.97, 3);
    expectAllEqual(result.index.yearStart, 629.2853, 3);
    expect(result.totalContributed).toBe(600);
  });
});

/**
 * The default profile's leverage inputs (500 a month, 40 years, 25,000 start,
 * 2x, 500 paths, the fixed seed). The monthly stream is the one the engine had
 * before the start-of-year stream replaced the whole-total-at-month-0 lump sum:
 * the figures below were measured at ec300fd (the builder also checked the
 * whole monthly result, medianPath included, bit for bit against the ec300fd
 * module). The start-of-year figures are contract section 7.
 */
describe('simulateDcaComparison: default profile inputs', () => {
  const inputs = makeInputs({ monthlyContribution: 500, years: 40, startingBalance: 25_000, paths: 500 });
  const result = simulateDcaComparison(inputs);

  it('keeps the monthly stream of ec300fd', () => {
    expect(result.index.dca.p10).toBeCloseTo(1_025_373.1480083336, 4);
    expect(result.index.dca.p50).toBeCloseTo(2_533_597.5967643997, 4);
    expect(result.index.dca.p90).toBeCloseTo(7_916_993.070988794, 4);
    expect(result.index.dca.mean).toBeCloseTo(3_772_792.131937432, 4);
    expect(result.leveraged.dca.p10).toBeCloseTo(530_895.3720385887, 4);
    expect(result.leveraged.dca.p50).toBeCloseTo(3_008_809.2754472755, 4);
    expect(result.leveraged.dca.p90).toBeCloseTo(29_466_998.99180678, 3);
    expect(result.leveraged.dca.mean).toBeCloseTo(14_770_605.475430474, 3);
    expect(result.probLeveragedBehindDca).toBe(0.404);
    expect(result.medianPath).toHaveLength(481);
    expect(result.medianPath[480].indexDca).toBe(result.index.dca.p50);
    expect(result.medianPath[480].leveragedDcaP90).toBe(result.leveraged.dca.p90);
  });

  it('adds the start-of-year stream: same total, p50 2,595,327.26 and 3,096,306.82, 40.4% behind', () => {
    expect(result.totalContributed).toBe(265_000);
    expect(result.index.yearStart.p50).toBeCloseTo(2_595_327.256646754, 2);
    expect(result.leveraged.yearStart.p50).toBeCloseTo(3_096_306.821326349, 2);
    expect(result.probLeveragedBehindYearStart).toBe(0.404);
    expect(result.dcaEffect.yearStartGap).toBeCloseTo(500_979.56, 2);
  });
});
