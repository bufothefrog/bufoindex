/**
 * The retirement run store (docs/rebuild-plan.md section 2.6): the shared
 * run-store policy over RETIREMENT_CALCULATOR, with the Monte Carlo batch run
 * off-thread. Inputs live in the profile store; nothing here is persisted.
 *
 * The worker literal stays in this module: Turbopack bundles a worker only
 * from `new Worker(new URL(...))` written at the call site (plan risk 8).
 */

import type { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { calculateRetirementAnalysis } from '@/lib/calculations/retirement';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { createWorkerRunner } from '@/lib/workers/createWorkerRunner';
import { createCalculatorStore, type CalculatorStore } from './createCalculatorStore';

/** Runs the analysis in the retirement worker, in-thread where there is none. */
export const retirementRunner = createWorkerRunner<RetirementInputs, RetirementResults>({
  create: () => new Worker(new URL('../workers/retirementWorker.ts', import.meta.url)),
  fallback: calculateRetirementAnalysis,
});

export const useRetirementStore: CalculatorStore<RetirementInputs, RetirementResults> = createCalculatorStore({
  definition: RETIREMENT_CALCULATOR,
  runner: retirementRunner,
  devtoolsName: 'RetirementStore',
});
