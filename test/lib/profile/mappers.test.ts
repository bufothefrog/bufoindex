/**
 * Shared-profile mapper tests.
 *
 * Default profile used throughout (lib/profile/defaults.ts): age 30, TX,
 * single, retire at 60; $3,500 gross / $2,600 net bi-weekly; $3,000/mo
 * necessary spending; fun money $300-$600; $5,000 emergency fund at 4% APY,
 * 3-month target; 401(k) 50% match up to 6%, contributing 6%; $25,000
 * invested, $1,500/mo total contributions ($500 taxable), 80/20 mix, $1,000
 * new cash; cashflow-investor preset at 2x.
 *
 * Hand-computed anchors:
 *   annual gross   = 3,500 x 26           = 91,000
 *   monthly gross  = 3,500 x 26 / 12      = 7,583.33
 *   monthly net    = 2,600 x 26 / 12      = 5,633.33
 *   rebalancer holdings value (worked example) = 2,875 + 5,900 = 8,775
 */

import { describe, expect, it } from 'vitest';
import {
  annualGrossIncome,
  getDefaultFinancialProfile,
  getProfileValue,
  isValidProfileValue,
  monthlyGrossIncome,
  monthlyNetIncome,
  normalizeProfile,
  PAYCHECKS_PER_YEAR,
  PRESET_EMERGENCY_MONTHS,
  PROFILE_FIELDS,
  PROFILE_SECTION_LABELS,
  PROFILE_SECTIONS,
  profileCompleteness,
  splitProfilePath,
  TARGET_MIX_WEIGHTS,
  toPaycheckProfile,
  toRebalanceInputs,
  toRetirementInputs,
} from '@/lib/profile';
import type { FinancialProfile, PayFrequency, TargetMixPreset } from '@/lib/profile';
import { calculateOptimalAllocation } from '@/lib/calculations/core';
import {
  rebalancePortfolioV2,
  validateRebalanceInputsV2,
} from '@/lib/calculations/portfolioRebalancing';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';

/** Default profile with per-section overrides. */
function makeProfile(overrides: {
  [K in keyof FinancialProfile]?: FinancialProfile[K] extends object
    ? Partial<FinancialProfile[K]>
    : FinancialProfile[K];
} = {}): FinancialProfile {
  const base = getDefaultFinancialProfile();
  return {
    ...base,
    ...overrides,
    person: { ...base.person, ...overrides.person },
    income: { ...base.income, ...overrides.income },
    spending: { ...base.spending, ...overrides.spending },
    cash: { ...base.cash, ...overrides.cash },
    workplace: { ...base.workplace, ...overrides.workplace },
    investing: { ...base.investing, ...overrides.investing },
    strategy: { ...base.strategy, ...overrides.strategy },
    provided: (overrides.provided as string[] | undefined) ?? base.provided,
  } as FinancialProfile;
}

describe('getDefaultFinancialProfile', () => {
  it('returns the documented placeholder values', () => {
    const p = getDefaultFinancialProfile();
    expect(p).toEqual({
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
      strategy: { preset: 'cashflow-investor', leverageRatio: 2 },
      provided: [],
    });
  });

  it('returns a fresh object each call', () => {
    const a = getDefaultFinancialProfile();
    a.person.age = 99;
    a.provided.push('person.age');
    const b = getDefaultFinancialProfile();
    expect(b.person.age).toBe(30);
    expect(b.provided).toEqual([]);
  });
});

