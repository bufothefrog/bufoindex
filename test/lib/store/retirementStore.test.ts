/**
 * The retirement run store on the shared factory (createCalculatorStore)
 * with the worker runner. jsdom has no Worker, so runs take the runner's
 * in-thread fallback; it still resolves asynchronously, like the worker, so
 * the sequence guard is exercised for real.
 *
 * calculateRetirementAnalysis is wrapped (not replaced) with a spy so call
 * counts are observable while results stay real: the memo tests assert "no
 * recompute" through the spy, never through timing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateRetirementAnalysis } from '@/lib/calculations/retirement';
import type { RetirementResults } from '@/lib/calculations/retirement';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { applyProfileWrites, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { Write } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import { retirementRunner, useRetirementStore } from '@/lib/store/retirementStore';

vi.mock('@/lib/calculations/retirement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculations/retirement')>();
  return {
    ...actual,
    calculateRetirementAnalysis: vi.fn(actual.calculateRetirementAnalysis),
  };
});

const analysisSpy = vi.mocked(calculateRetirementAnalysis);

const profileWith = (writes: Write[] = []): FinancialProfile =>
  applyProfileWrites(getDefaultFinancialProfile(), writes).profile;

/** Minimal structurally-valid results object with a distinguishing marker. */
const fakeResults = (marker: number): RetirementResults => ({
  scenarios: [],
  netWorthByAge: { 0: marker },
  withdrawalsByAge: {},
  initialWithdrawalRate: 0.04,
});

const getState = () => useRetirementStore.getState();

/** Submits now and waits for the run to settle. */
async function run(profile: FinancialProfile): Promise<void> {
  getState().submit(profile, { immediate: true });
  await getState().flush();
}

beforeEach(() => {
  vi.useRealTimers();
  analysisSpy.mockClear();
  getState().reset();
});

describe('the retirement run store', () => {
  it('starts with no inputs and no results, and persists nothing', () => {
    expect(getState().inputs).toBeNull();
    expect(getState().results).toBeNull();
    expect(getState().hasCalculatedOnce).toBe(false);
    expect(localStorage.getItem('retirement-calculator')).toBeNull();
  });

  it('runs the analysis on the profile\'s engine inputs (the in-thread fallback without a Worker)', async () => {
    const profile = profileWith();
    await run(profile);

    const state = getState();
    expect(analysisSpy).toHaveBeenCalledTimes(1);
    expect(analysisSpy).toHaveBeenCalledWith(engineInputsFor(RETIREMENT_CALCULATOR, profile));
    expect(state.inputs).toEqual(engineInputsFor(RETIREMENT_CALCULATOR, profile));
    expect(state.results!.scenarios.length).toBeGreaterThan(0);
    for (const scenario of state.results!.scenarios) {
      expect(scenario.successProbability).toBeGreaterThanOrEqual(0);
      expect(scenario.successProbability).toBeLessThanOrEqual(1);
    }
    expect(state.hasCalculatedOnce).toBe(true);
    expect(state.errors).toEqual({});
    expect(state.stale).toBe(false);
  });

  it('debounces by 300 ms', async () => {
    vi.useFakeTimers();
    getState().submit(profileWith());
    await vi.advanceTimersByTimeAsync(299);
    expect(analysisSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(analysisSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes the worker runner, whose prewarm is safe without Worker support', () => {
    expect(() => retirementRunner.prewarm()).not.toThrow();
  });
});

describe('memoization', () => {
  it('does not recompute for the same engine inputs', async () => {
    await run(profileWith());
    const first = getState().results;

    // A different profile that feeds the engine the same values: the
    // take-home pay is not a retirement input.
    await run(profileWith([{ path: 'income.netPerPaycheck', value: 2000 }]));

    expect(analysisSpy).toHaveBeenCalledTimes(1);
    expect(getState().results).toBe(first);
  });

  it('recomputes when an engine input changes', async () => {
    await run(profileWith());
    await run(profileWith([{ path: 'investing.monthlyContribution', value: 2500 }]));
    expect(analysisSpy).toHaveBeenCalledTimes(2);
    expect(getState().inputs?.monthlySavings).toBe(2500);
  });
});

describe('errors keep the last results', () => {
  it('marks the results stale on an invalid field and runs nothing', async () => {
    await run(profileWith());
    const results = getState().results;

    getState().submit(
      profileWith([
        { path: 'person.age', value: 60 },
        { path: 'person.retirementAge', value: 60 },
      ]),
      { immediate: true }
    );

    const state = getState();
    expect(analysisSpy).toHaveBeenCalledTimes(1);
    expect(state.results).toBe(results);
    expect(state.stale).toBe(true);
    expect(state.errors).toEqual({ 'person.retirementAge': 'The retirement age needs to be above your current age.' });
  });

  it('keeps the results and reports a failed run under calculation', async () => {
    await run(profileWith());
    const results = getState().results;
    analysisSpy.mockImplementationOnce(() => {
      throw new Error('Simulation failed');
    });

    await run(profileWith([{ path: 'investing.monthlyContribution', value: 2500 }]));

    expect(getState().results).toBe(results);
    expect(getState().stale).toBe(true);
    expect(getState().errors).toEqual({ calculation: 'Simulation failed' });
  });
});

describe('stale-response dropping', () => {
  it('never applies a superseded run, even transiently', async () => {
    const resultsA = fakeResults(1);
    const resultsB = fakeResults(2);
    analysisSpy.mockImplementationOnce(() => resultsA).mockImplementationOnce(() => resultsB);

    // Every results value the store publishes: without the sequence guard the
    // history would hold resultsA before resultsB.
    const seen: (RetirementResults | null)[] = [];
    const unsubscribe = useRetirementStore.subscribe((state) => {
      seen.push(state.results);
    });

    try {
      getState().submit(profileWith(), { immediate: true });
      getState().submit(profileWith([{ path: 'investing.monthlyContribution', value: 3000 }]), { immediate: true });
      await getState().flush();
    } finally {
      unsubscribe();
    }

    expect(analysisSpy).toHaveBeenCalledTimes(2);
    expect(getState().results).toBe(resultsB);
    expect(seen).not.toContain(resultsA);
  });
});
