/**
 * requiredSavingsCurve: the retirement "Savings Rate Impact" chart's PMT
 * logic, moved out of SavingsRateChart.tsx in rebuild slice c2.
 *
 * The parity fixtures below were captured before the move: the old
 * component's useMemo body was copied verbatim into a scratch test and run on
 * these three inputs, and its output is pinned here point for point. The
 * remaining cases are hand-computed.
 */

import { describe, expect, it } from 'vitest';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import { requiredSavingsCurve, type SavingsRateInputs } from '@/lib/calculations/savingsRate';

/** [retirementAge, requiredSavingsRate, requiredMonthlySavings] */
type Row = [number, number, number];

const rows = (inputs: SavingsRateInputs): Row[] =>
  requiredSavingsCurve(inputs).map((p) => [p.retirementAge, p.requiredSavingsRate, p.requiredMonthlySavings]);

/** The old retirement store defaults (the calculator's first screen before the rebuild). */
const DEFAULTS: RetirementInputs = {
  startingAge: 25,
  retirementAge: 60,
  lifeExpectancy: 85,
  targetIncome: 80000,
  startingBalance: 10000,
  currentIncome: 100000,
  incomeAmount: 100000,
  incomePeriod: 'yearly',
  monthlySavings: 2000,
  necessaryMonthlyExpenses: 4000,
  accumulationReturn: 0.08,
  retirementReturn: 0.06,
  inflationRate: 0.03,
  socialSecurityAge: 67,
  socialSecurityBenefit: 30000,
  healthcareCostMultiplier: 1,
  volatility: 0.15,
  filingStatus: 'single',
  state: 'TX',
  riskProfile: 'tdf',
  effectiveTaxRate: null,
  estimatedAnnualHealthcareCost: null,
};

describe('requiredSavingsCurve: parity with the old SavingsRateChart numbers', () => {
  it('the old defaults: ages 45 to 70 at an 8% return', () => {
    expect(rows(DEFAULTS)).toEqual([
      [45, 39.796048695539085, 3316.3373912949232],
      [46, 35.97389919186833, 2997.8249326556943],
      [47, 32.57254728096351, 2714.3789400802925],
      [48, 29.535318125733657, 2461.2765104778045],
      [49, 26.81495811333875, 2234.579842778229],
      [50, 24.371755725197822, 2030.979643766485],
      [51, 22.172095916945263, 1847.6746597454387],
      [52, 20.18733559598924, 1682.2779663324366],
      [53, 18.392919904423994, 1532.7433253686663],
      [54, 16.76768116687541, 1397.3067639062842],
      [55, 15.293277869143019, 1274.4398224285849],
      [56, 13.953742037939682, 1162.8118364949735],
      [57, 12.735111301424626, 1061.2592751187187],
      [58, 11.625127662449318, 968.7606385374432],
      [59, 10.612989245932985, 884.4157704944154],
      [60, 9.68914442360643, 807.4287019672026],
      [61, 8.845120075630449, 737.0933396358707],
      [62, 8.073377531611706, 672.7814609676421],
      [63, 7.367191094154503, 613.9325911795419],
      [64, 6.7205450946053125, 560.0454245504427],
      [65, 6.128046241591053, 510.67052013258774],
      [66, 5.584848655778667, 465.4040546482222],
      [67, 5.086589481403171, 423.88245678359755],
      [68, 4.6293333580859475, 385.77777984049567],
      [69, 4.209524348967782, 350.79369574731516],
      [70, 3.823944171098586, 318.6620142582155],
    ]);
  });

  it('a zero return from 40: straight-line contributions, capped at 100% until age 57', () => {
    const inputs = {
      ...DEFAULTS,
      startingAge: 40,
      startingBalance: 50000,
      targetIncome: 60000,
      currentIncome: 90000,
      accumulationReturn: 0,
    };
    expect(rows(inputs)).toEqual([
      [50, 100, 12083.333333333334],
      [51, 100, 10984.848484848484],
      [52, 100, 10069.444444444445],
      [53, 100, 9294.871794871795],
      [54, 100, 8630.952380952382],
      [55, 100, 8055.555555555556],
      [56, 100, 7552.083333333333],
      [57, 94.77124183006535, 7107.843137254902],
      [58, 89.50617283950616, 6712.962962962963],
      [59, 84.7953216374269, 6359.649122807017],
      [60, 80.55555555555556, 6041.666666666667],
      [61, 76.71957671957671, 5753.9682539682535],
      [62, 73.23232323232324, 5492.424242424242],
      [63, 70.04830917874396, 5253.623188405797],
      [64, 67.12962962962963, 5034.722222222223],
      [65, 64.44444444444444, 4833.333333333333],
      [66, 61.96581196581196, 4647.4358974358975],
      [67, 59.67078189300412, 4475.308641975309],
      [68, 57.539682539682545, 4315.476190476191],
      [69, 55.55555555555556, 4166.666666666667],
      [70, 53.70370370370371, 4027.777777777778],
    ]);
  });

  it('a large balance from 50: capped at 60, then the balance alone gets there', () => {
    const inputs = {
      ...DEFAULTS,
      startingAge: 50,
      startingBalance: 900000,
      targetIncome: 60000,
      currentIncome: 1000,
      accumulationReturn: 0.05,
    };
    expect(rows(inputs)).toEqual([
      [60, 100, 218.92282893874392],
      [61, 0, 0],
      [62, 0, 0],
      [63, 0, 0],
      [64, 0, 0],
      [65, 0, 0],
      [66, 0, 0],
      [67, 0, 0],
      [68, 0, 0],
      [69, 0, 0],
      [70, 0, 0],
    ]);
  });
});

