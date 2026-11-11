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
 * Goldens: the full outputs pinned below (the default and CUSTOM_V1) were
 * captured from the v1 mappers before the profile moved to v2. v1-shaped data
 * must map to exactly the same calculator inputs, so the numbers users see do
 * not move.
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
  migrateProfile,
  monthlyGrossIncome,
  newCashDepositWrites,
  monthlyNetIncome,
  PAYCHECKS_PER_YEAR,
  PROFILE_FIELDS,
  profileCompleteness,
  toPaycheckProfile,
  toRebalanceInputs,
  toRetirementInputs,
} from '@/lib/profile';
import type { FinancialProfile, PayFrequency, ProfilePatch, TargetMixPreset } from '@/lib/profile';
import { calculateOptimalAllocation } from '@/lib/calculations/core';
import { applyWrites } from '@/lib/fields/paths';
import {
  rebalancePortfolioV2,
  validateRebalanceInputsV2,
} from '@/lib/calculations/portfolioRebalancing';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';

/**
 * A v1-shaped profile: the given v1 sections over the v1 defaults, loaded
 * the way a saved v1 profile is (migrateProfile from version 1).
 */
function makeProfile(overrides: ProfilePatch = {}): FinancialProfile {
  return migrateProfile(overrides, 1);
}

/** A v2 profile with v2-only answers on top of the defaults. */
function withV2(edit: (profile: FinancialProfile) => void): FinancialProfile {
  const profile = getDefaultFinancialProfile();
  edit(profile);
  return profile;
}

