/**
 * The retirement bindings and definition: the golden test against the old
 * mapper's output for v1-shaped profiles, every RetirementInputs
 * leaf bound or engine-only, the derived income and filing-status leaves,
 * and engine errors mapped back to profile paths.
 *
 * Golden fixture. The expected inputs were captured on 2026-11-12 from the
 * former lib/profile/mappers.ts (deleted in phase 5): what its
 * toRetirementInputs returned for each profile, written as the leaves
 * that differ from its output for the v1 default (DEFAULT_INPUTS).
 */

import { describe, expect, it } from 'vitest';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import { RETIREMENT_BINDINGS, RETIREMENT_ENGINE_ONLY, filingStatusNote, retirementFilingStatus } from '@/lib/calculators/retirement/bindings';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_FORM } from '@/lib/calculators/retirement/form';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { isDerivedBinding } from '@/lib/fields/binding';
import { applyProfileWrites, getDefaultFinancialProfile, isProfilePath } from '@/lib/profile/defaults';
import type { Write } from '@/lib/fields/types';
import type { FilingStatus, FinancialProfile, PayFrequency, ProfilePatch } from '@/lib/profile/types';
import { answeredAt3bb0132, answeredEverywhere, defaultProfileAt3bb0132 } from '@/test/factories/profile-3bb0132';

/**
 * A v1-shaped profile: the given sections over the 3bb0132 defaults the
 * fixture was captured on, normalized the way any stored profile is, every
 * field answered (test/factories/profile-3bb0132.ts).
 */
const v1 = (patch: ProfilePatch = {}): FinancialProfile => answeredAt3bb0132(patch);

/** The 3bb0132 default profile, all answered, with `writes` applied (each must be a valid profile write). */
const withWrites = (writes: Write[]): FinancialProfile =>
  applyProfileWrites(answeredEverywhere(defaultProfileAt3bb0132()), writes).profile;

/** Every RetirementInputs leaf; the Record type makes the compiler reject a missing or extra one. */
const LEAVES: Readonly<Record<keyof RetirementInputs, true>> = {
  startingAge: true,
  retirementAge: true,
  lifeExpectancy: true,
  targetIncome: true,
  startingBalance: true,
  currentIncome: true,
  incomeAmount: true,
  incomePeriod: true,
  monthlySavings: true,
  necessaryMonthlyExpenses: true,
  accumulationReturn: true,
  retirementReturn: true,
  inflationRate: true,
  socialSecurityAge: true,
  socialSecurityBenefit: true,
  healthcareCostMultiplier: true,
  volatility: true,
  filingStatus: true,
  state: true,
  riskProfile: true,
  effectiveTaxRate: true,
  estimatedAnnualHealthcareCost: true,
};

