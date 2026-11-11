/**
 * The leverage run store: profile in, simulation out, 250 ms after the last
 * submit (audit H3); invalid inputs keep the last results, marked stale
 * (O17); and, because the inputs live in the profile, the leverage ratio
 * survives a reload (bug 5: the old page kept it only in the query string,
 * which a reload without one dropped).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulateDcaComparison } from '@/lib/calculations/leverageComparison';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useLeverageStore } from '@/lib/store/leverageStore';
import { PROFILE_STORAGE_KEY, useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const profile = () => useProfileStore.getState().profile;

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  useLeverageStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useLeverageStore', () => {
  it('runs the profile through the simulation in-thread on an immediate submit', () => {
    useLeverageStore.getState().submit(profile(), { immediate: true });
    const { inputs, results, errors, stale, hasCalculatedOnce } = useLeverageStore.getState();
    // The default profile: $500 taxable a month, age 30 to 60, $25,000 invested, 2x.
    expect(inputs).toMatchObject({ monthlyContribution: 500, years: 30, startingBalance: 25000, leverageRatio: 2 });
    expect(results).toEqual(simulateDcaComparison(inputs!));
    expect(results!.totalContributed).toBe(500 * 360 + 25000);
    expect(errors).toEqual({});
    expect(stale).toBe(false);
    expect(hasCalculatedOnce).toBe(true);
  });

  it('waits 250 ms after the last submit', () => {
    vi.useFakeTimers();
    useLeverageStore.getState().submit(profile());
    vi.advanceTimersByTime(249);
    expect(useLeverageStore.getState().results).toBeNull();
    vi.advanceTimersByTime(1);
    expect(useLeverageStore.getState().inputs?.years).toBe(30);

    useProfileStore.getState().setValues([{ path: 'leverage.years', value: 12 }]);
    useLeverageStore.getState().submit(profile());
    vi.advanceTimersByTime(200);
    useProfileStore.getState().setValues([{ path: 'leverage.years', value: 15 }]);
    useLeverageStore.getState().submit(profile());
    vi.advanceTimersByTime(249);
    expect(useLeverageStore.getState().inputs?.years).toBe(30);
    vi.advanceTimersByTime(1);
    // The newer submit restarted the delay; only its inputs ran.
    expect(useLeverageStore.getState().inputs?.years).toBe(15);
  });

  it('keeps the last results, marked stale, while nothing is invested', () => {
    useLeverageStore.getState().submit(profile(), { immediate: true });
    const before = useLeverageStore.getState().results;

    useProfileStore.getState().setValues([
      { path: 'leverage.monthlyContribution', value: 0 },
      { path: 'leverage.startingBalance', value: 0 },
    ]);
    useLeverageStore.getState().submit(profile(), { immediate: true });
    const after = useLeverageStore.getState();
    expect(after.errors).toEqual({ calculation: 'Enter a monthly contribution or a starting balance.' });
    expect(after.stale).toBe(true);
    expect(after.results).toBe(before);
    expect(after.inputs?.monthlyContribution).toBe(500);
  });

  it('marks a calculator field out of bounds without running', () => {
    useLeverageStore.getState().submit(profile(), { immediate: true });
    useProfileStore.getState().setValues([{ path: 'strategy.leverageRatio', value: 3.5 }]);
    useLeverageStore.getState().submit(profile(), { immediate: true });
    expect(useLeverageStore.getState().errors).toEqual({
      'strategy.leverageRatio': 'Leverage ratio must be between 1 and 3.',
    });
    expect(useLeverageStore.getState().inputs?.leverageRatio).toBe(2);
  });
});

describe('bug 5: the leverage ratio survives a reload', () => {
  it('reads the ratio and the overrides back from the saved profile', async () => {
    useProfileStore.getState().setValues([
      { path: 'strategy.leverageRatio', value: 3 },
      { path: 'leverage.years', value: 12 },
    ]);
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    expect(saved).not.toBeNull();

    // A reload: the in-memory profile starts from the defaults, then the
    // persisted one is read back.
    useProfileStore.setState({ profile: getDefaultFinancialProfile(), hasHydrated: false });
    useLeverageStore.getState().reset();
    window.localStorage.setItem(PROFILE_STORAGE_KEY, saved!);
    expect(profile().strategy.leverageRatio).toBe(2);
    await useProfileStore.persist.rehydrate();

    expect(useProfileStore.getState().hasHydrated).toBe(true);
    useLeverageStore.getState().submit(profile(), { immediate: true });
    expect(useLeverageStore.getState().inputs).toMatchObject({ leverageRatio: 3, years: 12 });
    expect(profile().provided).toEqual(expect.arrayContaining(['strategy.leverageRatio', 'leverage.years']));
  });
});
