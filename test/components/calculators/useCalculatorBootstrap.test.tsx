/**
 * useCalculatorBootstrap: mount order profile > defaults. It waits for the
 * profile store to hydrate, strips the query and hash (reporting only
 * ?from=profile), runs the one-time import of every old calculator key
 * (on every calculator page), submits the profile to the run store at once,
 * then reports ready.
 */

import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalculatorBootstrap } from '@/components/calculators/shared/useCalculatorBootstrap';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_LEGACY } from '@/lib/calculators/paycheck/legacy';
import { RETIREMENT_LEGACY } from '@/lib/calculators/retirement/legacy';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import type { FormSpec } from '@/lib/fields/types';
import { createCalculatorStore, type CalculatorStore } from '@/lib/store/createCalculatorStore';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

interface Engine {
  age: number;
  retirementAge: number;
}

const OLD_DEFAULTS: Engine = { age: 30, retirementAge: 60 };

const FORM: FormSpec = {
  id: 'fake',
  fields: [{ path: 'person.age', kind: 'number', label: 'Age', min: 18, max: 90, tier: 'details' }],
  screens: [{ id: 'about', title: 'About you', tier: 'details', fields: ['person.age'] }],
};

const DEFINITION: CalculatorDefinition<Engine, number> = {
  id: 'retirement',
  form: FORM,
  bindings: [
    { profile: 'person.age', engine: 'age' },
    { profile: 'person.retirementAge', engine: 'retirementAge' },
  ],
  engineBase: () => ({ ...OLD_DEFAULTS }),
  validate: () => ({}),
  calculate: (inputs) => inputs.retirementAge - inputs.age,
  debounceMs: 0,
};

/** An old retirement calculator key: the old defaults with `inputs` changed. */
function storeOldRetirement(inputs: Record<string, unknown>): void {
  window.localStorage.setItem(
    RETIREMENT_LEGACY.storageKey,
    JSON.stringify({ state: { inputs: { ...RETIREMENT_LEGACY.storageDefaults(), ...inputs } }, version: 3 })
  );
}

let store: CalculatorStore<Engine, number>;

function visit(url: string): void {
  window.history.replaceState(null, '', url);
}

function bootstrap(def: CalculatorDefinition<Engine, number> = DEFINITION) {
  return renderHook(() => useCalculatorBootstrap(def, store));
}

const location = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  store = createCalculatorStore({ definition: DEFINITION });
});

describe('useCalculatorBootstrap', () => {
  it('strips ?from=profile and reports arrivedFromProfile', () => {
    visit('/tools/fake?from=profile');
    const { result } = bootstrap();
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: true });
    expect(location()).toBe('/tools/fake');
  });

  it('strips the hash a profile link still carries along with ?from=profile', () => {
    visit('/tools/fake?from=profile#eyJ2IjozfQ');
    const { result } = bootstrap();
    expect(result.current.arrivedFromProfile).toBe(true);
    expect(location()).toBe('/tools/fake');
  });

  it('strips a stray hash silently and runs on the visitor\'s own profile', () => {
    resetProfileStore({ profile: { person: { age: 40, retirementAge: 65 } } });
    visit('/tools/fake#eyJhZ2UiOjk5fQ');
    const { result } = bootstrap();
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: false });
    expect(location()).toBe('/tools/fake');
    expect(store.getState().results).toBe(25);
    expect(useProfileStore.getState().profile.person.age).toBe(40);
  });

  it('strips a legacy query silently (another from value included)', () => {
    visit('/tools/fake?c=500&y=20&b=0&l=2&from=dashboard');
    const { result } = bootstrap();
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: false });
    expect(location()).toBe('/tools/fake');
  });

  it('leaves a clean URL alone and reads the profile', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    visit('/tools/fake');
    replaceState.mockClear();
    resetProfileStore({ profile: { person: { age: 50 } } });
    const { result } = bootstrap();
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: false });
    expect(replaceState).not.toHaveBeenCalled();
    // Default retirement age 60, seeded age 50.
    expect(store.getState().results).toBe(10);
    replaceState.mockRestore();
  });

  it('waits for the profile store to hydrate before touching the URL or the store', () => {
    resetProfileStore({ hydrated: false });
    visit('/tools/fake?from=profile');
    const { result } = bootstrap();
    expect(result.current).toEqual({ ready: false, arrivedFromProfile: false });
    expect(location()).toBe('/tools/fake?from=profile');
    expect(store.getState().hasCalculatedOnce).toBe(false);

    act(() => useProfileStore.setState({ hasHydrated: true }));
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: true });
    expect(location()).toBe('/tools/fake');
    expect(store.getState().results).toBe(30);
  });

  it('runs once under StrictMode', () => {
    const submit = vi.fn(store.getState().submit);
    store.setState({ submit });
    visit('/tools/fake?from=profile');
    const { result } = renderHook(() => useCalculatorBootstrap(DEFINITION, store), { wrapper: StrictMode });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(useProfileStore.getState().profile, { immediate: true });
    // The second effect pass found nothing to strip, yet the first pass's report stands.
    expect(result.current).toEqual({ ready: true, arrivedFromProfile: true });
  });

  it('imports the old localStorage keys before the first run', () => {
    storeOldRetirement({ startingAge: 45 });
    const { result } = bootstrap();
    expect(result.current.ready).toBe(true);
    expect(window.localStorage.getItem(RETIREMENT_LEGACY.storageKey)).toBeNull();
    expect(useProfileStore.getState().profile.person.age).toBe(45);
    expect(useProfileStore.getState().profile.provided).toContain('person.age');
    // The first run already saw the imported age.
    expect(store.getState().results).toBe(15);
  });

  it('imports both old keys on a calculator with no old key of its own (leverage)', () => {
    storeOldRetirement({ startingAge: 45 });
    const paycheck = PAYCHECK_LEGACY.storageDefaults();
    paycheck.preferences.necessaryExpenses = 3300;
    window.localStorage.setItem(PAYCHECK_LEGACY.storageKey, JSON.stringify({ state: { profile: paycheck }, version: 0 }));
    const submit = vi.fn();
    type LeverageInputs = Parameters<typeof LEVERAGE_CALCULATOR.calculate>[0];
    type LeverageResult = ReturnType<typeof LEVERAGE_CALCULATOR.calculate>;
    const leverageStore = { getState: () => ({ submit }) } as unknown as CalculatorStore<LeverageInputs, LeverageResult>;

    const { result } = renderHook(() => useCalculatorBootstrap(LEVERAGE_CALCULATOR, leverageStore));
    expect(result.current.ready).toBe(true);
    expect(window.localStorage.getItem(RETIREMENT_LEGACY.storageKey)).toBeNull();
    expect(window.localStorage.getItem(PAYCHECK_LEGACY.storageKey)).toBeNull();
    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(45);
    expect(profile.spending.necessaryMonthly).toBe(3300);
    // The run saw the imported profile.
    expect(submit).toHaveBeenCalledWith(profile, { immediate: true });
  });
});