const CUSTOM_V1: ProfilePatch = {
  person: { age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58 },
  income: { grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' },
  spending: { necessaryMonthly: 4200, funMoneyMin: 250, funMoneyMax: 900, targetRetirementIncome: 110000 },
  investing: { investedBalance: 140000, monthlyContribution: 2200, taxableMonthlyContribution: 900 },
};

/** The old mapper's output for the v1 default. */
const DEFAULT_INPUTS: RetirementInputs = {
  startingAge: 30,
  retirementAge: 60,
  lifeExpectancy: 85,
  targetIncome: 80000,
  startingBalance: 25000,
  currentIncome: 91000,
  incomeAmount: 3500,
  incomePeriod: 'biweekly',
  monthlySavings: 1500,
  necessaryMonthlyExpenses: 3000,
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

describe('golden: engineInputsFor equals the old mapper output for v1-shaped profiles', () => {
  it.each<[string, ProfilePatch, Partial<RetirementInputs>]>([
    ['the default', {}, {}],
    [
      'a custom profile (weekly pay, joint filing)',
      CUSTOM_V1,
      {
        startingAge: 38,
        retirementAge: 58,
        targetIncome: 110000,
        startingBalance: 140000,
        currentIncome: 109200,
        incomeAmount: 109200,
        incomePeriod: 'yearly',
        monthlySavings: 2200,
        necessaryMonthlyExpenses: 4200,
        filingStatus: 'marriedJoint',
        state: 'CA',
      },
    ],
    ['bi-weekly pay', { income: { frequency: 'bi-weekly', grossPerPaycheck: 3100 } }, { currentIncome: 80600, incomeAmount: 3100 }],
    [
      'semi-monthly pay',
      { income: { frequency: 'semi-monthly', grossPerPaycheck: 4000 } },
      { currentIncome: 96000, incomeAmount: 4000, incomePeriod: 'semimonthly' },
    ],
    [
      'monthly pay',
      { income: { frequency: 'monthly', grossPerPaycheck: 8000 }, person: { age: 51, retirementAge: 66 } },
      { startingAge: 51, retirementAge: 66, currentIncome: 96000, incomeAmount: 8000, incomePeriod: 'monthly' },
    ],
  ])('%s', (_name, patch, changed) => {
    expect(engineInputsFor(RETIREMENT_CALCULATOR, v1(patch))).toEqual({ ...DEFAULT_INPUTS, ...changed });
  });

  it('pins the default profile value by value (the PR 3 worked example)', () => {
    expect(engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile())).toEqual({
      startingAge: 25,
      retirementAge: 65,
      lifeExpectancy: 90,
      // Derived while unanswered: 12 x (3,000 + 450) = 41,400, to the nearest 1,000.
      targetIncome: 41000,
      startingBalance: 25000,
      // 4,000 every two weeks x 26.
      currentIncome: 104000,
      incomeAmount: 4000,
      incomePeriod: 'biweekly',
      monthlySavings: 1500,
      necessaryMonthlyExpenses: 3000,
      accumulationReturn: 0.08,
      retirementReturn: 0.06,
      inflationRate: 0.03,
      socialSecurityAge: 67,
      socialSecurityBenefit: 30000,
      healthcareCostMultiplier: 1,
      volatility: 0.15,
      filingStatus: 'single',
      state: 'CA',
      riskProfile: 'tdf',
      effectiveTaxRate: null,
      estimatedAnnualHealthcareCost: null,
    });
  });

  it('reads life expectancy, Social Security, healthcare and the assumptions from the profile (v2 leaves)', () => {
    const profile = withWrites([
      { path: 'person.lifeExpectancy', value: 92 },
      { path: 'retirementIncome.socialSecurityBenefit', value: 24000 },
      { path: 'retirementIncome.socialSecurityAge', value: 70 },
      { path: 'retirementIncome.annualHealthcareCost', value: 9000 },
      { path: 'assumptions.retirement.riskProfile', value: 'custom' },
      { path: 'assumptions.retirement.effectiveTaxRate', value: 0.18 },
      { path: 'assumptions.retirement.healthcareCostMultiplier', value: 1.5 },
    ]);
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, profile);
    expect(inputs).toEqual({
      ...DEFAULT_INPUTS,
      lifeExpectancy: 92,
      socialSecurityAge: 70,
      socialSecurityBenefit: 24000,
      healthcareCostMultiplier: 1.5,
      riskProfile: 'custom',
      effectiveTaxRate: 0.18,
      estimatedAnnualHealthcareCost: 9000,
    });
    expect(inputs).toMatchObject({
      lifeExpectancy: 92,
      socialSecurityBenefit: 24000,
      socialSecurityAge: 70,
      estimatedAnnualHealthcareCost: 9000,
      riskProfile: 'custom',
      effectiveTaxRate: 0.18,
      healthcareCostMultiplier: 1.5,
    });
  });

  it.each<[FilingStatus, RetirementInputs['filingStatus']]>([
    ['single', 'single'],
    ['marriedJoint', 'marriedJoint'],
    ['marriedSeparate', 'single'],
    ['headOfHousehold', 'single'],
  ])('maps filing status %s to %s in one binding (O10)', (status, expected) => {
    const profile = withWrites([{ path: 'person.filingStatus', value: status }]);
    expect(engineInputsFor(RETIREMENT_CALCULATOR, profile).filingStatus).toBe(expected);
    expect(retirementFilingStatus(status)).toBe(expected);
    expect(RETIREMENT_BINDINGS.filter((binding) => binding.engine === 'filingStatus')).toHaveLength(1);
  });

  it.each<[PayFrequency, number, RetirementInputs['incomePeriod'], number, number]>([
    ['weekly', 1000, 'yearly', 52000, 52000],
    ['bi-weekly', 3500, 'biweekly', 3500, 91000],
    ['semi-monthly', 4000, 'semimonthly', 4000, 96000],
    ['monthly', 8000, 'monthly', 8000, 96000],
  ])('enters %s pay of %d as period %s, amount %d, annual %d (O11)', (frequency, gross, period, amount, annual) => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, v1({ income: { frequency, grossPerPaycheck: gross } }));
    expect(inputs.incomePeriod).toBe(period);
    expect(inputs.incomeAmount).toBe(amount);
    expect(inputs.currentIncome).toBe(annual);
  });
});

