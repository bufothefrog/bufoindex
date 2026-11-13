/**
 * Profile Store Test Suite
 *
 * Exercises useProfileStore through getState() with no React rendering.
 * jsdom provides localStorage, so persist hydrates synchronously when the
 * module loads; the rehydration tests seed localStorage and call
 * persist.rehydrate() to exercise the merge/normalize path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROFILE_STORAGE_KEY, useProfileStore } from '@/lib/store/profileStore';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';

const store = useProfileStore;
const getState = () => store.getState();

function readPersisted(): { state: Record<string, unknown>; version: number } | null {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  getState().reset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initial state and hydration flag', () => {
  it('uses the localStorage key bufo-profile', () => {
    expect(PROFILE_STORAGE_KEY).toBe('bufo-profile');
    expect(store.persist.getOptions().name).toBe('bufo-profile');
  });

  it('starts from the default profile with no answers', () => {
    expect(getState().profile).toEqual(getDefaultFinancialProfile());
    expect(getState().hasProfile).toBe(false);
  });

  it('is hydrated on the client, while the server/hydration snapshot is not', () => {
    // jsdom has localStorage, so hydration ran when the module loaded.
    expect(getState().hasHydrated).toBe(true);
    expect(store.persist.hasHydrated()).toBe(true);
    // useStore renders the hydration pass from getInitialState(), which must
    // match SSR (hasHydrated false, default profile).
    expect(store.getInitialState().hasHydrated).toBe(false);
    expect(store.getInitialState().profile).toEqual(getDefaultFinancialProfile());
  });
});

describe('setFields', () => {
  it('shallow-merges each section and keeps untouched fields', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1760000000000);
    getState().setFields(
      { person: { age: 41, state: 'CA' }, investing: { monthlyContribution: 2000 } },
      ['person.age', 'person.state', 'investing.monthlyContribution']
    );
    const { profile, hasProfile } = getState();
    expect(profile.person).toEqual({ age: 41, state: 'CA', filingStatus: 'single', retirementAge: 65, lifeExpectancy: 90 });
    expect(profile.investing.monthlyContribution).toBe(2000);
    expect(profile.investing.investedBalance).toBe(25000);
    expect(profile.income).toEqual(getDefaultFinancialProfile().income);
    expect(profile.provided).toEqual(['person.age', 'person.state', 'investing.monthlyContribution']);
    expect(profile.updatedAt).toBe(1760000000000);
    expect(hasProfile).toBe(true);
  });

  it('appends provided paths without duplicates across calls', () => {
    getState().setFields({ person: { age: 35 } }, ['person.age']);
    getState().setFields({ person: { age: 36 }, cash: { targetMonths: 1 } }, ['person.age', 'cash.targetMonths']);
    expect(getState().profile.person.age).toBe(36);
    expect(getState().profile.cash.targetMonths).toBe(1);
    expect(getState().profile.provided).toEqual(['person.age', 'cash.targetMonths']);
  });

  it('changes values without marking them provided when no paths are given', () => {
    getState().setFields({ strategy: { leverageRatio: 3 } }, []);
    expect(getState().profile.strategy.leverageRatio).toBe(3);
    expect(getState().profile.provided).toEqual([]);
    expect(getState().hasProfile).toBe(false);
  });

  it('keeps the previous value for invalid leaves', () => {
    getState().setFields({ person: { age: 44 } }, ['person.age']);
    getState().setFields(
      {
        person: { age: Number.NaN },
        income: { frequency: 'daily' as never, grossPerPaycheck: 4100 },
        workplace: { has401k: undefined },
      },
      ['income.grossPerPaycheck']
    );
    const { profile } = getState();
    expect(profile.person.age).toBe(44);
    expect(profile.income.frequency).toBe('bi-weekly');
    expect(profile.income.grossPerPaycheck).toBe(4100);
    expect(profile.workplace.has401k).toBe(true);
  });

  it('ignores provided, version and updatedAt inside the patch', () => {
    vi.spyOn(Date, 'now').mockReturnValue(42);
    getState().setFields({ provided: ['person.age'], version: 2, updatedAt: 7 }, []);
    expect(getState().profile.provided).toEqual([]);
    expect(getState().profile.updatedAt).toBe(42);
    expect(getState().profile.version).toBe(2);
  });

  it('merges nested sections leaf by leaf and replaces a list whole', () => {
    const debt = { id: 'd1', name: 'Card', balance: 900, interestRate: 0.24, minimumPayment: 35, extraPayment: 0, taxDeductible: false };
    getState().setFields(
      { assumptions: { retirement: { volatility: 0.2 } }, debts: [debt] },
      ['assumptions.retirement.volatility', 'debts']
    );
    const { profile } = getState();
    expect(profile.assumptions.retirement).toEqual({ ...getDefaultFinancialProfile().assumptions.retirement, volatility: 0.2 });
    expect(profile.assumptions.paycheck).toEqual(getDefaultFinancialProfile().assumptions.paycheck);
    expect(profile.debts).toEqual([debt]);
    expect(profile.provided).toEqual(['assumptions.retirement.volatility', 'debts']);
  });

  it('drops provided paths that are not profile paths, and row paths to rows that do not exist', () => {
    getState().setFields({ person: { age: 35 } }, ['person.age', 'person.nickname', 'debts.0.balance']);
    // debts is empty, so 'debts.0.balance' names no row and does not mark debts.
    expect(getState().profile.provided).toEqual(['person.age']);
    // A row path to a row that exists is recorded by its list path.
    getState().setFields({}, ['portfolio.accounts.1.deposit']);
    expect(getState().profile.provided).toEqual(['person.age', 'portfolio.accounts']);
  });

  it('records the new cash on the Brokerage deposit only (the v1 leaf is gone)', () => {
    getState().setFields({}, ['investing.newCashThisMonth']);
    expect(getState().profile.provided).toEqual([]);
    getState().setFields({ portfolio: { accounts: [
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 2400 },
    ] } }, ['portfolio.accounts']);
    const { profile } = getState();
    expect(profile.investing).not.toHaveProperty('newCashThisMonth');
    expect(profile.portfolio.accounts.find((a) => a.name === 'Brokerage')?.deposit).toBe(2400);
    expect(profile.provided).toEqual(['portfolio.accounts']);
  });

  it('persists only the profile', () => {
    getState().setFields({ person: { age: 50 } }, ['person.age']);
    const persisted = readPersisted();
    expect(persisted?.version).toBe(2);
    expect(Object.keys(persisted!.state)).toEqual(['profile']);
    expect((persisted!.state.profile as { person: { age: number } }).person.age).toBe(50);
  });
});

describe('setValues', () => {
  it('writes leaves at any depth and marks the written paths provided', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1760000000000);
    getState().setValues([
      { path: 'person.age', value: 44 },
      { path: 'assumptions.retirement.effectiveTaxRate', value: 0.18 },
      { path: 'hsa.coverage', value: 'family' },
    ]);
    const { profile, hasProfile } = getState();
    expect(profile.person.age).toBe(44);
    expect(profile.assumptions.retirement.effectiveTaxRate).toBe(0.18);
    expect(profile.hsa.coverage).toBe('family');
    expect(profile.provided).toEqual(['person.age', 'assumptions.retirement.effectiveTaxRate', 'hsa.coverage']);
    expect(profile.updatedAt).toBe(1760000000000);
    expect(hasProfile).toBe(true);
  });

  it('keeps the previous value for invalid writes and does not mark them provided', () => {
    getState().setValues([
      { path: 'person.age', value: 'forty' },
      { path: 'person.nickname', value: 'Bufo' },
      { path: 'income.frequency', value: 'monthly' },
    ]);
    expect(getState().profile.person.age).toBe(25);
    expect(getState().profile.income.frequency).toBe('monthly');
    expect(getState().profile.provided).toEqual(['income.frequency']);
  });

  it('records list rows and row fields by their list path', () => {
    const debt = { id: 'd1', name: 'Card', balance: 900, interestRate: 0.24, minimumPayment: 35, extraPayment: 0, taxDeductible: false };
    getState().setValues([{ path: 'debts.0', value: debt }]);
    getState().setValues([{ path: 'debts.0.balance', value: 750 }, { path: 'portfolio.accounts.0.deposit', value: 300 }]);
    const { profile } = getState();
    expect(profile.debts).toEqual([{ ...debt, balance: 750 }]);
    expect(profile.portfolio.accounts[0].deposit).toBe(300);
    expect(profile.provided).toEqual(['debts', 'portfolio.accounts']);
  });

  it('sets a nullable override back to null (derive)', () => {
    getState().setValues([{ path: 'leverage.years', value: 15 }]);
    expect(getState().profile.leverage.years).toBe(15);
    getState().setValues([{ path: 'leverage.years', value: null }]);
    expect(getState().profile.leverage.years).toBeNull();
  });

  it('marks only the paths given in provide, which may be empty', () => {
    getState().setValues(
      [
        { path: 'person.age', value: 40 },
        { path: 'cash.targetMonths', value: 1 },
      ],
      { provide: ['person.age'] }
    );
    expect(getState().profile.cash.targetMonths).toBe(1);
    expect(getState().profile.provided).toEqual(['person.age']);

    getState().setValues([{ path: 'strategy.leverageRatio', value: 3 }], { provide: [] });
    expect(getState().profile.strategy.leverageRatio).toBe(3);
    expect(getState().profile.provided).toEqual(['person.age']);
  });

  it('unprovides paths, and unprovide wins over the written paths (restore defaults)', () => {
    getState().setValues([
      { path: 'assumptions.retirement.volatility', value: 0.25 },
      { path: 'assumptions.retirement.inflationRate', value: 0.04 },
      { path: 'person.age', value: 33 },
    ]);
    const defaults = getDefaultFinancialProfile().assumptions.retirement;
    getState().setValues(
      [
        { path: 'assumptions.retirement.volatility', value: defaults.volatility },
        { path: 'assumptions.retirement.inflationRate', value: defaults.inflationRate },
      ],
      { unprovide: ['assumptions.retirement.volatility', 'assumptions.retirement.inflationRate'] }
    );
    const { profile, hasProfile } = getState();
    expect(profile.assumptions.retirement).toEqual(defaults);
    expect(profile.provided).toEqual(['person.age']);
    expect(hasProfile).toBe(true);

    getState().setValues([], { unprovide: ['person.age'] });
    expect(getState().profile.provided).toEqual([]);
    expect(getState().hasProfile).toBe(false);
  });

  it('unprovides a list by any of its row paths', () => {
    getState().setValues([{ path: 'debts', value: [] }]);
    expect(getState().profile.provided).toEqual(['debts']);
    getState().setValues([], { unprovide: ['debts.0.balance'] });
    expect(getState().profile.provided).toEqual([]);
  });

  it('stamps updatedAt on every call', () => {
    vi.spyOn(Date, 'now').mockReturnValue(77);
    getState().setValues([]);
    expect(getState().profile.updatedAt).toBe(77);
  });

  it('leaves untouched sections as the same objects', () => {
    const before = getState().profile;
    getState().setValues([{ path: 'person.age', value: 31 }]);
    const after = getState().profile;
    expect(after.person).not.toBe(before.person);
    expect(after.income).toBe(before.income);
    expect(after.portfolio).toBe(before.portfolio);
  });
});

describe('setProvidedValue', () => {
  it('sets one leaf by dot path and marks it provided', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    getState().setProvidedValue('cash.emergencyFundBalance', 8000);
    getState().setProvidedValue('income.frequency', 'monthly');
    getState().setProvidedValue('workplace.has401k', false);
    const { profile, hasProfile } = getState();
    expect(profile.cash.emergencyFundBalance).toBe(8000);
    expect(profile.cash.targetMonths).toBe(3);
    expect(profile.income.frequency).toBe('monthly');
    expect(profile.workplace.has401k).toBe(false);
    expect(profile.provided).toEqual(['cash.emergencyFundBalance', 'income.frequency', 'workplace.has401k']);
    expect(profile.updatedAt).toBe(1234);
    expect(hasProfile).toBe(true);
  });

  it('does not duplicate a path that is set twice', () => {
    getState().setProvidedValue('person.age', 31);
    getState().setProvidedValue('person.age', 32);
    expect(getState().profile.person.age).toBe(32);
    expect(getState().profile.provided).toEqual(['person.age']);
  });

  it('sets values at any depth, including a list row field', () => {
    getState().setProvidedValue('assumptions.paycheck.riskTolerance', 'optimizer');
    getState().setProvidedValue('portfolio.holdings.1.shares', 8);
    const { profile } = getState();
    expect(profile.assumptions.paycheck.riskTolerance).toBe('optimizer');
    expect(profile.portfolio.holdings[1].shares).toBe(8);
    expect(profile.provided).toEqual(['assumptions.paycheck.riskTolerance', 'portfolio.holdings']);
  });

  it('is a no-op for unknown paths and invalid values', () => {
    const before = getState().profile;
    getState().setProvidedValue('person.nickname', 'Bufo');
    getState().setProvidedValue('person.age', '31');
    getState().setProvidedValue('strategy.preset', 'standard');
    getState().setProvidedValue('strategy.leverageRatio', 'yolo');
    getState().setProvidedValue('provided', ['person.age']);
    getState().setProvidedValue('debts.0.balance', 100);
    getState().setProvidedValue('person', { age: 50 });
    expect(getState().profile).toBe(before);
    expect(getState().hasProfile).toBe(false);
  });
});

describe('reset', () => {
  it('restores the defaults and clears provided paths', () => {
    getState().setFields({ person: { age: 60, retirementAge: 65 } }, ['person.age', 'person.retirementAge']);
    getState().setProvidedValue('strategy.leverageRatio', 3);
    expect(getState().hasProfile).toBe(true);

    getState().reset();
    expect(getState().profile).toEqual(getDefaultFinancialProfile());
    expect(getState().hasProfile).toBe(false);
    expect((readPersisted()!.state.profile as { provided: string[] }).provided).toEqual([]);
  });
});

describe('rehydration from localStorage', () => {
  async function rehydrateWith(raw: string | null) {
    store.setState({ hasHydrated: false });
    window.localStorage.clear();
    if (raw !== null) window.localStorage.setItem(PROFILE_STORAGE_KEY, raw);
    await store.persist.rehydrate();
  }

  it('restores a saved profile, derives hasProfile, and flips hasHydrated', async () => {
    const saved = getDefaultFinancialProfile();
    saved.person.age = 47;
    saved.investing.targetMix = '60-40';
    saved.provided = ['person.age', 'investing.targetMix'];
    saved.updatedAt = 999;
    await rehydrateWith(JSON.stringify({ state: { profile: saved }, version: 2 }));

    expect(getState().hasHydrated).toBe(true);
    expect(getState().profile).toEqual(saved);
    expect(getState().hasProfile).toBe(true);
  });

  it('normalizes partial or hand-edited payloads against the defaults', async () => {
    await rehydrateWith(
      JSON.stringify({
        state: { profile: { person: { age: 52, filingStatus: 'nope' }, cash: null, provided: ['person.age', 3] } },
        version: 1,
      })
    );
    const { profile, hasProfile } = getState();
    expect(profile.person).toEqual({ age: 52, state: 'CA', filingStatus: 'single', retirementAge: 65, lifeExpectancy: 90 });
    expect(profile.cash).toEqual(getDefaultFinancialProfile().cash);
    expect(profile.provided).toEqual(['person.age']);
    expect(hasProfile).toBe(true);
  });

  it('keeps the current profile when nothing is stored', async () => {
    await rehydrateWith(null);
    expect(getState().hasHydrated).toBe(true);
    expect(getState().profile).toEqual(getDefaultFinancialProfile());
    expect(getState().hasProfile).toBe(false);
  });

  it('accepts a payload saved under another version', async () => {
    const saved = getDefaultFinancialProfile();
    saved.person.age = 33;
    saved.provided = ['person.age'];
    await rehydrateWith(JSON.stringify({ state: { profile: saved }, version: 0 }));
    expect(getState().profile.person.age).toBe(33);
    expect(getState().hasProfile).toBe(true);
  });

  it('loads a saved v1 payload by normalizing it, keeping every v2 leaf, and saves it back as v2', async () => {
    const v1 = {
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
      provided: ['person.age', 'investing.newCashThisMonth', 'not.a.path'],
    };
    await rehydrateWith(JSON.stringify({ state: { profile: v1 }, version: 1 }));

    const { profile, hasProfile, hasHydrated } = getState();
    expect(hasHydrated).toBe(true);
    expect(hasProfile).toBe(true);
    expect(profile.version).toBe(2);
    expect(profile.updatedAt).toBe(1761000000000);
    expect(profile.person).toEqual({ ...v1.person, lifeExpectancy: 90 });
    expect(profile.income).toEqual({ ...getDefaultFinancialProfile().income, ...v1.income });
    expect(profile.spending).toEqual(v1.spending);
    // The months were never asked in v1 (not in provided): an unanswered 1 loads as the typical 3.
    expect(profile.cash).toEqual({ ...v1.cash, targetMonths: 3 });
    expect(profile.workplace).toEqual({ ...getDefaultFinancialProfile().workplace, ...v1.workplace });
    // The removed strategy preset is dropped with it.
    expect(profile.strategy).toEqual({ leverageRatio: 1.5 });
    // The v1 new cash is no v2 leaf: it is dropped and not moved anywhere,
    // so the Brokerage deposit keeps its default.
    expect(profile.investing).toEqual({ investedBalance: 140000, monthlyContribution: 2200, taxableMonthlyContribution: 900, targetMix: '60-40' });
    expect(profile.portfolio).toEqual(getDefaultFinancialProfile().portfolio);
    expect(profile.assumptions).toEqual(getDefaultFinancialProfile().assumptions);
    expect(profile.provided).toEqual(['person.age']);

    const persisted = readPersisted();
    expect(persisted?.version).toBe(2);
    expect(persisted?.state.profile).toEqual(profile);
  });

  it('loads a saved v2 profile that still holds the removed new-cash leaf, dropping only that leaf', async () => {
    const saved = getDefaultFinancialProfile();
    saved.person.age = 44;
    saved.portfolio.accounts[1].deposit = 400;
    saved.provided = ['person.age', 'portfolio.accounts', 'investing.newCashThisMonth'];
    const stored = JSON.parse(JSON.stringify(saved));
    stored.investing.newCashThisMonth = 9000;
    await rehydrateWith(JSON.stringify({ state: { profile: stored }, version: 2 }));

    expect(getState().hasHydrated).toBe(true);
    expect(getState().hasProfile).toBe(true);
    expect(getState().profile).toEqual({ ...saved, provided: ['person.age', 'portfolio.accounts'] });
    expect(getState().profile.investing).not.toHaveProperty('newCashThisMonth');
    expect(getState().profile.portfolio.accounts[1].deposit).toBe(400);
  });

  it('reads a payload saved by a later version but never overwrites it', async () => {
    const saved = {
      ...getDefaultFinancialProfile(),
      version: 3,
      newSection: { x: 1 },
      person: { ...getDefaultFinancialProfile().person, age: 44, extra: 1 },
      provided: ['person.age'],
    };
    const raw = JSON.stringify({ state: { profile: saved }, version: 3 });
    await rehydrateWith(raw);

    expect(getState().hasHydrated).toBe(true);
    expect(getState().profile.version).toBe(2);
    expect(getState().profile.person.age).toBe(44);
    expect(getState().profile).not.toHaveProperty('newSection');
    expect(window.localStorage.getItem(PROFILE_STORAGE_KEY)).toBe(raw);

    // Edits in this session stay in memory; the newer payload survives them.
    getState().setFields({ person: { age: 45 } }, ['person.age']);
    expect(getState().profile.person.age).toBe(45);
    expect(window.localStorage.getItem(PROFILE_STORAGE_KEY)).toBe(raw);

    // The next hydration of a current payload saves normally again.
    await rehydrateWith(JSON.stringify({ state: { profile: getDefaultFinancialProfile() }, version: 2 }));
    getState().setFields({ person: { age: 46 } }, ['person.age']);
    expect(readPersisted()?.version).toBe(2);
    expect((readPersisted()?.state.profile as { person: { age: number } }).person.age).toBe(46);
  });

  it('clears the stored payload through persist.clearStorage', () => {
    getState().setProvidedValue('person.age', 41);
    expect(readPersisted()).not.toBeNull();
    store.persist.clearStorage();
    expect(readPersisted()).toBeNull();
  });

  it('drops provided row paths whose row does not exist', async () => {
    const saved = getDefaultFinancialProfile();
    saved.provided = ['debts.7.balance', 'portfolio.holdings.0', 'person.age'];
    await rehydrateWith(JSON.stringify({ state: { profile: saved }, version: 2 }));
    expect(getState().profile.debts).toEqual([]);
    expect(getState().profile.provided).toEqual(['portfolio.holdings', 'person.age']);
  });

  it('still marks hydration finished when the stored JSON is corrupt', async () => {
    await rehydrateWith('{not json');
    expect(getState().hasHydrated).toBe(true);
    expect(getState().profile).toEqual(getDefaultFinancialProfile());
  });
});
