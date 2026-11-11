/**
 * The one-time import of the old 'paycheck-allocator-storage' localStorage
 * key (O7): readStorage on the old persist envelope, the frozen old
 * defaults, and importLegacyStorage(LEGACY_IMPORTS) with the paycheck key
 * alone and with both old keys. Storage only: the old share links are not
 * decoded.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { LEGACY_IMPORTS } from '@/lib/calculators/legacyImports';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_LEGACY, readPaycheckStorage } from '@/lib/calculators/paycheck/legacy';
import { RETIREMENT_LEGACY } from '@/lib/calculators/retirement/legacy';
import { engineInputsFor, validateFor } from '@/lib/calculators/runtime';
import { NET_PAY_AT_MOST_GROSS } from '@/lib/fields/shared';
import { importLegacyStorage } from '@/lib/store/legacyImport';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
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
  usePreferencesStore.setState({ displayMode: 'today' });
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

describe('importLegacyStorage: the paycheck key alone', () => {
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

    const imported = importLegacyStorage(LEGACY_IMPORTS);

    expect(imported.sort()).toEqual(
      [
        'income.grossPerPaycheck',
        // The pay amounts and their frequency are one group: the untouched
        // take-home pay comes along so the three stay the old store's.
        'income.netPerPaycheck',
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
    expect(profile.income).toMatchObject({ grossPerPaycheck: 4200, netPerPaycheck: 1900, frequency: 'semi-monthly' });
    expect(profile.person.state).toBe('NY');
    expect(profile.workplace).toMatchObject({ contributionType: 'split', contributionPercent: 0.1, rothContributionPercent: 0.04 });
    expect(profile.hsa.eligible).toBe(true);
    expect(profile.ira.roth).toBe(true);
    expect(profile.debts).toHaveLength(1);
    expect(profile.debts[0]).toMatchObject({ id: 'd1', name: 'Car', balance: 9000 });
    expect(profile.spending).toMatchObject({ funMoneyMin: 200, funMoneyMax: 500 });
    expect(profile.assumptions.paycheck.optimizationGoal).toBe('wealth_maximization');
    // An untouched old default equal to the profile's default changes nothing;
    // one that differs comes in unprovided, so the inputs stay the old store's.
    expect(profile.person.age).toBe(30);
    expect(profile.spending.necessaryMonthly).toBe(2500);
    expect(profile.cash.emergencyFundBalance).toBe(0);
    expect(profile.investing.taxableMonthlyContribution).toBe(0);
    expect(profile.provided.sort()).toEqual(imported);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('never overrides an answer given since, and is idempotent', () => {
    resetProfileStore({ profile: { person: { state: 'WA' } } });
    store(envelope(oldProfile((profile) => {
      profile.taxes.state = 'NY';
      profile.preferences.necessaryExpenses = 3300;
    })));

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['spending.necessaryMonthly']);
    expect(useProfileStore.getState().profile.person.state).toBe('WA');
    expect(useProfileStore.getState().profile.spending.necessaryMonthly).toBe(3300);
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
  });

  it('answers nothing from an untouched old store, and still removes the key', () => {
    store(envelope(OLD_DEFAULTS));
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(useProfileStore.getState().profile.provided).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the old 3% election and the old none taxable account a visitor left untouched', () => {
    // The visitor changed their pay and state but never the 401(k) or the
    // taxable account: the old allocator ran them at 3% and $0.
    store(
      envelope(
        oldProfile((profile) => {
          profile.income.grossPaycheck = 4200;
          profile.income.netPaycheck = 3050;
          profile.income.frequency = 'semi-monthly';
          profile.taxes.state = 'NY';
        })
      )
    );

    importLegacyStorage(LEGACY_IMPORTS);
    const run = engineInputsFor(PAYCHECK_CALCULATOR, useProfileStore.getState().profile);
    expect(run.benefits.employer401k).toMatchObject({ currentContribution: 0.03, traditionalContribution: 0.03 });
    expect(run.preferences).toMatchObject({ hasTaxableAccount: false, taxableAccountContribution: 0 });
    // Not answers: the intake still asks for them.
    expect(useProfileStore.getState().profile.provided).not.toContain('workplace.contributionPercent');
    expect(useProfileStore.getState().profile.provided).not.toContain('investing.taxableMonthlyContribution');
  });

  it('never writes the old 3% over a 401(k) election answered since', () => {
    resetProfileStore({ profile: { workplace: { contributionPercent: 0.1 } } });
    store(envelope(OLD_DEFAULTS));
    importLegacyStorage(LEGACY_IMPORTS);
    expect(useProfileStore.getState().profile.workplace.contributionPercent).toBe(0.1);
  });

  it('removes a corrupt payload without importing it', () => {
    localStorage.setItem(KEY, '{not json');
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('importLegacyStorage, the paycheck key alone: coupled values', () => {
  const plan = () => engineInputsFor(PAYCHECK_CALCULATOR, useProfileStore.getState().profile).benefits.employer401k;

  it('imports a switch to a split election whole, so the plan runs as the old store did', () => {
    // What the old BenefitsInputCard stored on a switch to Split: the 3%
    // default halved, the total itself unchanged.
    store(
      envelope(
        oldProfile((profile) => {
          profile.benefits.employer401k.contributionType = 'split';
          profile.benefits.employer401k.traditionalContribution = 0.015;
          profile.benefits.employer401k.rothContribution = 0.015;
        })
      )
    );

    expect(importLegacyStorage(LEGACY_IMPORTS).sort()).toEqual(
      ['workplace.contributionType', 'workplace.contributionPercent', 'workplace.rothContributionPercent'].sort()
    );
    expect(plan()).toMatchObject({
      contributionType: 'split',
      currentContribution: 0.03,
      traditionalContribution: 0.015,
      rothContribution: 0.015,
    });
  });

  it('imports a changed pay frequency with the pay amounts it goes with', () => {
    store(envelope(oldProfile((profile) => {
      profile.income.frequency = 'monthly';
    })));

    expect(importLegacyStorage(LEGACY_IMPORTS).sort()).toEqual(
      ['income.frequency', 'income.grossPerPaycheck', 'income.netPerPaycheck'].sort()
    );
    const { income } = engineInputsFor(PAYCHECK_CALCULATOR, useProfileStore.getState().profile);
    expect(income).toMatchObject({ grossPaycheck: 2500, netPaycheck: 1900, frequency: 'monthly', monthlyGross: 2500 });
  });

  it('skips the whole group when one of its paths was answered since', () => {
    resetProfileStore({ profile: { income: { grossPerPaycheck: 4100 } } });
    store(envelope(oldProfile((profile) => {
      profile.income.frequency = 'monthly';
    })));

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 4100, frequency: 'bi-weekly' });
  });
});

describe('importLegacyStorage, the paycheck key alone: the dollar display mode (O15)', () => {
  const withMode = (displayMode: unknown) => ({ state: { profile: OLD_DEFAULTS, displayMode }, version: 0 });

  it('keeps a future-dollars preference chosen since, whatever the old key saved', () => {
    usePreferencesStore.setState({ displayMode: 'nominal' });
    store(withMode('today'));
    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
  });

  it('carries a saved future-dollars choice into the shared preference', () => {
    store(withMode('nominal'));
    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("leaves the preference alone for today's dollars or an unknown mode", () => {
    store(withMode('today'));
    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
    store(withMode('sideways'));
    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
  });
});

/**
 * Both old keys in one call: the paycheck key is imported first (its pay is
 * the complete record), then the retirement key against the profile it left.
 * When both hold the visitor's own pay, the paycheck record stays and the
 * retirement salary is dropped unless it writes the same values.
 */
