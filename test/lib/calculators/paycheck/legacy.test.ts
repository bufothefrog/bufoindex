/**
 * The one-time import of the old 'paycheck-allocator-storage' localStorage
 * key (O7): readStorage on the old persist envelope, the frozen old
 * defaults, and importLegacyCalculatorStorage over the real paycheck
 * definition. Storage only: the old share links are not decoded.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_LEGACY, readPaycheckStorage } from '@/lib/calculators/paycheck/legacy';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_LEGACY } from '@/lib/calculators/retirement/legacy';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { importLegacyCalculatorStorage } from '@/lib/store/legacyImport';
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

    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual(['spending.necessaryMonthly']);
    expect(useProfileStore.getState().profile.person.state).toBe('WA');
    expect(useProfileStore.getState().profile.spending.necessaryMonthly).toBe(3300);
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
  });

  it('answers nothing from an untouched old store, and still removes the key', () => {
    store(envelope(OLD_DEFAULTS));
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
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

    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
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
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(useProfileStore.getState().profile.workplace.contributionPercent).toBe(0.1);
  });

  it('removes a corrupt payload without importing it', () => {
    localStorage.setItem(KEY, '{not json');
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('importLegacyCalculatorStorage(PAYCHECK_CALCULATOR): coupled values', () => {
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

    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR).sort()).toEqual(
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

    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR).sort()).toEqual(
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

    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 4100, frequency: 'bi-weekly' });
  });
});

describe('importLegacyCalculatorStorage(PAYCHECK_CALCULATOR): the dollar display mode (O15)', () => {
  const withMode = (displayMode: unknown) => ({ state: { profile: OLD_DEFAULTS, displayMode }, version: 0 });

  it('carries a saved future-dollars choice into the shared preference', () => {
    store(withMode('nominal'));
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("leaves the preference alone for today's dollars or an unknown mode", () => {
    store(withMode('today'));
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
    store(withMode('sideways'));
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
  });
});

describe('importLegacyCalculatorStorage: the retirement key imported first', () => {
  const RETIREMENT_KEY = RETIREMENT_LEGACY.storageKey;
  const storeRetirement = (inputs: Record<string, unknown>, displayMode: unknown = 'today') =>
    localStorage.setItem(
      RETIREMENT_KEY,
      JSON.stringify({ state: { inputs: { ...RETIREMENT_LEGACY.storageDefaults(), ...inputs }, displayMode }, version: 3 })
    );
  const storePaycheck = (edit: (profile: PaycheckProfile) => void, displayMode: unknown = 'today') =>
    store({ ...envelope(oldProfile(edit)), state: { ...envelope(oldProfile(edit)).state, displayMode } });

  beforeEach(() => {
    usePreferencesStore.setState({ displayMode: 'today' });
  });

  it('still imports the saved take-home pay when the pay and frequency already came from the retirement key', () => {
    storeRetirement({ incomeAmount: 4200, incomePeriod: 'semimonthly' });
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });

    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR).sort()).toEqual(['income.frequency', 'income.grossPerPaycheck']);
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual(['income.netPerPaycheck']);
    const { profile } = useProfileStore.getState();
    expect(profile.income).toMatchObject({ grossPerPaycheck: 4200, netPerPaycheck: 3050, frequency: 'semi-monthly' });
    expect(profile.provided).toContain('income.netPerPaycheck');
  });

  it('keeps the whole pay group out when the retirement key set a different pay', () => {
    storeRetirement({ incomeAmount: 5000, incomePeriod: 'monthly' });
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual([]);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 5000, frequency: 'monthly' });
    expect(useProfileStore.getState().profile.provided).not.toContain('income.netPerPaycheck');
  });

  // The same annual income stored in another form by each calculator: the
  // retirement import writes an old yearly or hourly salary as a monthly
  // paycheck, and has no period for weekly pay.
  it.each([
    ['a yearly salary (the old default period)', { incomeAmount: 100800, incomePeriod: 'yearly' }, 4200, 3050, 'semi-monthly'],
    ['an hourly wage', { incomeAmount: 50, incomePeriod: 'hourly' }, 4000, 2900, 'bi-weekly'],
    ['a yearly salary paid weekly', { incomeAmount: 104000, incomePeriod: 'yearly' }, 2000, 1500, 'weekly'],
  ] as const)(
    'keeps the saved take-home pay with its own paycheck when the retirement key held the same income as %s',
    (_, retirement, gross, net, frequency) => {
      storeRetirement(retirement);
      storePaycheck((profile) => {
        profile.income.grossPaycheck = gross;
        profile.income.netPaycheck = net;
        profile.income.frequency = frequency;
      });

      expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR).sort()).toEqual(['income.frequency', 'income.grossPerPaycheck']);
      expect(useProfileStore.getState().profile.income.frequency).toBe('monthly');
      expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR).sort()).toEqual(
        ['income.frequency', 'income.grossPerPaycheck', 'income.netPerPaycheck'].sort()
      );
      const { profile } = useProfileStore.getState();
      expect(profile.income).toMatchObject({ grossPerPaycheck: gross, netPerPaycheck: net, frequency });
      expect(profile.provided).toEqual(expect.arrayContaining(['income.grossPerPaycheck', 'income.netPerPaycheck', 'income.frequency']));
    }
  );

  it('keeps the paycheck record when the paycheck key is imported first and the retirement key held the same income yearly', () => {
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });
    storeRetirement({ incomeAmount: 100800, incomePeriod: 'yearly' });

    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)).not.toContain('income.grossPerPaycheck');
    expect(useProfileStore.getState().profile.income).toMatchObject({
      grossPerPaycheck: 4200,
      netPerPaycheck: 3050,
      frequency: 'semi-monthly',
    });
  });

  it('keeps the whole pay group out when the retirement key held a different yearly income', () => {
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).not.toContain('income.netPerPaycheck');
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 10000, frequency: 'monthly' });
    expect(useProfileStore.getState().profile.income.netPerPaycheck).not.toBe(3050);
  });

  it('keeps the saved take-home share of pay, unprovided, when the retirement key set a different income', () => {
    // The old allocator kept 3,050 of a 4,200 semi-monthly paycheck. The
    // retirement key's 120,000 a year (10,000 monthly) wins, and the take-home
    // pay follows it at the same share instead of the profile default.
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).not.toContain('income.netPerPaycheck');
    const { profile } = useProfileStore.getState();
    expect(profile.income).toMatchObject({ grossPerPaycheck: 10000, frequency: 'monthly' });
    expect(profile.income.netPerPaycheck).toBeCloseTo((3050 / 4200) * 10000, 2);
    expect(profile.provided).not.toContain('income.netPerPaycheck');
  });

  it('never carries the saved take-home share over a take-home pay answered since', () => {
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    useProfileStore.getState().setValues([{ path: 'income.netPerPaycheck', value: 7000 }]);
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(useProfileStore.getState().profile.income.netPerPaycheck).toBe(7000);
  });

  it("imports the paycheck key's own pay over the retirement key's untouched old default salary", () => {
    // The old retirement default (100,000 a year) comes in unprovided, so it
    // does not hold back the pay the visitor saved in the allocator.
    storeRetirement({});
    storePaycheck((profile) => {
      profile.income.grossPaycheck = 4200;
      profile.income.netPaycheck = 3050;
      profile.income.frequency = 'semi-monthly';
    });

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(useProfileStore.getState().profile.income).toMatchObject({ grossPerPaycheck: 8333.33, frequency: 'monthly' });
    expect(useProfileStore.getState().profile.provided).toEqual([]);
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(useProfileStore.getState().profile.income).toMatchObject({
      grossPerPaycheck: 4200,
      netPerPaycheck: 3050,
      frequency: 'semi-monthly',
    });
  });

  it("settles the display mode once, so a switch to today's dollars between the two imports stays", () => {
    storeRetirement({}, 'nominal');
    storePaycheck(() => {}, 'nominal');

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    usePreferencesStore.getState().setDisplayMode('today');
    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(usePreferencesStore.getState().displayMode).toBe('today');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('carries a future-dollars mode saved only in the key imported second', () => {
    storeRetirement({ monthlySavings: 3100 }, 'today');
    storePaycheck((profile) => {
      profile.preferences.necessaryExpenses = 3300;
    }, 'nominal');

    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    // The other key keeps its inputs for its own import.
    expect(importLegacyCalculatorStorage(PAYCHECK_CALCULATOR)).toEqual(['spending.necessaryMonthly']);
  });
});

/**
 * The retirement key's income group writes gross pay and frequency but no
 * take-home pay. When it moves the frequency, the take-home pay the profile
 * holds must move with it (same annual amount), or the paycheck engine reads
 * a per-paycheck take-home under another frequency's unit.
 */
