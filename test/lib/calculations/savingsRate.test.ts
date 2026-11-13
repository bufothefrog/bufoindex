/**
 * requiredSavingsCurve: the retirement "Savings Rate Impact" chart's PMT
 * logic, moved out of SavingsRateChart.tsx in rebuild slice c2.
 *
 * The fixtures below were first captured from the old component (r / 12 a
 * month). PR 5 moved the curve to the one monthly-rate convention,
 * i = (1 + r)^(1/12) - 1, and the three tables were re-pinned from an
 * independent re-implementation of that formula (not from the module under
 * test); the zero-return table did not move. The remaining cases are
 * hand-computed.
 */

import { describe, expect, it } from 'vitest';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import { yearStartShareOf } from '@/lib/calculations/contributionSchedule';
import { ownerYearStartRaw } from '@/test/factories/accountsFixtures';
import { requiredSavingsCurve, type SavingsRateInputs } from '@/lib/calculations/savingsRate';

/** [retirementAge, requiredSavingsRate, requiredMonthlySavings] */
type Row = [number, number, number];

const rows = (inputs: SavingsRateInputs): Row[] =>
  requiredSavingsCurve(inputs).map((p) => [p.retirementAge, p.requiredSavingsRate, p.requiredMonthlySavings]);

// Exponentiation is not bit-identical across JavaScript engine versions (the
// V8 in Node 24 differs from Node 22 by one ulp for some arguments), so the
// computed columns are compared to nine significant digits, far tighter than
// anything the chart shows. Row counts and retirement ages stay exact.
const REL_TOL = 1e-9;
const COLUMNS = ['retirementAge', 'requiredSavingsRate', 'requiredMonthlySavings'] as const;

function expectRowsClose(actual: Row[], expected: Row[]): void {
  expect(actual.length, 'number of rows').toBe(expected.length);
  expected.forEach((want, i) => {
    const got = actual[i];
    expect(got[0], `row ${i} ${COLUMNS[0]}`).toBe(want[0]);
    for (const col of [1, 2] as const) {
      const diff = Math.abs(got[col] - want[col]);
      const ok = diff <= REL_TOL * Math.max(1, Math.abs(want[col]));
      expect(
        ok,
        `row ${i} (age ${want[0]}) ${COLUMNS[col]}: expected ${want[col]}, received ${got[col]}`,
      ).toBe(true);
    }
  });
}

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

