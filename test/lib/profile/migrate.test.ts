/**
 * migrateProfile: the seam the persist `migrate` hook calls. A payload saved
 * before version 3 (v1 included) goes through migrateV2Payload (the account
 * list becomes the one home of the invested money, contract section 8) and
 * is then normalized against the v3 defaults; a v3 payload is normalized
 * only.
 *
 * The older-version fixtures are what the v1 store wrote to localStorage
 * under 'bufo-profile' (the `state.profile` part of `{ state, version: 1 }`):
 * the untouched default, a profile with every v1 field answered, and a
 * hand-edited payload with wrong types, stray keys and junk paths. They must
 * still load without throwing.
 */

import { describe, expect, it } from 'vitest';
import { makeGet } from '@/lib/fields/paths';
import { emergencyFundBalance, investedBalance, iraBalances } from '@/lib/profile/accounts';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import { migrateV2Payload } from '@/lib/profile/migrateV2';
import { migrateProfile, PROFILE_VERSION } from '@/lib/profile/migrate';
import type { FinancialProfile } from '@/lib/profile/types';
import { MIGRATION_EXAMPLES } from '@/test/factories/profile-90ef4ed-v2';
import { defaultProfileAt3bb0132 } from '@/test/factories/profile-3bb0132';

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
  it('keeps the old example values the v1 default stored; the leaves it lacks take today\'s defaults', () => {
    // The stored leaves are 3bb0132's example (30, TX, $3,500 ...); life
    // expectancy and the portfolio were not in v1, so they come from the
    // PR 3 defaults. Nothing is marked answered, so the stored Social
    // Security benefit (the old 30,000 default) loads as Auto (null).
    // Nothing was answered, so the stored invested balance and monthly
    // contribution give way to the example accounts and to Auto.
    const today = getDefaultFinancialProfile();
    const old = defaultProfileAt3bb0132();
    expect(migrateProfile(V1_DEFAULT, 1)).toEqual({
      ...old,
      person: { ...old.person, lifeExpectancy: today.person.lifeExpectancy },
      retirementIncome: { ...old.retirementIncome, socialSecurityBenefit: null },
      investing: today.investing,
      portfolio: today.portfolio,
    });
  });

  it('loads a v1 payload: every v2 leaf it holds is kept, the unknown new-cash and preset leaves are dropped', () => {
    let p: ReturnType<typeof migrateProfile> | undefined;
    expect(() => {
      p = migrateProfile(V1_ALL_PROVIDED, 1);
    }).not.toThrow();
    if (!p) throw new Error('no profile');
    const defaults = getDefaultFinancialProfile();
    expect(p.version).toBe(3);
    expect(p.updatedAt).toBe(1761000000000);
    expect(p.person).toEqual({ age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58, lifeExpectancy: 90 });
    expect(p.income).toEqual({ ...defaults.income, grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' });
    expect(p.spending).toEqual(V1_ALL_PROVIDED.spending);
    // The 1 month was never asked in v1 (not in provided): it loads as the typical 3.
    expect(p.cash).toEqual({ ...V1_ALL_PROVIDED.cash, targetMonths: 3 });
    expect(p.workplace).toEqual({ ...defaults.workplace, ...V1_ALL_PROVIDED.workplace });
    // The answered monthly contribution is the Custom monthly investing figure.
    // Normalization fills the timing leaf (new in PR 5) with its default.
    expect(p.investing).toEqual({
      monthlyContribution: 2200,
      taxableMonthlyContribution: 900,
      taxableTiming: 'monthly',
      targetMix: '60-40',
    });
    expect(p.investing).not.toHaveProperty('newCashThisMonth');
    expect(p.investing).not.toHaveProperty('investedBalance');
    expect(p.strategy).toEqual({ leverageRatio: 1.5 });
    expect(p.provided).toEqual([
      ...V1_ALL_PROVIDED.provided.filter(
        (path) => !['investing.newCashThisMonth', 'strategy.preset', 'investing.investedBalance'].includes(path)
      ),
      'portfolio.accounts',
    ]);
    // The answered 140,000 is one "Other investments" 401(k) row (has401k yes);
    // v1 had no lists, so no example holdings are kept. The v1 new cash is not
    // moved anywhere.
    expect(p.portfolio.accounts).toEqual([
      { id: 'acc-other', kind: '401k', name: 'Other investments', balance: 140000, holdsEmergencyFund: false },
    ]);
    expect(p.portfolio.holdings).toEqual([]);
    expect(p.portfolio.newCash).toEqual([]);
    expect(investedBalance(makeGet(p))).toBe(140000);
    for (const key of ['hsa', 'ira', 'retirementIncome', 'debts', 'leverage', 'assumptions'] as const) {
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
    // The one valid workplace leaf (a 50% match) is kept.
    expect(p.workplace).toEqual({ ...defaults.workplace, matchPercent: 0.5 });
    expect(p.investing).toEqual(defaults.investing);
    expect(p.strategy).toEqual({ leverageRatio: 3 });
    expect(p).not.toHaveProperty('extras');
    expect(p.portfolio).toEqual(defaults.portfolio);
    // Junk paths are dropped, and so is a row path whose row does not exist
    // (v1 had no debts list, so 'debts.0.balance' was never a real answer).
    expect(p.provided).toEqual(['person.age', 'strategy.leverageRatio']);
  });

  it('loads a v2 profile saved with the removed strategy preset: the leaf and its answer go, unanswered months load as 3', () => {
    // As saved at 3bb0132: the preset answered, and 1 month written by the cash-flow investor preset
    // without being marked provided. The 1 was never the visitor's answer, so it loads as the typical 3.
    const saved = {
      ...getDefaultFinancialProfile(),
      updatedAt: 1762000000000,
      cash: { emergencyFundBalance: 4000, emergencyFundApy: 0.04, targetMonths: 1 },
      strategy: { preset: 'cashflow-investor', leverageRatio: 3 },
      provided: ['person.age', 'strategy.preset', 'strategy.leverageRatio'],
    };
    let p: ReturnType<typeof migrateProfile> | undefined;
    expect(() => {
      p = migrateProfile(saved, 2);
    }).not.toThrow();
    if (!p) throw new Error('no profile');
    expect(p.version).toBe(PROFILE_VERSION);
    expect(p.strategy).toEqual({ leverageRatio: 3 });
    expect(p.strategy).not.toHaveProperty('preset');
    expect(p.cash).toEqual({ emergencyFundBalance: 4000, emergencyFundApy: 0.04, targetMonths: 3 });
    expect(p.provided).toEqual(['person.age', 'strategy.leverageRatio']);
  });

  it('keeps emergency months the visitor entered, 1 included', () => {
    const saved = {
      ...getDefaultFinancialProfile(),
      cash: { emergencyFundBalance: 4000, emergencyFundApy: 0.04, targetMonths: 1 },
      provided: ['cash.targetMonths'],
    };
    expect(migrateProfile(saved, 2).cash.targetMonths).toBe(1);
    // A partial patch normalized over a base is not a stored payload: left alone.
    expect(normalizeProfile({ cash: { targetMonths: 1 } }).cash.targetMonths).toBe(1);
  });

  it('treats every version before 3 the same: the result is normalizeProfile of the migrated payload', () => {
    for (const payload of [V1_DEFAULT, V1_ALL_PROVIDED, V1_GARBAGE]) {
      const expected = normalizeProfile(migrateV2Payload(payload));
      for (const version of [0, 1, 2]) expect(migrateProfile(payload, version)).toEqual(expected);
    }
  });

  it('returns the defaults for a payload that is not an object', () => {
    expect(migrateProfile(null, 1)).toEqual(getDefaultFinancialProfile());
    expect(migrateProfile('profile', 1)).toEqual(getDefaultFinancialProfile());
  });
});

describe('migrateProfile at the current version', () => {
  it('is version 3', () => {
    expect(PROFILE_VERSION).toBe(3);
  });

  it('normalizes only: a stored v3 profile that holds removed v2 leaves loses those leaves and nothing else', () => {
    const saved = getDefaultFinancialProfile();
    saved.person.age = 44;
    saved.portfolio.newCash = [{ id: 'acc-brok', amount: 400 }];
    saved.provided = ['person.age', 'portfolio.accounts', 'investing.newCashThisMonth'];
    const stored = JSON.parse(JSON.stringify(saved));
    stored.investing.newCashThisMonth = 9000;
    stored.investing.investedBalance = 70000;
    const expected = { ...saved, provided: ['person.age', 'portfolio.accounts'] };

    let p: ReturnType<typeof migrateProfile> | undefined;
    expect(() => {
      p = migrateProfile(stored, 3);
    }).not.toThrow();
    expect(p).toEqual(expected);
    expect(p?.investing).not.toHaveProperty('newCashThisMonth');
    expect(p?.investing).not.toHaveProperty('investedBalance');
    expect(p?.portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 400 }]);
    expect(migrateProfile(stored, 4)).toEqual(expected);
  });

  it('is idempotent across a v1 load and a later load', () => {
    const once = migrateProfile(V1_ALL_PROVIDED, 1);
    expect(migrateProfile(JSON.parse(JSON.stringify(once)), 3)).toEqual(once);
  });
});

