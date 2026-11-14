/**
 * Dedicated Web Worker entry for the leverage comparison's simulation:
 * answers the runner in lib/store/leverageStore.ts (createWorkerRunner) with
 * simulateDcaComparison. Only pure calculation code runs here, so the module
 * bundles cleanly under Turbopack's
 * `new Worker(new URL('../workers/leverageWorker.ts', import.meta.url))`.
 */

import { simulateDcaComparison } from '../calculations/leverageComparison';
import { exposeCalculation } from './exposeCalculation';

exposeCalculation(simulateDcaComparison);
