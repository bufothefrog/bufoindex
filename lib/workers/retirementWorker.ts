/**
 * Dedicated Web Worker entry for the retirement Monte Carlo batch.
 *
 * The store posts a `RetirementWorkerRequest` and receives a
 * `RetirementWorkerResponse` echoing the same sequence id, so the store can
 * drop responses that a newer request has superseded. Only pure functions
 * from `lib/calculations/retirement` run here (no React/DOM/storage imports),
 * so the module bundles cleanly under Turbopack's
 * `new Worker(new URL('../workers/retirementWorker.ts', import.meta.url))`.
 *
 * Errors cross the thread boundary as plain serializable data:
 * `RetirementInputValidationError` becomes `{ fieldErrors }` and anything
 * else becomes `{ message }` — the store rehydrates the typed error on the
 * other side so its errors map is populated exactly as in a direct call.
 */

import {
  calculateRetirementAnalysis,
  RetirementInputValidationError,
} from '../calculations/retirement';
import type { RetirementInputs, RetirementResults } from '../calculations/retirement';

/** Message posted to the worker: a monotonic sequence id plus the inputs. */
export interface RetirementWorkerRequest {
  id: number;
  inputs: RetirementInputs;
}

/**
 * Serializable result envelope posted back by the worker. `fieldErrors` is
 * present exactly when the run failed input validation; `message` covers any
 * other failure.
 */
export type RetirementWorkerResponse =
  | { id: number; ok: true; results: RetirementResults }
  | { id: number; ok: false; fieldErrors?: Record<string, string>; message?: string };

self.onmessage = (event: MessageEvent<RetirementWorkerRequest>) => {
  const { id, inputs } = event.data;
  let response: RetirementWorkerResponse;
  try {
    response = { id, ok: true, results: calculateRetirementAnalysis(inputs) };
  } catch (error) {
    response =
      error instanceof RetirementInputValidationError
        ? { id, ok: false, fieldErrors: error.fieldErrors }
        : {
            id,
            ok: false,
            message: error instanceof Error ? error.message : 'Calculation failed',
          };
  }
  self.postMessage(response);
};
