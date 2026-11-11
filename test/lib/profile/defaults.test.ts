/**
 * Profile v2 defaults, path metadata and list normalization.
 */

import { describe, expect, it } from 'vitest';
import {
  getDefaultFinancialProfile,
  getProfileValue,
  isProfileFieldPath,
  isProfileLeafPath,
  isProfileListPath,
  isProfilePath,
  isValidProfileValue,
  listPathOf,
  normalizeList,
  normalizeProfile,
  normalizeProvided,
  PROFILE_ENUM_VALUES,
  PROFILE_LEAF_PATHS,
  PROFILE_LIST_PATHS,
  PROFILE_LIST_ROWS,
  PROFILE_NULLABLE_PATHS,
  PROFILE_SECTIONS,
  providedPathFor,
  splitProfilePath,
  TARGET_MIX_PRESETS,
} from '@/lib/profile';
import { getAt } from '@/lib/fields/paths';

describe('path metadata', () => {
  it('lists every v2 leaf and list, and nothing else', () => {
    expect(PROFILE_LIST_PATHS).toEqual([
      'debts',
      'portfolio.accounts',
      'portfolio.securities',
      'portfolio.holdings',
      'portfolio.classTargets',
      'portfolio.customAssetClasses',
    ]);
    expect(PROFILE_LEAF_PATHS).toContain('person.lifeExpectancy');
    expect(PROFILE_LEAF_PATHS).toContain('assumptions.retirement.effectiveTaxRate');
    expect(PROFILE_LEAF_PATHS).toContain('leverage.years');
    expect(PROFILE_LEAF_PATHS).not.toContain('version');
    expect(PROFILE_LEAF_PATHS).not.toContain('updatedAt');
    expect(PROFILE_LEAF_PATHS).not.toContain('provided');
    expect(new Set(PROFILE_LEAF_PATHS).size).toBe(PROFILE_LEAF_PATHS.length);
    // Every leaf belongs to a listed section.
    for (const path of [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS]) {
      expect(PROFILE_SECTIONS).toContain(path.split('.')[0]);
    }
  });

  it('has a row schema for every list, an existing leaf for every enum and nullable path', () => {
    for (const list of PROFILE_LIST_PATHS) expect(PROFILE_LIST_ROWS[list]).toBeDefined();
    for (const path of Object.keys(PROFILE_ENUM_VALUES)) expect(isProfileLeafPath(path)).toBe(true);
    for (const path of PROFILE_NULLABLE_PATHS) {
      expect(isProfileLeafPath(path)).toBe(true);
      expect(getAt(getDefaultFinancialProfile(), path)).toBeNull();
    }
  });

  it('gives every enum leaf a default that is one of its values', () => {
    const defaults = getDefaultFinancialProfile();
    for (const [path, values] of Object.entries(PROFILE_ENUM_VALUES)) {
      expect(values).toContain(getAt(defaults, path));
    }
    expect(TARGET_MIX_PRESETS).toEqual(['100-0', '80-20', '60-40', 'custom']);
  });

  it.each([
    ['person.age', true, 'person.age'],
    ['assumptions.paycheck.riskTolerance', true, 'assumptions.paycheck.riskTolerance'],
    ['debts', true, 'debts'],
    ['debts.0', true, 'debts'],
    ['debts.3.balance', true, 'debts'],
    ['portfolio.securities.1.name', true, 'portfolio.securities'],
    ['portfolio.holdings.0.shares', true, 'portfolio.holdings'],
    ['debts.0.nickname', false, null],
    ['debts.x.balance', false, null],
    ['debts.0.balance.extra', false, null],
    ['person', false, null],
    ['person.0', false, null],
    ['assumptions.retirement', false, null],
    ['provided', false, null],
    ['version', false, null],
    ['', false, null],
  ] as const)('isProfilePath(%s) = %s, provided as %s', (path, known, provided) => {
    expect(isProfilePath(path)).toBe(known);
    expect(providedPathFor(path)).toBe(provided);
  });

  it('separates leaves, lists and row paths', () => {
    expect(isProfileLeafPath('person.age')).toBe(true);
    expect(isProfileLeafPath('debts')).toBe(false);
    expect(isProfileListPath('debts')).toBe(true);
    expect(isProfileListPath('debts.0')).toBe(false);
    expect(listPathOf('portfolio.accounts.2.deposit')).toBe('portfolio.accounts');
    expect(listPathOf('person.age')).toBeNull();
    expect(isProfileFieldPath('workplace.contributionType')).toBe(true);
  });

  it('keeps the deprecated two-segment helpers working', () => {
    const p = getDefaultFinancialProfile();
    expect(splitProfilePath('hsa.eligible')).toEqual({ section: 'hsa', key: 'eligible' });
    expect(splitProfilePath('assumptions.paycheck.riskTolerance')).toBeNull();
    expect(splitProfilePath('debts')).toBeNull();
    expect(getProfileValue(p, 'assumptions.paycheck.riskTolerance')).toBe('moderate');
    expect(getProfileValue(p, 'portfolio.accounts.1.deposit')).toBe(1000);
    expect(getProfileValue(p, 'person.nickname')).toBeUndefined();
  });
});

