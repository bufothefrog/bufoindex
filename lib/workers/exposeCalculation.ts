/**
 * Worker side of createWorkerRunner (docs/rebuild-plan.md section 2.6).
 *
 * `exposeCalculation(fn)` answers every WorkerRequest with a WorkerResponse
 * echoing its id. A thrown error crosses the thread boundary as plain data:
 * its message, plus its `fieldErrors` record when the engine attached one.
 *
 * Import only pure modules into a worker entry (no React, DOM or storage).
 */

import type { FieldErrors } from '@/lib/fields/types';
import type { WorkerRequest, WorkerResponse } from './createWorkerRunner';

/** The part of a dedicated worker's global scope this module uses. */
export interface CalculationScope<I, R> {
  onmessage: ((event: MessageEvent<WorkerRequest<I>>) => void) | null;
  postMessage(message: WorkerResponse<R>): void;
}

function fieldErrorsOf(error: unknown): FieldErrors | undefined {
  if (typeof error !== 'object' || error === null || !('fieldErrors' in error)) return undefined;
  const candidate = (error as { fieldErrors: unknown }).fieldErrors;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return undefined;
  const entries = Object.entries(candidate).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Builds the response for one request (exported for tests). */
export function respond<I, R>(fn: (inputs: I) => R, request: WorkerRequest<I>): WorkerResponse<R> {
  const { id, inputs } = request;
  try {
    return { id, ok: true, results: fn(inputs) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Calculation failed';
    const fieldErrors = fieldErrorsOf(error);
    return fieldErrors ? { id, ok: false, message, fieldErrors } : { id, ok: false, message };
  }
}

/** Installs the message handler on the worker scope (defaults to the worker's `self`). */
export function exposeCalculation<I, R>(
  fn: (inputs: I) => R,
  scope: CalculationScope<I, R> = self as unknown as CalculationScope<I, R>
): void {
  scope.onmessage = (event) => {
    scope.postMessage(respond(fn, event.data));
  };
}
