/**
 * The one-time import of the old 'retirement-calculator' localStorage key
 * (O7): readStorage on the old persist envelope, the frozen old defaults,
 * and importLegacyCalculatorStorage over the real retirement definition.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_LEGACY, readRetirementStorage } from '@/lib/calculators/retirement/legacy';
import { importLegacyCalculatorStorage } from '@/lib/store/legacyImport';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const KEY = 'retirement-calculator';

/** The old store's defaults, as its getDefaultInputs() returned them. */
const OLD_DEFAULTS: RetirementInputs = {
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

/** An old persisted payload: zustand persist's envelope around the old partialized state. */
const envelope = (inputs: Partial<RetirementInputs> | Record<string, unknown>, version = 3) => ({
  state: { inputs, showAdvanced: true, hasCalculatedOnce: true, displayMode: 'nominal' },
  version,
});

const store = (value: unknown) => localStorage.setItem(KEY, JSON.stringify(value));

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

describe('RETIREMENT_LEGACY', () => {
  it('reads the old key and keeps the old defaults frozen', () => {
    expect(RETIREMENT_LEGACY.storageKey).toBe(KEY);
    expect(RETIREMENT_LEGACY.storageDefaults()).toEqual(OLD_DEFAULTS);
    // A copy each time, so nothing can change the frozen table.
    expect(RETIREMENT_LEGACY.storageDefaults()).not.toBe(RETIREMENT_LEGACY.storageDefaults());
  });
});

describe('readRetirementStorage', () => {
  it('fills the leaves an old payload lacks from the old defaults (a v2 payload has no tax or healthcare override)', () => {
    const v2: Record<string, unknown> = { ...OLD_DEFAULTS, startingAge: 41 };
    delete v2.effectiveTaxRate;
    delete v2.estimatedAnnualHealthcareCost;
    expect(readRetirementStorage(envelope(v2, 2))).toEqual({ ...OLD_DEFAULTS, startingAge: 41 });
  });

  it('migrates a retired risk profile to custom, as the old store did', () => {
    expect(readRetirementStorage(envelope({ riskProfile: 'aggressive' }, 1))?.riskProfile).toBe('custom');
    expect(readRetirementStorage(envelope({ riskProfile: 'tdf' }))?.riskProfile).toBe('tdf');
  });

  it('keeps the old default for a leaf of the wrong type', () => {
    const read = readRetirementStorage(
      envelope({ startingAge: 'abc', incomePeriod: 'weekly', filingStatus: 'headOfHousehold', effectiveTaxRate: 0.2, volatility: null })
    );
    expect(read).toEqual({ ...OLD_DEFAULTS, effectiveTaxRate: 0.2 });
  });

  it('derives the annual income from the stored entry', () => {
    const read = readRetirementStorage(envelope({ incomeAmount: 4000, incomePeriod: 'semimonthly', currentIncome: 1 }));
    expect(read?.currentIncome).toBe(96000);
  });

  it('is null for anything that is not the old envelope', () => {
    expect(readRetirementStorage(null)).toBeNull();
    expect(readRetirementStorage([])).toBeNull();
    expect(readRetirementStorage({ state: {} })).toBeNull();
    expect(readRetirementStorage({ state: { inputs: [] } })).toBeNull();
  });
});

describe('importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)', () => {
  it('writes only the values the visitor changed, marks them provided and removes the key', () => {
    store(
      envelope({
        ...OLD_DEFAULTS,
        startingAge: 44,
        incomeAmount: 4200,
        incomePeriod: 'semimonthly',
        filingStatus: 'marriedJoint',
        riskProfile: 'custom',
        volatility: 0.12,
        estimatedAnnualHealthcareCost: 9000,
      })
    );

    const imported = importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);

    expect(imported.sort()).toEqual(
      [
        'person.age',
        'income.grossPerPaycheck',
        'income.frequency',
        'person.filingStatus',
        'assumptions.retirement.riskProfile',
        'assumptions.retirement.volatility',
        'retirementIncome.annualHealthcareCost',
      ].sort()
    );
    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(44);
    expect(profile.income).toMatchObject({ grossPerPaycheck: 4200, frequency: 'semi-monthly' });
    expect(profile.person.filingStatus).toBe('marriedJoint');
    expect(profile.assumptions.retirement).toMatchObject({ riskProfile: 'custom', volatility: 0.12 });
    expect(profile.retirementIncome.annualHealthcareCost).toBe(9000);
    // Untouched old defaults are not imported: the profile keeps its own.
    expect(profile.investing.investedBalance).toBe(25000);
    expect(profile.person.retirementAge).toBe(60);
    expect(profile.provided.sort()).toEqual(imported);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('turns an old yearly salary into a monthly paycheck', () => {
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 120000, incomePeriod: 'yearly' }));
    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 10000, frequency: 'monthly' });
  });

  it('never overrides an answer given since, and is idempotent', () => {
    resetProfileStore({ profile: { person: { age: 33 } } });
    store(envelope({ ...OLD_DEFAULTS, startingAge: 44, monthlySavings: 900 }));

    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)).toEqual(['investing.monthlyContribution']);
    expect(useProfileStore.getState().profile.person.age).toBe(33);
    expect(useProfileStore.getState().profile.investing.monthlyContribution).toBe(900);
    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)).toEqual([]);
  });

  it('imports nothing from an untouched old store, and still removes the key', () => {
    store(envelope(OLD_DEFAULTS));
    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)).toEqual([]);
    expect(useProfileStore.getState().profile.provided).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