describe('requiredSavingsCurve: re-pinned tables at the effective monthly rate', () => {
  // Before PR 5 (r / 12): age 45 39.796048695539085% / 3,316.34; age 60
  // 9.68914442360643% / 807.43; age 70 3.823944171098586% / 318.66.
  it('the old defaults: ages 45 to 70 at an 8% return', () => {
    expectRowsClose(rows(DEFAULTS), [
      [45, 41.196350593962656, 3433.029216163555],
      [46, 37.31690315934331, 3109.741929945276],
      [47, 33.85954931208871, 2821.6291093407262],
      [48, 30.767644527004105, 2563.970377250342],
      [49, 27.993960185997878, 2332.8300154998233],
      [50, 25.49880475890128, 2124.9003965751067],
      [51, 23.24857846353299, 1937.3815386277493],
      [52, 21.21464900375289, 1767.8874169794074],
      [53, 19.372468100573442, 1614.3723417144536],
      [54, 17.700870680632185, 1475.0725567193488],
      [55, 16.181514090815945, 1348.4595075679954],
      [56, 14.79842571101344, 1233.2021425844534],
      [57, 13.537635245496112, 1128.1362704580094],
      [58, 12.386873725048826, 1032.2394770874023],
      [59, 11.335325481060558, 944.6104567550465],
      [60, 10.373422494339026, 864.4518745282522],
      [61, 9.4926728775152, 791.0560731262667],
      [62, 8.685517032830486, 723.7930860692072],
      [63, 7.945206387680927, 662.1005323067438],
      [64, 7.265700656817977, 605.4750547348314],
      [65, 6.641580391085933, 553.4650325904944],
      [66, 6.06797220546005, 505.6643504550041],
      [67, 5.540484576340542, 461.7070480283785],
      [68, 5.05515249111309, 421.2627075927575],
      [69, 4.6083895455746875, 384.032462131224],
      [70, 4.196946334828646, 349.7455279023872],
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
    expectRowsClose(rows(inputs), [
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
    expectRowsClose(rows(inputs), [
      // Before PR 5: 218.92282893874392.
      [60, 100, 220.2263520239225],
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
    // 12% a year compounds monthly at i = 1.12^(1/12) - 1 = 0.00948879.
    // $4,000 / 4% = $100,000 needed at 45, 120 months out:
    // (1.12^10 - 1) / i = 2.1058482 / 0.00948879 = 221.92992, so
    // $100,000 / 221.92992 = $450.59 a month, $5,407.11 a year, 5.4071% of
    // $100,000. (At r / 12 before PR 5: $434.71, 5.2165%.)
    const [first] = requiredSavingsCurve({
      ...base,
      startingAge: 35,
      targetIncome: 4000,
      accumulationReturn: 0.12,
      currentIncome: 100000,
    });
    expect(first.retirementAge).toBe(45);
    expect(first.requiredMonthlySavings).toBeCloseTo(450.59, 2);
    expect(first.requiredSavingsRate).toBeCloseTo(5.4071, 4);
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

describe('requiredSavingsCurve: the effective monthly rate and the start-of-year share (PR 5)', () => {
  // E7: $40,000 / 4% = $1,000,000, S = 0, 20 years at 8%, income $100,000.
  const e7: SavingsRateInputs = {
    startingAge: 25,
    targetIncome: 40000,
    startingBalance: 0,
    accumulationReturn: 0.08,
    currentIncome: 100000,
  };
  const age45 = (inputs: SavingsRateInputs) => requiredSavingsCurve(inputs).find((p) => p.retirementAge === 45)!;

  it('E7 all monthly: A_m = (1.08^20 - 1) / i8 = 568.9991, PMT 1,757.4721 (21.0897%)', () => {
    // Before PR 5, at r / 12: ((1 + 0.08/12)^240 - 1) / (0.08/12) = 589.0204, PMT 1,697.7340 (20.373%).
    const point = age45(e7);
    expect(point.requiredMonthlySavings).toBeCloseTo(1757.4721, 4);
    expect(point.requiredSavingsRate).toBeCloseTo(21.0897, 4);
  });

  it('E7 share 1: A_y = 1.08 x 3.660957 / 0.08 = 49.42292 a year, T = 1e6 / (12 x 49.42292) = 1,686.1272 (20.234%)', () => {
    const point = age45({ ...e7, yearStartShare: 1 });
    expect(point.requiredMonthlySavings).toBeCloseTo(1686.1272, 4);
    expect(point.requiredSavingsRate).toBeCloseTo(20.2335, 3);
  });

  it('a share above 1 or NaN is clamped (to 1 and to 0)', () => {
    expect(age45({ ...e7, yearStartShare: 3 }).requiredMonthlySavings).toBeCloseTo(1686.1272, 4);
    expect(age45({ ...e7, yearStartShare: Number.NaN }).requiredMonthlySavings).toBeCloseTo(1757.4721, 4);
  });

  it('zero-return rows stay (need <= 0 gives 0 at any share)', () => {
    const curve = requiredSavingsCurve({ ...e7, startingBalance: 2_000_000, yearStartShare: 0.5 });
    expect(curve.every((p) => p.requiredMonthlySavings === 0 && p.requiredSavingsRate === 0)).toBe(true);
  });

  it('the default profile: 45 1,596.62 / 18.423%; 55 549.10 / 6.336%; 65 149.60 / 1.726%', () => {
    // Before PR 5: 45 1,542.35 / 17.796%; 50 897.75; 55 518.96 / 5.988%;
    // 60 285.70; 65 138.04 / 1.593%; 70 43.03.
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile());
    expect(yearStartShareOf(inputs.monthlySavings, inputs.yearStartSavings)).toBe(0);
    const curve = requiredSavingsCurve(inputs);
    const at = (age: number) => curve.find((p) => p.retirementAge === age)!;
    expect(at(45).requiredMonthlySavings).toBeCloseTo(1596.62, 2);
    expect(at(50).requiredMonthlySavings).toBeCloseTo(939.27, 2);
    expect(at(55).requiredMonthlySavings).toBeCloseTo(549.1, 2);
    expect(at(60).requiredMonthlySavings).toBeCloseTo(305.88, 2);
    expect(at(65).requiredMonthlySavings).toBeCloseTo(149.6, 2);
    expect(at(70).requiredMonthlySavings).toBeCloseTo(47.23, 2);
    expect(at(45).requiredSavingsRate).toBeCloseTo(18.423, 3);
    expect(at(55).requiredSavingsRate).toBeCloseTo(6.336, 3);
    expect(at(65).requiredSavingsRate).toBeCloseTo(1.726, 3);
  });

  it('the owner with the Roth IRA once a year: share 7,500 / 38,340 = 0.19562; 45 927.07, 50 327.80, 55 to 70 zero', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, normalizeProfile(ownerYearStartRaw()));
    const share = yearStartShareOf(inputs.monthlySavings, inputs.yearStartSavings);
    expect(share).toBeCloseTo(0.19562, 5);
    const withShare = requiredSavingsCurve({ ...inputs, yearStartShare: share });
    const allMonthly = requiredSavingsCurve(inputs);
    const at = (curve: typeof withShare, age: number) => curve.find((p) => p.retirementAge === age)!;
    // Before PR 5 (r / 12, all monthly): 902.98 (6.95%) and 315.90 (2.43%).
    expect(at(withShare, 45).requiredMonthlySavings).toBeCloseTo(927.07, 2);
    expect(at(withShare, 45).requiredSavingsRate).toBeCloseTo(7.13, 2);
    expect(at(withShare, 50).requiredMonthlySavings).toBeCloseTo(327.8, 2);
    expect(at(withShare, 50).requiredSavingsRate).toBeCloseTo(2.52, 2);
    // The convention alone (share 0).
    expect(at(allMonthly, 45).requiredMonthlySavings).toBeCloseTo(934.75, 2);
    expect(at(allMonthly, 50).requiredMonthlySavings).toBeCloseTo(330.51, 2);
    for (const age of [55, 60, 65, 70]) {
      expect(at(withShare, age).requiredMonthlySavings).toBe(0);
      expect(at(allMonthly, age).requiredMonthlySavings).toBe(0);
    }
  });
});
