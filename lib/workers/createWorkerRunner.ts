/**
 * Off-thread runner for a calculation, generalized from the retirement
 * store's plumbing. The result is the `runner` a calculator passes to
 * createCalculatorStore.
 *
 * - The worker is created lazily on the first run (or on prewarm) and reused.
 * - Where there is no Worker (the server, jsdom) or construction throws, runs
 *   go straight to `fallback` in-thread, wrapped in a promise, so callers
 *   share one async path.
 * - If the worker breaks (onerror, e.g. its script failed to load; a
 *   messageerror; or a message that is not a CalculationResponse), it is
 *   retired for good and the runs it still owed are retried in-thread.
 * - A failure response without a message rejects with 'Calculation failed'.
 * - If posting a request throws (e.g. inputs that cannot be cloned), that run
 *   goes in-thread and the worker is no longer used.
 *
 * `create` is a thunk because the literal
 * `new Worker(new URL('../workers/<name>.ts', import.meta.url))` has to stay
 * in the caller's module for Turbopack to bundle the worker (plan risk 8).
 */

import type { CalculationRequest, CalculationResponse } from './exposeCalculation';

export interface WorkerRunnerOptions<E, R> {
  /** Constructs the worker; called at most once until dispose(). */
  create: () => Worker;
  /** The same calculation in-thread; used without a worker and after it breaks. */
  fallback: (inputs: E) => R;
}

export interface WorkerRunner<E, R> {
  (inputs: E): Promise<R>;
  /** Creates the worker ahead of the first run. Safe to call repeatedly, on the server and without Worker. */
  prewarm(): void;
  /**
   * Terminates the worker and forgets that it was unavailable, so the next
   * run starts fresh. Runs still owed are finished in-thread. For tests.
   */
  dispose(): void;
}

interface Pending<E, R> {
  /** Kept so a broken worker's runs can be retried in-thread. */
  inputs: E;
  resolve: (results: R) => void;
  reject: (error: unknown) => void;
}

/** The message a failed run reports when the worker sent none. */
const FAILED = 'Calculation failed';

/** A response in the shape exposeCalculation posts (id a number, ok a boolean). */
function isResponse(data: unknown): data is { id: number; ok: boolean; results?: unknown; message?: unknown } {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return typeof record.id === 'number' && typeof record.ok === 'boolean';
}

export function createWorkerRunner<E, R>({ create, fallback }: WorkerRunnerOptions<E, R>): WorkerRunner<E, R> {
  let worker: Worker | null = null;
  let unavailable = false;
  let nextId = 0;
  const pending = new Map<number, Pending<E, R>>();

  const runInThread = (inputs: E): Promise<R> => {
    try {
      return Promise.resolve(fallback(inputs));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  /** Detaches the worker and finishes everything it still owed in-thread. */
  const retire = (target: Worker): void => {
    const stranded = [...pending.values()];
    pending.clear();
    target.terminate();
    if (worker === target) worker = null;
    for (const { inputs, resolve, reject } of stranded) runInThread(inputs).then(resolve, reject);
  };

  const getWorker = (): Worker | null => {
    if (unavailable || typeof window === 'undefined' || typeof Worker === 'undefined') return null;
    if (worker) return worker;

    let created: Worker;
    try {
      created = create();
    } catch {
      unavailable = true;
      return null;
    }
    const broken = (): void => {
      unavailable = true;
      retire(created);
    };
    created.onmessage = (event: MessageEvent<CalculationResponse<R>>) => {
      const response: unknown = event.data;
      if (!isResponse(response)) {
        // Not this protocol: the worker cannot be trusted to answer what it owes.
        broken();
        return;
      }
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id);
      if (response.ok) request.resolve(response.results as R);
      else request.reject(new Error(typeof response.message === 'string' && response.message ? response.message : FAILED));
    };
    created.onmessageerror = broken;
    created.onerror = broken;
    worker = created;
    return created;
  };

  const run = (inputs: E): Promise<R> => {
    const target = getWorker();
    if (!target) return runInThread(inputs);
    const id = ++nextId;
    return new Promise<R>((resolve, reject) => {
      pending.set(id, { inputs, resolve, reject });
      const request: CalculationRequest<E> = { id, inputs };
      try {
        target.postMessage(request);
      } catch {
        // The worker will never answer this one: run it here and stop using it.
        pending.delete(id);
        unavailable = true;
        runInThread(inputs).then(resolve, reject);
      }
    });
  };

  return Object.assign(run, {
    prewarm: (): void => {
      getWorker();
    },
    dispose: (): void => {
      if (worker) retire(worker);
      unavailable = false;
    },
  });
}