describe('importLegacyStorage: both old keys', () => {
  const RETIREMENT_KEY = RETIREMENT_LEGACY.storageKey;
  const storeRetirement = (inputs: Record<string, unknown>, displayMode: unknown = 'today') =>
    localStorage.setItem(
      RETIREMENT_KEY,
      JSON.stringify({ state: { inputs: { ...RETIREMENT_LEGACY.storageDefaults(), ...inputs }, displayMode }, version: 3 })
    );
  const storePaycheck = (edit: (profile: PaycheckProfile) => void, displayMode: unknown = 'today') =>
    store({ ...envelope(oldProfile(edit)), state: { ...envelope(oldProfile(edit)).state, displayMode } });
  const storePay = (gross: number, net: number, frequency: PaycheckProfile['income']['frequency']) =>
    storePaycheck((profile) => {
      profile.income.grossPaycheck = gross;
      profile.income.netPaycheck = net;
      profile.income.frequency = frequency;
    });
  const income = () => useProfileStore.getState().profile.income;

  beforeEach(() => {
    usePreferencesStore.setState({ displayMode: 'today' });
  });

  it('imports the paycheck record whole when the retirement key held the same pay', () => {
    storeRetirement({ incomeAmount: 4200, incomePeriod: 'semimonthly' });
    storePay(4200, 3050, 'semi-monthly');

    expect(importLegacyStorage(LEGACY_IMPORTS).sort()).toEqual(['income.frequency', 'income.grossPerPaycheck', 'income.netPerPaycheck']);
    expect(income()).toMatchObject({ grossPerPaycheck: 4200, netPerPaycheck: 3050, frequency: 'semi-monthly' });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(RETIREMENT_KEY)).toBeNull();
  });

  it.each([
    ['monthly 5,000', { incomeAmount: 5000, incomePeriod: 'monthly' }],
    ['yearly 90,000', { incomeAmount: 90000, incomePeriod: 'yearly' }],
    ['yearly 120,000', { incomeAmount: 120000, incomePeriod: 'yearly' }],
  ] as const)('keeps the paycheck record and drops a retirement salary of another income (%s)', (_, inputs) => {
    storeRetirement(inputs);
    storePay(4200, 3050, 'semi-monthly');

    importLegacyStorage(LEGACY_IMPORTS);
    expect(income()).toMatchObject({ grossPerPaycheck: 4200, netPerPaycheck: 3050, frequency: 'semi-monthly' });
    expect([...useProfileStore.getState().profile.provided].sort()).toEqual([
      'income.frequency',
      'income.grossPerPaycheck',
      'income.netPerPaycheck',
    ]);
  });

  it.each([
    // 100,800 a year is 4,200 semi-monthly.
    ['yearly 100,800', { incomeAmount: 100800, incomePeriod: 'yearly' }, { gross: 4200, net: 3050, frequency: 'semi-monthly' }],
    ['yearly 120,000', { incomeAmount: 120000, incomePeriod: 'yearly' }, { gross: 10000, net: 7000, frequency: 'monthly' }],
    ['yearly 104,000', { incomeAmount: 104000, incomePeriod: 'yearly' }, { gross: 2000, net: 1500, frequency: 'weekly' }],
    ['hourly 50', { incomeAmount: 50, incomePeriod: 'hourly' }, { gross: 2000, net: 1500, frequency: 'weekly' }],
    ['hourly 50', { incomeAmount: 50, incomePeriod: 'hourly' }, { gross: 4000, net: 2900, frequency: 'bi-weekly' }],
  ] as const)('keeps the paycheck record after a retirement %s salary of the same income', (_, inputs, pay) => {
    storeRetirement(inputs);
    storePay(pay.gross, pay.net, pay.frequency);

    importLegacyStorage(LEGACY_IMPORTS);
    expect(income()).toMatchObject({ grossPerPaycheck: pay.gross, netPerPaycheck: pay.net, frequency: pay.frequency });
  });

  it('never writes the same gross pay number under another frequency', () => {
    // 104,000 a year is 4,000 bi-weekly; the allocator's 4,000 weekly is not the same pay.
    storeRetirement({ incomeAmount: 104000, incomePeriod: 'yearly' });
    storePay(4000, 3000, 'weekly');

    importLegacyStorage(LEGACY_IMPORTS);
    expect(income()).toMatchObject({ grossPerPaycheck: 4000, netPerPaycheck: 3000, frequency: 'weekly' });
  });

  it("imports the paycheck key's own pay over the retirement key's untouched old default salary", () => {
    storeRetirement({});
    storePay(4200, 3050, 'semi-monthly');

    importLegacyStorage(LEGACY_IMPORTS);
    expect(income()).toMatchObject({ grossPerPaycheck: 4200, netPerPaycheck: 3050, frequency: 'semi-monthly' });
  });

  it('imports a retirement salary over the untouched paycheck record, the take-home pay at its old share', () => {
    // The old allocator's untouched 1,900 of 2,500 (76%) applied to 120,000 a year, 4,615.38 bi-weekly.
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });
    storePaycheck(() => {});

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['income.grossPerPaycheck']);
    expect(income()).toMatchObject({ grossPerPaycheck: 4615.38, netPerPaycheck: 3507.69, frequency: 'bi-weekly' });
    expect(useProfileStore.getState().profile.provided).toEqual(['income.grossPerPaycheck']);
  });

  it('never carries the saved take-home share over a take-home pay answered before the import', () => {
    resetProfileStore({ profile: { income: { netPerPaycheck: 3000 } } });
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });
    storePaycheck(() => {});

    importLegacyStorage(LEGACY_IMPORTS);
    expect(income()).toMatchObject({ grossPerPaycheck: 4615.38, netPerPaycheck: 3000, frequency: 'bi-weekly' });
  });

  it('carries a future-dollars mode saved in either key, once', () => {
    storeRetirement({ monthlySavings: 3100 }, 'nominal');
    storePaycheck((profile) => {
      profile.preferences.necessaryExpenses = 3300;
    }, 'today');

    expect(importLegacyStorage(LEGACY_IMPORTS).sort()).toEqual(['investing.monthlyContribution', 'spending.necessaryMonthly']);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    usePreferencesStore.getState().setDisplayMode('today');
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
  });

  it("leaves the preference alone when no key saved future dollars", () => {
    storeRetirement({}, 'today');
    storePaycheck(() => {}, 'sideways');

    importLegacyStorage(LEGACY_IMPORTS);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
  });
});