describe('PROFILE_FIELDS and preset constants', () => {
  it('lists every leaf field exactly once, with a label and a known section', () => {
    const defaults = getDefaultFinancialProfile();
    const leafPaths = PROFILE_SECTIONS.flatMap((section) =>
      Object.keys(defaults[section]).map((key) => `${section}.${key}`)
    );
    expect(PROFILE_FIELDS).toHaveLength(25);
    expect(PROFILE_FIELDS.map((f) => f.path).sort()).toEqual([...leafPaths].sort());
    for (const field of PROFILE_FIELDS) {
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.path.startsWith(`${field.section}.`)).toBe(true);
      expect(PROFILE_SECTION_LABELS[field.section as keyof typeof PROFILE_SECTION_LABELS]).toBeTruthy();
    }
  });

  it('excludes version, updatedAt and provided', () => {
    const paths = PROFILE_FIELDS.map((f) => f.path);
    expect(paths).not.toContain('version');
    expect(paths).not.toContain('updatedAt');
    expect(paths).not.toContain('provided');
  });

  it('maps each strategy preset to its starting emergency-fund months', () => {
    expect(PRESET_EMERGENCY_MONTHS).toEqual({ standard: 3, 'cashflow-investor': 1 });
  });

  it('derives paychecks per year from the frequency multipliers', () => {
    expect(PAYCHECKS_PER_YEAR).toEqual({ weekly: 52, 'bi-weekly': 26, 'semi-monthly': 24, monthly: 12 });
  });

  it('has target-mix weights that each sum to 1', () => {
    for (const mix of Object.keys(TARGET_MIX_WEIGHTS) as TargetMixPreset[]) {
      const w = TARGET_MIX_WEIGHTS[mix];
      expect(w['us-stock'] + w['intl-stock'] + w.bonds + w.cash).toBeCloseTo(1, 12);
    }
  });
});

describe('path helpers and validation', () => {
  it('splits and reads known leaf paths', () => {
    const p = getDefaultFinancialProfile();
    expect(splitProfilePath('person.age')).toEqual({ section: 'person', key: 'age' });
    expect(splitProfilePath('person.nickname')).toBeNull();
    expect(splitProfilePath('provided')).toBeNull();
    expect(getProfileValue(p, 'income.grossPerPaycheck')).toBe(3500);
    expect(getProfileValue(p, 'workplace.has401k')).toBe(true);
    expect(getProfileValue(p, 'nope.nothing')).toBeUndefined();
  });

  it('accepts only finite numbers, booleans, listed enum members and non-empty strings', () => {
    expect(isValidProfileValue('person.age', 41)).toBe(true);
    expect(isValidProfileValue('person.age', '41')).toBe(false);
    expect(isValidProfileValue('person.age', Number.NaN)).toBe(false);
    expect(isValidProfileValue('person.age', Infinity)).toBe(false);
    expect(isValidProfileValue('workplace.has401k', false)).toBe(true);
    expect(isValidProfileValue('workplace.has401k', 'false')).toBe(false);
    expect(isValidProfileValue('income.frequency', 'semi-monthly')).toBe(true);
    expect(isValidProfileValue('income.frequency', 'daily')).toBe(false);
    expect(isValidProfileValue('person.filingStatus', 'marriedJoint')).toBe(true);
    expect(isValidProfileValue('person.filingStatus', 'headOfHousehold')).toBe(false);
    expect(isValidProfileValue('investing.targetMix', '60-40')).toBe(true);
    expect(isValidProfileValue('strategy.preset', 'standard')).toBe(true);
    expect(isValidProfileValue('strategy.preset', 3)).toBe(false);
    expect(isValidProfileValue('person.state', 'CA')).toBe(true);
    expect(isValidProfileValue('person.state', '  ')).toBe(false);
    expect(isValidProfileValue('person.nickname', 'x')).toBe(false);
  });
});

describe('normalizeProfile', () => {
  it('returns the defaults for non-object input', () => {
    expect(normalizeProfile(null)).toEqual(getDefaultFinancialProfile());
    expect(normalizeProfile('garbage')).toEqual(getDefaultFinancialProfile());
    expect(normalizeProfile([1, 2])).toEqual(getDefaultFinancialProfile());
  });

  it('fills missing sections and keys, and drops invalid leaves', () => {
    const p = normalizeProfile({
      updatedAt: 1234,
      person: { age: 45, state: 'NY', filingStatus: 'bogus' },
      income: 'not-an-object',
      cash: { emergencyFundBalance: Number.NaN, targetMonths: 6 },
      strategy: { preset: 'standard', leverageRatio: 3, extra: 'ignored' },
      provided: ['person.age', 'person.age', 7, 'cash.targetMonths'],
    });
    expect(p.version).toBe(1);
    expect(p.updatedAt).toBe(1234);
    expect(p.person).toEqual({ age: 45, state: 'NY', filingStatus: 'single', retirementAge: 60 });
    expect(p.income).toEqual(getDefaultFinancialProfile().income);
    expect(p.cash).toEqual({ emergencyFundBalance: 5000, emergencyFundApy: 0.04, targetMonths: 6 });
    expect(p.strategy).toEqual({ preset: 'standard', leverageRatio: 3 });
    expect(p.provided).toEqual(['person.age', 'cash.targetMonths']);
  });

  it('falls back to a supplied base profile rather than the defaults', () => {
    const base = makeProfile({ person: { age: 52 }, updatedAt: 99 });
    const p = normalizeProfile({ person: { age: 'x' }, updatedAt: Number.NaN }, base);
    expect(p.person.age).toBe(52);
    expect(p.updatedAt).toBe(99);
  });

  it('does not share nested objects with the base', () => {
    const base = getDefaultFinancialProfile();
    const p = normalizeProfile({}, base);
    p.person.age = 70;
    p.provided.push('person.age');
    expect(base.person.age).toBe(30);
    expect(base.provided).toEqual([]);
  });
});