describe('importLegacyCalculatorStorage: the take-home pay keeps its frequency', () => {
  const storeRetirement = (inputs: Record<string, unknown>) =>
    localStorage.setItem(
      RETIREMENT_LEGACY.storageKey,
      JSON.stringify({ state: { inputs: { ...RETIREMENT_LEGACY.storageDefaults(), ...inputs } }, version: 3 })
    );
  const paycheckIncome = () => engineInputsFor(PAYCHECK_CALCULATOR, useProfileStore.getState().profile).income;
  const yearly = (perPaycheck: number, perYear: number) => perPaycheck * perYear;

  it('converts the profile default take-home pay when only the retirement key is there, salary untouched', () => {
    storeRetirement({ startingAge: 40 });

    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)).toEqual(['person.age']);
    const income = paycheckIncome();
    expect(income).toMatchObject({ grossPaycheck: 8333.33, frequency: 'monthly' });
    // 2,600 bi-weekly (the profile default) is 67,600 a year, 5,633.33 a month.
    expect(income.netPaycheck).toBeCloseTo(5633.33, 2);
    expect(yearly(income.netPaycheck, 12)).toBeCloseTo(67600, 0);
    expect(useProfileStore.getState().profile.provided).toEqual(['person.age']);
  });

  it('keeps the annual take-home pay of the paycheck key imported first when both are untouched', () => {
    store(envelope(oldProfile(() => {})));
    storeRetirement({ startingAge: 40 });

    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 2500, netPaycheck: 1900, frequency: 'bi-weekly' });
    importLegacyCalculatorStorage(RETIREMENT_CALCULATOR);
    const income = paycheckIncome();
    expect(income).toMatchObject({ grossPaycheck: 8333.33, frequency: 'monthly' });
    // 1,900 bi-weekly is 49,400 a year, 4,116.67 a month.
    expect(income.netPaycheck).toBeCloseTo(4116.67, 2);
    expect(yearly(income.netPaycheck, 12)).toBeCloseTo(49400, 0);
    expect(useProfileStore.getState().profile.provided).not.toContain('income.netPerPaycheck');
  });

  it("converts the paycheck key's take-home pay under a changed retirement salary", () => {
    store(envelope(oldProfile(() => {})));
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });

    importLegacyCalculatorStorage(PAYCHECK_CALCULATOR);
    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR).sort()).toEqual(['income.frequency', 'income.grossPerPaycheck']);
    const income = paycheckIncome();
    expect(income).toMatchObject({ grossPaycheck: 10000, frequency: 'monthly' });
    expect(income.netPaycheck).toBeCloseTo(4116.67, 2);
    expect(useProfileStore.getState().profile.provided).not.toContain('income.netPerPaycheck');
  });

  it('never moves the frequency under a take-home pay answered since', () => {
    resetProfileStore({ profile: { income: { netPerPaycheck: 2800 } } });
    storeRetirement({ incomeAmount: 120000, incomePeriod: 'yearly' });

    expect(importLegacyCalculatorStorage(RETIREMENT_CALCULATOR)).toEqual([]);
    expect(paycheckIncome()).toMatchObject({ grossPaycheck: 3500, netPaycheck: 2800, frequency: 'bi-weekly' });
  });
});
