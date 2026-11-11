/**
 * Profile Store Test Suite
 *
 * Exercises useProfileStore through getState() with no React rendering.
 * jsdom provides localStorage, so persist hydrates synchronously when the
 * module loads; the rehydration tests seed localStorage and call
 * persist.rehydrate() to exercise the merge/normalize path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROFILE_STORAGE_KEY, applyProfileWrites, patchToWrites, useProfileStore } from '@/lib/store/profileStore';
import { getDefaultFinancialProfile } from '@/lib/profile';
import { V1_ALL_PROVIDED } from '../profile/fixtures/v1Payloads';

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
    expect(profile.person).toEqual({ age: 41, state: 'CA', filingStatus: 'single', retirementAge: 60, lifeExpectancy: 85 });
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
    getState().setFields({ strategy: { preset: 'standard' } }, []);
    expect(getState().profile.strategy.preset).toBe('standard');
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
    getState().setFields({ provided: ['person.age'], version: 1 as never, updatedAt: 7, person: { age: 31 } }, []);
    expect(getState().profile.provided).toEqual([]);
    expect(getState().profile.updatedAt).toBe(42);
    expect(getState().profile.version).toBe(2);
  });

  it('persists only the profile', () => {
    getState().setFields({ person: { age: 50 } }, ['person.age']);
    const persisted = readPersisted();
    expect(persisted?.version).toBe(2);
    expect(Object.keys(persisted!.state)).toEqual(['profile']);
    expect((persisted!.state.profile as { person: { age: number } }).person.age).toBe(50);
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

  it('is a no-op for unknown paths and invalid values', () => {
    const before = getState().profile;
    getState().setProvidedValue('person.nickname', 'Bufo');
    getState().setProvidedValue('person.age', '31');
    getState().setProvidedValue('strategy.preset', 'yolo');
    getState().setProvidedValue('provided', ['person.age']);
    expect(getState().profile).toEqual(before);
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
        version: 2,
      })
    );
    const { profile, hasProfile } = getState();
    expect(profile.person).toEqual({ age: 52, state: 'TX', filingStatus: 'single', retirementAge: 60, lifeExpectancy: 85 });
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

  it('still marks hydration finished when the stored JSON is corrupt', async () => {
    await rehydrateWith('{not json');
    expect(getState().hasHydrated).toBe(true);
    expect(getState().profile).toEqual(getDefaultFinancialProfile());
  });
});

describe('setValues', () => {
  it('writes nested leaves at any depth and marks the written paths provided', () => {
    vi.spyOn(Date, 'now').mockReturnValue(555);
    getState().setValues([
      { path: 'assumptions.retirement.inflationRate', value: 0.025 },
      { path: 'person.lifeExpectancy', value: 92 },
    ]);
    const { profile, hasProfile } = getState();
    expect(profile.assumptions.retirement.inflationRate).toBe(0.025);
    expect(profile.person.lifeExpectancy).toBe(92);
    expect(profile.provided).toEqual(['assumptions.retirement.inflationRate', 'person.lifeExpectancy']);
    expect(profile.updatedAt).toBe(555);
    expect(hasProfile).toBe(true);
  });

  it('writes a whole list and records the list path as provided', () => {
    const debt = { id: 'd1', name: 'Car', balance: 9000, interestRate: 0.06, minimumPayment: 250, extraPayment: 0, taxDeductible: false };
    getState().setValues([{ path: 'debts', value: [debt] }]);
    expect(getState().profile.debts).toEqual([debt]);
    expect(getState().profile.provided).toEqual(['debts']);
  });

  it('writes a list row field and records the list, not the row path', () => {
    getState().setValues([{ path: 'portfolio.holdings.2.shares', value: 25 }]);
    expect(getState().profile.portfolio.holdings[2].shares).toBe(25);
    expect(getState().profile.portfolio.holdings[0].shares).toBe(10);
    expect(getState().profile.provided).toEqual(['portfolio.holdings']);
  });

  it('accepts null for nullable leaves and rejects it elsewhere', () => {
    getState().setValues([{ path: 'leverage.years', value: 12 }]);
    expect(getState().profile.leverage.years).toBe(12);
    getState().setValues([{ path: 'leverage.years', value: null }, { path: 'person.age', value: null }]);
    expect(getState().profile.leverage.years).toBeNull();
    expect(getState().profile.person.age).toBe(30);
    expect(getState().profile.provided).toEqual(['leverage.years']);
  });

  it('drops invalid writes and unknown paths without marking them', () => {
    getState().setValues([
      { path: 'person.nickname', value: 'Bufo' },
      { path: 'hsa.coverage', value: 'everyone' },
      { path: 'debts', value: 'none' },
      { path: 'provided', value: ['person.age'] },
      { path: 'income.bonusAmount', value: 2000 },
    ]);
    const { profile } = getState();
    expect(profile.hsa.coverage).toBe('individual');
    expect(profile.debts).toEqual([]);
    expect(profile.income.bonusAmount).toBe(2000);
    expect(profile.provided).toEqual(['income.bonusAmount']);
  });

  it('honours explicit provide and unprovide lists', () => {
    getState().setValues([{ path: 'workplace.contributionType', value: 'split' }], { provide: [] });
    expect(getState().profile.workplace.contributionType).toBe('split');
    expect(getState().profile.provided).toEqual([]);

    getState().setValues([], { provide: ['person.age', 'debts.0.balance', 'person.nickname'] });
    expect(getState().profile.provided).toEqual(['person.age', 'debts']);

    getState().setValues(
      [{ path: 'assumptions.paycheck.riskTolerance', value: 'moderate' }],
      { provide: [], unprovide: ['person.age'] }
    );
    expect(getState().profile.provided).toEqual(['debts']);
  });

  it('is a no-op (state and updatedAt untouched) when nothing changes', () => {
    getState().setValues([{ path: 'person.age', value: 40 }]);
    const before = getState().profile;
    getState().setValues([{ path: 'person.age', value: 40 }]);
    getState().setValues([{ path: 'person.age', value: Number.NaN }]);
    getState().setValues([]);
    expect(getState().profile).toBe(before);
  });

  it('mirrors the deprecated new-cash leaf onto the Brokerage deposit', () => {
    getState().setProvidedValue('investing.newCashThisMonth', 2400);
    const { profile } = getState();
    expect(profile.investing.newCashThisMonth).toBe(2400);
    expect(profile.portfolio.accounts.find((a) => a.id === 'acc-brok')?.deposit).toBe(2400);
    expect(profile.portfolio.accounts.find((a) => a.id === 'acc-roth')?.deposit).toBe(0);
    expect(profile.provided).toEqual(['investing.newCashThisMonth']);
  });

  it('drops holdings orphaned by an account removal', () => {
    const accounts = getState().profile.portfolio.accounts.filter((a) => a.id !== 'acc-roth');
    getState().setValues([{ path: 'portfolio.accounts', value: accounts }]);
    expect(getState().profile.portfolio.holdings.map((h) => h.id)).toEqual(['hld-brok-vti', 'hld-brok-vxus']);
  });
});

describe('patchToWrites and applyProfileWrites', () => {
  it('flattens a patch to leaf writes, keeping arrays whole and skipping meta keys', () => {
    expect(
      patchToWrites({
        version: 2,
        provided: [],
        person: { age: 33 },
        assumptions: { leverage: { financingRate: 0.05 } },
        debts: [],
      })
    ).toEqual([
      { path: 'person.age', value: 33 },
      { path: 'assumptions.leverage.financingRate', value: 0.05 },
      { path: 'debts', value: [] },
    ]);
  });

  it('is pure: returns a new profile and leaves the input untouched', () => {
    const current = getDefaultFinancialProfile();
    const next = applyProfileWrites(current, [{ path: 'cash.targetMonths', value: 6 }], {}, 9);
    expect(next?.cash.targetMonths).toBe(6);
    expect(next?.updatedAt).toBe(9);
    expect(current.cash.targetMonths).toBe(3);
    // Same value, nothing to mark: no change.
    expect(applyProfileWrites(current, [{ path: 'cash.targetMonths', value: 3 }], { provide: [] })).toBeNull();
    // Same value, but answering it marks it provided.
    expect(applyProfileWrites(current, [{ path: 'cash.targetMonths', value: 3 }])?.provided).toEqual(['cash.targetMonths']);
  });
});

describe('v1 -> v2 migration through persist', () => {
  it('migrates a stored v1 envelope on rehydrate, moving new cash to the Brokerage deposit', async () => {
    store.setState({ hasHydrated: false });
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(V1_ALL_PROVIDED));
    await store.persist.rehydrate();

    const { profile, hasProfile, hasHydrated } = getState();
    expect(hasHydrated).toBe(true);
    expect(hasProfile).toBe(true);
    expect(profile.version).toBe(2);
    expect(profile.person).toEqual({ age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58, lifeExpectancy: 85 });
    expect(profile.portfolio.accounts.find((a) => a.id === 'acc-brok')?.deposit).toBe(3000);
    expect(profile.provided).toHaveLength(25);
    // The migrated record is written back under version 2 on the next change.
    getState().setValues([{ path: 'person.age', value: 39 }]);
    expect(readPersisted()?.version).toBe(2);
  });
});
