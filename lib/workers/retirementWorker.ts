/**
 * Dedicated Web Worker entry for the retirement Monte Carlo batch: answers
 * the runner in lib/store/retirementStore.ts (createWorkerRunner) with
 * calculateRetirementAnalysis. Only pure calculation code runs here, so the
 * module bundles cleanly under Turbopack's
 * `new Worker(new URL('../workers/retirementWorker.ts', import.meta.url))`.
 */

import { calculateRetirementAnalysis } from '../calculations/retirement';
import { exposeCalculation } from './exposeCalculation';

exposeCalculation(calculateRetirementAnalysis);
