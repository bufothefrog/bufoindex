/**
 * Worker side of the calculation protocol that createWorkerRunner speaks.
 *
 * A worker entry module calls exposeCalculation(calculate) once. Each
 * request carries an id that the response echoes, so the runner can match
 * answers to callers. Inputs were validated before dispatch, so the only
 * failure that crosses the boundary is a thrown error, sent as its message.
 * Only pure calculation code should run here (no React, DOM or storage), so
 * the module bundles cleanly under Turbopack.
 */

/** Posted to the worker. */
export interface CalculationRequest<E> {
  id: number;
  inputs: E;
}

/** Posted back by the worker, echoing the request id. */
export type CalculationResponse<R> =
  | { id: number; ok: true; results: R }
  | { id: number; ok: false; message: string };

/** The part of DedicatedWorkerGlobalScope this protocol uses. */
export interface CalculationScope<E, R> {
  onmessage: ((event: MessageEvent<CalculationRequest<E>>) => void) | null;
  postMessage(message: CalculationResponse<R>): void;
}

/** The message a failed run reports. */
export function calculationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Calculation failed';
}

/**
 * Answers every request with `calculate(inputs)`. `scope` defaults to the
 * worker global; tests pass a stand-in.
 */
export function exposeCalculation<E, R>(
  calculate: (inputs: E) => R,
  scope: CalculationScope<E, R> = self as unknown as CalculationScope<E, R>
): void {
  scope.onmessage = (event) => {
    const { id, inputs } = event.data;
    let response: CalculationResponse<R>;
    try {
      response = { id, ok: true, results: calculate(inputs) };
    } catch (error) {
      response = { id, ok: false, message: calculationErrorMessage(error) };
    }
    scope.postMessage(response);
  };
}
