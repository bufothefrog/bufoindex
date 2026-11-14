/**
 * The leverage comparison's run store (createCalculatorStore), with the
 * simulation run off-thread. Inputs live in the profile, so the leverage
 * ratio and every override survive a reload; this store holds run state
 * only and persists nothing.
 *
 * The worker literal stays in this module: Turbopack bundles a worker only
 * from `new Worker(new URL(...))` written at the call site (plan risk 8).
 */

import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import type { DcaComparisonInputs, DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { simulateDcaComparison } from '@/lib/calculations/leverageComparison';
import { createWorkerRunner } from '@/lib/workers/createWorkerRunner';
import { createCalculatorStore, type CalculatorStore } from './createCalculatorStore';

/** Runs the simulation in the leverage worker, in-thread where there is none. */
export const leverageRunner = createWorkerRunner<DcaComparisonInputs, DcaComparisonResult>({
  create: () => new Worker(new URL('../workers/leverageWorker.ts', import.meta.url)),
  fallback: simulateDcaComparison,
});

export const useLeverageStore: CalculatorStore<DcaComparisonInputs, DcaComparisonResult> = createCalculatorStore({
  definition: LEVERAGE_CALCULATOR,
  runner: leverageRunner,
});
