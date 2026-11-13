/**
 * Leverage bindings: the profile feeds DcaComparisonInputs exactly as the old
 * profile link did, every engine input is bound or engine-only, and the
 * definition's own check.
 *
 * Golden fixture. Each GOLDEN entry is a v1 'bufo-profile' payload (only the
 * leaves the comparison reads differ from the v1 default) and the engine
 * inputs the page used to run for it. The `inputs` were captured on
 * 2026-11-11, before slice c7 deleted
 * app/tools/leverage-comparison/components/queryParams.ts, as
 * inputsFromQuery(new URLSearchParams(query)) for the query of
 * leverageLink(migrateProfile(v1, 1)); that query is kept as `link`. The
 * payloads now load through normalizeProfile, as any stored profile does.
 *
 * Documented exceptions (no v1 fixture hits them): a derived contribution or
 * balance is no longer rounded to whole dollars (the calculator never
 * rounded a typed value), and a leverage ratio outside 1 to 3 is no longer
 * clamped but fails the form's bounds.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  type DcaComparisonInputs,
} from '@/lib/calculations/leverageComparison';
import {
  LEVERAGE_BINDINGS,
  LEVERAGE_ENGINE_ONLY,
  derivedMonthlyContribution,
  derivedStartingBalance,
  derivedYears,
} from '@/lib/calculators/leverage/bindings';
import { LEVERAGE_CALCULATOR, validateDcaComparisonInputs } from '@/lib/calculators/leverage/definition';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { isDerivedBinding } from '@/lib/fields/binding';
import { makeGet } from '@/lib/fields/paths';
import { applyProfileWrites, getDefaultFinancialProfile, normalizeProfile, patchWrites } from '@/lib/profile/defaults';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';

const V1_DEFAULT = {
  version: 1,
  updatedAt: 0,
  person: { age: 30, state: 'TX', filingStatus: 'single', retirementAge: 60 },
  income: { grossPerPaycheck: 3500, netPerPaycheck: 2600, frequency: 'bi-weekly' },
  spending: { necessaryMonthly: 3000, funMoneyMin: 300, funMoneyMax: 600, targetRetirementIncome: 80000 },
  cash: { emergencyFundBalance: 5000, emergencyFundApy: 0.04, targetMonths: 3 },
  workplace: { has401k: true, matchPercent: 0.5, matchLimit: 0.06, contributionPercent: 0.06 },
  investing: {
    investedBalance: 25000,
    monthlyContribution: 1500,
    taxableMonthlyContribution: 500,
    targetMix: '80-20',
    newCashThisMonth: 1000,
  },
  strategy: { leverageRatio: 2 },
  provided: [] as string[],
};

type V1Edits = {
  person?: Partial<typeof V1_DEFAULT.person>;
  investing?: Partial<typeof V1_DEFAULT.investing>;
  strategy?: Partial<typeof V1_DEFAULT.strategy>;
};

function v1(edits: V1Edits) {
  return {
    ...V1_DEFAULT,
    person: { ...V1_DEFAULT.person, ...edits.person },
    investing: { ...V1_DEFAULT.investing, ...edits.investing },
    strategy: { ...V1_DEFAULT.strategy, ...edits.strategy },
  };
}

/** The model assumptions every captured link carried (the defaults). */
const MARKET = {
  indexMeanReturn: 0.1,
  indexVolatility: 0.16,
  financingRate: 0.045,
  expenseRatio: 0.0089,
  indexExpenseRatio: 0.0003,
  paths: 500,
  seed: 20260812,
};

