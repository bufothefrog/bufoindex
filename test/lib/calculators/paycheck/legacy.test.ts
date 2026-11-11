/**
 * The one-time import of the old 'paycheck-allocator-storage' localStorage
 * key (O7): readStorage on the old persist envelope, the frozen old
 * defaults, and importLegacyCalculatorStorage over the real paycheck
 * definition. Storage only: the old share links are not decoded.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_LEGACY, readPaycheckStorage } from '@/lib/calculators/paycheck/legacy';
import { importLegacyCalculatorStorage } from '@/lib/store/legacyImport';
import { useProfileStore } from '@/lib/store/profileStore';
import type { PaycheckProfile } from '@/lib/types';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const KEY = 'paycheck-allocator-storage';

/** The old store's defaults, as its getDefaultProfile() returned them (lastUpdated fixed). */
const OLD_DEFAULTS: PaycheckProfile = {
  income: {
    grossPaycheck: 2500,
    netPaycheck: 1900,
    frequency: 'bi-weekly',
    regularBonus: false,
    bonusAmount: 0,
    bonusFrequency: 'annual',
    monthlyGross: 5417,
    monthlyNet: 4123,
    gross: 5417,
    net: 4123,
    bonusExpected: 0,
  },
  taxes: {
    federalBracket: 0.22,
    state: 'CA',
    filingStatus: 'single',
    currentWithholding: { federal: 800, state: 200, fica: 382 },
  },
  benefits: {
    employer401k: {
      available: true,
      matchPercent: 0.5,
      matchLimit: 0.06,
      currentContribution: 0.03,
      contributionType: 'traditional',
      traditionalContribution: 0.03,
      rothContribution: 0,
      afterTaxAvailable: false,
      currentYTD: 0,
    },
    hsa: {
      eligible: false,
      employerContribution: 0,
      currentContribution: 0,
      currentYTD: 0,
      coverageType: 'individual',
      investmentStrategy: false,
    },
    ira: {
      hasIRA: false,
      accountTypes: { traditional: false, roth: false },
      currentContributions: { traditional: 0, roth: 0 },
      currentBalances: { traditional: 0, roth: 0 },
    },
    other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
  },
  debts: [],
  preferences: {
    emergencyFundMonths: 3,
    currentEmergencyFund: 0,
    emergencyFundAPY: 0.04,
    necessaryExpenses: 2500,
    funMoney: { min: 300, max: 600, current: 450 },
    age: 30,
    hasTaxableAccount: false,
    taxableAccountContribution: 0,
    isPeakEarnings: false,
    expectedRetirementBracket: 0.12,
    riskTolerance: 'moderate',
    optimizationGoal: 'balanced',
  },
  version: '1.0',
  lastUpdated: 0,
  source: 'user_input',
};

type Patch = { [K in keyof PaycheckProfile]?: unknown };

/** An old payload: zustand persist's envelope around the old partialized state. */
const envelope = (profile: Patch | Record<string, unknown>) => ({
  state: { profile, currentStep: 4, hasCalculatedOnce: true },
  version: 0,
});

/** The old defaults with some sections replaced (sections merge one level deep). */
function oldProfile(edit: (profile: PaycheckProfile) => void): PaycheckProfile {
  const profile = PAYCHECK_LEGACY.storageDefaults();
  edit(profile);
  return profile;
}

/**
 * `read` against `expected` leaf for leaf. The reader recomputes the monthly
 * income figures from the paycheck (the old defaults stored them rounded),
 * so those are compared to the cent.
 */
function expectRead(read: PaycheckProfile | null, expected: PaycheckProfile): void {
  expect(read).not.toBeNull();
  const { monthlyGross, monthlyNet, gross, net, ...income } = read!.income;
  const want = expected.income;
  expect({ ...read!, income }).toEqual({
    ...expected,
    income: { ...want, monthlyGross: undefined, monthlyNet: undefined, gross: undefined, net: undefined },
  });
  expect(monthlyGross).toBeCloseTo(want.monthlyGross, 0);
  expect(monthlyNet).toBeCloseTo(want.monthlyNet, 0);
  expect(gross).toBe(monthlyGross);
  expect(net).toBe(monthlyNet);
}

