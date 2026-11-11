/**
 * createCalculatorStore with a fake definition, fake timers and hand-driven
 * runner promises. Re-expresses the retirement store's memo and stale-drop
 * cases generically, plus the error, debounce, flush and reset policy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { setAt } from '@/lib/fields/paths';
import type { FieldErrors, FormSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile';
import type { FinancialProfile } from '@/lib/profile';
import { createCalculatorStore } from '@/lib/store/createCalculatorStore';

interface Engine {
  age: number;
  years: number;
  /** Same values, key order set by person.state: a memo key must not care. */
  mix: Record<string, number>;
}

interface Results {
  total: number;
}

const FORM: FormSpec = {
  id: 'fake',
  fields: [
    { path: 'person.age', kind: 'number', label: 'Age', min: 18, max: 90, tier: 'core' },
    { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', min: 19, max: 100, tier: 'core' },
  ],
  screens: [{ id: 'basics', title: 'Basics', tier: 'core', fields: ['person.age', 'person.retirementAge'] }],
};

const calculate = vi.fn((inputs: Engine): Results => {
  if (inputs.age === 77) throw new Error('Engine exploded.');
  return { total: inputs.age + inputs.years };
});

function definition(debounceMs: number): CalculatorDefinition<Engine, Results> {
  return {
    id: 'retirement',
    form: FORM,
    bindings: [
      { profile: 'person.age', engine: 'age' },
      {
        engine: 'years',
        read: (get) => (get('person.retirementAge') as number) - (get('person.age') as number),
        errorPath: 'person.retirementAge',
      },
      {
        engine: 'mix',
        read: (get) => (get('person.state') === 'CA' ? { stocks: 0.6, bonds: 0.4 } : { bonds: 0.4, stocks: 0.6 }),
      },
    ],
    engineBase: () => ({ age: 0, years: 0, mix: {} }),
    validate: (inputs): FieldErrors => (inputs.years > 50 ? { years: 'At most 50 years.' } : {}),
    calculate,
    debounceMs,
  };
}

function profileWith(values: Record<string, unknown> = {}): FinancialProfile {
  let profile = getDefaultFinancialProfile();
  for (const [path, value] of Object.entries(values)) profile = setAt(profile, path, value);
  return profile;
}

/** A runner whose calls resolve or reject only when the test says so. */
function manualRunner() {
  const calls: { inputs: Engine; resolve: (r: Results) => void; reject: (e: unknown) => void }[] = [];
  const runner = vi.fn(
    (inputs: Engine) =>
      new Promise<Results>((resolve, reject) => {
        calls.push({ inputs, resolve, reject });
      })
  );
  return { runner, calls };
}

// Defaults: age 30, retirementAge 60, so years 30 and total 60.
const DEFAULT_RESULTS: Results = { total: 60 };

beforeEach(() => {
  vi.useFakeTimers();
  calculate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initial state', () => {
  it('starts empty', () => {
    const state = createCalculatorStore({ definition: definition(0) }).getState();
    expect(state).toMatchObject({
      inputs: null,
      results: null,
      errors: {},
      stale: false,
      isCalculating: false,
      hasCalculatedOnce: false,
      resultsKey: null,
    });
  });
});

describe('synchronous dispatch (debounceMs 0, no runner)', () => {
  it('runs during submit and stores the inputs with their results', () => {
    const store = createCalculatorStore({ definition: definition(0) });
    store.getState().submit(profileWith());
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      inputs: { age: 30, years: 30, mix: { bonds: 0.4, stocks: 0.6 } },
      results: DEFAULT_RESULTS,
      errors: {},
      stale: false,
      isCalculating: false,
      hasCalculatedOnce: true,
      resultsKey: '{"age":30,"mix":{"bonds":0.4,"stocks":0.6},"years":30}',
    });
  });
});

describe('debounce', () => {
  it('waits debounceMs after the last submit and runs once with the latest values', () => {
    const store = createCalculatorStore({ definition: definition(150) });
    store.getState().submit(profileWith({ 'person.age': 31 }));
    vi.advanceTimersByTime(100);
    store.getState().submit(profileWith({ 'person.age': 32 }));
    vi.advanceTimersByTime(149);
    expect(calculate).not.toHaveBeenCalled();
    expect(store.getState().results).toBeNull();
    vi.advanceTimersByTime(1);
    expect(calculate).toHaveBeenCalledTimes(1);
    // age 32, years 60 - 32 = 28
    expect(store.getState().results).toEqual({ total: 60 });
    expect(store.getState().inputs?.age).toBe(32);
  });

  it('skips the delay with immediate', () => {
    const store = createCalculatorStore({ definition: definition(300) });
    store.getState().submit(profileWith(), { immediate: true });
    expect(store.getState().results).toEqual(DEFAULT_RESULTS);
    vi.advanceTimersByTime(300);
    expect(calculate).toHaveBeenCalledTimes(1);
  });

  it('an immediate submit replaces a pending debounced one', () => {
    const store = createCalculatorStore({ definition: definition(300) });
    store.getState().submit(profileWith({ 'person.age': 40 }));
    store.getState().submit(profileWith({ 'person.age': 41 }), { immediate: true });
    vi.advanceTimersByTime(300);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().inputs?.age).toBe(41);
  });
});

