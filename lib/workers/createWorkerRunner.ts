/**
 * Generic main-thread side of an off-thread calculation
 * (docs/rebuild-plan.md section 2.6).
 *
 * The runner creates its Worker lazily through a `create` thunk (the caller
 * keeps the literal `new Worker(new URL(...), import.meta.url)` so Turbopack
 * can bundle the worker entry), matches responses to requests by id, and
 * falls back to running `fallback` in-thread whenever there is no worker:
 * during SSR, under jsdom, when construction or dispatch throws, and after
 * the worker breaks (its stranded runs are retried in-thread). Every caller
 * shares one async code path either way.
 *
 * The worker side is lib/workers/exposeCalculation.ts.
 */

import type { FieldErrors } from '@/lib/fields/types';

/** Message posted to the worker. */
export interface WorkerRequest<I> {
  id: number;
  inputs: I;
}

/** Serializable envelope posted back; `fieldErrors` is set when the engine threw a validation error. */
export type WorkerResponse<R> =
  | { id: number; ok: true; results: R }
  | { id: number; ok: false; message: string; fieldErrors?: FieldErrors };

/**
 * A calculation failure that crossed (or could have crossed) the thread
 * boundary. `fieldErrors` carries engine-path validation errors when the
 * engine reported them.
 */
export class CalculationError extends Error {
  readonly fieldErrors?: FieldErrors;

  constructor(message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = 'CalculationError';
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}

export interface WorkerRunnerOptions<I, R> {
  /** Creates the worker. Called at most once until the worker breaks. */
  create: () => Worker;
  /** The same calculation, run in-thread when no worker is available. May throw. */
  fallback: (inputs: I) => R;
}

export interface WorkerRunner<I, R> {
  /** Runs the calculation off-thread when possible; rejects with the calculation's error. */
  run(inputs: I): Promise<R>;
  /**
   * Creates the worker ahead of the first run, when the browser is idle
   * (requestIdleCallback, or a short timeout where it is missing). Safe to
   * call repeatedly and during SSR (a no-op there).
   */
  prewarm(): void;
  /** Terminates the worker; pending runs finish in-thread. The next run creates a new one. */
  terminate(): void;
  /** True while a worker instance exists (for tests and diagnostics). */
  hasWorker(): boolean;
}

interface Pending<I, R> {
  inputs: I;
  resolve: (results: R) => void;
  reject: (error: unknown) => void;
}

function workerSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function scheduleIdle(callback: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 2000 });
  } else {
    setTimeout(callback, 1);
  }
}

export function createWorkerRunner<I, R>({ create, fallback }: WorkerRunnerOptions<I, R>): WorkerRunner<I, R> {
  let worker: Worker | null = null;
  let unavailable = false;
  let prewarmScheduled = false;
  let nextId = 0;
  const pending = new Map<number, Pending<I, R>>();

  const runInThread = (inputs: I): Promise<R> => {
    try {
      return Promise.resolve(fallback(inputs));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  /** Moves every pending run to the in-thread path. */
  const strand = () => {
    const stranded = [...pending.values()];
    pending.clear();
    for (const { inputs, resolve, reject } of stranded) runInThread(inputs).then(resolve, reject);
  };

  const retire = (broken: Worker, permanently: boolean) => {
    broken.terminate();
    if (worker === broken) worker = null;
    if (permanently) unavailable = true;
    strand();
  };

  const getWorker = (): Worker | null => {
    if (worker) return worker;
    if (unavailable || !workerSupported()) return null;

    let created: Worker;
    try {
      created = create();
    } catch {
      unavailable = true;
      return null;
    }

    created.onmessage = (event: MessageEvent<WorkerResponse<R>>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.results);
      else entry.reject(new CalculationError(response.message, response.fieldErrors));
    };
    // The worker itself broke (its script failed to load, or it crashed):
    // stop using workers and finish the in-flight runs in-thread, so only a
    // genuine calculation error reaches the caller.
    created.onerror = () => retire(created, true);

    worker = created;
    return created;
  };

  return {
    run(inputs) {
      const active = getWorker();
      if (!active) return runInThread(inputs);
      const id = ++nextId;
      return new Promise<R>((resolve, reject) => {
        pending.set(id, { inputs, resolve, reject });
        const request: WorkerRequest<I> = { id, inputs };
        try {
          active.postMessage(request);
        } catch {
          // Dispatch failed (e.g. the payload could not be cloned): the worker
          // will never answer this run, so finish it in-thread and stop using it.
          pending.delete(id);
          unavailable = true;
          runInThread(inputs).then(resolve, reject);
        }
      });
    },

    prewarm() {
      if (prewarmScheduled || worker || unavailable || !workerSupported()) return;
      prewarmScheduled = true;
      scheduleIdle(() => {
        prewarmScheduled = false;
        getWorker();
      });
    },

    terminate() {
      if (worker) retire(worker, false);
    },

    hasWorker() {
      return worker !== null;
    },
  };
}
