/**
 * migrateProfile: the seam the persist `migrate` hook calls. It has no
 * migration step today; a payload of any version is normalized against the
 * v2 defaults.
 *
 * The older-version fixtures are what the v1 store wrote to localStorage
 * under 'bufo-profile' (the `state.profile` part of `{ state, version: 1 }`):
 * the untouched default, a profile with every v1 field answered, and a
 * hand-edited payload with wrong types, stray keys and junk paths. They must
 * still load without throwing.
 */

import { describe, expect, it } from 'vitest';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import { migrateProfile, PROFILE_VERSION } from '@/lib/profile/migrate';

/** v1 getDefaultFinancialProfile(), as JSON.parse returns it. */
const V1_DEFAULT = {
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
};

/** A v1 profile after the full profile intake: every field answered. */
const V1_ALL_PROVIDED = {
  version: 1,
  updatedAt: 1761000000000,
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
  provided: [
    'person.age', 'person.state', 'person.filingStatus', 'income.grossPerPaycheck', 'income.frequency',
    'income.netPerPaycheck', 'spending.necessaryMonthly', 'person.retirementAge', 'investing.investedBalance',
    'investing.monthlyContribution', 'spending.funMoneyMin', 'spending.funMoneyMax', 'workplace.has401k',
    'workplace.matchPercent', 'workplace.matchLimit', 'investing.newCashThisMonth', 'investing.targetMix',
    'investing.taxableMonthlyContribution', 'cash.emergencyFundBalance', 'cash.emergencyFundApy', 'strategy.preset',
  ],
};

/** Edited by hand in devtools. */
const V1_GARBAGE = {
  version: 1,
  updatedAt: 'yesterday',
  person: { age: '41', state: '', filingStatus: 'headOfHousehold', retirementAge: 62, nickname: 'Bufo' },
  income: null,
  spending: { necessaryMonthly: -200, funMoneyMin: 300, funMoneyMax: null },
  cash: [5000, 0.04, 3],
  workplace: { has401k: 'yes', matchPercent: 0.5 },
  investing: { investedBalance: 1e400, targetMix: '90-10', newCashThisMonth: -250 },
  strategy: { preset: 'yolo', leverageRatio: 3 },
  extras: { theme: 'dark' },
  provided: ['person.age', 'person.age', 42, null, 'person.nickname', 'debts.0.balance', 'strategy.leverageRatio'],
};

describe('migrateProfile from an older version (normalize only)', () => {
  it('turns the v1 default into exactly the v2 default', () => {
    expect(migrateProfile(V1_DEFAULT, 1)).toEqual(getDefaultFinancialProfile());
  });

  it('loads a v1 payload: every v2 leaf it holds is kept, the unknown v1 new-cash leaf is dropped', () => {
    let p: ReturnType<typeof migrateProfile> | undefined;
    expect(() => {
      p = migrateProfile(V1_ALL_PROVIDED, 1);
    }).not.toThrow();
    if (!p) throw new Error('no profile');
    const defaults = getDefaultFinancialProfile();
    expect(p.version).toBe(2);
    expect(p.updatedAt).toBe(1761000000000);
    expect(p.person).toEqual({ age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58, lifeExpectancy: 85 });
    expect(p.income).toEqual({ ...defaults.income, grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' });
    expect(p.spending).toEqual(V1_ALL_PROVIDED.spending);
    expect(p.cash).toEqual(V1_ALL_PROVIDED.cash);
    expect(p.workplace).toEqual({ ...defaults.workplace, ...V1_ALL_PROVIDED.workplace });
    expect(p.investing).toEqual({ investedBalance: 140000, monthlyContribution: 2200, taxableMonthlyContribution: 900, targetMix: '60-40' });
    expect(p.investing).not.toHaveProperty('newCashThisMonth');
    expect(p.strategy).toEqual(V1_ALL_PROVIDED.strategy);
    expect(p.provided).toEqual(V1_ALL_PROVIDED.provided.filter((path) => path !== 'investing.newCashThisMonth'));
    // The v1 new cash is not moved anywhere: the portfolio keeps its defaults,
    // the Brokerage deposit included.
    for (const key of ['hsa', 'ira', 'retirementIncome', 'debts', 'leverage', 'portfolio', 'assumptions'] as const) {
      expect(p[key]).toEqual(defaults[key]);
    }
  });

  it('cleans a hand-edited payload: invalid leaves take defaults, unknown keys and paths go', () => {
    const p = migrateProfile(V1_GARBAGE, 1);
    const defaults = getDefaultFinancialProfile();
    expect(p.updatedAt).toBe(0);
    // The widened filing status makes a v1 'headOfHousehold' valid.
    expect(p.person).toEqual({ ...defaults.person, filingStatus: 'headOfHousehold', retirementAge: 62 });
    expect(p.person).not.toHaveProperty('nickname');
    expect(p.income).toEqual(defaults.income);
    expect(p.spending).toEqual({ ...defaults.spending, necessaryMonthly: -200 });
    expect(p.cash).toEqual(defaults.cash);
    expect(p.workplace).toEqual(defaults.workplace);
    expect(p.investing).toEqual(defaults.investing);
    expect(p.strategy).toEqual({ preset: 'cashflow-investor', leverageRatio: 3 });
    expect(p).not.toHaveProperty('extras');
    expect(p.portfolio).toEqual(defaults.portfolio);
    // Junk paths are dropped, and so is a row path whose row does not exist
    // (v1 had no debts list, so 'debts.0.balance' was never a real answer).
    expect(p.provided).toEqual(['person.age', 'strategy.leverageRatio']);
  });

  it('treats every version the same: the result is normalizeProfile of the payload', () => {
    for (const payload of [V1_DEFAULT, V1_ALL_PROVIDED, V1_GARBAGE]) {
      const expected = normalizeProfile(payload);
      for (const version of [0, 1, 2, 3]) expect(migrateProfile(payload, version)).toEqual(expected);
    }
  });

  it('returns the defaults for a payload that is not an object', () => {
    expect(migrateProfile(null, 1)).toEqual(getDefaultFinancialProfile());
    expect(migrateProfile('profile', 1)).toEqual(getDefaultFinancialProfile());
  });
});

describe('migrateProfile at the current version', () => {
  it('is version 2', () => {
    expect(PROFILE_VERSION).toBe(2);
  });

  it('normalizes only: a stored v2 profile that still holds the removed new-cash leaf loses that leaf and nothing else', () => {
    const saved = getDefaultFinancialProfile();
    saved.person.age = 44;
    saved.portfolio.accounts[1].deposit = 400;
    saved.provided = ['person.age', 'portfolio.accounts', 'investing.newCashThisMonth'];
    const stored = JSON.parse(JSON.stringify(saved));
    stored.investing.newCashThisMonth = 9000;
    const expected = { ...saved, provided: ['person.age', 'portfolio.accounts'] };

    let p: ReturnType<typeof migrateProfile> | undefined;
    expect(() => {
      p = migrateProfile(stored, 2);
    }).not.toThrow();
    expect(p).toEqual(expected);
    expect(p?.investing).not.toHaveProperty('newCashThisMonth');
    expect(p?.portfolio.accounts[1].deposit).toBe(400);
    expect(migrateProfile(stored, 3)).toEqual(expected);
  });

  it('is idempotent across a v1 load and a later load', () => {
    const once = migrateProfile(V1_ALL_PROVIDED, 1);
    expect(migrateProfile(JSON.parse(JSON.stringify(once)), 2)).toEqual(once);
  });
});
