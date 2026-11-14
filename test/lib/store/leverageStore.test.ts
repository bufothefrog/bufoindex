/**
 * The leverage run store: profile in, simulation out, 250 ms after the last
 * submit (audit H3); invalid inputs keep the last results, marked stale
 * (O17); and, because the inputs live in the profile, the leverage ratio
 * survives a reload (bug 5: the old page kept it only in the query string,
 * which a reload without one dropped).
 *
 * The simulation runs through the worker runner. jsdom has no Worker, so
 * runs take the runner's in-thread fallback; it still resolves
 * asynchronously, like the worker, so every run is awaited (flush) and the
 * sequence guard is exercised for real. simulateDcaComparison is wrapped
 * (not replaced) with a spy, so results stay real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulateDcaComparison, type DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { leverageRunner, useLeverageStore } from '@/lib/store/leverageStore';
import { PROFILE_STORAGE_KEY, useProfileStore } from '@/lib/store/profileStore';
import {
  exposeCalculation,
  type CalculationRequest,
  type CalculationResponse,
  type CalculationScope,
} from '@/lib/workers/exposeCalculation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

vi.mock('@/lib/calculations/leverageComparison', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculations/leverageComparison')>();
  return {
    ...actual,
    simulateDcaComparison: vi.fn(actual.simulateDcaComparison),
  };
});

const simulateSpy = vi.mocked(simulateDcaComparison);

const profile = () => useProfileStore.getState().profile;

/** Submits now and waits for the run to settle. */
async function run(): Promise<void> {
  useLeverageStore.getState().submit(profile(), { immediate: true });
  await useLeverageStore.getState().flush();
}