describe('isValidProfileValue (v2)', () => {
  it('validates nullable leaves', () => {
    expect(isValidProfileValue('leverage.years', null)).toBe(true);
    expect(isValidProfileValue('leverage.years', 10)).toBe(true);
    expect(isValidProfileValue('leverage.years', Number.NaN)).toBe(false);
    expect(isValidProfileValue('leverage.years', '10')).toBe(false);
    expect(isValidProfileValue('person.age', null)).toBe(false);
  });

  it('validates lists, rows and row fields', () => {
    expect(isValidProfileValue('debts', [])).toBe(true);
    expect(isValidProfileValue('debts', {})).toBe(false);
    expect(isValidProfileValue('debts.0', { id: 'x' })).toBe(true);
    expect(isValidProfileValue('debts.0', 'x')).toBe(false);
    expect(isValidProfileValue('debts.0.balance', 100)).toBe(true);
    expect(isValidProfileValue('debts.0.balance', Infinity)).toBe(false);
    expect(isValidProfileValue('debts.0.taxDeductible', 'yes')).toBe(false);
    expect(isValidProfileValue('debts.0.name', '')).toBe(true);
    expect(isValidProfileValue('debts.0.id', '')).toBe(false);
    expect(isValidProfileValue('portfolio.accounts.0.accountType', 'tax-deferred')).toBe(true);
    expect(isValidProfileValue('portfolio.accounts.0.accountType', 'offshore')).toBe(false);
    expect(isValidProfileValue('portfolio.classTargets.0.accountId', null)).toBe(true);
    expect(isValidProfileValue('portfolio.classTargets.0.accountId', 'acc-roth')).toBe(true);
    expect(isValidProfileValue('portfolio.classTargets.0.accountId', 3)).toBe(false);
    expect(isValidProfileValue('portfolio.securities.0.name', 'Fund')).toBe(true);
    expect(isValidProfileValue('portfolio.securities.0.name', 4)).toBe(false);
    expect(isValidProfileValue('debts.0.nickname', 'x')).toBe(false);
    expect(isValidProfileValue('hsa.coverage', 'family')).toBe(true);
    expect(isValidProfileValue('assumptions.portfolio.mode', 'yearly')).toBe(false);
  });
});