const store = (value: unknown) => localStorage.setItem(KEY, JSON.stringify(value));

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

describe('PAYCHECK_LEGACY', () => {
  it('reads the old key and keeps the old defaults frozen', () => {
    expect(PAYCHECK_LEGACY.storageKey).toBe(KEY);
    expect(PAYCHECK_LEGACY.storageDefaults()).toEqual(OLD_DEFAULTS);
    // A copy each time, so nothing can change the frozen table.
    expect(PAYCHECK_LEGACY.storageDefaults()).not.toBe(PAYCHECK_LEGACY.storageDefaults());
    expect(PAYCHECK_LEGACY.readStorage).toBe(readPaycheckStorage);
  });
});

describe('readPaycheckStorage', () => {
  it('reads the old defaults back as they were; the monthly figures recomputed from the paycheck', () => {
    // 2,500 every two weeks = 5,416.67 a month (stored rounded as 5,417); 1,900 = 4,116.67.
    expectRead(
      readPaycheckStorage(envelope(OLD_DEFAULTS)),
      oldProfile((profile) => {
        profile.income = { ...profile.income, monthlyGross: 5416.67, monthlyNet: 4116.67 };
      })
    );
  });

  it('fills the leaves an old payload lacks from the old defaults', () => {
    expectRead(
      readPaycheckStorage(envelope({ preferences: { age: 41 } })),
      oldProfile((profile) => {
        profile.income = { ...profile.income, monthlyGross: 5416.67, monthlyNet: 4116.67 };
        profile.preferences.age = 41;
      })
    );
  });

  it('keeps the old default for a leaf of the wrong type or outside its options', () => {
    const read = readPaycheckStorage(
      envelope({
        income: { grossPaycheck: 'abc', frequency: 'daily', netPaycheck: 1800 },
        taxes: { state: 12, filingStatus: 'marriedJoint' },
        preferences: { riskTolerance: 'reckless', age: null },
      })
    );
    expect(read?.income).toMatchObject({ grossPaycheck: 2500, frequency: 'bi-weekly', netPaycheck: 1800 });
    expect(read?.taxes).toMatchObject({ state: 'CA', filingStatus: 'marriedJoint' });
    expect(read?.preferences).toMatchObject({ riskTolerance: 'moderate', age: 30 });
  });

  it('recomputes the derived leaves as the old store kept them', () => {
    const read = readPaycheckStorage(
      envelope({
        income: { grossPaycheck: 3000, netPaycheck: 2200, frequency: 'semi-monthly', monthlyGross: 1 },
        preferences: { funMoney: { min: 200, max: 800, current: 1 } },
      })
    );
    // Twice a month: 3,000 x 2 = 6,000 gross; 2,200 x 2 = 4,400 net.
    expect(read?.income).toMatchObject({ monthlyGross: 6000, monthlyNet: 4400, gross: 6000, net: 4400 });
    expect(read?.preferences.funMoney).toEqual({ min: 200, max: 800, current: 500 });
  });

  it('reads IRA types and the taxable contribution only behind their old flags', () => {
    const hidden = readPaycheckStorage(
      envelope({
        benefits: { ira: { hasIRA: false, accountTypes: { traditional: true, roth: true } } },
        preferences: { hasTaxableAccount: false, taxableAccountContribution: 400 },
      })
    );
    expect(hidden?.benefits.ira).toMatchObject({ hasIRA: false, accountTypes: { traditional: false, roth: false } });
    expect(hidden?.preferences).toMatchObject({ hasTaxableAccount: false, taxableAccountContribution: 0 });

    const shown = readPaycheckStorage(
      envelope({
        benefits: { ira: { hasIRA: true, accountTypes: { traditional: false, roth: true } } },
        preferences: { hasTaxableAccount: true, taxableAccountContribution: 400 },
      })
    );
    expect(shown?.benefits.ira).toMatchObject({ hasIRA: true, accountTypes: { traditional: false, roth: true } });
    expect(shown?.preferences).toMatchObject({ hasTaxableAccount: true, taxableAccountContribution: 400 });
  });

  it('reads debt rows that have an id, each field over the row defaults', () => {
    const read = readPaycheckStorage(
      envelope({
        debts: [
          { id: 'a', name: 'Card', balance: 3000, interestRate: 0.22, minimumPayment: 90, extraPayment: 'x' },
          { name: 'No id', balance: 100 },
          { id: '', balance: 100 },
          'junk',
        ],
      })
    );
    expect(read?.debts).toEqual([
      { id: 'a', name: 'Card', balance: 3000, interestRate: 0.22, minimumPayment: 90, extraPayment: 0, taxDeductible: false },
    ]);
  });

  it('is null for anything that is not the old envelope', () => {
    expect(readPaycheckStorage(null)).toBeNull();
    expect(readPaycheckStorage([])).toBeNull();
    expect(readPaycheckStorage({ state: {} })).toBeNull();
    expect(readPaycheckStorage({ state: { profile: [] } })).toBeNull();
  });
});

