/**
 * The paycheck run store on the shared factory (createCalculatorStore):
 * profile in, allocation out, in-thread 150 ms after the last submit (the
 * old store's artificial 300 ms delay is gone, audit H4); a broken relation
 * keeps the last results, marked stale; nothing is persisted under the old
 * 'paycheck-allocator-storage' key.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateOptimalAllocation } from '@/lib/calculations/core';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import type { Write } from '@/lib/fields/types';
import { applyProfileWrites, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { usePaycheckStore } from '@/lib/store/paycheckStore';
import { clearBrowserState } from '@/test/utils/stores';

/** The default profile with `writes` applied; each must be a valid profile write, or the test fails. */
function profileWith(writes: Write[] = []): FinancialProfile {
  const { profile, accepted } = applyProfileWrites(getDefaultFinancialProfile(), writes);
  expect(accepted).toEqual(writes.map((write) => write.path));
  return profile;
}

const getState = () => usePaycheckStore.getState();

beforeEach(() => {
  clearBrowserState();
  getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePaycheckStore', () => {
  it('starts with no inputs and no results, and persists nothing', () => {
    expect(getState().inputs).toBeNull();
    expect(getState().results).toBeNull();
    expect(getState().hasCalculatedOnce).toBe(false);
    getState().submit(profileWith(), { immediate: true });
    expect(localStorage.getItem('paycheck-allocator-storage')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('runs the allocation on the profile\'s engine inputs on an immediate submit', () => {
    const profile = profileWith();
    getState().submit(profile, { immediate: true });
    const state = getState();
    const inputs = engineInputsFor(PAYCHECK_CALCULATOR, profile);
    expect(state.inputs).toEqual(inputs);
    expect(state.results).toEqual(calculateOptimalAllocation(inputs));
    expect(state.results!.allocations.length).toBeGreaterThan(0);
    expect(state.errors).toEqual({});
    expect(state.stale).toBe(false);
    expect(state.hasCalculatedOnce).toBe(true);
  });

  it('waits 150 ms after the last submit', () => {
    vi.useFakeTimers();
    getState().submit(profileWith());
    vi.advanceTimersByTime(149);
    expect(getState().results).toBeNull();
    vi.advanceTimersByTime(1);
    expect(getState().inputs?.preferences.age).toBe(25);

    getState().submit(profileWith([{ path: 'person.age', value: 40 }]));
    vi.advanceTimersByTime(100);
    getState().submit(profileWith([{ path: 'person.age', value: 45 }]));
    vi.advanceTimersByTime(149);
    expect(getState().inputs?.preferences.age).toBe(25);
    vi.advanceTimersByTime(1);
    // The newer submit restarted the delay; only its inputs ran.
    expect(getState().inputs?.preferences.age).toBe(45);
  });

  it('keeps the same results for a profile that feeds the engine the same values', () => {
    getState().submit(profileWith(), { immediate: true });
    const first = getState().results;
    // The retirement age is not a paycheck input.
    getState().submit(profileWith([{ path: 'person.retirementAge', value: 55 }]), { immediate: true });
    expect(getState().results).toBe(first);
  });

  it('marks the results stale on a broken relation and keeps them', () => {
    getState().submit(profileWith(), { immediate: true });
    const results = getState().results;

    getState().submit(
      profileWith([
        { path: 'spending.funMoneyMin', value: 900 },
        { path: 'spending.funMoneyMax', value: 600 },
      ]),
      { immediate: true }
    );

    const state = getState();
    expect(state.results).toBe(results);
    expect(state.stale).toBe(true);
    expect(state.errors).toEqual({ 'spending.funMoneyMax': 'The minimum is above the maximum. Adjust one of them.' });
  });

  it('runs nothing for a broken relation before any result, then recomputes once fixed', () => {
    getState().submit(profileWith([{ path: 'spending.funMoneyMin', value: 900 }]), { immediate: true });
    expect(getState().results).toBeNull();
    expect(getState().hasCalculatedOnce).toBe(false);

    getState().submit(profileWith([{ path: 'spending.necessaryMonthly', value: 2000 }]), { immediate: true });
    const first = getState().results;
    expect(getState().inputs?.preferences.necessaryExpenses).toBe(2000);
    expect(getState().stale).toBe(false);

    getState().submit(profileWith([{ path: 'spending.necessaryMonthly', value: 2400 }]), { immediate: true });
    expect(getState().inputs?.preferences.necessaryExpenses).toBe(2400);
    expect(getState().results).not.toBe(first);
    expect(getState().errors).toEqual({});
  });
});