describe('memoization', () => {
  it('does not rerun for equal inputs given in a different key order', () => {
    const store = createCalculatorStore({ definition: definition(0) });
    store.getState().submit(profileWith({ 'person.state': 'CA' }));
    const first = store.getState().results;
    store.getState().submit(profileWith({ 'person.state': 'TX' }));
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().results).toBe(first);
  });

  it('reruns when a calculation input changes', () => {
    const store = createCalculatorStore({ definition: definition(0) });
    store.getState().submit(profileWith());
    store.getState().submit(profileWith({ 'person.age': 35 }));
    expect(calculate).toHaveBeenCalledTimes(2);
    expect(store.getState().results).toEqual({ total: 60 });
    expect(store.getState().inputs?.years).toBe(25);
  });

  it('cancels a pending run when the values go back to the ones on display', () => {
    const store = createCalculatorStore({ definition: definition(150) });
    store.getState().submit(profileWith(), { immediate: true });
    store.getState().submit(profileWith({ 'person.age': 35 }));
    store.getState().submit(profileWith());
    vi.advanceTimersByTime(150);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().inputs?.age).toBe(30);
  });

  it('does not dispatch again while the same inputs are in flight', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(0), runner });
    store.getState().submit(profileWith());
    store.getState().submit(profileWith());
    expect(runner).toHaveBeenCalledTimes(1);
    calls[0].resolve(DEFAULT_RESULTS);
    await store.getState().flush();
    expect(store.getState().results).toEqual(DEFAULT_RESULTS);
  });
});

describe('newest run wins', () => {
  it('drops a run that settles after a newer one, even transiently', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(0), runner });
    const seen: (Results | null)[] = [];
    store.subscribe((state) => seen.push(state.results));

    store.getState().submit(profileWith({ 'person.age': 40 }));
    store.getState().submit(profileWith({ 'person.age': 50 }));
    expect(store.getState().isCalculating).toBe(true);

    calls[1].resolve({ total: 50 });
    await store.getState().flush();
    calls[0].resolve({ total: 40 });
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().results).toEqual({ total: 50 });
    expect(store.getState().inputs?.age).toBe(50);
    expect(store.getState().isCalculating).toBe(false);
    expect(seen).not.toContainEqual({ total: 40 });
  });

  it('drops a failure from a superseded run', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(0), runner });
    store.getState().submit(profileWith({ 'person.age': 40 }));
    store.getState().submit(profileWith({ 'person.age': 50 }));
    calls[0].reject(new Error('old failure'));
    calls[1].resolve({ total: 50 });
    await store.getState().flush();
    expect(store.getState().errors).toEqual({});
    expect(store.getState().results).toEqual({ total: 50 });
  });
});

describe('validation errors', () => {
  it('keeps the last results, marks them stale and does not run', () => {
    const store = createCalculatorStore({ definition: definition(0) });
    store.getState().submit(profileWith());
    store.getState().submit(profileWith({ 'person.age': 12 }));
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      results: DEFAULT_RESULTS,
      inputs: { age: 30 },
      errors: { 'person.age': 'Age must be between 18 and 90.' },
      stale: true,
      hasCalculatedOnce: true,
    });
  });

  it('reports engine errors on profile paths', () => {
    const store = createCalculatorStore({ definition: definition(0) });
    // years = 90 - 30 = 60 > 50
    store.getState().submit(profileWith({ 'person.retirementAge': 90 }));
    expect(store.getState().errors).toEqual({ 'person.retirementAge': 'At most 50 years.' });
    expect(store.getState().stale).toBe(true);
    expect(calculate).not.toHaveBeenCalled();
  });

  it('drops a pending run and an in-flight run when the newest values are invalid', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(200), runner });
    store.getState().submit(profileWith(), { immediate: true });
    store.getState().submit(profileWith({ 'person.age': 40 }));
    store.getState().submit(profileWith({ 'person.age': 12 }));
    vi.advanceTimersByTime(200);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(store.getState().isCalculating).toBe(false);
    calls[0].resolve(DEFAULT_RESULTS);
    await Promise.resolve();
    expect(store.getState().results).toBeNull();
    expect(store.getState().errors).toEqual({ 'person.age': 'Age must be between 18 and 90.' });
  });

  it('clears the errors on the next valid submit and the stale flag once the run lands', () => {
    const store = createCalculatorStore({ definition: definition(150) });
    store.getState().submit(profileWith(), { immediate: true });
    store.getState().submit(profileWith({ 'person.age': 12 }));
    store.getState().submit(profileWith({ 'person.age': 35 }));
    expect(store.getState().errors).toEqual({});
    expect(store.getState().stale).toBe(true);
    vi.advanceTimersByTime(150);
    expect(store.getState().stale).toBe(false);
    expect(store.getState().inputs?.age).toBe(35);
  });

  it('clears stale at once when the fixed values match the results on display', () => {
    const store = createCalculatorStore({ definition: definition(150) });
    store.getState().submit(profileWith(), { immediate: true });
    store.getState().submit(profileWith({ 'person.age': 12 }));
    store.getState().submit(profileWith());
    expect(store.getState()).toMatchObject({ errors: {}, stale: false, results: DEFAULT_RESULTS });
    expect(calculate).toHaveBeenCalledTimes(1);
  });
});

