/**
 * One run store per calculator (plan section 2.6). Inputs live in the profile
 * store; this store holds run state only and persists nothing.
 *
 * submit(values) applies one policy everywhere:
 *
 * 1. Validate (prepareRun: the form's calculator screens, then the engine's
 *    own checks). On errors nothing runs: the last results stay on display
 *    with stale: true, and a pending or in-flight run is dropped, since it
 *    was for older values.
 * 2. Memo: when stableKey(inputs) equals resultsKey the results already
 *    match, so nothing runs (key order does not matter).
 * 3. Debounce by definition.debounceMs; 0, or { immediate: true }, dispatches
 *    synchronously. A new submit restarts the delay.
 * 4. Run: without a runner, definition.calculate is called in-thread and the
 *    results land before submit returns; a runner (createWorkerRunner) is
 *    awaited. The newest run wins by sequence id, so a run that settles after
 *    a newer submit is dropped.
 * 5. A successful run sets inputs, results and resultsKey together (results
 *    always render from the inputs that produced them), clears errors and
 *    stale, and sets hasCalculatedOnce. A failed run keeps the last results,
 *    sets stale, and reports the message under 'calculation'.
 *
 * stale is true from an error until a run (or a memo hit) brings the results
 * back in line with valid values; a valid submit clears errors at once but
 * leaves stale as it is until then. isCalculating is true while a dispatched
 * run is in flight, not during the debounce.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { prepareRun } from '@/lib/calculators/runtime';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { stableKey } from '@/lib/fields/binding';
import type { FieldErrors } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import { calculationErrorMessage } from '@/lib/workers/exposeCalculation';

export interface SubmitOptions {
  /** Skip the debounce and dispatch now. */
  immediate?: boolean;
}

export interface CalculatorRunState<E, R> {
  /** The engine inputs that produced `results`; null until the first run. */
  inputs: E | null;
  results: R | null;
  /** Profile path -> message; 'calculation' for a failed run or an unmapped engine error. */
  errors: FieldErrors;
  /** True while the results on display do not reflect the latest valid values because of an error. */
  stale: boolean;
  isCalculating: boolean;
  hasCalculatedOnce: boolean;
  /** stableKey(inputs); the memo key. */
  resultsKey: string | null;
  /** Validate, memo, debounce, run. */
  submit: (values: FinancialProfile, opts?: SubmitOptions) => void;
  /** Dispatches a debounced submit now; resolves once the latest run has settled. Never rejects. */
  flush: () => Promise<void>;
  /** Back to the initial state; a pending or in-flight run is dropped. */
  reset: () => void;
}

export type CalculatorStore<E, R> = UseBoundStore<StoreApi<CalculatorRunState<E, R>>>;

export interface CreateCalculatorStoreOptions<E, R> {
  definition: CalculatorDefinition<E, R>;
  /** Runs the calculation asynchronously (e.g. off-thread); defaults to definition.calculate in-thread. */
  runner?: (inputs: E) => Promise<R>;
  /** Connects the store to Redux DevTools under this name. */
  devtoolsName?: string;
}

type RunData<E, R> = Omit<CalculatorRunState<E, R>, 'submit' | 'flush' | 'reset'>;

function initialRunData<E, R>(): RunData<E, R> {
  return {
    inputs: null,
    results: null,
    errors: {},
    stale: false,
    isCalculating: false,
    hasCalculatedOnce: false,
    resultsKey: null,
  };
}

const NO_ERRORS: FieldErrors = Object.freeze({}) as FieldErrors;

interface Job<E> {
  inputs: E;
  key: string;
}

export function createCalculatorStore<E, R>({
  definition,
  runner,
  devtoolsName,
}: CreateCalculatorStoreOptions<E, R>): CalculatorStore<E, R> {
  return create<CalculatorRunState<E, R>>()(
    devtools(
      (set, get) => {
        let seq = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let queued: Job<E> | null = null;
        let inFlight: (Job<E> & { done: Promise<void> }) | null = null;

        const cancelQueued = (): void => {
          if (timer !== null) clearTimeout(timer);
          timer = null;
          queued = null;
        };

        /** Drops whatever is queued or in flight; their results will never land. */
        const abandon = (): void => {
          cancelQueued();
          seq += 1;
          inFlight = null;
        };

        const succeed = (job: Job<E>, results: R): void =>
          set({
            inputs: job.inputs,
            results,
            resultsKey: job.key,
            errors: NO_ERRORS,
            stale: false,
            isCalculating: false,
            hasCalculatedOnce: true,
          });

        const fail = (error: unknown): void =>
          set({ errors: { calculation: calculationErrorMessage(error) }, stale: true, isCalculating: false });

        const dispatch = (job: Job<E>): void => {
          const id = ++seq;
          if (!runner) {
            inFlight = null;
            let results: R;
            try {
              results = definition.calculate(job.inputs);
            } catch (error) {
              fail(error);
              return;
            }
            succeed(job, results);
            return;
          }
          set({ isCalculating: true });
          const done = runner(job.inputs).then(
            (results) => {
              if (id !== seq) return;
              inFlight = null;
              succeed(job, results);
            },
            (error: unknown) => {
              if (id !== seq) return;
              inFlight = null;
              fail(error);
            }
          );
          inFlight = { ...job, done };
        };

        const dispatchQueued = (): void => {
          const job = queued;
          cancelQueued();
          if (job) dispatch(job);
        };

        return {
          ...initialRunData<E, R>(),

          submit: (values, opts = {}) => {
            const { inputs, errors } = prepareRun(definition, values);
            if (Object.keys(errors).length > 0) {
              abandon();
              set({ errors, stale: true, isCalculating: false });
              return;
            }

            const key = stableKey(inputs);
            const state = get();
            if (state.results !== null && key === state.resultsKey) {
              abandon();
              set({ errors: NO_ERRORS, stale: false, isCalculating: false });
              return;
            }
            if (Object.keys(state.errors).length > 0) set({ errors: NO_ERRORS });
            if (inFlight?.key === key) {
              // The run already under way is for these very inputs.
              cancelQueued();
              return;
            }

            queued = { inputs, key };
            if (opts.immediate || definition.debounceMs <= 0) {
              dispatchQueued();
              return;
            }
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(dispatchQueued, definition.debounceMs);
          },

          flush: () => {
            dispatchQueued();
            return inFlight ? inFlight.done : Promise.resolve();
          },

          reset: () => {
            abandon();
            set(initialRunData<E, R>());
          },
        };
      },
      { name: devtoolsName ?? `calculator:${definition.id}`, enabled: devtoolsName !== undefined }
    )
  );
}