describe('income helpers', () => {
  it('annualizes and monthlyizes using the pay frequency', () => {
    const p = getDefaultFinancialProfile();
    expect(annualGrossIncome(p)).toBe(91000);
    expect(monthlyGrossIncome(p)).toBeCloseTo(7583.33, 2);
    expect(monthlyNetIncome(p)).toBeCloseTo(5633.33, 2);
    expect(annualGrossIncome(makeProfile({ income: { grossPerPaycheck: 1000, frequency: 'weekly' } }))).toBe(52000);
  });
});

describe('toRetirementInputs', () => {
  it('maps the profile fields and annualizes bi-weekly gross 3,500 to 91,000', () => {
    const inputs = toRetirementInputs(getDefaultFinancialProfile());
    expect(inputs).toEqual({
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
    });
  });

  it('carries through age, state, filing status, savings and balance overrides', () => {
    const inputs = toRetirementInputs(
      makeProfile({
        person: { age: 42, retirementAge: 62, state: 'CA', filingStatus: 'marriedJoint' },
        investing: { monthlyContribution: 2750, investedBalance: 180000 },
        spending: { necessaryMonthly: 5200, targetRetirementIncome: 95000 },
      })
    );
    expect(inputs.startingAge).toBe(42);
    expect(inputs.retirementAge).toBe(62);
    expect(inputs.state).toBe('CA');
    expect(inputs.filingStatus).toBe('marriedJoint');
    expect(inputs.monthlySavings).toBe(2750);
    expect(inputs.startingBalance).toBe(180000);
    expect(inputs.necessaryMonthlyExpenses).toBe(5200);
    expect(inputs.targetIncome).toBe(95000);
  });

  it.each<[PayFrequency, number, string, number, number]>([
    // frequency, gross per paycheck, expected period, expected amount, expected annual
    ['weekly', 1000, 'yearly', 52000, 52000],
    ['bi-weekly', 3500, 'biweekly', 3500, 91000],
    ['semi-monthly', 4000, 'semimonthly', 4000, 96000],
    ['monthly', 8000, 'monthly', 8000, 96000],
  ])('maps %s pay of %d to period %s, amount %d, annual %d', (frequency, gross, period, amount, annual) => {
    const inputs = toRetirementInputs(makeProfile({ income: { frequency, grossPerPaycheck: gross } }));
    expect(inputs.incomePeriod).toBe(period);
    expect(inputs.incomeAmount).toBe(amount);
    expect(inputs.currentIncome).toBe(annual);
  });

  it('uses the retirement store defaults for every field the profile does not carry', () => {
    const storeDefaults = useRetirementStore.getInitialState().inputs;
    const inputs = toRetirementInputs(getDefaultFinancialProfile());
    for (const key of [
      'lifeExpectancy',
      'accumulationReturn',
      'retirementReturn',
      'inflationRate',
      'socialSecurityAge',
      'socialSecurityBenefit',
      'healthcareCostMultiplier',
      'volatility',
      'riskProfile',
      'effectiveTaxRate',
      'estimatedAnnualHealthcareCost',
    ] as const) {
      expect(inputs[key]).toEqual(storeDefaults[key]);
    }
  });
});

