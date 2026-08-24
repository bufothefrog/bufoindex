/**
 * Retirement Store Test Suite
 *
 * Exercises the Zustand store's actions directly through
 * useRetirementStore.getState() — no React rendering. jsdom has no Worker,
 * so these tests run the store's synchronous fallback path; the worker and
 * fallback share the memoization and sequence-counter logic under test here.
 *
 * calculateRetirementAnalysis is wrapped (not replaced) with a spy so call
 * counts are observable while results stay real — the memoization tests
 * assert "no recompute" via the spy, never via timing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { calculateRetirementAnalysis } from '@/lib/calculations/retirement';
import type { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { encodeRetirementToUrlHash } from '@/lib/utils/retirementState';

vi.mock('@/lib/calculations/retirement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculations/retirement')>();
  return {
    ...actual,
    calculateRetirementAnalysis: vi.fn(actual.calculateRetirementAnalysis),
  };
});

const analysisSpy = vi.mocked(calculateRetirementAnalysis);

// Store defaults captured before any test mutates state (localStorage is
// empty at module load, so persist rehydration leaves the defaults intact).
const defaultInputs: RetirementInputs = useRetirementStore.getState().inputs;

const baseInputs = (overrides: Partial<RetirementInputs> = {}): RetirementInputs => ({
  ...defaultInputs,
  ...overrides,
});

/** Minimal structurally-valid results object with a distinguishing marker. */
const fakeResults = (marker: string): RetirementResults => ({
  scenarios: [],
  netWorthByAge: {},
  withdrawalsByAge: {},
  insights: [marker],
  initialWithdrawalRate: 0.04,
});

const getState = () => useRetirementStore.getState();

beforeEach(() => {
  vi.useRealTimers();
  analysisSpy.mockClear();
  window.location.hash = '';
  useRetirementStore.setState({
    inputs: baseInputs(),
    results: null,
    lastCalculationHash: null,
    isCalculating: false,
    hasCalculatedOnce: false,
    errors: {},
  });
});

describe('calculate — synchronous fallback path (no Worker in jsdom)', () => {
  it('runs the analysis and populates results, flags, and empty errors', async () => {
    await getState().calculate();

    const state = getState();
    expect(analysisSpy).toHaveBeenCalledTimes(1);
    expect(state.results).not.toBeNull();
    expect(state.results!.scenarios.length).toBeGreaterThan(0);
    // Seeded Monte Carlo: probabilities are real numbers in [0, 1].
    for (const scenario of state.results!.scenarios) {
      expect(scenario.successProbability).toBeGreaterThanOrEqual(0);
      expect(scenario.successProbability).toBeLessThanOrEqual(1);
    }
    expect(state.isCalculating).toBe(false);
    expect(state.hasCalculatedOnce).toBe(true);
    expect(state.errors).toEqual({});
  });

  it('maps RetirementInputValidationError onto per-field errors', async () => {
    useRetirementStore.setState({
      inputs: baseInputs({ startingAge: 40, retirementAge: 35 }),
    });

    await getState().calculate();

    const state = getState();
    expect(state.results).toBeNull();
    expect(state.errors.retirementAge).toMatch(/greater than/i);
    expect(state.isCalculating).toBe(false);
    // Error path leaves hasCalculatedOnce untouched (matches pre-worker behavior).
    expect(state.hasCalculatedOnce).toBe(false);
  });
});

describe('memoization', () => {
  it('a second calculate with identical inputs does not recompute', async () => {
    await getState().calculate();
    expect(analysisSpy).toHaveBeenCalledTimes(1);
    const firstResults = getState().results;

    await getState().calculate();

    expect(analysisSpy).toHaveBeenCalledTimes(1); // memo hit — no second run
    expect(getState().results).toBe(firstResults); // exact cached object
    expect(getState().isCalculating).toBe(false);
  });

  it('recomputes when a calculation-relevant input changes', async () => {
    await getState().calculate();
    useRetirementStore.setState({ inputs: baseInputs({ monthlySavings: 2500 }) });

    await getState().calculate();

    expect(analysisSpy).toHaveBeenCalledTimes(2);
  });

  it('a displayMode toggle does not invalidate the memo cache', async () => {
    await getState().calculate();
    getState().setDisplayMode('nominal');

    await getState().calculate();

    expect(analysisSpy).toHaveBeenCalledTimes(1);
    expect(getState().displayMode).toBe('nominal');
  });

  it('debounced auto-recalculation skips identical inputs (focus churn)', async () => {
    await getState().calculate();
    expect(analysisSpy).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    // Re-emitting the same value, as focus/blur churn does, is a memo hit.
    getState().updateInputs({ monthlySavings: defaultInputs.monthlySavings });
    await vi.runAllTimersAsync();
    expect(analysisSpy).toHaveBeenCalledTimes(1);

    // A real change recomputes through the same debounce.
    getState().updateInputs({ monthlySavings: 2500 });
    await vi.runAllTimersAsync();
    expect(analysisSpy).toHaveBeenCalledTimes(2);
    expect(getState().results).not.toBeNull();
  });
});

describe('stale-response dropping', () => {
  it('never applies a superseded run, even transiently', async () => {
    const resultsA = fakeResults('A');
    const resultsB = fakeResults('B');
    analysisSpy
      .mockImplementationOnce(() => resultsA)
      .mockImplementationOnce(() => resultsB);

    // Record every results value the store ever publishes: without the
    // sequence guard the history would contain resultsA before resultsB.
    const seen: (RetirementResults | null)[] = [];
    const unsubscribe = useRetirementStore.subscribe((state) => {
      seen.push(state.results);
    });

    try {
      const first = getState().calculate(); // run 1 (superseded below)
      useRetirementStore.setState({ inputs: baseInputs({ monthlySavings: 3000 }) });
      const second = getState().calculate(); // run 2 supersedes run 1
      await Promise.all([first, second]);
    } finally {
      unsubscribe();
    }

    expect(analysisSpy).toHaveBeenCalledTimes(2);
    expect(getState().results).toBe(resultsB);
    expect(seen).not.toContain(resultsA); // stale result was dropped, not overwritten
    expect(getState().isCalculating).toBe(false);
  });
});

describe('loadFromUrl', () => {
  it('adopts shared inputs synchronously and resolves results asynchronously', async () => {
    const shared = baseInputs({ monthlySavings: 1234 });
    window.location.hash = `#${encodeRetirementToUrlHash(shared, 'nominal')}`;

    getState().loadFromUrl();

    // Inputs land immediately; the heavy analysis settles on a later tick.
    const immediate = getState();
    expect(immediate.inputs.monthlySavings).toBe(1234);
    expect(immediate.displayMode).toBe('nominal');
    expect(immediate.hasCalculatedOnce).toBe(true);
    expect(immediate.isCalculating).toBe(true);
    expect(immediate.results).toBeNull();

    await vi.waitFor(() => {
      expect(getState().results).not.toBeNull();
    });
    expect(getState().isCalculating).toBe(false);
    expect(analysisSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores an unparseable hash', () => {
    window.location.hash = '#not-a-valid-hash!!!';
    const before = getState().inputs;

    getState().loadFromUrl();

    expect(getState().inputs).toBe(before);
    expect(getState().hasCalculatedOnce).toBe(false);
    expect(analysisSpy).not.toHaveBeenCalled();
  });
});
