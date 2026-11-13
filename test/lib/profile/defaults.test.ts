/**
 * Profile v3 defaults, path registry, value rules, normalization and writes.
 *
 * Default profile (lib/profile/defaults.ts, docs/rebuild-plan.md section 2.3):
 * the PR 3 worked example (25, CA, single, retire at 65; $4,000 every two
 * weeks) plus every calculator input's home: the retirement and leverage
 * model constants, and the account list's worked example (a 401(k) with a
 * typed 16,225 and a brokerage holding 8,775 of three funds; PR 4).
 */

import { describe, expect, it } from 'vitest';
import {
  applyProfileWrites,
  BROKERAGE_ACCOUNT_ID,
  getDefaultFinancialProfile,
  getProfileValue,
  isProfilePath,
  isValidProfileValue,
  normalizeProfile,
  normalizeProvided,
  presetClassTargets,
  PROFILE_LEAF_PATHS,
  PROFILE_LIST_PATHS,
  PROFILE_LIST_ROW_DEFAULTS,
  PROFILE_SECTIONS,
  providedPathFor,
  TARGET_MIX_PRESETS,
  TARGET_MIX_WEIGHTS,
} from '@/lib/profile/defaults';
import type { PresetTargetMix } from '@/lib/profile/defaults';
import { DEFAULT_DCA_COMPARISON_INPUTS } from '@/lib/calculations/leverageComparison';
import { RetirementConstants } from '@/lib/constants/retirement';
import { calculateAnnualFederalTax } from '@/lib/calculations/projections';
import { STATE_TAX_RATES_2026 } from '@/lib/constants/states-2026';
import { DEFAULT_FINANCING_RATE, SHORT_RATE_ASSUMPTION, SWAP_FINANCING_SPREAD } from '@/lib/constants/leverage';
import { withDerivedValues } from '@/lib/profile/derived';
import { getFICARate } from '@/lib/utils';

/** The 25 leaves of the v1 profile, as v1 listed them. */
const V1_LEAF_PATHS = [
  'person.age', 'person.state', 'person.filingStatus', 'person.retirementAge',
  'income.grossPerPaycheck', 'income.netPerPaycheck', 'income.frequency',
  'spending.necessaryMonthly', 'spending.funMoneyMin', 'spending.funMoneyMax', 'spending.targetRetirementIncome',
  'cash.emergencyFundBalance', 'cash.emergencyFundApy', 'cash.targetMonths',
  'workplace.has401k', 'workplace.matchPercent', 'workplace.matchLimit', 'workplace.contributionPercent',
  'investing.investedBalance', 'investing.monthlyContribution', 'investing.taxableMonthlyContribution',
  'investing.targetMix', 'investing.newCashThisMonth',
  'strategy.preset', 'strategy.leverageRatio',
];

describe('the PR 3 worked example', () => {
  it('is the example the site owner filled in: 25, CA, single, retiring at 65, planning to 90', () => {
    const p = getDefaultFinancialProfile();
    expect(p.person).toEqual({ age: 25, state: 'CA', filingStatus: 'single', retirementAge: 65, lifeExpectancy: 90 });
    expect(p.income).toMatchObject({ grossPerPaycheck: 4000, frequency: 'bi-weekly', hasBonus: false });
    expect(p.spending).toMatchObject({ necessaryMonthly: 3000, funMoneyMin: 300, funMoneyMax: 600 });
    expect(p.cash).toMatchObject({ emergencyFundApy: 0.04, targetMonths: 3 });
    expect(p.workplace).toMatchObject({ has401k: true, matchPercent: 1, matchLimit: 0.04, contributionType: 'traditional', contributionPercent: 0.08 });
  });

  it("computes take-home pay with the paycheck allocator's own tax model, to the nearest 50", () => {
    const p = getDefaultFinancialProfile();
    const annualGross = p.income.grossPerPaycheck * 26;
    const deferral = annualGross * p.workplace.contributionPercent;
    const wages = annualGross - deferral;
    const federal = calculateAnnualFederalTax(wages, p.person.filingStatus);
    const state = wages * STATE_TAX_RATES_2026.CA.rate;
    const fica = annualGross * getFICARate(annualGross, p.person.filingStatus);
    // By hand: 104,000 - 8,320 - 12,219.60 - 8,898.24 - 7,956 = 66,606.16 a year.
    expect(federal).toBeCloseTo(12219.6, 6);
    expect(state).toBeCloseTo(8898.24, 6);
    expect(fica).toBeCloseTo(7956, 6);
    const perPaycheck = (annualGross - deferral - federal - state - fica) / 26;
    expect(perPaycheck).toBeCloseTo(2561.775, 3);
    expect(p.income.netPerPaycheck).toBe(Math.round(perPaycheck / 50) * 50);
    expect(p.income.netPerPaycheck).toBe(2550);
  });

  it('stores what the derived rules give for its own answers', () => {
    const p = getDefaultFinancialProfile();
    expect(p.cash.emergencyFundBalance).toBe(9000);
    expect(p.spending.targetRetirementIncome).toBe(41000);
    expect(p.hsa.coverage).toBe('individual');
    expect(withDerivedValues(p)).toBe(p);
  });

  it('prices the example funds at whole multiples of 5 dollars', () => {
    const prices = getDefaultFinancialProfile().portfolio.securities.map((s) => [s.ticker, s.price]);
    expect(prices).toEqual([['VTI', 375], ['VXUS', 85], ['BND', 70]]);
  });

  it('keeps the financing rate at the 4% short rate plus the 0.5 point spread', () => {
    expect(SHORT_RATE_ASSUMPTION).toBe(0.04);
    expect(SWAP_FINANCING_SPREAD).toBe(0.005);
    expect(DEFAULT_FINANCING_RATE).toBeCloseTo(0.045, 12);
  });
});