const GOLDEN: { name: string; edits: V1Edits; link: string; inputs: DcaComparisonInputs }[] = [
  {
    name: 'the v1 default',
    edits: {},
    link: '/tools/leverage-comparison?c=500&y=30&b=25000&l=2&from=profile',
    inputs: { monthlyContribution: 500, years: 30, startingBalance: 25000, leverageRatio: 2, ...MARKET },
  },
  {
    name: 'every v1 field answered',
    edits: {
      person: { age: 38, retirementAge: 58 },
      investing: { investedBalance: 140000, monthlyContribution: 2200, taxableMonthlyContribution: 900 },
      strategy: { leverageRatio: 1.5 },
    },
    link: '/tools/leverage-comparison?c=900&y=20&b=140000&l=1.5&from=profile',
    inputs: { monthlyContribution: 900, years: 20, startingBalance: 140000, leverageRatio: 1.5, ...MARKET },
  },
  {
    name: 'no taxable contribution (the total monthly contribution instead)',
    edits: {
      person: { age: 45, retirementAge: 67 },
      investing: { investedBalance: 60000, monthlyContribution: 1800, taxableMonthlyContribution: 0 },
      strategy: { leverageRatio: 3 },
    },
    link: '/tools/leverage-comparison?c=1800&y=22&b=60000&l=3&from=profile',
    inputs: { monthlyContribution: 1800, years: 22, startingBalance: 60000, leverageRatio: 3, ...MARKET },
  },
  {
    name: 'past the retirement age (horizon clamped to 1 year)',
    edits: { person: { age: 70, retirementAge: 65 }, investing: { taxableMonthlyContribution: 250 } },
    link: '/tools/leverage-comparison?c=250&y=1&b=25000&l=2&from=profile',
    inputs: { monthlyContribution: 250, years: 1, startingBalance: 25000, leverageRatio: 2, ...MARKET },
  },
  {
    name: 'a 67-year horizon (clamped to 60), nothing invested, 1x',
    edits: { person: { age: 18, retirementAge: 85 }, investing: { investedBalance: 0 }, strategy: { leverageRatio: 1 } },
    link: '/tools/leverage-comparison?c=500&y=60&b=0&l=1&from=profile',
    inputs: { monthlyContribution: 500, years: 60, startingBalance: 0, leverageRatio: 1, ...MARKET },
  },
  {
    name: 'no contribution and no balance',
    edits: { investing: { investedBalance: 0, monthlyContribution: 0, taxableMonthlyContribution: 0 } },
    link: '/tools/leverage-comparison?c=0&y=30&b=0&l=2&from=profile',
    inputs: { monthlyContribution: 0, years: 30, startingBalance: 0, leverageRatio: 2, ...MARKET },
  },
];

const withPatch = (patch: ProfilePatch): FinancialProfile =>
  applyProfileWrites(getDefaultFinancialProfile(), patchWrites(patch)).profile;

describe('golden: engineInputsFor equals the old profile link, read by the old query reader', () => {
  it.each(GOLDEN)('$name', ({ edits, inputs }) => {
    expect(engineInputsFor(LEVERAGE_CALCULATOR, normalizeProfile(v1(edits)))).toEqual(inputs);
  });
});

describe('every engine input is bound or engine-only', () => {
  it('binds each DcaComparisonInputs leaf once, or lists it with a reason', () => {
    const bound = LEVERAGE_BINDINGS.map((binding) => binding.engine);
    expect(new Set(bound).size).toBe(bound.length);
    const engineOnly = Object.keys(LEVERAGE_ENGINE_ONLY);
    expect([...bound, ...engineOnly].sort()).toEqual(Object.keys(DEFAULT_DCA_COMPARISON_INPUTS).sort());
    expect(engineOnly).toEqual(['paths', 'seed']);
    for (const reason of Object.values(LEVERAGE_ENGINE_ONLY)) expect(reason.length).toBeGreaterThan(20);
  });

  it('derives the three overridable inputs and copies the ratio and the five rates', () => {
    const derived = LEVERAGE_BINDINGS.filter(isDerivedBinding).map((binding) => binding.engine);
    expect(derived).toEqual(['monthlyContribution', 'years', 'startingBalance']);
    const direct = LEVERAGE_BINDINGS.filter((binding) => !isDerivedBinding(binding));
    expect(direct).toEqual([
      { profile: 'strategy.leverageRatio', engine: 'leverageRatio' },
      { profile: 'assumptions.leverage.indexMeanReturn', engine: 'indexMeanReturn' },
      { profile: 'assumptions.leverage.indexVolatility', engine: 'indexVolatility' },
      { profile: 'assumptions.leverage.financingRate', engine: 'financingRate' },
      { profile: 'assumptions.leverage.expenseRatio', engine: 'expenseRatio' },
      { profile: 'assumptions.leverage.indexExpenseRatio', engine: 'indexExpenseRatio' },
    ]);
  });
});