describe('every RetirementInputs leaf is bound or engine-only', () => {
  const bound = new Set(RETIREMENT_BINDINGS.map((binding) => binding.engine));

  it('binds each leaf exactly once', () => {
    for (const leaf of Object.keys(LEAVES)) {
      expect(RETIREMENT_BINDINGS.filter((binding) => binding.engine === leaf), leaf).toHaveLength(1);
    }
    expect([...bound].sort()).toEqual(Object.keys(LEAVES).sort());
  });

  it('lists the income leaves as engine-only, each still derived by a binding', () => {
    expect(Object.keys(RETIREMENT_ENGINE_ONLY).sort()).toEqual(['currentIncome', 'incomeAmount', 'incomePeriod']);
    for (const [leaf, reason] of Object.entries(RETIREMENT_ENGINE_ONLY)) {
      expect(reason.length, leaf).toBeGreaterThan(0);
      const binding = RETIREMENT_BINDINGS.find((each) => each.engine === leaf)!;
      expect(isDerivedBinding(binding), leaf).toBe(true);
    }
  });

  it('reads every 1:1 leaf from a real profile path the form asks', () => {
    const asked = new Set(RETIREMENT_FORM.fields.map((spec) => spec.path));
    for (const binding of RETIREMENT_BINDINGS) {
      if (isDerivedBinding(binding)) continue;
      expect(isProfilePath(binding.profile), binding.profile).toBe(true);
      expect(asked.has(binding.profile), binding.profile).toBe(true);
    }
  });

  it('builds the engine base from the default profile, with every leaf', () => {
    const base = RETIREMENT_CALCULATOR.engineBase();
    expect(Object.keys(base).sort()).toEqual(Object.keys(LEAVES).sort());
    expect(base).toEqual(engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile()));
  });
});

describe('the definition', () => {
  it('runs debounced by 300 ms', () => {
    expect(RETIREMENT_CALCULATOR.id).toBe('retirement');
    expect(RETIREMENT_CALCULATOR.debounceMs).toBe(300);
    expect(RETIREMENT_CALCULATOR.form).toBe(RETIREMENT_FORM);
    expect(RETIREMENT_CALCULATOR.bindings).toBe(RETIREMENT_BINDINGS);
  });

  it('maps engine errors back to profile paths, the form message first', () => {
    const profile = withWrites([
      { path: 'person.age', value: 60 },
      { path: 'person.retirementAge', value: 60 },
    ]);
    expect(prepareRun(RETIREMENT_CALCULATOR, profile).errors).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
    // An engine-only rule reaches its field: a negative healthcare override.
    const negative = withWrites([
      { path: 'retirementIncome.annualHealthcareCost', value: -1 },
    ]);
    expect(RETIREMENT_CALCULATOR.validate(engineInputsFor(RETIREMENT_CALCULATOR, negative))).toEqual({
      estimatedAnnualHealthcareCost: 'Estimated healthcare cost cannot be negative.',
    });
    expect(prepareRun(RETIREMENT_CALCULATOR, negative).errors).toEqual({
      'retirementIncome.annualHealthcareCost': 'Annual healthcare cost must be at least $0.',
    });
  });
});

describe('filingStatusNote', () => {
  it('names the saved status when the model runs it as single', () => {
    expect(filingStatusNote('headOfHousehold')).toBe(
      'Retirement estimates model only single and married filing jointly, so head of household runs here as single.'
    );
    expect(filingStatusNote('marriedSeparate')).toBe(
      'Retirement estimates model only single and married filing jointly, so married filing separately runs here as single.'
    );
  });

  it('is null for the two statuses the model has', () => {
    expect(filingStatusNote('single')).toBeNull();
    expect(filingStatusNote('marriedJoint')).toBeNull();
  });
});