describe('normalizeList', () => {
  it('normalizes debts: drops non-objects and id-less rows, defaults bad keys, drops unknown keys', () => {
    expect(
      normalizeList('debts', [
        { id: 'd1', name: 'Car', balance: 9000, interestRate: 0.06, minimumPayment: 250, extraPayment: 0, taxDeductible: false },
        { id: 'd2', name: 7, balance: 'lots', interestRate: 0.2, taxDeductible: 'no', color: 'red' },
        { name: 'No id' },
        { id: '   ' },
        'junk',
        null,
      ])
    ).toEqual([
      { id: 'd1', name: 'Car', balance: 9000, interestRate: 0.06, minimumPayment: 250, extraPayment: 0, taxDeductible: false },
      { id: 'd2', name: '', balance: 0, interestRate: 0.2, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
    ]);
  });

  it('keeps the first of duplicate ids and falls back to the previous row with the same id', () => {
    const previous = [{ id: 'a', name: 'Roth', accountType: 'tax-free', deposit: 50 }];
    expect(
      normalizeList(
        'portfolio.accounts',
        [
          { id: 'a', name: 'Roth IRA', accountType: 'nope', deposit: Number.NaN },
          { id: 'a', name: 'Duplicate', accountType: 'taxable', deposit: 1 },
          { id: 'b', name: 'New', accountType: 'tax-deferred', deposit: 10 },
        ],
        previous
      )
    ).toEqual([
      { id: 'a', name: 'Roth IRA', accountType: 'tax-free', deposit: 50 },
      { id: 'b', name: 'New', accountType: 'tax-deferred', deposit: 10 },
    ]);
  });

  it('keeps an optional security name only when it is a string', () => {
    expect(
      normalizeList('portfolio.securities', [
        { id: 's1', ticker: 'VTI', name: 'Total', price: 250, assetClass: 'us-stock' },
        { id: 's2', ticker: 'X', name: 3, price: 10, assetClass: 'other' },
      ])
    ).toEqual([
      { id: 's1', ticker: 'VTI', name: 'Total', price: 250, assetClass: 'us-stock' },
      { id: 's2', ticker: 'X', price: 10, assetClass: 'other' },
    ]);
  });

  it('requires holdings to name an account and a security', () => {
    expect(
      normalizeList('portfolio.holdings', [
        { id: 'h1', accountId: 'a', securityId: 's', shares: 3 },
        { id: 'h2', accountId: '', securityId: 's', shares: 3 },
        { id: 'h3', accountId: 'a', shares: 3 },
      ])
    ).toEqual([{ id: 'h1', accountId: 'a', securityId: 's', shares: 3 }]);
  });

  it('normalizes class targets (no id: no dedupe) and custom asset classes', () => {
    expect(
      normalizeList('portfolio.classTargets', [
        { accountId: null, assetClass: 'us-stock', target: 0.7 },
        { accountId: 'acc', assetClass: 'bonds', target: 'x' },
        { accountId: 4, assetClass: 'cash', target: 0.1 },
        { assetClass: '', target: 0.2 },
      ])
    ).toEqual([
      { accountId: null, assetClass: 'us-stock', target: 0.7 },
      { accountId: 'acc', assetClass: 'bonds', target: 0 },
      { accountId: null, assetClass: 'cash', target: 0.1 },
    ]);
    expect(normalizeList('portfolio.customAssetClasses', [{ id: 'crypto', label: 'Crypto' }, { label: 'x' }])).toEqual([
      { id: 'crypto', label: 'Crypto' },
    ]);
  });

  it('returns a copy of the previous list for a non-array or an unknown list', () => {
    const previous = [{ id: 'd' }];
    expect(normalizeList('debts', 'nope', previous)).toEqual(previous);
    expect(normalizeList('debts', 'nope', previous)).not.toBe(previous);
    expect(normalizeList('person', [], [])).toEqual([]);
  });
});

describe('normalizeProfile (v2)', () => {
  it('normalizes nested assumption leaves and nullable overrides', () => {
    const p = normalizeProfile({
      assumptions: {
        retirement: { inflationRate: 0.02, effectiveTaxRate: 0.2, riskProfile: 'yolo' },
        leverage: 'none',
      },
      leverage: { years: null, monthlyContribution: 'x', startingBalance: 3000 },
      retirementIncome: { annualHealthcareCost: 12000 },
    });
    expect(p.assumptions.retirement.inflationRate).toBe(0.02);
    expect(p.assumptions.retirement.effectiveTaxRate).toBe(0.2);
    expect(p.assumptions.retirement.riskProfile).toBe('tdf');
    expect(p.assumptions.leverage).toEqual(getDefaultFinancialProfile().assumptions.leverage);
    expect(p.leverage).toEqual({ monthlyContribution: null, years: null, startingBalance: 3000 });
    expect(p.retirementIncome.annualHealthcareCost).toBe(12000);
  });

  it('keeps the base list when the input list is missing or not an array', () => {
    const base = getDefaultFinancialProfile();
    expect(normalizeProfile({ portfolio: { accounts: 'x' } }, base).portfolio).toEqual(base.portfolio);
    expect(normalizeProfile({ debts: [] }, base).debts).toEqual([]);
  });

  it('drops holdings orphaned by a missing account or security', () => {
    const base = getDefaultFinancialProfile();
    const p = normalizeProfile({
      portfolio: { securities: base.portfolio.securities.filter((s) => s.id !== 'sec-bnd') },
    });
    expect(p.portfolio.holdings.map((h) => h.id)).toEqual(['hld-roth-vti', 'hld-brok-vti', 'hld-brok-vxus']);
  });

  it('records provided row paths as their list and drops unknown paths', () => {
    expect(normalizeProvided(['debts.0.balance', 'debts', 'person.age', 'person.nickname', 5, 'portfolio.holdings.1'])).toEqual([
      'debts',
      'person.age',
      'portfolio.holdings',
    ]);
  });

  it('is idempotent on the defaults', () => {
    const d = getDefaultFinancialProfile();
    expect(normalizeProfile(d)).toEqual(d);
    expect(normalizeProfile(normalizeProfile(d))).toEqual(d);
  });
});