describe('requiredSavingsCurve: hand-computed cases', () => {
  const base: SavingsRateInputs = {
    startingAge: 40,
    targetIncome: 40000,
    startingBalance: 0,
    accumulationReturn: 0,
    currentIncome: 200000,
  };

  it('divides the gap evenly over the months at a zero return', () => {
    // $40,000 / 4% = $1,000,000. At 50: 120 months, $8,333.33 a month,
    // $100,000 a year, 50% of $200,000. At 70: 360 months, $2,777.78 a month,
    // $33,333.33 a year, 16.67%.
    const curve = requiredSavingsCurve(base);
    expect(curve[0].retirementAge).toBe(50);
    expect(curve[0].requiredMonthlySavings).toBeCloseTo(8333.33, 2);
    expect(curve[0].requiredSavingsRate).toBeCloseTo(50, 10);
    const last = curve[curve.length - 1];
    expect(last.retirementAge).toBe(70);
    expect(last.requiredMonthlySavings).toBeCloseTo(2777.78, 2);
    expect(last.requiredSavingsRate).toBeCloseTo(16.6667, 4);
  });

  it('uses the annuity payment at a positive return', () => {
    // 12% a year is 1% a month. $4,000 / 4% = $100,000 needed at 45, 120
    // months out: 1.01^120 = 3.300387, ((1.01^120) - 1) / 0.01 = 230.03869,
    // so $100,000 / 230.03869 = $434.71 a month, $5,216.51 a year, 5.2165%
    // of $100,000.
    const [first] = requiredSavingsCurve({
      ...base,
      startingAge: 35,
      targetIncome: 4000,
      accumulationReturn: 0.12,
      currentIncome: 100000,
    });
    expect(first.retirementAge).toBe(45);
    expect(first.requiredMonthlySavings).toBeCloseTo(434.71, 2);
    expect(first.requiredSavingsRate).toBeCloseTo(5.2165, 4);
  });

  it('nets the grown starting balance off the target', () => {
    // $500,000 at 0% stays $500,000, so contributions cover the other
    // $500,000: at 50, $500,000 / 120 = $4,166.67 a month, 25% of $200,000.
    const [first] = requiredSavingsCurve({ ...base, startingBalance: 500000 });
    expect(first.requiredMonthlySavings).toBeCloseTo(4166.67, 2);
    expect(first.requiredSavingsRate).toBeCloseTo(25, 10);
  });

  it('is zero at every age once the starting balance covers the target', () => {
    const curve = requiredSavingsCurve({ ...base, startingBalance: 1_000_000 });
    expect(curve).toHaveLength(21);
    expect(curve.every((p) => p.requiredSavingsRate === 0 && p.requiredMonthlySavings === 0)).toBe(true);
  });

  it('starts at 45 for a young saver and ten years out for an older one', () => {
    expect(requiredSavingsCurve({ ...base, startingAge: 20 })[0].retirementAge).toBe(45);
    expect(requiredSavingsCurve({ ...base, startingAge: 20 })).toHaveLength(26);
    expect(requiredSavingsCurve({ ...base, startingAge: 52 }).map((p) => p.retirementAge)).toEqual([
      62, 63, 64, 65, 66, 67, 68, 69, 70,
    ]);
  });

  it('has one point at a starting age of 60 and none after it', () => {
    expect(requiredSavingsCurve({ ...base, startingAge: 60 }).map((p) => p.retirementAge)).toEqual([70]);
    expect(requiredSavingsCurve({ ...base, startingAge: 61 })).toEqual([]);
  });

  it('caps the rate at 100% when there is no current income', () => {
    const [first] = requiredSavingsCurve({ ...base, currentIncome: 0 });
    expect(first.requiredSavingsRate).toBe(100);
    expect(first.requiredMonthlySavings).toBeCloseTo(8333.33, 2);
  });
});
