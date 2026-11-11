import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeProfileHandoff,
  useCalculatorBootstrap,
} from '@/components/calculators/shared/useCalculatorBootstrap';
import { restoreDefaultsWrites, useCalculatorValues } from '@/components/calculators/shared/useCalculatorValues';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { createFakeStore, FAKE_DEFINITION, fakeProfile } from './fakeCalculator';

beforeEach(() => {
  clearBrowserState();
  window.history.replaceState(null, '', '/tools/retirement-calculator');
});

afterEach(() => clearBrowserState());

describe('consumeProfileHandoff', () => {
  it('returns false and leaves the URL alone without the marker', () => {
    window.history.replaceState(null, '', '/tools/x?from=elsewhere#h');
    expect(consumeProfileHandoff()).toBe(false);
    expect(window.location.search).toBe('?from=elsewhere');
    expect(window.location.hash).toBe('#h');
  });

  it('strips the query and hash and keeps history.state', () => {
    window.history.replaceState({ router: 'tree' }, '', '/tools/x?from=profile&c=1#h');
    expect(consumeProfileHandoff()).toBe(true);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/tools/x');
    expect(window.history.state).toEqual({ router: 'tree' });
  });
});

describe('useCalculatorBootstrap', () => {
  it('is not ready and submits nothing before hydration', () => {
    resetProfileStore({ profile: fakeProfile(40, 65), hydrated: false });
    const store = createFakeStore();
    const submit = vi.spyOn(store.getState(), 'submit');
    const { result } = renderHook(() => useCalculatorBootstrap(store));
    expect(result.current).toEqual({ ready: false, arrivedFromProfile: false });
    expect(submit).not.toHaveBeenCalled();
    expect(store.getState().results).toBeNull();
  });

  it('becomes ready after hydration and runs the profile once, then on every change', () => {
    resetProfileStore({ profile: fakeProfile(40, 65), hydrated: false });
    const store = createFakeStore();
    const { result } = renderHook(() => useCalculatorBootstrap(store));
    act(() => useProfileStore.setState({ hasHydrated: true }));
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: false });
    expect(store.getState().results).toEqual({ years: 25 });

    act(() => useProfileStore.getState().setValues([{ path: 'person.age', value: 50 }]));
    expect(store.getState().results).toEqual({ years: 15 });
  });

  it('consumes the hand-off once under StrictMode', () => {
    resetProfileStore({ profile: fakeProfile(40, 65) });
    window.history.replaceState(null, '', '/tools/retirement-calculator?from=profile');
    const replace = vi.spyOn(window.history, 'replaceState');
    const store = createFakeStore();
    const { result } = renderHook(() => useCalculatorBootstrap(store), { wrapper: StrictMode });
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: true });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('');
    replace.mockRestore();
  });
});

describe('useCalculatorValues', () => {
  it('reads the profile and writes through with provided paths', () => {
    resetProfileStore({ profile: fakeProfile(40, 65) });
    const { result } = renderHook(() => useCalculatorValues());
    expect(result.current.get('person.age')).toBe(40);
    act(() => result.current.write([{ path: 'person.retirementAge', value: 67 }]));
    expect(result.current.get('person.retirementAge')).toBe(67);
    expect(result.current.provided).toContain('person.retirementAge');
    const before = useProfileStore.getState().profile;
    act(() => result.current.write([]));
    expect(useProfileStore.getState().profile).toBe(before);
  });

  it('builds restore-defaults writes from the default profile for visible screen fields', () => {
    const screen = FAKE_DEFINITION.form.screens[1];
    const values = { ...fakeProfile(40, 65), cash: { ...fakeProfile(40, 65).cash, emergencyFundApy: 0.1 } };
    expect(restoreDefaultsWrites(FAKE_DEFINITION.form, screen, values)).toEqual([
      { path: 'cash.emergencyFundApy', value: 0.04 },
    ]);
  });
});