/**
 * A stand-in Worker: records the script URL and every request, and answers
 * each request on a later task through exposeCalculation with the real
 * simulation, the way leverageWorker.ts does in a browser.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<CalculationResponse<DcaComparisonResult>>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly requests: CalculationRequest<unknown>[] = [];
  private readonly scope: CalculationScope<unknown, DcaComparisonResult>;

  constructor(readonly url: URL | string) {
    FakeWorker.instances.push(this);
    this.scope = {
      onmessage: null,
      postMessage: (message) =>
        this.onmessage?.({ data: message } as MessageEvent<CalculationResponse<DcaComparisonResult>>),
    };
    exposeCalculation(simulateDcaComparison as (inputs: unknown) => DcaComparisonResult, this.scope);
  }

  postMessage(request: CalculationRequest<unknown>): void {
    this.requests.push(request);
    setTimeout(() => this.scope.onmessage?.({ data: request } as MessageEvent<CalculationRequest<unknown>>), 0);
  }

  terminate(): void {}
}

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  simulateSpy.mockClear();
  useLeverageStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Forget any worker a test created (or failed to create).
  leverageRunner.dispose();
});

describe('useLeverageStore', () => {
  it('runs the profile through the simulation (the in-thread fallback without a Worker) on an immediate submit', async () => {
    await run();
    expect(simulateSpy).toHaveBeenCalledTimes(1);
    const { inputs, results, errors, stale, hasCalculatedOnce } = useLeverageStore.getState();
    // The default profile: $500 taxable a month, age 25 to 65, $25,000 invested, 2x.
    expect(inputs).toMatchObject({ monthlyContribution: 500, years: 40, startingBalance: 25000, leverageRatio: 2 });
    expect(results).toEqual(simulateDcaComparison(inputs!));
    expect(results!.totalContributed).toBe(500 * 480 + 25000);
    expect(errors).toEqual({});
    expect(stale).toBe(false);
    expect(hasCalculatedOnce).toBe(true);
  });

  it('waits 250 ms after the last submit', async () => {
    vi.useFakeTimers();
    useLeverageStore.getState().submit(profile());
    await vi.advanceTimersByTimeAsync(249);
    expect(simulateSpy).not.toHaveBeenCalled();
    expect(useLeverageStore.getState().results).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(useLeverageStore.getState().inputs?.years).toBe(40);

    useProfileStore.getState().setValues([{ path: 'leverage.years', value: 12 }]);
    useLeverageStore.getState().submit(profile());
    await vi.advanceTimersByTimeAsync(200);
    useProfileStore.getState().setValues([{ path: 'leverage.years', value: 15 }]);
    useLeverageStore.getState().submit(profile());
    await vi.advanceTimersByTimeAsync(249);
    expect(useLeverageStore.getState().inputs?.years).toBe(40);
    await vi.advanceTimersByTimeAsync(1);
    // The newer submit restarted the delay; only its inputs ran.
    expect(useLeverageStore.getState().inputs?.years).toBe(15);
    expect(simulateSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the last results, marked stale, while nothing is invested', async () => {
    await run();
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

  it('marks a calculator field out of bounds without running', async () => {
    await run();
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
    await run();
    expect(useLeverageStore.getState().inputs).toMatchObject({ leverageRatio: 3, years: 12 });
    expect(profile().provided).toEqual(expect.arrayContaining(['strategy.leverageRatio', 'leverage.years']));
  });
});

describe('the worker runner', () => {
  it('exposes the runner, whose prewarm is safe without Worker support', () => {
    expect(() => leverageRunner.prewarm()).not.toThrow();
  });

  it('runs the simulation in the leverage worker where there is one', async () => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);

    useLeverageStore.getState().submit(profile(), { immediate: true });
    // The worker answers on a later task: nothing has landed yet.
    expect(useLeverageStore.getState().results).toBeNull();
    await useLeverageStore.getState().flush();

    expect(FakeWorker.instances).toHaveLength(1);
    const [worker] = FakeWorker.instances;
    // Vite's worker plugin may append a query to the bundled script URL.
    expect(new URL(String(worker.url)).pathname).toBe('/lib/workers/leverageWorker.ts');
    const { inputs, results } = useLeverageStore.getState();
    expect(worker.requests).toEqual([{ id: 1, inputs }]);
    expect(results).toEqual(simulateDcaComparison(inputs!));
    expect(results!.totalContributed).toBe(500 * 480 + 25000);
  });

  it('falls back to the in-thread simulation when the worker cannot start', async () => {
    // A constructor (called with new) that throws, as a blocked worker script does.
    const create = vi.fn(function BlockedWorker() {
      throw new Error('Worker scripts are blocked');
    });
    vi.stubGlobal('Worker', create);

    await run();

    expect(create).toHaveBeenCalledTimes(1);
    const { inputs, results, errors } = useLeverageStore.getState();
    expect(errors).toEqual({});
    expect(simulateSpy).toHaveBeenCalledTimes(1);
    expect(results).toEqual(simulateDcaComparison(inputs!));
  });

  it('never applies a superseded run, even transiently', async () => {
    const resultsA = { marker: 'A' } as unknown as DcaComparisonResult;
    const resultsB = { marker: 'B' } as unknown as DcaComparisonResult;
    simulateSpy.mockImplementationOnce(() => resultsA).mockImplementationOnce(() => resultsB);

    // Every results value the store publishes: without the sequence guard the
    // history would hold resultsA before resultsB.
    const seen: (DcaComparisonResult | null)[] = [];
    const unsubscribe = useLeverageStore.subscribe((state) => {
      seen.push(state.results);
    });

    try {
      useLeverageStore.getState().submit(profile(), { immediate: true });
      useProfileStore.getState().setValues([{ path: 'leverage.years', value: 12 }]);
      useLeverageStore.getState().submit(profile(), { immediate: true });
      await useLeverageStore.getState().flush();
    } finally {
      unsubscribe();
    }

    expect(simulateSpy).toHaveBeenCalledTimes(2);
    expect(useLeverageStore.getState().results).toBe(resultsB);
    expect(useLeverageStore.getState().inputs?.years).toBe(12);
    expect(seen).not.toContain(resultsA);
  });
});