/** The rows of the migrated list as [id, kind, name, balance]. */
const rows = (p: FinancialProfile) => p.portfolio.accounts.map((a) => [a.id, a.kind, a.name, a.balance]);
const answered = (p: FinancialProfile) => p.provided.includes('portfolio.accounts');
const migrated = (example: string) => migrateProfile(MIGRATION_EXAMPLES[example](), 2);

describe('migrateProfile(payload, 2): the examples of contract section 8, normalized', () => {
  it('every example loads as version 3 without the three removed leaves or their answers', () => {
    for (const [name, payload] of Object.entries(MIGRATION_EXAMPLES)) {
      const p = migrateProfile(payload(), 2);
      expect(p.version, name).toBe(3);
      expect(p.investing, name).not.toHaveProperty('investedBalance');
      expect(p.ira, name).not.toHaveProperty('traditionalBalance');
      expect(p.ira, name).not.toHaveProperty('rothBalance');
      for (const path of ['investing.investedBalance', 'ira.traditionalBalance', 'ira.rothBalance']) {
        expect(p.provided, name).not.toContain(path);
      }
      // Migrating again is a no-op.
      expect(migrateProfile(JSON.parse(JSON.stringify(p)), 3), name).toEqual(p);
    }
  });

  it('1: the v2 default gives the v3 default', () => {
    expect(migrated('1')).toEqual(getDefaultFinancialProfile());
  });

  it('2: the typed 60,000 becomes one "Other investments" 401(k); the 2,000 a month is Custom', () => {
    const p = migrated('2');
    expect(rows(p)).toEqual([['acc-other', '401k', 'Other investments', 60000]]);
    expect([p.portfolio.holdings, p.portfolio.newCash]).toEqual([[], []]);
    expect(p.portfolio.securities.map((sec) => sec.ticker)).toEqual(['VTI', 'VXUS', 'BND']);
    expect(p.investing.monthlyContribution).toBe(2000);
    expect(answered(p)).toBe(true);
    expect(investedBalance(makeGet(p))).toBe(60000);
  });

  it('3: both accounts kept by their holdings, 30,000 - 12,875 = 17,125 added, the 1,000 deposit kept as new cash', () => {
    const p = migrated('3');
    expect(rows(p)).toEqual([
      ['acc-roth', 'roth-ira', 'Roth IRA', 0],
      ['acc-brok', 'brokerage', 'Brokerage', 0],
      ['acc-other', '401k', 'Other investments', 17125],
    ]);
    expect(p.portfolio.holdings).toHaveLength(4);
    expect(p.portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1000 }]);
    expect(p.investing.monthlyContribution).toBeNull();
    expect(investedBalance(makeGet(p))).toBe(30000);
    expect(iraBalances(makeGet(p))).toEqual({ traditional: 0, roth: 4100 });
  });

  it('3b: B = 10,000 adds no row; the holdings win at 12,875', () => {
    const p = migrated('3b');
    expect(rows(p).map(([id]) => id)).toEqual(['acc-roth', 'acc-brok']);
    expect(investedBalance(makeGet(p))).toBe(12875);
  });

  it('4a: the typed IRA balances become the only rows', () => {
    const p = migrated('4a');
    expect(rows(p)).toEqual([
      ['acc-trad-ira', 'traditional-ira', '', 20000],
      ['acc-roth-ira', 'roth-ira', '', 6000],
    ]);
    expect(p.portfolio.holdings).toEqual([]);
    expect(iraBalances(makeGet(p))).toEqual({ traditional: 20000, roth: 6000 });
    expect(investedBalance(makeGet(p))).toBe(26000);
  });

  it('4b: the Roth IRA holdings count, and the rest 6,000 - 4,100 = 1,900 is added', () => {
    const p = migrated('4b');
    expect(rows(p)).toEqual([
      ['acc-roth', 'roth-ira', 'Roth IRA', 0],
      ['acc-brok', 'brokerage', 'Brokerage', 0],
      ['acc-trad-ira', 'traditional-ira', '', 20000],
      ['acc-roth-ira', 'roth-ira', 'Roth IRA (rest)', 1900],
    ]);
    expect(p.portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1000 }]);
    expect(iraBalances(makeGet(p))).toEqual({ traditional: 20000, roth: 6000 });
    expect(investedBalance(makeGet(p))).toBe(34775);
  });

  it('5: yes answers alone keep the unanswered v3 example', () => {
    const p = migrated('5');
    expect(p.portfolio).toEqual(getDefaultFinancialProfile().portfolio);
    expect(answered(p)).toBe(false);
  });

  it('6: the BOXX account is kept unticked; 40,000 - 20,400 = 19,600 added; the typed fund stands', () => {
    const p = migrated('6');
    expect(rows(p)).toEqual([
      ['acc-fid', 'roth-ira', 'Fidelity Roth IRA', 0],
      ['acc-rh', 'brokerage', 'Robinhood', 0],
      ['acc-other', '401k', 'Other investments', 19600],
    ]);
    expect(p.portfolio.accounts.every((a) => !a.holdsEmergencyFund)).toBe(true);
    expect(p.portfolio.newCash).toEqual([]);
    expect(investedBalance(makeGet(p))).toBe(40000);
    expect(emergencyFundBalance(makeGet(p))).toBe(10000);
    expect(iraBalances(makeGet(p)).roth).toBe(10050);
  });

  it('7: a tax-free account with no name hint is a Roth IRA; the rest 1,900 is added', () => {
    const p = migrated('7');
    expect(rows(p)).toEqual([
      ['acc-1', 'roth-ira', 'Fidelity', 0],
      ['acc-roth-ira', 'roth-ira', 'Roth IRA (rest)', 1900],
    ]);
    expect(iraBalances(makeGet(p)).roth).toBe(6000);
    expect(investedBalance(makeGet(p))).toBe(6000);
  });

  it('8: the accepted 25,000 and example lists: 25,000 - 12,875 = 12,125 added', () => {
    const p = migrated('8');
    expect(rows(p)).toEqual([
      ['acc-roth', 'roth-ira', 'Roth IRA', 0],
      ['acc-brok', 'brokerage', 'Brokerage', 0],
      ['acc-other', '401k', 'Other investments', 12125],
    ]);
    expect(p.portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1000 }]);
    expect(investedBalance(makeGet(p))).toBe(25000);
    expect(iraBalances(makeGet(p)).roth).toBe(4100);
  });

  it('9: a price edit keeps the unanswered example with VTI at 400', () => {
    const p = migrated('9');
    expect(answered(p)).toBe(false);
    expect(p.provided).toContain('portfolio.securities');
    expect(p.portfolio.securities.find((sec) => sec.id === 'sec-vti')?.price).toBe(400);
    // 16,225 + (20 x 400 + 15 x 85) = 16,225 + 9,275.
    expect(investedBalance(makeGet(p))).toBe(25500);
  });
});