describe('leverage bindings', () => {
  it('runs the v2 defaults the same as the v1 default', () => {
    expect(engineInputsFor(LEVERAGE_CALCULATOR, getDefaultFinancialProfile())).toEqual(GOLDEN[0].inputs);
  });

  it('uses each override when it is set, unclamped (the form checks it)', () => {
    const profile = withPatch({ leverage: { monthlyContribution: 750, years: 12, startingBalance: 0 } });
    expect(engineInputsFor(LEVERAGE_CALCULATOR, profile)).toMatchObject({
      monthlyContribution: 750,
      years: 12,
      startingBalance: 0,
    });
    const tooLong = withPatch({ leverage: { years: 75 } });
    expect(engineInputsFor(LEVERAGE_CALCULATOR, tooLong).years).toBe(75);
  });

  it('reads the market assumptions from the profile', () => {
    const profile = withPatch({
      assumptions: {
        leverage: {
          indexMeanReturn: 0.02,
          indexVolatility: 0.25,
          financingRate: 0.06,
          expenseRatio: 0.0095,
          indexExpenseRatio: 0.001,
        },
      },
    });
    expect(engineInputsFor(LEVERAGE_CALCULATOR, profile)).toEqual({
      ...GOLDEN[0].inputs,
      indexMeanReturn: 0.02,
      indexVolatility: 0.25,
      financingRate: 0.06,
      expenseRatio: 0.0095,
      indexExpenseRatio: 0.001,
    });
  });

  it('derives the auto values from the profile, within the bounds', () => {
    const get = (values: ProfilePatch) => makeGet(withPatch(values));
    // Taxable first, then the total monthly contribution; clamped to $0..$1,000,000.
    expect(derivedMonthlyContribution(get({ investing: { taxableMonthlyContribution: 650 } }))).toBe(650);
    expect(derivedMonthlyContribution(get({ investing: { taxableMonthlyContribution: 0, monthlyContribution: 1200 } }))).toBe(1200);
    expect(derivedMonthlyContribution(get({ investing: { taxableMonthlyContribution: 2_500_000 } }))).toBe(1_000_000);
    expect(derivedMonthlyContribution(get({ investing: { taxableMonthlyContribution: -5, monthlyContribution: -10 } }))).toBe(0);
    // Not rounded: 512.5 stays 512.5 (the old query reader rounded it).
    expect(derivedMonthlyContribution(get({ investing: { taxableMonthlyContribution: 512.5 } }))).toBe(512.5);
    // Rounded years, clamped to 1..60: 64.6 - 30 = 34.6 -> 35.
    expect(derivedYears(get({ person: { age: 30, retirementAge: 64.6 } }))).toBe(35);
    expect(derivedYears(get({ person: { age: 50, retirementAge: 50 } }))).toBe(1);
    expect(derivedYears(get({ person: { age: 16, retirementAge: 85 } }))).toBe(60);
    // The invested balance, clamped to $0..$100,000,000.
    expect(derivedStartingBalance(get({ investing: { investedBalance: 33_000 } }))).toBe(33_000);
    expect(derivedStartingBalance(get({ investing: { investedBalance: 250_000_000 } }))).toBe(100_000_000);
  });
});

describe('validateDcaComparisonInputs', () => {
  it('asks for a contribution or a balance when both are zero', () => {
    const inputs = { ...DEFAULT_DCA_COMPARISON_INPUTS, monthlyContribution: 0, startingBalance: 0 };
    expect(validateDcaComparisonInputs(inputs)).toEqual({
      monthlyContribution: 'Enter a monthly contribution or a starting balance.',
    });
    expect(validateDcaComparisonInputs({ ...inputs, startingBalance: 1 })).toEqual({});
    expect(validateDcaComparisonInputs({ ...inputs, monthlyContribution: 1 })).toEqual({});
    expect(validateDcaComparisonInputs(DEFAULT_DCA_COMPARISON_INPUTS)).toEqual({});
  });

  it('shows that error with the results, whether the contribution is derived or an override', () => {
    const derived = normalizeProfile(v1(GOLDEN[5].edits));
    expect(prepareRun(LEVERAGE_CALCULATOR, derived).errors).toEqual({
      calculation: 'Enter a monthly contribution or a starting balance.',
    });
    const overridden = withPatch({ leverage: { monthlyContribution: 0, startingBalance: 0 } });
    expect(prepareRun(LEVERAGE_CALCULATOR, overridden).errors).toEqual({
      calculation: 'Enter a monthly contribution or a starting balance.',
    });
  });

  it('checks the calculator fields against their bounds, but not the intake-only facts', () => {
    const profile = withPatch({
      leverage: { monthlyContribution: 2_000_000, years: 0 },
      strategy: { leverageRatio: 4 },
      assumptions: { leverage: { indexMeanReturn: 0.5, expenseRatio: -0.01 } },
      person: { age: 60, retirementAge: 40 },
    });
    expect(prepareRun(LEVERAGE_CALCULATOR, profile).errors).toEqual({
      'leverage.monthlyContribution': 'Monthly contribution must be between $0 and $1,000,000.',
      'leverage.years': 'Years must be between 1 yrs and 60 yrs.',
      'strategy.leverageRatio': 'Leverage ratio must be between 1 and 3.',
      'assumptions.leverage.indexMeanReturn': 'Index expected annual return must be between -50% and 30%.',
      'assumptions.leverage.expenseRatio': 'Leveraged fund expense ratio must be between 0% and 5%.',
    });
  });

  it('runs at 250 ms and computes in-thread', () => {
    expect(LEVERAGE_CALCULATOR.id).toBe('leverage');
    expect(LEVERAGE_CALCULATOR.debounceMs).toBe(250);
    expect(LEVERAGE_CALCULATOR.engineBase()).toEqual(DEFAULT_DCA_COMPARISON_INPUTS);
    expect(LEVERAGE_CALCULATOR.engineBase()).not.toBe(DEFAULT_DCA_COMPARISON_INPUTS);
  });
});