describe('importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)', () => {
  it('writes only the values the visitor changed, marks them provided and removes the key', () => {
    store(
      envelope(
        oldProfile((profile) => {
          profile.income.grossPaycheck = 4200;
          profile.income.frequency = 'semi-monthly';
          profile.taxes.state = 'NY';
          profile.benefits.employer401k.contributionType = 'split';
          profile.benefits.employer401k.currentContribution = 0.1;
          profile.benefits.employer401k.rothContribution = 0.04;
          profile.benefits.hsa.eligible = true;
          profile.benefits.ira.hasIRA = true;
          profile.benefits.ira.accountTypes.roth = true;
          profile.debts = [
            { id: 'd1', name: 'Car', balance: 9000, interestRate: 0.06, minimumPayment: 250, extraPayment: 0, taxDeductible: false },
          ];
          profile.preferences.funMoney = { min: 200, max: 500, current: 350 };
          profile.preferences.optimizationGoal = 'wealth_maximization';
        })
      )
    );

    const imported = importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);

    expect(imported.sort()).toEqual(
      [
        'income.grossPerPaycheck',
        'income.frequency',
        'person.state',
        'workplace.contributionType',
        'workplace.contributionPercent',
        'workplace.rothContributionPercent',
        'hsa.eligible',
        'ira.roth',
        'debts',
        'spending.funMoneyMin',
        'spending.funMoneyMax',
        'assumptions.paycheck.optimizationGoal',
      ].sort()
    );
    const { profile } = useProfileStore.getState();
    expect(profile.income).toMatchObject({ grossPerPaycheck: 4200, frequency: 'semi-monthly' });
    expect(profile.person.state).toBe('NY');
    expect(profile.workplace).toMatchObject({ contributionType: 'split', contributionPercent: 0.1, rothContributionPercent: 0.04 });
    expect(profile.hsa.eligible).toBe(true);
    expect(profile.ira.roth).toBe(true);
    expect(profile.debts).toHaveLength(1);
    expect(profile.debts[0]).toMatchObject({ id: 'd1', name: 'Car', balance: 9000 });
    expect(profile.spending).toMatchObject({ funMoneyMin: 200, funMoneyMax: 500 });
    expect(profile.assumptions.paycheck.optimizationGoal).toBe('wealth_maximization');
    // Untouched old defaults are not imported: the profile keeps its own.
    expect(profile.person.age).toBe(30);
    expect(profile.spending.necessaryMonthly).toBe(3000);
    expect(profile.cash.emergencyFundBalance).toBe(5000);
    expect(profile.provided.sort()).toEqual(imported);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('never overrides an answer given since, and is idempotent', () => {
    resetProfileStore({ profile: { person: { state: 'WA' } } });
    store(envelope(oldProfile((profile) => {
      profile.taxes.state = 'NY';
      profile.preferences.necessaryExpenses = 3300;
    })));

    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual(['spending.necessaryMonthly']);
    expect(useProfileStore.getState().profile.person.state).toBe('WA');
    expect(useProfileStore.getState().profile.spending.necessaryMonthly).toBe(3300);
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
  });

  it('imports nothing from an untouched old store, and still removes the key', () => {
    store(envelope(OLD_DEFAULTS));
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
    expect(useProfileStore.getState().profile.provided).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('removes a corrupt payload without importing it', () => {
    localStorage.setItem(KEY, '{not json');
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
