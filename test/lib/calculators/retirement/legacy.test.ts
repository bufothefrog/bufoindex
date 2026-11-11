/**
 * The one-time import of the old 'retirement-calculator' localStorage key
 * (O7): readStorage on the old persist envelope, the frozen old defaults,
 * and importLegacyStorage(LEGACY_IMPORTS) with only the retirement key stored.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import { LEGACY_IMPORTS } from '@/lib/calculators/legacyImports';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_LEGACY, readRetirementStorage } from '@/lib/calculators/retirement/legacy';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { importLegacyStorage } from '@/lib/store/legacyImport';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
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

describe('importLegacyStorage: the retirement key alone', () => {
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

    const imported = importLegacyStorage(LEGACY_IMPORTS);

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
    // An untouched old default equal to the profile's default changes nothing;
    // one that differs comes in unprovided, so the inputs stay the old store's.
    expect(profile.investing.investedBalance).toBe(10000);
    expect(profile.person.retirementAge).toBe(60);
    expect(profile.provided.sort()).toEqual(imported);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('turns an old yearly salary into a paycheck of the frequency the profile holds', () => {
    // 120,000 a year / 26 = 4,615.38 bi-weekly (the profile default), to the cent.
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 120000, incomePeriod: 'yearly' }));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['income.grossPerPaycheck']);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 4615.38, frequency: 'bi-weekly' });
    expect(useProfileStore.getState().profile.provided).not.toContain('income.frequency');
  });

  it('never overrides an answer given since, and is idempotent', () => {
    resetProfileStore({ profile: { person: { age: 33 } } });
    store(envelope({ ...OLD_DEFAULTS, startingAge: 44, monthlySavings: 900 }));

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['investing.monthlyContribution']);
    expect(useProfileStore.getState().profile.person.age).toBe(33);
    expect(useProfileStore.getState().profile.investing.monthlyContribution).toBe(900);
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
  });

  it('answers nothing from an untouched old store, and still removes the key', () => {
    store(envelope(OLD_DEFAULTS));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(useProfileStore.getState().profile.provided).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the old defaults the profile defaults differ from, unprovided', () => {
    store(envelope(OLD_DEFAULTS));
    importLegacyStorage(LEGACY_IMPORTS);
    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(25);
    expect(profile.investing).toMatchObject({ investedBalance: 10000, monthlyContribution: 2000 });
    expect(profile.spending.necessaryMonthly).toBe(4000);
    // 100,000 a year in the profile's bi-weekly pay: 3,846.15.
    expect(profile.income).toMatchObject({ grossPerPaycheck: 3846.15, frequency: 'bi-weekly' });
    expect(profile.provided).toEqual([]);
  });
});

/**
 * An old yearly or hourly income has no pay frequency of its own: it comes
 * in as gross pay in the frequency the profile holds, so a frequency or a
 * take-home pay answered on the new paycheck page never makes it drop the
 * salary. Only the visitor's own monthly, bi-weekly or semi-monthly period
 * against a different answered frequency is a true conflict.
 */
describe('importLegacyStorage, the retirement key alone: a salary with no pay frequency of its own', () => {
  const currentIncome = () => engineInputsFor(RETIREMENT_CALCULATOR, useProfileStore.getState().profile).currentIncome;
  const income = () => useProfileStore.getState().profile.income;

  it('keeps an hourly wage under an answered weekly frequency', () => {
    resetProfileStore({ profile: { income: { frequency: 'weekly' } } });
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 30, incomePeriod: 'hourly' }));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['income.grossPerPaycheck']);
    // 30 x 2,080 = 62,400 a year = 1,200 a week.
    expect(income()).toMatchObject({ grossPerPaycheck: 1200, frequency: 'weekly' });
    expect(currentIncome()).toBeCloseTo(62400, 6);
  });

  it('keeps a yearly salary under an answered semi-monthly frequency', () => {
    resetProfileStore({ profile: { income: { frequency: 'semi-monthly' } } });
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 100800, incomePeriod: 'yearly' }));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['income.grossPerPaycheck']);
    expect(income()).toMatchObject({ grossPerPaycheck: 4200, frequency: 'semi-monthly' });
    expect(currentIncome()).toBeCloseTo(100800, 6);
  });

  it('keeps a yearly salary under an answered bi-weekly frequency', () => {
    resetProfileStore({ profile: { income: { frequency: 'bi-weekly' } } });
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 90000, incomePeriod: 'yearly' }));
    importLegacyStorage(LEGACY_IMPORTS);
    // 90,000 / 26 = 3,461.54 (to the cent): 90,000.04 a year.
    expect(income()).toMatchObject({ grossPerPaycheck: 3461.54, frequency: 'bi-weekly' });
    expect(currentIncome()).toBeCloseTo(90000, 1);
  });

  it('keeps a yearly salary and an answered take-home pay that it stays above', () => {
    resetProfileStore({ profile: { income: { netPerPaycheck: 2800 } } });
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 90000, incomePeriod: 'yearly' }));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['income.grossPerPaycheck']);
    expect(income()).toMatchObject({ grossPerPaycheck: 3461.54, netPerPaycheck: 2800, frequency: 'bi-weekly' });
  });

  it("skips the visitor's own monthly period against a different answered frequency", () => {
    resetProfileStore({ profile: { income: { frequency: 'weekly' } } });
    store(envelope({ ...OLD_DEFAULTS, incomeAmount: 5000, incomePeriod: 'monthly' }));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(income()).toMatchObject({ grossPerPaycheck: 3500, frequency: 'weekly' });
  });
});

describe('importLegacyStorage, the retirement key alone: the dollar display mode (O15)', () => {
  // The old store persisted { inputs, showAdvanced, hasCalculatedOnce, displayMode } (v3).
  const withMode = (displayMode: unknown, inputs: Partial<RetirementInputs> = {}) => ({
    state: { inputs: { ...OLD_DEFAULTS, ...inputs }, showAdvanced: false, hasCalculatedOnce: true, displayMode },
    version: 3,
  });

  beforeEach(() => {
    usePreferencesStore.setState({ displayMode: 'today' });
  });

  it('carries a saved future-dollars choice into the shared preference, along with the inputs', () => {
    store(withMode('nominal', { monthlySavings: 3100 }));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['investing.monthlyContribution']);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('carries it even when no input differs from the old defaults', () => {
    store(withMode('nominal'));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
  });

  it("keeps today's dollars for an old 'today' and for a payload that is not the old envelope", () => {
    store(withMode('today'));
    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
    localStorage.setItem(KEY, '{not json');
    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
  });
});