/** The custom v1 profile used by the link tests: every section differs from the defaults. */
const CUSTOM_V1: ProfilePatch = {
  updatedAt: 1760000000000,
  person: { age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58 },
  income: { grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' },
  spending: { necessaryMonthly: 4200, funMoneyMin: 250, funMoneyMax: 900, targetRetirementIncome: 110000 },
  cash: { emergencyFundBalance: 12000, emergencyFundApy: 0.045, targetMonths: 1 },
  workplace: { has401k: true, matchPercent: 1, matchLimit: 0.04, contributionPercent: 0.1 },
  investing: {
    investedBalance: 140000,
    monthlyContribution: 2200,
    taxableMonthlyContribution: 900,
    targetMix: '60-40',
    newCashThisMonth: 3000,
  },
  strategy: { preset: 'standard', leverageRatio: 1.5 },
  provided: ['person.age'],
};

describe('PAYCHECKS_PER_YEAR', () => {
  it('derives paychecks per year from the frequency multipliers', () => {
    expect(PAYCHECKS_PER_YEAR).toEqual({ weekly: 52, 'bi-weekly': 26, 'semi-monthly': 24, monthly: 12 });
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

  it('defaults the fields v1 did not carry to the retirement store defaults', () => {
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
    // NaN cannot be saved (JSON stores null); in memory it reaches the
    // deposit only through newCashDepositWrites, which clamps it.
    const p = getDefaultFinancialProfile();
    expect(toRebalanceInputs(applyWrites(p, newCashDepositWrites(p, Number.NaN))).accounts[1].deposit).toBe(0);
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

describe('goldens: v1-shaped data maps exactly as before v2', () => {
  const custom = makeProfile(CUSTOM_V1);

  it('toRetirementInputs, custom profile', () => {
    expect(toRetirementInputs(custom)).toEqual({
      startingAge: 38,
      retirementAge: 58,
      lifeExpectancy: 85,
      targetIncome: 110000,
      startingBalance: 140000,
      currentIncome: 109200,
      incomeAmount: 109200,
      incomePeriod: 'yearly',
      monthlySavings: 2200,
      necessaryMonthlyExpenses: 4200,
      accumulationReturn: 0.08,
      retirementReturn: 0.06,
      inflationRate: 0.03,
      socialSecurityAge: 67,
      socialSecurityBenefit: 30000,
      healthcareCostMultiplier: 1,
      volatility: 0.15,
      filingStatus: 'marriedJoint',
      state: 'CA',
      riskProfile: 'tdf',
      effectiveTaxRate: null,
      estimatedAnnualHealthcareCost: null,
    });
  });

  it.each([
    ['default', getDefaultFinancialProfile(), {
      gross: 3500, net: 2600, frequency: 'bi-weekly', monthlyGross: 7583.333333333333, monthlyNet: 5633.333333333333,
      state: 'TX', filingStatus: 'single', match: 0.5, limit: 0.06, contribution: 0.06,
      months: 3, fund: 5000, apy: 0.04, necessary: 3000, min: 300, max: 600, current: 450, age: 30, taxable: 500, lastUpdated: 0,
    }],
    ['custom', custom, {
      gross: 2100, net: 1550, frequency: 'weekly', monthlyGross: 9100, monthlyNet: 6716.666666666666,
      state: 'CA', filingStatus: 'marriedJoint', match: 1, limit: 0.04, contribution: 0.1,
      months: 1, fund: 12000, apy: 0.045, necessary: 4200, min: 250, max: 900, current: 575, age: 38, taxable: 900,
      lastUpdated: 1760000000000,
    }],
  ] as const)('toPaycheckProfile, %s profile', (_name, profile, g) => {
    expect(toPaycheckProfile(profile)).toEqual({
      income: {
        grossPaycheck: g.gross,
        netPaycheck: g.net,
        frequency: g.frequency,
        regularBonus: false,
        bonusAmount: 0,
        bonusFrequency: 'annual',
        monthlyGross: g.monthlyGross,
        monthlyNet: g.monthlyNet,
        gross: g.monthlyGross,
        net: g.monthlyNet,
        bonusExpected: 0,
      },
      taxes: {
        federalBracket: 0.22,
        state: g.state,
        filingStatus: g.filingStatus,
        currentWithholding: { federal: 800, state: 200, fica: 382 },
      },
      benefits: {
        employer401k: {
          available: true,
          matchPercent: g.match,
          matchLimit: g.limit,
          currentContribution: g.contribution,
          contributionType: 'traditional',
          traditionalContribution: g.contribution,
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
        emergencyFundMonths: g.months,
        currentEmergencyFund: g.fund,
        emergencyFundAPY: g.apy,
        necessaryExpenses: g.necessary,
        funMoney: { min: g.min, max: g.max, current: g.current },
        age: g.age,
        hasTaxableAccount: true,
        taxableAccountContribution: g.taxable,
        isPeakEarnings: false,
        expectedRetirementBracket: 0.12,
        riskTolerance: 'moderate',
        optimizationGoal: 'balanced',
      },
      version: '1.0',
      lastUpdated: g.lastUpdated,
      source: 'imported',
    });
  });

  it('toRebalanceInputs, default profile', () => {
    expect(toRebalanceInputs(getDefaultFinancialProfile())).toEqual({
      setupMode: 'multi-shared',
      securities: [
        { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
        { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 60, assetClass: 'intl-stock' },
        { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 75, assetClass: 'bonds' },
      ],
      accounts: [
        { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
        { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 1000 },
      ],
      holdings: [
        { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
        { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
        { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
        { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
      ],
      classTargets: [
        { accountId: null, assetClass: 'us-stock', target: 0.6 },
        { accountId: null, assetClass: 'intl-stock', target: 0.2 },
        { accountId: null, assetClass: 'bonds', target: 0.2 },
        { accountId: null, assetClass: 'cash', target: 0 },
      ],
      customAssetClasses: [],
      allowTaxableSelling: false,
      showPlacementAdvice: true,
      mode: 'whole',
    });
  });
});

describe('v2 sources', () => {
  it('toRetirementInputs reads life expectancy, Social Security, healthcare and the assumptions', () => {
    const inputs = toRetirementInputs(
      withV2((p) => {
        p.person.lifeExpectancy = 92;
        p.retirementIncome = { socialSecurityBenefit: 24000, socialSecurityAge: 70, annualHealthcareCost: 9000 };
        p.assumptions.retirement = {
          riskProfile: 'custom',
          accumulationReturn: 0.07,
          retirementReturn: 0.05,
          inflationRate: 0.025,
          volatility: 0.12,
          effectiveTaxRate: 0.18,
          healthcareCostMultiplier: 1.2,
        };
      })
    );
    expect(inputs).toMatchObject({
      lifeExpectancy: 92,
      socialSecurityBenefit: 24000,
      socialSecurityAge: 70,
      estimatedAnnualHealthcareCost: 9000,
      riskProfile: 'custom',
      accumulationReturn: 0.07,
      retirementReturn: 0.05,
      inflationRate: 0.025,
      volatility: 0.12,
      effectiveTaxRate: 0.18,
      healthcareCostMultiplier: 1.2,
    });
  });

  it.each([
    ['single', 'single'],
    ['marriedJoint', 'marriedJoint'],
    ['marriedSeparate', 'single'],
    ['headOfHousehold', 'single'],
  ] as const)('toRetirementInputs maps filing status %s to %s (O10)', (status, expected) => {
    expect(toRetirementInputs(withV2((p) => { p.person.filingStatus = status; })).filingStatus).toBe(expected);
    expect(toPaycheckProfile(withV2((p) => { p.person.filingStatus = status; })).taxes.filingStatus).toBe(status);
  });

  it.each([
    // type, total, roth share asked, expected traditional, expected roth
    ['traditional', 0.1, 0.04, 0.1, 0],
    ['roth', 0.1, 0.04, 0, 0.1],
    ['split', 0.1, 0.04, 0.06, 0.04],
    ['split', 0.05, 0.08, 0, 0.05],
  ] as const)('toPaycheckProfile splits a %s 401(k) election of %d (Roth %d) into %d / %d', (type, total, rothPct, trad, roth) => {
    const mapped = toPaycheckProfile(
      withV2((p) => {
        p.workplace.contributionType = type;
        p.workplace.contributionPercent = total;
        p.workplace.rothContributionPercent = rothPct;
      })
    );
    expect(mapped.benefits.employer401k.contributionType).toBe(type);
    expect(mapped.benefits.employer401k.currentContribution).toBe(total);
    expect(mapped.benefits.employer401k.traditionalContribution).toBeCloseTo(trad, 12);
    expect(mapped.benefits.employer401k.rothContribution).toBeCloseTo(roth, 12);
  });

  it('toPaycheckProfile reads the bonus, HSA, IRAs, debts and the allocator assumptions', () => {
    const debt = { id: 'd1', name: 'Card', balance: 4000, interestRate: 0.24, minimumPayment: 120, extraPayment: 0, taxDeductible: false };
    const profile = withV2((p) => {
      p.income = { ...p.income, hasBonus: true, bonusAmount: 6000, bonusFrequency: 'annual' };
      p.workplace.afterTaxAvailable = true;
      p.hsa = { eligible: true, coverage: 'family', monthlyContribution: 300, employerAnnualContribution: 1000, investing: true };
      p.ira = { traditional: false, roth: true, traditionalMonthly: 0, rothMonthly: 500, traditionalBalance: 0, rothBalance: 12000 };
      p.debts = [debt];
      p.assumptions.paycheck = { riskTolerance: 'optimizer', optimizationGoal: 'tax_minimization', expectedRetirementBracket: 0.22 };
    });
    const mapped = toPaycheckProfile(profile);
    // Bonus: 6,000 a year = 500 a month.
    expect(mapped.income).toMatchObject({ regularBonus: true, bonusAmount: 6000, bonusFrequency: 'annual', bonusExpected: 500 });
    expect(mapped.benefits.employer401k.afterTaxAvailable).toBe(true);
    expect(mapped.benefits.hsa).toEqual({
      eligible: true,
      employerContribution: 1000,
      currentContribution: 300,
      currentYTD: 0,
      coverageType: 'family',
      investmentStrategy: true,
    });
    expect(mapped.benefits.ira).toEqual({
      hasIRA: true,
      accountTypes: { traditional: false, roth: true },
      currentContributions: { traditional: 0, roth: 500 },
      currentBalances: { traditional: 0, roth: 12000 },
    });
    expect(mapped.debts).toEqual([debt]);
    expect(mapped.debts[0]).not.toBe(profile.debts[0]);
    expect(mapped.preferences).toMatchObject({
      riskTolerance: 'optimizer',
      optimizationGoal: 'tax_minimization',
      expectedRetirementBracket: 0.22,
    });
  });

  it("toRebalanceInputs uses the profile's class targets for a 'custom' mix, and its lists and settings", () => {
    const profile = withV2((p) => {
      p.investing.targetMix = 'custom';
      p.portfolio.classTargets = [
        { accountId: null, assetClass: 'us-stock', target: 0.5 },
        { accountId: null, assetClass: 'cac-gold', target: 0.1 },
        { accountId: null, assetClass: 'bonds', target: 0.4 },
      ];
      p.portfolio.customAssetClasses = [{ id: 'cac-gold', label: 'Gold' }];
      p.portfolio.accounts[0].deposit = 250;
      p.assumptions.portfolio = { mode: 'fractional', allowTaxableSelling: true, showPlacementAdvice: false };
    });
    const inputs = toRebalanceInputs(profile);
    expect(inputs.classTargets).toEqual(profile.portfolio.classTargets);
    expect(inputs.classTargets).not.toBe(profile.portfolio.classTargets);
    expect(inputs.customAssetClasses).toEqual([{ id: 'cac-gold', label: 'Gold' }]);
    expect(inputs.accounts.map((a) => a.deposit)).toEqual([250, 1000]);
    expect(inputs).toMatchObject({ mode: 'fractional', allowTaxableSelling: true, showPlacementAdvice: false });
    expect(validateRebalanceInputsV2(inputs)).toEqual([]);
  });

  it('toRebalanceInputs copies the rows, so editing the result never edits the profile', () => {
    const profile = getDefaultFinancialProfile();
    const inputs = toRebalanceInputs(profile);
    inputs.accounts[1].deposit = 1;
    inputs.holdings[0].shares = 99;
    expect(profile.portfolio.accounts[1].deposit).toBe(1000);
    expect(profile.portfolio.holdings[0].shares).toBe(10);
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
    const c = profileCompleteness({
      ...getDefaultFinancialProfile(),
      provided: ['person.age', 'income.frequency', 'cash.targetMonths', 'not.a.field', 'hsa.eligible', 'debts'],
    });
    expect(c.provided).toBe(3);
    expect(c.total).toBe(25);
    expect(c.missing).toHaveLength(22);
    expect(c.missing.map((m) => m.path)).not.toContain('person.age');
    expect(c.missing.map((m) => m.path)).toContain('person.state');
  });

  it('reports complete when every field is provided', () => {
    const c = profileCompleteness(makeProfile({ provided: PROFILE_FIELDS.map((f) => f.path) }));
    expect(c).toEqual({ provided: 25, total: 25, missing: [] });
    // The new v2 leaves do not count toward the v1 completeness.
    const c2 = profileCompleteness({ ...getDefaultFinancialProfile(), provided: ['hsa.eligible', 'debts'] });
    expect(c2.provided).toBe(0);
  });

  it('keeps the same result for the same v1 answers after migration', () => {
    const c = profileCompleteness(makeProfile({ provided: PROFILE_FIELDS.map((f) => f.path) }));
    expect(c).toEqual({ provided: 25, total: 25, missing: [] });
  });
});