describe('hasCalculatedOnce', () => {
  it('stays false until a run succeeds', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(0), runner });
    store.getState().submit(profileWith({ 'person.age': 12 }));
    expect(store.getState().hasCalculatedOnce).toBe(false);
    store.getState().submit(profileWith());
    expect(store.getState().hasCalculatedOnce).toBe(false);
    calls[0].reject(new Error('nope'));
    await store.getState().flush();
    expect(store.getState().hasCalculatedOnce).toBe(false);
    store.getState().submit(profileWith({ 'person.age': 31 }));
    calls[1].resolve({ total: 1 });
    await store.getState().flush();
    expect(store.getState().hasCalculatedOnce).toBe(true);
  });
});

describe('failed runs', () => {
  it('a rejecting runner keeps the last results and reports under calculation', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(0), runner });
    store.getState().submit(profileWith());
    calls[0].resolve(DEFAULT_RESULTS);
    await store.getState().flush();
    store.getState().submit(profileWith({ 'person.age': 40 }));
    calls[1].reject(new Error('Worker said no.'));
    await store.getState().flush();
    expect(store.getState()).toMatchObject({
      results: DEFAULT_RESULTS,
      resultsKey: '{"age":30,"mix":{"bonds":0.4,"stocks":0.6},"years":30}',
      errors: { calculation: 'Worker said no.' },
      stale: true,
      isCalculating: false,
    });
  });

  it('a non-Error rejection gets a generic message', async () => {
    const runner = vi.fn(() => Promise.reject('broken'));
    const store = createCalculatorStore({ definition: definition(0), runner });
    store.getState().submit(profileWith());
    await store.getState().flush();
    expect(store.getState().errors).toEqual({ calculation: 'Calculation failed' });
  });

  it('a throwing in-thread calculate is reported the same way', () => {
    const store = createCalculatorStore({ definition: definition(0) });
    store.getState().submit(profileWith());
    store.getState().submit(profileWith({ 'person.age': 77 }));
    expect(store.getState()).toMatchObject({
      results: DEFAULT_RESULTS,
      errors: { calculation: 'Engine exploded.' },
      stale: true,
    });
  });
});

describe('flush', () => {
  it('runs a debounced submit now and resolves once it has landed', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(300), runner });
    store.getState().submit(profileWith());
    expect(runner).not.toHaveBeenCalled();
    const flushed = store.getState().flush();
    expect(runner).toHaveBeenCalledTimes(1);
    calls[0].resolve(DEFAULT_RESULTS);
    await flushed;
    expect(store.getState().results).toEqual(DEFAULT_RESULTS);
    vi.advanceTimersByTime(300);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('resolves at once when nothing is pending', async () => {
    const store = createCalculatorStore({ definition: definition(0) });
    await expect(store.getState().flush()).resolves.toBeUndefined();
  });
});

describe('reset', () => {
  it('returns to the initial state and drops pending and in-flight runs', async () => {
    const { runner, calls } = manualRunner();
    const store = createCalculatorStore({ definition: definition(100), runner });
    store.getState().submit(profileWith(), { immediate: true });
    store.getState().submit(profileWith({ 'person.age': 40 }));
    store.getState().reset();
    vi.advanceTimersByTime(100);
    calls[0].resolve(DEFAULT_RESULTS);
    await Promise.resolve();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      inputs: null,
      results: null,
      errors: {},
      stale: false,
      isCalculating: false,
      hasCalculatedOnce: false,
      resultsKey: null,
    });
  });
});

describe('devtools', () => {
  it('creates a working store with a devtools name', () => {
    const store = createCalculatorStore({ definition: definition(0), devtoolsName: 'FakeRunStore' });
    store.getState().submit(profileWith());
    expect(store.getState().results).toEqual(DEFAULT_RESULTS);
  });
});
