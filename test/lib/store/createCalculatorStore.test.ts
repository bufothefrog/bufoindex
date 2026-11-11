/**
 * createCalculatorStore with a fake definition: the run policy every
 * calculator shares (validate -> memo -> debounce -> newest wins). Replaces
 * the retirement-specific memo and stale-drop cases generically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { setAt } from '@/lib/fields/paths';
import type { FieldErrors } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { createCalculatorStore, runErrorsFrom } from '@/lib/store/createCalculatorStore';

interface Engine {
  age: number;
  retireAt: number;
  meta: Record<string, number>;
}

interface Result {
  years: number;
}

let flipKeyOrder = false;

function makeDefinition(overrides: Partial<CalculatorDefinition<Engine, Result>> = {}) {
  const calculate = vi.fn((inputs: Engine): Result => ({ years: inputs.retireAt - inputs.age }));
  const definition: CalculatorDefinition<Engine, Result> = {
    id: 'retirement',
    form: {
      id: 'fake',
      fields: [{ path: 'person.age', kind: 'number', label: 'Age', tier: 'core', min: 18, max: 100 }],
      screens: [{ id: 'basics', title: 'Basics', tier: 'core', fields: ['person.age'] }],
    },
    bindings: [
      { profile: 'person.age', engine: 'age' },
      { profile: 'person.retirementAge', engine: 'retireAt' },
    ],
    // Alternates the key order of an equal object, to prove the memo key is stable.
    engineBase: () => {
      flipKeyOrder = !flipKeyOrder;
      return { age: 0, retireAt: 0, meta: flipKeyOrder ? { a: 1, b: 2 } : { b: 2, a: 1 } };
    },
    validate: (inputs): FieldErrors => (inputs.retireAt <= inputs.age ? { retireAt: 'Retire after your current age.' } : {}),
    calculate,
    debounceMs: 150,
    ...overrides,
  };
  return { definition, calculate };
}

const profile = (age: number, retirementAge = 65): FinancialProfile =>
  setAt(setAt(getDefaultFinancialProfile(), 'person.age', age), 'person.retirementAge', retirementAge);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createCalculatorStore: debounce', () => {
  it('starts empty', () => {
    const store = createCalculatorStore(makeDefinition());
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

  it('waits debounceMs and runs only the last of a burst', () => {
    const { definition, calculate } = makeDefinition();
    const store = createCalculatorStore({ definition });

    store.getState().submit(profile(30));
    store.getState().submit(profile(31));
    store.getState().submit(profile(32));
    expect(store.getState().isCalculating).toBe(true);
    expect(store.getState().inputs?.age).toBe(32);

    vi.advanceTimersByTime(149);
    expect(calculate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ results: { years: 33 }, isCalculating: false, hasCalculatedOnce: true });
    expect(store.getState().resultsInputs?.age).toBe(32);
  });

  it('runs at once with debounceMs 0 or immediate', () => {
    const zero = createCalculatorStore(makeDefinition({ debounceMs: 0 }));
    zero.getState().submit(profile(30));
    expect(zero.getState().results).toEqual({ years: 35 });

    const { definition, calculate } = makeDefinition();
    const store = createCalculatorStore({ definition });
    store.getState().submit(profile(40), { immediate: true });
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().results).toEqual({ years: 25 });
  });

  it('keeps the queued timer for a repeated submit and honours immediate on it', () => {
    const { definition, calculate } = makeDefinition();
    const store = createCalculatorStore({ definition });
    store.getState().submit(profile(30));
    vi.advanceTimersByTime(100);
    store.getState().submit(profile(30));
    vi.advanceTimersByTime(50);
    expect(calculate).toHaveBeenCalledTimes(1);

    store.getState().submit(profile(31));
    store.getState().submit(profile(31), { immediate: true });
    expect(calculate).toHaveBeenCalledTimes(2);
    expect(store.getState().results).toEqual({ years: 34 });
  });

  it('flush runs the queued submit now and resolves when idle', async () => {
    const { definition, calculate } = makeDefinition();
    const store = createCalculatorStore({ definition });
    await store.getState().flush();
    store.getState().submit(profile(50));
    await store.getState().flush();
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().results).toEqual({ years: 15 });
    vi.advanceTimersByTime(500);
    expect(calculate).toHaveBeenCalledTimes(1);
  });
});

describe('createCalculatorStore: memo', () => {
  it('skips the run for equal inputs in a different key order', () => {
    const { definition, calculate } = makeDefinition({ debounceMs: 0 });
    const store = createCalculatorStore({ definition });
    store.getState().submit(profile(30));
    const firstKey = store.getState().resultsKey;
    const firstInputs = store.getState().inputs;
    store.getState().submit(profile(30));
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().resultsKey).toBe(firstKey);
    // The two engine objects really differ in key order.
    expect(Object.keys(store.getState().inputs?.meta ?? {})).not.toEqual(Object.keys(firstInputs?.meta ?? {}));
  });

  it('returning to the shown inputs cancels the queued run', () => {
    const { definition, calculate } = makeDefinition();
    const store = createCalculatorStore({ definition });
    store.getState().submit(profile(30), { immediate: true });
    store.getState().submit(profile(31));
    expect(store.getState().isCalculating).toBe(true);
    store.getState().submit(profile(30));
    expect(store.getState().isCalculating).toBe(false);
    vi.advanceTimersByTime(500);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState().results).toEqual({ years: 35 });
  });
});

describe('createCalculatorStore: newest run wins', () => {
  it('drops a superseded result that resolves late', async () => {
    const first = deferred<Result>();
    const second = deferred<Result>();
    const runner = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createCalculatorStore({ definition: makeDefinition({ debounceMs: 0 }).definition, runner });

    store.getState().submit(profile(30));
    store.getState().submit(profile(40));
    second.resolve({ years: 25 });
    await second.promise;
    await vi.waitFor(() => expect(store.getState().results).toEqual({ years: 25 }));

    first.resolve({ years: 35 });
    await first.promise;
    await Promise.resolve();
    expect(store.getState().results).toEqual({ years: 25 });
    expect(store.getState().resultsInputs?.age).toBe(40);
    expect(store.getState().isCalculating).toBe(false);
  });

  it('drops a superseded failure', async () => {
    const first = deferred<Result>();
    const runner = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce({ years: 25 });
    const store = createCalculatorStore({ definition: makeDefinition({ debounceMs: 0 }).definition, runner });

    store.getState().submit(profile(30));
    store.getState().submit(profile(40));
    await store.getState().flush();
    first.reject(new Error('late failure'));
    await first.promise.catch(() => undefined);
    await Promise.resolve();
    expect(store.getState().errors).toEqual({});
    expect(store.getState().results).toEqual({ years: 25 });
  });

  it('an invalid submit drops the in-flight run', async () => {
    const first = deferred<Result>();
    const runner = vi.fn().mockReturnValueOnce(first.promise);
    const store = createCalculatorStore({ definition: makeDefinition({ debounceMs: 0 }).definition, runner });
    store.getState().submit(profile(30));
    store.getState().submit(profile(10));
    first.resolve({ years: 35 });
    await first.promise;
    await Promise.resolve();
    expect(store.getState().results).toBeNull();
    expect(store.getState().hasCalculatedOnce).toBe(false);
  });
});

describe('createCalculatorStore: errors', () => {
  it('validates before running and keeps the last results marked stale', () => {
    const { definition, calculate } = makeDefinition({ debounceMs: 0 });
    const store = createCalculatorStore({ definition });
    store.getState().submit(profile(30));

    store.getState().submit(profile(70));
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      results: { years: 35 },
      stale: true,
      isCalculating: false,
      errors: { 'person.retirementAge': 'Retire after your current age.' },
    });
    expect(store.getState().inputs?.age).toBe(70);
    expect(store.getState().resultsInputs?.age).toBe(30);

    store.getState().submit(profile(10));
    expect(Object.keys(store.getState().errors)).toEqual(['person.age']);

    store.getState().submit(profile(30));
    expect(store.getState()).toMatchObject({ stale: false, errors: {}, results: { years: 35 } });
    expect(calculate).toHaveBeenCalledTimes(1);
  });

  it('is not stale when invalid before any result', () => {
    const store = createCalculatorStore(makeDefinition({ debounceMs: 0 }));
    store.getState().submit(profile(10));
    expect(store.getState().stale).toBe(false);
    expect(store.getState().hasCalculatedOnce).toBe(false);
  });

  it('a thrown calculation keeps results stale and reports on calculation', () => {
    const { definition, calculate } = makeDefinition({ debounceMs: 0 });
    const store = createCalculatorStore({ definition });
    store.getState().submit(profile(30));
    calculate.mockImplementationOnce(() => {
      throw new Error('Engine exploded');
    });
    store.getState().submit(profile(31));
    expect(store.getState()).toMatchObject({
      results: { years: 35 },
      stale: true,
      errors: { calculation: 'Engine exploded' },
      hasCalculatedOnce: true,
    });
  });

  it('a rejected runner with engine field errors maps them through the bindings', async () => {
    const runner = vi.fn().mockRejectedValue(Object.assign(new Error('Invalid'), { fieldErrors: { age: 'Too old.' } }));
    const store = createCalculatorStore({ definition: makeDefinition({ debounceMs: 0 }).definition, runner });
    store.getState().submit(profile(30));
    await store.getState().flush();
    expect(store.getState().errors).toEqual({ 'person.age': 'Too old.' });
    expect(store.getState().hasCalculatedOnce).toBe(false);
  });

  it('a runner that throws synchronously is handled like a rejection', async () => {
    const runner = vi.fn(() => {
      throw new Error('no runner');
    });
    const store = createCalculatorStore({ definition: makeDefinition({ debounceMs: 0 }).definition, runner });
    store.getState().submit(profile(30));
    await store.getState().flush();
    expect(store.getState().errors).toEqual({ calculation: 'no runner' });
  });

  it('runErrorsFrom falls back for unknown throwables', () => {
    const { definition } = makeDefinition();
    expect(runErrorsFrom(definition, 'boom')).toEqual({ calculation: 'Calculation failed' });
    expect(runErrorsFrom(definition, { fieldErrors: {} })).toEqual({ calculation: 'Calculation failed' });
    expect(runErrorsFrom(definition, { fieldErrors: { x: 1 } })).toEqual({ calculation: 'Calculation failed' });
    expect(runErrorsFrom(definition, { fieldErrors: { nowhere: 'Bad.' } })).toEqual({ calculation: 'Bad.' });
  });
});

describe('createCalculatorStore: hasCalculatedOnce and reset', () => {
  it('turns true only after a successful run and reset clears everything', () => {
    const { definition, calculate } = makeDefinition();
    const store = createCalculatorStore({ definition, devtoolsName: 'FakeStore' });
    store.getState().submit(profile(30));
    expect(store.getState().hasCalculatedOnce).toBe(false);
    vi.advanceTimersByTime(150);
    expect(store.getState().hasCalculatedOnce).toBe(true);

    store.getState().submit(profile(31));
    store.getState().reset();
    vi.advanceTimersByTime(500);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ results: null, hasCalculatedOnce: false, isCalculating: false, inputs: null });
  });
});