describe('getDefaultFinancialProfile', () => {
  it('returns the documented v3 placeholder values', () => {
    expect(getDefaultFinancialProfile()).toEqual({
      version: 3,
      updatedAt: 0,
      person: { age: 25, state: 'CA', filingStatus: 'single', retirementAge: 65, lifeExpectancy: 90 },
      income: {
        grossPerPaycheck: 4000,
        netPerPaycheck: 2550,
        frequency: 'bi-weekly',
        hasBonus: false,
        bonusAmount: 0,
        bonusFrequency: 'annual',
      },
      spending: { necessaryMonthly: 3000, funMoneyMin: 300, funMoneyMax: 600, targetRetirementIncome: 41000 },
      cash: { emergencyFundBalance: 9000, emergencyFundApy: 0.04, targetMonths: 3 },
      workplace: {
        has401k: true,
        matchPercent: 1,
        matchLimit: 0.04,
        contributionType: 'traditional',
        contributionPercent: 0.08,
        rothContributionPercent: 0,
        afterTaxAvailable: false,
      },
      hsa: { eligible: false, coverage: 'individual', monthlyContribution: 0, employerAnnualContribution: 0, investing: false },
      ira: { traditional: false, roth: false, traditionalMonthly: 0, rothMonthly: 0 },
      investing: {
        monthlyContribution: null,
        taxableMonthlyContribution: 500,
        targetMix: '80-20',
      },
      retirementIncome: { socialSecurityBenefit: null, socialSecurityAge: 67, annualHealthcareCost: null },
      debts: [],
      portfolio: {
        accounts: [
          { id: 'acc-401k', kind: '401k', name: '', balance: 16225, holdsEmergencyFund: false },
          { id: 'acc-brok', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
        ],
        securities: [
          { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 375, assetClass: 'us-stock' },
          { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 85, assetClass: 'intl-stock' },
          { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 70, assetClass: 'bonds' },
        ],
        holdings: [
          { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
          { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
          { id: 'hld-brok-bnd', accountId: 'acc-brok', securityId: 'sec-bnd', shares: 0 },
        ],
        newCash: [],
        classTargets: [
          { accountId: null, assetClass: 'us-stock', target: 0.6 },
          { accountId: null, assetClass: 'intl-stock', target: 0.2 },
          { accountId: null, assetClass: 'bonds', target: 0.2 },
          { accountId: null, assetClass: 'cash', target: 0 },
        ],
        customAssetClasses: [],
      },
      strategy: { leverageRatio: 2 },
      leverage: { monthlyContribution: null, years: null, startingBalance: null },
      assumptions: {
        retirement: {
          riskProfile: 'tdf',
          accumulationReturn: 0.08,
          retirementReturn: 0.06,
          inflationRate: 0.03,
          volatility: 0.15,
          effectiveTaxRate: null,
          healthcareCostMultiplier: 1,
        },
        paycheck: { riskTolerance: 'moderate', optimizationGoal: 'balanced', expectedRetirementBracket: 0.12 },
        portfolio: { mode: 'whole', allowTaxableSelling: false, showPlacementAdvice: true },
        leverage: {
          indexMeanReturn: 0.1,
          indexVolatility: 0.16,
          financingRate: DEFAULT_DCA_COMPARISON_INPUTS.financingRate,
          expenseRatio: 0.0089,
          indexExpenseRatio: 0.0003,
        },
      },
      provided: [],
    });
  });

  it('derives the model defaults from the existing constants', () => {
    const p = getDefaultFinancialProfile();
    expect(p.person.lifeExpectancy).toBe(RetirementConstants.DEFAULT_LIFE_EXPECTANCY);
    expect(p.retirementIncome.socialSecurityAge).toBe(RetirementConstants.SS_FULL_RETIREMENT_AGE);
    expect(p.assumptions.retirement).toMatchObject({
      accumulationReturn: RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
      retirementReturn: RetirementConstants.DEFAULT_RETIREMENT_RETURN,
      inflationRate: RetirementConstants.DEFAULT_INFLATION_RATE,
      volatility: RetirementConstants.DEFAULT_VOLATILITY,
    });
    const { indexMeanReturn, indexVolatility, financingRate, expenseRatio, indexExpenseRatio } =
      DEFAULT_DCA_COMPARISON_INPUTS;
    expect(p.assumptions.leverage).toEqual({ indexMeanReturn, indexVolatility, financingRate, expenseRatio, indexExpenseRatio });
    expect(p.portfolio.classTargets).toEqual(presetClassTargets('80-20'));
  });

  it('is the account list example: no stored new cash, the brokerage worth 20 x 375 + 15 x 85 + 0 x 70 = 8,775', () => {
    const p = getDefaultFinancialProfile();
    expect(p.portfolio.newCash).toEqual([]);
    expect(p.investing.monthlyContribution).toBeNull();
    const price = new Map(p.portfolio.securities.map((s) => [s.id, s.price]));
    const brokerage = p.portfolio.holdings
      .filter((h) => h.accountId === BROKERAGE_ACCOUNT_ID)
      .reduce((sum, h) => sum + h.shares * (price.get(h.securityId) ?? 0), 0);
    expect(brokerage).toBe(8775);
    expect(p.portfolio.accounts.find((a) => a.kind === '401k')?.balance).toBe(16225);
  });

  it('returns a fresh object each call', () => {
    const a = getDefaultFinancialProfile();
    a.person.age = 99;
    a.provided.push('person.age');
    a.portfolio.accounts[0].balance = 5;
    a.assumptions.retirement.volatility = 0.3;
    const b = getDefaultFinancialProfile();
    expect(b.person.age).toBe(25);
    expect(b.provided).toEqual([]);
    expect(b.portfolio.accounts[0].balance).toBe(16225);
    expect(b.assumptions.retirement.volatility).toBe(0.15);
  });
});

describe('target mix', () => {
  it('has target-mix weights that each sum to 1', () => {
    for (const mix of Object.keys(TARGET_MIX_WEIGHTS) as PresetTargetMix[]) {
      const w = TARGET_MIX_WEIGHTS[mix];
      expect(w['us-stock'] + w['intl-stock'] + w.bonds + w.cash).toBeCloseTo(1, 12);
    }
  });

  it('builds portfolio-wide class targets from a preset', () => {
    expect(presetClassTargets('60-40')).toEqual([
      { accountId: null, assetClass: 'us-stock', target: 0.45 },
      { accountId: null, assetClass: 'intl-stock', target: 0.15 },
      { accountId: null, assetClass: 'bonds', target: 0.4 },
      { accountId: null, assetClass: 'cash', target: 0 },
    ]);
  });

  it("accepts 'custom' as a target mix", () => {
    expect(TARGET_MIX_PRESETS).toEqual(['100-0', '80-20', '60-40', 'custom']);
    expect(isValidProfileValue('investing.targetMix', 'custom')).toBe(true);
  });
});

describe('v1 leaves, sections and preset constants', () => {
  it('keeps every v1 leaf but the invested balance, the one-off new cash and the removed strategy preset, which are no v3 paths', () => {
    expect(V1_LEAF_PATHS).toHaveLength(25);
    expect(V1_LEAF_PATHS.filter((path) => !PROFILE_LEAF_PATHS.includes(path))).toEqual([
      'investing.investedBalance',
      'investing.newCashThisMonth',
      'strategy.preset',
    ]);
    expect(isProfilePath('investing.newCashThisMonth')).toBe(false);
    expect(isProfilePath('strategy.preset')).toBe(false);
    // v3 keeps balances on the account rows only.
    expect(isProfilePath('investing.investedBalance')).toBe(false);
    expect(isProfilePath('ira.traditionalBalance')).toBe(false);
    expect(isProfilePath('ira.rothBalance')).toBe(false);
  });

  it('excludes version, updatedAt and provided from the leaf paths', () => {
    const paths = PROFILE_LEAF_PATHS;
    expect(paths).not.toContain('version');
    expect(paths).not.toContain('updatedAt');
    expect(paths).not.toContain('provided');
  });

  it('lists the sections, exactly the data keys of the profile', () => {
    const keys = Object.keys(getDefaultFinancialProfile()).filter(
      (k) => !['version', 'updatedAt', 'provided'].includes(k)
    );
    expect([...PROFILE_SECTIONS].sort()).toEqual(keys.sort());
  });

  it('has no strategy preset any more: the strategy section holds the leverage ratio alone', () => {
    expect(getDefaultFinancialProfile().strategy).toEqual({ leverageRatio: 2 });
    expect(PROFILE_LEAF_PATHS.filter((path) => path.startsWith('strategy.'))).toEqual(['strategy.leverageRatio']);
  });
});

describe('path registry', () => {
  it('lists every leaf of the default profile once, in section order', () => {
    expect(PROFILE_LEAF_PATHS).toHaveLength(62);
    expect(new Set(PROFILE_LEAF_PATHS).size).toBe(PROFILE_LEAF_PATHS.length);
    expect(PROFILE_LEAF_PATHS.slice(0, 5)).toEqual([
      'person.age',
      'person.state',
      'person.filingStatus',
      'person.retirementAge',
      'person.lifeExpectancy',
    ]);
    expect(PROFILE_LEAF_PATHS).toContain('assumptions.retirement.effectiveTaxRate');
    expect(PROFILE_LEAF_PATHS).toContain('retirementIncome.annualHealthcareCost');
    expect(PROFILE_LEAF_PATHS).not.toContain('investing.newCashThisMonth');
    expect(PROFILE_LEAF_PATHS[PROFILE_LEAF_PATHS.length - 1]).toBe('assumptions.leverage.indexExpenseRatio');
    for (const path of PROFILE_LEAF_PATHS) {
      expect(getProfileValue(getDefaultFinancialProfile(), path), path).not.toBeUndefined();
    }
  });

  it('lists the seven lists and none of them as leaves', () => {
    expect(PROFILE_LIST_PATHS).toEqual([
      'debts',
      'portfolio.accounts',
      'portfolio.securities',
      'portfolio.holdings',
      'portfolio.newCash',
      'portfolio.classTargets',
      'portfolio.customAssetClasses',
    ]);
    for (const list of PROFILE_LIST_PATHS) expect(PROFILE_LEAF_PATHS).not.toContain(list);
  });

  it('recognizes leaves, lists, rows and row fields, and nothing else', () => {
    expect(isProfilePath('person.age')).toBe(true);
    expect(isProfilePath('assumptions.portfolio.mode')).toBe(true);
    expect(isProfilePath('debts')).toBe(true);
    expect(isProfilePath('debts.0')).toBe(true);
    expect(isProfilePath('debts.12.balance')).toBe(true);
    expect(isProfilePath('portfolio.securities.1.name')).toBe(true);
    expect(isProfilePath('portfolio.classTargets.0.accountId')).toBe(true);

    expect(isProfilePath('person')).toBe(false);
    expect(isProfilePath('assumptions.retirement')).toBe(false);
    expect(isProfilePath('portfolio')).toBe(false);
    expect(isProfilePath('debts.balance')).toBe(false);
    expect(isProfilePath('debts.01.balance')).toBe(false);
    expect(isProfilePath('debts.0.nickname')).toBe(false);
    expect(isProfilePath('debts.0.balance.x')).toBe(false);
    expect(isProfilePath('provided')).toBe(false);
    expect(isProfilePath('version')).toBe(false);
    expect(isProfilePath('person.nickname')).toBe(false);
  });

  it('records rows and row fields by their list path', () => {
    expect(providedPathFor('person.age')).toBe('person.age');
    expect(providedPathFor('debts')).toBe('debts');
    expect(providedPathFor('debts.3')).toBe('debts');
    expect(providedPathFor('portfolio.accounts.1.balance')).toBe('portfolio.accounts');
    expect(providedPathFor('not.a.path')).toBeNull();
    expect(normalizeProvided(['debts.0.balance', 'person.age', 'debts', 7, 'nope', 'person.age'])).toEqual([
      'debts',
      'person.age',
    ]);
  });

  it('drops row paths whose row does not exist when given the profile', () => {
    const p = getDefaultFinancialProfile();
    expect(normalizeProvided(['debts.7.balance', 'portfolio.holdings.2', 'portfolio.holdings.3', 'person.age'], p))
      .toEqual(['portfolio.holdings', 'person.age']);
    // A list path itself is an answer even when the list is empty ("I have no debts").
    expect(normalizeProvided(['debts'], p)).toEqual(['debts']);
  });

  it('reads any profile path and nothing else', () => {
    const p = getDefaultFinancialProfile();
    expect(getProfileValue(p, 'income.grossPerPaycheck')).toBe(4000);
    expect(getProfileValue(p, 'workplace.has401k')).toBe(true);
    expect(getProfileValue(p, 'assumptions.retirement.effectiveTaxRate')).toBeNull();
    expect(getProfileValue(p, 'portfolio.accounts.0.balance')).toBe(16225);
    expect(getProfileValue(p, 'portfolio.accounts.1.kind')).toBe('brokerage');
    expect(getProfileValue(p, 'portfolio.holdings')).toHaveLength(3);
    expect(getProfileValue(p, 'portfolio.newCash')).toEqual([]);
    expect(getProfileValue(p, 'nope.nothing')).toBeUndefined();
    expect(getProfileValue(p, 'person')).toBeUndefined();
  });
});

describe('isValidProfileValue', () => {
  it('accepts only finite numbers, booleans, listed enum members and non-empty strings', () => {
    expect(isValidProfileValue('person.age', 41)).toBe(true);
    expect(isValidProfileValue('person.age', '41')).toBe(false);
    expect(isValidProfileValue('person.age', Number.NaN)).toBe(false);
    expect(isValidProfileValue('person.age', Infinity)).toBe(false);
    expect(isValidProfileValue('person.age', null)).toBe(false);
    expect(isValidProfileValue('workplace.has401k', false)).toBe(true);
    expect(isValidProfileValue('workplace.has401k', 'false')).toBe(false);
    expect(isValidProfileValue('income.frequency', 'semi-monthly')).toBe(true);
    expect(isValidProfileValue('income.frequency', 'daily')).toBe(false);
    expect(isValidProfileValue('investing.targetMix', '60-40')).toBe(true);
    expect(isValidProfileValue('strategy.preset', 'standard')).toBe(false);
    expect(isValidProfileValue('person.state', 'CA')).toBe(true);
    expect(isValidProfileValue('person.state', '  ')).toBe(false);
    expect(isValidProfileValue('person.nickname', 'x')).toBe(false);
  });

  it('accepts all four filing statuses', () => {
    for (const status of ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold']) {
      expect(isValidProfileValue('person.filingStatus', status)).toBe(true);
    }
    expect(isValidProfileValue('person.filingStatus', 'married')).toBe(false);
  });

  it('checks the new enum leaves against their vocabularies', () => {
    expect(isValidProfileValue('income.bonusFrequency', 'quarterly')).toBe(true);
    expect(isValidProfileValue('income.bonusFrequency', 'monthly')).toBe(false);
    expect(isValidProfileValue('workplace.contributionType', 'split')).toBe(true);
    expect(isValidProfileValue('workplace.contributionType', 'both')).toBe(false);
    expect(isValidProfileValue('hsa.coverage', 'family')).toBe(true);
    expect(isValidProfileValue('assumptions.retirement.riskProfile', 'custom')).toBe(true);
    expect(isValidProfileValue('assumptions.retirement.riskProfile', 'aggressive')).toBe(false);
    expect(isValidProfileValue('assumptions.paycheck.riskTolerance', 'optimizer')).toBe(true);
    expect(isValidProfileValue('assumptions.paycheck.optimizationGoal', 'tax_minimization')).toBe(true);
    expect(isValidProfileValue('assumptions.portfolio.mode', 'fractional')).toBe(true);
    expect(isValidProfileValue('assumptions.portfolio.mode', 'partial')).toBe(false);
  });

  it('accepts null only for the nullable overrides', () => {
    expect(isValidProfileValue('assumptions.retirement.effectiveTaxRate', null)).toBe(true);
    expect(isValidProfileValue('assumptions.retirement.effectiveTaxRate', 0.18)).toBe(true);
    expect(isValidProfileValue('assumptions.retirement.effectiveTaxRate', '0.18')).toBe(false);
    expect(isValidProfileValue('retirementIncome.annualHealthcareCost', null)).toBe(true);
    expect(isValidProfileValue('leverage.years', null)).toBe(true);
    expect(isValidProfileValue('leverage.years', 25)).toBe(true);
    expect(isValidProfileValue('leverage.years', Number.NaN)).toBe(false);
    expect(isValidProfileValue('retirementIncome.socialSecurityAge', null)).toBe(false);
  });

  it('checks row fields by list path, index and key', () => {
    expect(isValidProfileValue('debts.0.balance', 1200)).toBe(true);
    expect(isValidProfileValue('debts.0.taxDeductible', 'yes')).toBe(false);
    expect(isValidProfileValue('debts.0.name', '')).toBe(true);
    expect(isValidProfileValue('debts.0.id', '')).toBe(false);
    expect(isValidProfileValue('portfolio.accounts.1.kind', 'roth-ira')).toBe(true);
    expect(isValidProfileValue('portfolio.accounts.1.kind', 'tax-deferred')).toBe(false);
    expect(isValidProfileValue('portfolio.accounts.1.balance', 0)).toBe(true);
    expect(isValidProfileValue('portfolio.accounts.1.balance', -1)).toBe(false);
    expect(isValidProfileValue('portfolio.accounts.1.holdsEmergencyFund', true)).toBe(true);
    expect(isValidProfileValue('portfolio.newCash.0.amount', 250)).toBe(true);
    expect(isValidProfileValue('portfolio.newCash.0.amount', -5)).toBe(false);
    expect(isValidProfileValue('portfolio.classTargets.0.accountId', null)).toBe(true);
    expect(isValidProfileValue('portfolio.classTargets.0.accountId', 'acc-1')).toBe(true);
    expect(isValidProfileValue('portfolio.securities.0.name', 'Total Market')).toBe(true);
    expect(isValidProfileValue('debts', [])).toBe(false);
    expect(isValidProfileValue('debts.0', {})).toBe(false);
  });
});

describe('normalizeProfile', () => {
  it('returns the defaults for non-object input', () => {
    expect(normalizeProfile(null)).toEqual(getDefaultFinancialProfile());
    expect(normalizeProfile('garbage')).toEqual(getDefaultFinancialProfile());
    expect(normalizeProfile([1, 2])).toEqual(getDefaultFinancialProfile());
  });

  it('fills missing sections and keys, and drops invalid leaves and unknown keys', () => {
    const p = normalizeProfile({
      version: 7,
      updatedAt: 1234,
      person: { age: 45, state: 'NY', filingStatus: 'bogus' },
      income: 'not-an-object',
      cash: { emergencyFundBalance: Number.NaN, targetMonths: 6 },
      strategy: { preset: 'standard', leverageRatio: 3, extra: 'ignored' },
      assumptions: { retirement: { volatility: 0.2, effectiveTaxRate: null, junk: 1 }, paycheck: 'x' },
      nickname: 'Bufo',
      provided: ['person.age', 'person.age', 7, 'cash.targetMonths'],
    });
    expect(p.version).toBe(3);
    expect(p.updatedAt).toBe(1234);
    expect(p.person).toEqual({ age: 45, state: 'NY', filingStatus: 'single', retirementAge: 65, lifeExpectancy: 90 });
    expect(p.income).toEqual(getDefaultFinancialProfile().income);
    expect(p.cash).toEqual({ emergencyFundBalance: 9000, emergencyFundApy: 0.04, targetMonths: 6 });
    // The removed strategy preset is an unknown key now and is dropped.
    expect(p.strategy).toEqual({ leverageRatio: 3 });
    expect(p.assumptions.retirement).toEqual({ ...getDefaultFinancialProfile().assumptions.retirement, volatility: 0.2 });
    expect(p.assumptions.paycheck).toEqual(getDefaultFinancialProfile().assumptions.paycheck);
    expect(p).not.toHaveProperty('nickname');
    expect(p.provided).toEqual(['person.age', 'cash.targetMonths']);
  });

  it('keeps a nullable override set to a number and returns it to null', () => {
    const set = normalizeProfile({ leverage: { years: 25, startingBalance: null, monthlyContribution: 'x' } });
    expect(set.leverage).toEqual({ monthlyContribution: null, years: 25, startingBalance: null });
    const base = { ...getDefaultFinancialProfile(), leverage: { monthlyContribution: 700, years: 25, startingBalance: 0 } };
    expect(normalizeProfile({ leverage: { years: null } }, base).leverage).toEqual({
      monthlyContribution: 700,
      years: null,
      startingBalance: 0,
    });
  });

  it('falls back to a supplied base profile rather than the defaults', () => {
    const base = getDefaultFinancialProfile();
    base.person.age = 52;
    base.updatedAt = 99;
    base.debts = [{ id: 'd1', name: 'Card', balance: 900, interestRate: 0.24, minimumPayment: 35, extraPayment: 0, taxDeductible: false }];
    const p = normalizeProfile({ person: { age: 'x' }, updatedAt: Number.NaN, debts: 'none' }, base);
    expect(p.person.age).toBe(52);
    expect(p.updatedAt).toBe(99);
    expect(p.debts).toEqual(base.debts);
  });

  it('does not share nested objects or rows with the base', () => {
    const base = getDefaultFinancialProfile();
    const p = normalizeProfile({}, base);
    p.person.age = 70;
    p.provided.push('person.age');
    p.portfolio.accounts[0].balance = 1;
    p.assumptions.portfolio.mode = 'fractional';
    expect(base.person.age).toBe(25);
    expect(base.provided).toEqual([]);
    expect(base.portfolio.accounts[0].balance).toBe(16225);
    expect(base.assumptions.portfolio.mode).toBe('whole');
  });

  describe('lists', () => {
    it('debts: fills invalid fields from the row defaults and drops rows without an id', () => {
      const p = normalizeProfile({
        debts: [
          { id: 'd1', name: 'Car loan', balance: 12000, interestRate: 0.065, minimumPayment: 320, extraPayment: 50, taxDeductible: false },
          { id: 'd2', name: 42, balance: '900', interestRate: 0.24, taxDeductible: 'no', color: 'red' },
          { name: 'No id', balance: 100 },
          { id: '', balance: 100 },
          'card',
          null,
          { id: 'd1', name: 'Duplicate', balance: 1 },
        ],
      });
      expect(p.debts).toEqual([
        { id: 'd1', name: 'Car loan', balance: 12000, interestRate: 0.065, minimumPayment: 320, extraPayment: 50, taxDeductible: false },
        { id: 'd2', name: '', balance: 0, interestRate: 0.24, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
      ]);
    });

    it('accounts: checks the kind, keeps an empty name and floors the balance at 0', () => {
      const p = normalizeProfile({
        portfolio: {
          accounts: [
            { id: 'a1', name: '', kind: '401k', balance: 250, holdsEmergencyFund: false },
            { id: 'a2', name: 'Roth', kind: 'roth', balance: -5 },
            { name: 'No id' },
          ],
        },
      });
      expect(p.portfolio.accounts).toEqual([
        { id: 'a1', name: '', kind: '401k', balance: 250, holdsEmergencyFund: false },
        { id: 'a2', name: 'Roth', kind: 'brokerage', balance: 0, holdsEmergencyFund: false },
      ]);
      // The other portfolio lists keep the base (default) rows.
      expect(p.portfolio.holdings).toEqual(getDefaultFinancialProfile().portfolio.holdings);
    });

    it('accounts: forces the emergency-fund tick off on a kind that is not a brokerage', () => {
      const p = normalizeProfile({
        portfolio: {
          accounts: [
            { id: 'a1', name: 'Bank', kind: 'cash', balance: 4000, holdsEmergencyFund: true },
            { id: 'a2', name: 'Broker', kind: 'brokerage', balance: 900, holdsEmergencyFund: true },
            { id: 'a3', name: 'Odd', kind: 'pension', balance: 10, holdsEmergencyFund: true },
          ],
        },
      });
      expect(p.portfolio.accounts.map((a) => [a.kind, a.holdsEmergencyFund])).toEqual([
        ['cash', false],
        ['brokerage', true],
        // An unknown kind reads as a brokerage, and a brokerage may hold the fund.
        ['brokerage', true],
      ]);
    });

    it('newCash: drops repeated ids and floors a negative amount at 0', () => {
      const p = normalizeProfile({
        portfolio: {
          newCash: [
            { id: 'acc-brok', amount: 500 },
            { id: 'acc-401k', amount: -40 },
            { id: 'acc-brok', amount: 900 },
            { amount: 7 },
          ],
        },
      });
      expect(p.portfolio.newCash).toEqual([
        { id: 'acc-brok', amount: 500 },
        { id: 'acc-401k', amount: 0 },
      ]);
    });

    it('keeps monthly investing null as Auto and a number as the override', () => {
      expect(normalizeProfile({}).investing.monthlyContribution).toBeNull();
      expect(normalizeProfile({ investing: { monthlyContribution: 1500 } }).investing.monthlyContribution).toBe(1500);
      expect(normalizeProfile({ investing: { monthlyContribution: 'x' } }).investing.monthlyContribution).toBeNull();
    });

    it('securities: keeps the optional name only when it is a string', () => {
      const p = normalizeProfile({
        portfolio: {
          securities: [
            { id: 's1', ticker: 'VTI', name: 'Total Market', price: 250, assetClass: 'us-stock' },
            { id: 's2', ticker: '', price: Number.NaN, assetClass: '', name: 7 },
            { ticker: 'BND' },
          ],
        },
      });
      expect(p.portfolio.securities).toEqual([
        { id: 's1', ticker: 'VTI', name: 'Total Market', price: 250, assetClass: 'us-stock' },
        { id: 's2', ticker: '', price: 0, assetClass: 'other' },
      ]);
    });

    it('holdings: drops rows without an account or security reference', () => {
      const p = normalizeProfile({
        portfolio: {
          holdings: [
            { id: 'h1', accountId: 'a1', securityId: 's1', shares: 3.5 },
            { id: 'h2', accountId: 'a1', shares: 1 },
            { id: 'h3', accountId: '', securityId: 's1', shares: 1 },
            { id: 'h4', accountId: 'a1', securityId: 's2', shares: 'many' },
          ],
        },
      });
      expect(p.portfolio.holdings).toEqual([
        { id: 'h1', accountId: 'a1', securityId: 's1', shares: 3.5 },
        { id: 'h4', accountId: 'a1', securityId: 's2', shares: 0 },
      ]);
    });

    it('classTargets: needs an asset class and accepts a null or string account id', () => {
      const p = normalizeProfile({
        portfolio: {
          classTargets: [
            { accountId: null, assetClass: 'us-stock', target: 0.7 },
            { accountId: 'a1', assetClass: 'bonds', target: 0.3 },
            { accountId: 5, assetClass: 'cash', target: 'x' },
            { accountId: null, target: 0.1 },
          ],
        },
      });
      expect(p.portfolio.classTargets).toEqual([
        { accountId: null, assetClass: 'us-stock', target: 0.7 },
        { accountId: 'a1', assetClass: 'bonds', target: 0.3 },
        { accountId: null, assetClass: 'cash', target: 0 },
      ]);
    });

    it('customAssetClasses: needs an id', () => {
      const p = normalizeProfile({
        portfolio: { customAssetClasses: [{ id: 'cac-1', label: 'Gold' }, { label: 'No id' }, { id: 'cac-2' }] },
      });
      expect(p.portfolio.customAssetClasses).toEqual([
        { id: 'cac-1', label: 'Gold' },
        { id: 'cac-2', label: '' },
      ]);
    });

    it('has a row default for every list', () => {
      expect(Object.keys(PROFILE_LIST_ROW_DEFAULTS).sort()).toEqual([...PROFILE_LIST_PATHS].sort());
    });
  });

  describe('the Social Security benefit (Auto since PR 3)', () => {
    const SS = 'retirementIncome.socialSecurityBenefit';
    const stored = (benefit: unknown, provided: string[]) => ({
      retirementIncome: { socialSecurityBenefit: benefit, socialSecurityAge: 67, annualHealthcareCost: null },
      provided,
    });

    it('is null (Auto) by default and accepts null or a number', () => {
      expect(getDefaultFinancialProfile().retirementIncome.socialSecurityBenefit).toBeNull();
      expect(isValidProfileValue(SS, null)).toBe(true);
      expect(isValidProfileValue(SS, 24000)).toBe(true);
      expect(isValidProfileValue(SS, 'x')).toBe(false);
    });

    it('loads a stored number that was never answered (the old 30,000 default) as Auto', () => {
      expect(normalizeProfile(stored(30000, [])).retirementIncome.socialSecurityBenefit).toBeNull();
      expect(normalizeProfile(stored(30000, ['person.age'])).retirementIncome.socialSecurityBenefit).toBeNull();
    });

    it('keeps an answered stored number, and an answered Auto', () => {
      expect(normalizeProfile(stored(30000, [SS])).retirementIncome.socialSecurityBenefit).toBe(30000);
      expect(normalizeProfile(stored(0, [SS])).retirementIncome.socialSecurityBenefit).toBe(0);
      const auto = normalizeProfile(stored(null, [SS]));
      expect(auto.retirementIncome.socialSecurityBenefit).toBeNull();
      expect(auto.provided).toEqual([SS]);
    });

    it('leaves a partial patch normalized over a base (no provided list of its own) alone', () => {
      const base = { ...getDefaultFinancialProfile(), retirementIncome: { socialSecurityBenefit: 30000, socialSecurityAge: 67, annualHealthcareCost: null } };
      expect(normalizeProfile({ person: { age: 40 } }, base).retirementIncome.socialSecurityBenefit).toBe(30000);
    });
  });
});

describe('a stored answered emergency fund target loads as whole months', () => {
  const MONTHS = 'cash.targetMonths';
  const stored = (months: number, provided: string[]) => ({
    cash: { emergencyFundBalance: 9000, emergencyFundApy: 0.04, targetMonths: months },
    provided,
  });

  it.each<[number, number]>([
    [2.5, 3],
    [2.4, 2],
    [0.5, 1],
    [61.2, 60],
    [-1, 0],
  ])('an answered %s loads as %s and stays answered', (months, whole) => {
    const p = normalizeProfile(stored(months, [MONTHS]));
    expect(p.cash.targetMonths).toBe(whole);
    expect(p.provided).toEqual([MONTHS]);
  });

  it('leaves an answered whole value untouched', () => {
    for (const months of [0, 1, 6, 60]) {
      expect(normalizeProfile(stored(months, [MONTHS])).cash.targetMonths).toBe(months);
    }
  });

  it('still loads an unanswered value as the typical 3', () => {
    expect(normalizeProfile(stored(2.5, [])).cash.targetMonths).toBe(3);
    expect(normalizeProfile(stored(1, ['person.age'])).cash.targetMonths).toBe(3);
  });

  it('leaves a partial patch normalized over a base alone', () => {
    const base = { ...getDefaultFinancialProfile(), provided: [MONTHS] };
    expect(normalizeProfile({ cash: { targetMonths: 2.5 } }, base).cash.targetMonths).toBe(2.5);
  });
});

describe('applyProfileWrites', () => {
  const base = getDefaultFinancialProfile();

  it('applies valid writes in order and reports the accepted paths', () => {
    const { profile, accepted } = applyProfileWrites(base, [
      { path: 'person.age', value: 41 },
      { path: 'assumptions.retirement.effectiveTaxRate', value: 0.18 },
      { path: 'person.age', value: 42 },
    ]);
    expect(profile.person.age).toBe(42);
    expect(profile.assumptions.retirement.effectiveTaxRate).toBe(0.18);
    expect(accepted).toEqual(['person.age', 'assumptions.retirement.effectiveTaxRate', 'person.age']);
    expect(profile.income).toBe(base.income);
    expect(base.person.age).toBe(25);
  });

  it('refuses unknown paths and invalid values, keeping the previous value', () => {
    const { profile, accepted } = applyProfileWrites(base, [
      { path: 'person.nickname', value: 'Bufo' },
      { path: 'person', value: { age: 50 } },
      { path: 'person.age', value: '41' },
      { path: 'income.frequency', value: 'daily' },
      { path: 'provided', value: ['person.age'] },
    ]);
    expect(profile).toBe(base);
    expect(accepted).toEqual([]);
  });

  it('writes a whole list, normalizing its rows', () => {
    const { profile, accepted } = applyProfileWrites(base, [
      { path: 'debts', value: [{ id: 'd1', name: 'Card', balance: 900, interestRate: 0.24 }, { name: 'bad' }] },
    ]);
    expect(profile.debts).toEqual([
      { id: 'd1', name: 'Card', balance: 900, interestRate: 0.24, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
    ]);
    expect(accepted).toEqual(['debts']);
    expect(applyProfileWrites(base, [{ path: 'debts', value: 'none' }]).accepted).toEqual([]);
  });

  it('appends or replaces a row, and refuses a gap or an invalid row', () => {
    const debt = { id: 'd1', name: 'Card', balance: 900, interestRate: 0.24, minimumPayment: 35, extraPayment: 0, taxDeductible: false };
    const appended = applyProfileWrites(base, [{ path: 'debts.0', value: debt }]);
    expect(appended.profile.debts).toEqual([debt]);
    const replaced = applyProfileWrites(appended.profile, [{ path: 'debts.0', value: { ...debt, balance: 800 } }]);
    expect(replaced.profile.debts[0].balance).toBe(800);
    expect(applyProfileWrites(base, [{ path: 'debts.1', value: debt }]).accepted).toEqual([]);
    expect(applyProfileWrites(base, [{ path: 'debts.0', value: { name: 'no id' } }]).accepted).toEqual([]);
  });

  it('writes a field of an existing row only', () => {
    const { profile, accepted } = applyProfileWrites(base, [
      { path: 'portfolio.holdings.2.shares', value: 25 },
      { path: 'portfolio.holdings.9.shares', value: 1 },
      { path: 'portfolio.holdings.0.shares', value: 'ten' },
      { path: 'portfolio.holdings.0.accountId', value: '' },
    ]);
    expect(profile.portfolio.holdings[2].shares).toBe(25);
    expect(profile.portfolio.holdings[0]).toEqual(base.portfolio.holdings[0]);
    expect(accepted).toEqual(['portfolio.holdings.2.shares']);
  });

  it('refuses a row or an id that would repeat another row id', () => {
    const first = base.portfolio.accounts[0];
    const { profile, accepted } = applyProfileWrites(base, [
      { path: 'portfolio.accounts.2', value: { ...first, name: 'Copy' } },
      { path: 'portfolio.accounts.1.id', value: 'acc-401k' },
      { path: 'portfolio.accounts.0', value: { ...first, name: 'Work plan' } },
      { path: 'portfolio.accounts.1.id', value: 'acc-taxable' },
    ]);
    expect(profile.portfolio.accounts.map((account) => [account.id, account.name])).toEqual([
      ['acc-401k', 'Work plan'],
      ['acc-taxable', ''],
    ]);
    expect(accepted).toEqual(['portfolio.accounts.0', 'portfolio.accounts.1.id']);
  });

  it('refuses a write to the removed v1 new-cash leaf and leaves the account balances alone', () => {
    const { profile, accepted } = applyProfileWrites(base, [{ path: 'investing.newCashThisMonth', value: 2400 }]);
    expect(profile).toEqual(base);
    expect(profile.investing).not.toHaveProperty('newCashThisMonth');
    expect(profile.portfolio.accounts.map((account) => account.balance)).toEqual([16225, 0]);
    expect(accepted).toEqual([]);
  });

  it('refuses the emergency-fund tick on an account that is not a brokerage', () => {
    const { profile, accepted } = applyProfileWrites(base, [
      { path: 'portfolio.accounts.0.holdsEmergencyFund', value: true },
      { path: 'portfolio.accounts.1.holdsEmergencyFund', value: true },
    ]);
    expect(profile.portfolio.accounts.map((account) => account.holdsEmergencyFund)).toEqual([false, true]);
    expect(accepted).toEqual(['portfolio.accounts.1.holdsEmergencyFund']);
  });

  it('clears the tick when a brokerage changes to another kind', () => {
    const ticked = applyProfileWrites(base, [{ path: 'portfolio.accounts.1.holdsEmergencyFund', value: true }]).profile;
    const { profile } = applyProfileWrites(ticked, [{ path: 'portfolio.accounts.1.kind', value: 'cash' }]);
    expect(profile.portfolio.accounts[1]).toEqual({
      id: 'acc-brok',
      kind: 'cash',
      name: '',
      balance: 0,
      holdsEmergencyFund: false,
    });
  });
});