describe('toPaycheckProfile', () => {
  const mapped = toPaycheckProfile(getDefaultFinancialProfile());

  it('maps income and recomputes the monthly legacy fields', () => {
    expect(mapped.income.grossPaycheck).toBe(3500);
    expect(mapped.income.netPaycheck).toBe(2600);
    expect(mapped.income.frequency).toBe('bi-weekly');
    // updateLegacyIncomeFields: paycheck x 26/12
    expect(mapped.income.monthlyGross).toBeCloseTo(7583.33, 2);
    expect(mapped.income.monthlyNet).toBeCloseTo(5633.33, 2);
    expect(mapped.income.gross).toBe(mapped.income.monthlyGross);
    expect(mapped.income.net).toBe(mapped.income.monthlyNet);
    expect(mapped.income.regularBonus).toBe(false);
    expect(mapped.income.bonusExpected).toBe(0);
  });

  it('maps taxes and the 401(k) election', () => {
    expect(mapped.taxes.state).toBe('TX');
    expect(mapped.taxes.filingStatus).toBe('single');
    expect(mapped.taxes.federalBracket).toBe(0.22); // allocator default
    expect(mapped.benefits.employer401k).toEqual({
      available: true,
      matchPercent: 0.5,
      matchLimit: 0.06,
      currentContribution: 0.06,
      contributionType: 'traditional',
      traditionalContribution: 0.06,
      rothContribution: 0,
      afterTaxAvailable: false,
      currentYTD: 0,
    });
    // Untouched benefit blocks keep the allocator defaults.
    expect(mapped.benefits.hsa.eligible).toBe(false);
    expect(mapped.benefits.ira.hasIRA).toBe(false);
  });

  it('maps preferences, with fun money current at the midpoint', () => {
    expect(mapped.preferences).toMatchObject({
      age: 30,
      necessaryExpenses: 3000,
      funMoney: { min: 300, max: 600, current: 450 },
      emergencyFundMonths: 3,
      currentEmergencyFund: 5000,
      emergencyFundAPY: 0.04,
      hasTaxableAccount: true,
      taxableAccountContribution: 500,
      riskTolerance: 'moderate',
      optimizationGoal: 'balanced',
    });
    expect(mapped.debts).toEqual([]);
    expect(mapped.source).toBe('imported');
    expect(mapped.lastUpdated).toBe(0);
  });

  it('reflects overrides: no 401(k), no taxable account, 1-month target, married', () => {
    const p = toPaycheckProfile(
      makeProfile({
        person: { filingStatus: 'marriedJoint', state: 'NY', age: 48 },
        income: { grossPerPaycheck: 9000, netPerPaycheck: 6200, frequency: 'monthly' },
        workplace: { has401k: false, contributionPercent: 0 },
        investing: { taxableMonthlyContribution: 0 },
        cash: { targetMonths: 1 },
        updatedAt: 1700000000000,
      })
    );
    expect(p.income.monthlyGross).toBe(9000);
    expect(p.income.monthlyNet).toBe(6200);
    expect(p.taxes.filingStatus).toBe('marriedJoint');
    expect(p.taxes.state).toBe('NY');
    expect(p.preferences.age).toBe(48);
    expect(p.benefits.employer401k.available).toBe(false);
    expect(p.benefits.employer401k.currentContribution).toBe(0);
    expect(p.preferences.hasTaxableAccount).toBe(false);
    expect(p.preferences.taxableAccountContribution).toBe(0);
    expect(p.preferences.emergencyFundMonths).toBe(1);
    expect(p.lastUpdated).toBe(1700000000000);
  });

  it('feeds the allocation engine', () => {
    // Necessary $3,000/mo -> 3,000 x 12/26 = 1,384.62 per paycheck;
    // fun-money minimum $300/mo -> 138.46 per paycheck.
    const result = calculateOptimalAllocation(mapped);
    expect(result.paycheckContext?.netPaycheck).toBe(2600);
    expect(result.paycheckContext?.necessaryExpensesPerPaycheck).toBeCloseTo(1384.62, 2);
    expect(result.paycheckContext?.funMoneyPerPaycheck).toBeCloseTo(138.46, 2);
    expect(result.incomeShortfall).toBeUndefined();
  });
});