/**
 * The retirement key's income group writes gross pay (and, for a period
 * that has one, the frequency) but no take-home pay. When it changes the
 * pay, the take-home pay the profile holds keeps its share of gross pay
 * (net / gross, the same in any frequency, capped at 1), applied to the new
 * gross: it never sits under another frequency's unit and never above the
 * new gross.
 */
describe('importLegacyStorage: the take-home pay keeps its share of gross pay', () => {
  const storeRetirement = (inputs: Record<string, unknown>) =>
    localStorage.setItem(
      RETIREMENT_LEGACY.storageKey,
      JSON.stringify({ state: { inputs: { ...RETIREMENT_LEGACY.storageDefaults(), ...inputs } }, version: 3 })
    );
  const paycheckIncome = () => engineInputsFor(PAYCHECK_CALCULATOR, useProfileStore.getState().profile).income;
  const paycheckErrors = () => validateFor(PAYCHECK_CALCULATOR, useProfileStore.getState().profile);

  it('applies the profile default share when only the retirement key is there, salary untouched', () => {
    storeRetirement({ startingAge: 40 });

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['person.age']);
    // 100,000 a year is 3,846.15 bi-weekly; 2,600 of 3,500 (the profile default) applied to it.
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 3846.15, netPaycheck: 2857.14, frequency: 'bi-weekly' });
    expect(useProfileStore.getState().profile.provided).toEqual(['person.age']);
  });

  it.each([
    ['a yearly salary of 50,000', { incomeAmount: 50000, incomePeriod: 'yearly' }, 1923.08, 'bi-weekly', 1428.57],
    ['an hourly wage of 25', { incomeAmount: 25, incomePeriod: 'hourly' }, 2000, 'bi-weekly', 1485.71],
    ['a monthly paycheck of 3,000', { incomeAmount: 3000, incomePeriod: 'monthly' }, 3000, 'monthly', 2228.57],
    ['a bi-weekly paycheck of 2,000', { incomeAmount: 2000, incomePeriod: 'biweekly' }, 2000, 'bi-weekly', 1485.71],
  ] as const)(
    'keeps the take-home pay below a retirement salary under the old take-home amount: %s',
    (_, retirement, gross, frequency, net) => {
      storeRetirement(retirement);

      importLegacyStorage(LEGACY_IMPORTS);
      const income = paycheckIncome();
      expect(income).toMatchObject({ grossPaycheck: gross, frequency });
      expect(income.netPaycheck).toBeCloseTo(net, 2);
      expect(income.netPaycheck).toBeLessThanOrEqual(income.grossPaycheck);
      expect(Object.values(paycheckErrors())).not.toContain(NET_PAY_AT_MOST_GROSS.message);
      expect(useProfileStore.getState().profile.provided).not.toContain('income.netPerPaycheck');
    }
  );

  it("lets the retirement key's old default salary replace the paycheck key's when both are untouched", () => {
    store(envelope(oldProfile(() => {})));
    storeRetirement({ startingAge: 40 });

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual(['person.age']);
    // The paycheck key's 2,500 / 1,900 bi-weekly comes in first, then the
    // retirement default of 100,000 a year (3,846.15 bi-weekly) replaces the
    // gross pay; 1,900 of 2,500 is 76%: 2,923.07.
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 3846.15, netPaycheck: 2923.07, frequency: 'bi-weekly' });
    expect(useProfileStore.getState().profile.provided).toEqual(['person.age']);
  });

  it('caps the share at 1 when the saved take-home pay is above gross pay', () => {
    // A saved take-home pay above gross pay keeps a share of 1: the new gross.
    store(envelope(oldProfile((profile) => {
      profile.income.grossPaycheck = 1000;
      profile.income.netPaycheck = 1500;
    })));
    storeRetirement({ incomeAmount: 50000, incomePeriod: 'yearly' });

    importLegacyStorage(LEGACY_IMPORTS);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 1000, netPerPaycheck: 1500, frequency: 'bi-weekly' });

    resetProfileStore();
    useProfileStore.getState().setValues(
      [
        { path: 'income.grossPerPaycheck', value: 1000 },
        { path: 'income.netPerPaycheck', value: 1500 },
      ],
      { provide: [] }
    );
    storeRetirement({ incomeAmount: 50000, incomePeriod: 'yearly' });
    importLegacyStorage(LEGACY_IMPORTS);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 1923.08, netPaycheck: 1923.08, frequency: 'bi-weekly' });
  });

  it('leaves an answered gross pay and frequency alone and fills only the take-home pay at its saved share', () => {
    // 8,400 monthly and 4,200 semi-monthly are the same income; the answer wins.
    resetProfileStore({ profile: { income: { grossPerPaycheck: 8400, frequency: 'monthly' } } });
    store(envelope(oldProfile((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 4200;
      profile.income.frequency = 'semi-monthly';
    })));

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    const { profile } = useProfileStore.getState();
    expect(profile.income).toMatchObject({ grossPerPaycheck: 8400, netPerPaycheck: 8400, frequency: 'monthly' });
    expect(profile.provided.sort()).toEqual(['income.frequency', 'income.grossPerPaycheck']);
  });

  it('leaves the take-home pay as it is when the saved gross pay has no share to keep', () => {
    resetProfileStore({ profile: { income: { grossPerPaycheck: 8400, frequency: 'monthly' } } });
    store(envelope(oldProfile((profile) => {
      profile.income.grossPaycheck = 0;
      profile.income.netPaycheck = 0;
      profile.income.frequency = 'monthly';
    })));

    importLegacyStorage(LEGACY_IMPORTS);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 8400, netPerPaycheck: 2600, frequency: 'monthly' });
  });

  it('imports a monthly salary with its own frequency under an answered take-home pay, which keeps its value', () => {
    // The frequency is unanswered, so the salary's group (gross pay and
    // frequency) meets no answered path; the answered 2,800 is never written.
    resetProfileStore({ profile: { income: { netPerPaycheck: 2800 } } });
    storeRetirement({ incomeAmount: 8000, incomePeriod: 'monthly' });

    expect(importLegacyStorage(LEGACY_IMPORTS).sort()).toEqual(['income.frequency', 'income.grossPerPaycheck']);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 8000, netPaycheck: 2800, frequency: 'monthly' });
    expect([...useProfileStore.getState().profile.provided].sort()).toEqual([
      'income.frequency',
      'income.grossPerPaycheck',
      'income.netPerPaycheck',
    ]);
  });

  it('keeps a monthly salary out when it is below the answered take-home pay', () => {
    resetProfileStore({ profile: { income: { netPerPaycheck: 2800 } } });
    storeRetirement({ incomeAmount: 2500, incomePeriod: 'monthly' });

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 3500, netPaycheck: 2800, frequency: 'bi-weekly' });
  });

  it('never moves a frequency answered since', () => {
    resetProfileStore({ profile: { income: { frequency: 'weekly' } } });
    storeRetirement({ incomeAmount: 8000, incomePeriod: 'monthly' });

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(paycheckIncome()).toMatchObject({ frequency: 'weekly' });
  });

  it('never puts the gross pay below a take-home pay answered since', () => {
    resetProfileStore({ profile: { income: { netPerPaycheck: 2800 } } });
    storeRetirement({ incomeAmount: 2000, incomePeriod: 'biweekly' });

    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 3500, netPaycheck: 2800, frequency: 'bi-weekly' });

    storeRetirement({ incomeAmount: 3000, incomePeriod: 'biweekly' });
    expect(importLegacyStorage(LEGACY_IMPORTS).sort()).toEqual(['income.frequency', 'income.grossPerPaycheck']);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 3000, netPaycheck: 2800, frequency: 'bi-weekly' });
  });
});