describe('toRebalanceInputs', () => {
  it.each<[TargetMixPreset, number, number, number]>([
    ['100-0', 0.75, 0.25, 0],
    ['80-20', 0.6, 0.2, 0.2],
    ['60-40', 0.45, 0.15, 0.4],
  ])('sets %s targets to us %d / intl %d / bonds %d and cash 0', (targetMix, us, intl, bonds) => {
    const inputs = toRebalanceInputs(makeProfile({ investing: { targetMix } }));
    expect(inputs.classTargets).toEqual([
      { accountId: null, assetClass: 'us-stock', target: us },
      { accountId: null, assetClass: 'intl-stock', target: intl },
      { accountId: null, assetClass: 'bonds', target: bonds },
      { accountId: null, assetClass: 'cash', target: 0 },
    ]);
    expect(validateRebalanceInputsV2(inputs)).toEqual([]);
  });

  it('puts all new cash on the Brokerage account', () => {
    const inputs = toRebalanceInputs(makeProfile({ investing: { targetMix: '60-40', newCashThisMonth: 2400 } }));
    expect(inputs.accounts).toEqual([
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 2400 },
    ]);
  });

  it('clamps negative or non-finite new cash to a zero deposit', () => {
    expect(toRebalanceInputs(makeProfile({ investing: { newCashThisMonth: -50 } })).accounts[1].deposit).toBe(0);
    expect(toRebalanceInputs(makeProfile({ investing: { newCashThisMonth: Number.NaN } })).accounts[1].deposit).toBe(0);
  });

  it('reconstructs the rebalancer store worked example (holdings, securities, flags)', () => {
    usePortfolioRebalancingStore.getState().reset();
    const storeDefaults = usePortfolioRebalancingStore.getState().inputs;
    const inputs = toRebalanceInputs(getDefaultFinancialProfile());
    expect(inputs.setupMode).toBe(storeDefaults.setupMode);
    expect(inputs.securities).toEqual(storeDefaults.securities);
    expect(inputs.holdings).toEqual(storeDefaults.holdings);
    expect(inputs.accounts.map(({ id, name, accountType }) => ({ id, name, accountType }))).toEqual(
      storeDefaults.accounts.map(({ id, name, accountType }) => ({ id, name, accountType }))
    );
    expect(inputs.customAssetClasses).toEqual(storeDefaults.customAssetClasses);
    expect(inputs.allowTaxableSelling).toBe(storeDefaults.allowTaxableSelling);
    expect(inputs.showPlacementAdvice).toBe(storeDefaults.showPlacementAdvice);
    expect(inputs.mode).toBe(storeDefaults.mode);
  });

  it('runs through the rebalancer with the worked-example value and the profile deposit', () => {
    const result = rebalancePortfolioV2(toRebalanceInputs(getDefaultFinancialProfile()));
    // Holdings: Roth 10 x 250 + 5 x 75 = 2,875; Brokerage 20 x 250 + 15 x 60 = 5,900.
    expect(result.totalValueBefore).toBe(8775);
    expect(result.totalDeposit).toBe(1000);
  });
});

describe('profileCompleteness', () => {
  it('reports nothing provided for a fresh profile', () => {
    const c = profileCompleteness(getDefaultFinancialProfile());
    expect(c.provided).toBe(0);
    expect(c.total).toBe(25);
    expect(c.missing).toHaveLength(25);
    expect(c.missing[0]).toEqual({ path: 'person.age', label: 'Age' });
  });

  it('counts known provided paths and ignores unknown ones', () => {
    const c = profileCompleteness(
      makeProfile({ provided: ['person.age', 'income.frequency', 'cash.targetMonths', 'not.a.field'] })
    );
    expect(c.provided).toBe(3);
    expect(c.total).toBe(25);
    expect(c.missing).toHaveLength(22);
    expect(c.missing.map((m) => m.path)).not.toContain('person.age');
    expect(c.missing.map((m) => m.path)).toContain('person.state');
  });

  it('reports complete when every field is provided', () => {
    const c = profileCompleteness(makeProfile({ provided: PROFILE_FIELDS.map((f) => f.path) }));
    expect(c).toEqual({ provided: 25, total: 25, missing: [] });
  });
});
