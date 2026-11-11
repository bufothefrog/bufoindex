/**
 * One run store per calculator (docs/rebuild-plan.md section 2.6).
 *
 * The store holds run state only: inputs live in the shared profile
 * (lib/store/profileStore.ts). The page calls `submit(values)` whenever the
 * profile values change, and the store applies one policy app-wide:
 *
 * 1. Validate first (prepareRun): field bounds, relations, engine validation.
 *    On errors nothing runs; the last results stay visible with
 *    `stale: true` (O17) and any queued or in-flight run is dropped.
 * 2. Memoize on `stableKey(inputs)`: inputs equal to the ones behind the
 *    current results (in any key order) skip the run.
 * 3. Debounce by `definition.debounceMs` (0 runs now; `{ immediate: true }`
 *    skips the wait).
 * 4. Newest run wins by sequence id: a superseded run's result or failure is
 *    dropped.
 * 5. A thrown calculation error keeps the last results with `stale: true`
 *    and reports the error on its field (when the engine says which) or on
 *    'calculation'.
 *
 * `hasCalculatedOnce` turns true only after a successful run. Without a
 * runner the definition's calculate runs synchronously; with one (the
 * retirement worker runner) runs are async.
 *
 * Owner decision O6 dropped legacy share links, so there is no in-memory
 * scenario state here.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { prepareRun } from '@/lib/calculators/runtime';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { engineErrorsToFields, stableKey } from '@/lib/fields/binding';
import { CALCULATION_ERROR_KEY } from '@/lib/fields/runtime';
import type { FieldErrors } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';

export interface SubmitOptions {
  /** Run without waiting for the debounce. */
  immediate?: boolean;
}

export interface CalculatorRunState<E, R> {
  /** Engine inputs from the latest submit (valid or not). */
  inputs: E | null;
  results: R | null;
  /** The inputs that produced `results`; differs from `inputs` while stale or recalculating. */
  resultsInputs: E | null;
  /** Profile-path errors from the latest submit or run. */
  errors: FieldErrors;
  /** True when results are shown but no longer match the inputs (invalid inputs or a failed run). */
  stale: boolean;
  /** True while a run is queued (debounce) or in flight. */
  isCalculating: boolean;
  hasCalculatedOnce: boolean;
  /** stableKey of resultsInputs. */
  resultsKey: string | null;
  /** validate -> memo -> debounce -> run. */
  submit(values: FinancialProfile, opts?: SubmitOptions): void;
  /** Runs the queued submit now; resolves when the current run settles. */
  flush(): Promise<void>;
  /** Drops queued and in-flight runs and clears all run state. */
  reset(): void;
}

export type CalculatorStore<E, R> = UseBoundStore<StoreApi<CalculatorRunState<E, R>>>;

export interface CreateCalculatorStoreOptions<E, R> {
  definition: CalculatorDefinition<E, R>;
  /** Async runner (e.g. a worker runner's run); defaults to definition.calculate in-thread. */
  runner?: (inputs: E) => Promise<R>;
  /** Redux devtools name; devtools are enabled only in development. */
  devtoolsName?: string;
}

type RunData<E, R> = Pick<
  CalculatorRunState<E, R>,
  'inputs' | 'results' | 'resultsInputs' | 'errors' | 'stale' | 'isCalculating' | 'hasCalculatedOnce' | 'resultsKey'
>;

function initialRunData<E, R>(): RunData<E, R> {
  return {
    inputs: null,
    results: null,
    resultsInputs: null,
    errors: {},
    stale: false,
    isCalculating: false,
    hasCalculatedOnce: false,
    resultsKey: null,
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

/**
 * Profile-path errors for a thrown calculation error: engine validation
 * errors (an error carrying a non-empty `fieldErrors` record) map through the
 * bindings; anything else lands on 'calculation'.
 */
export function runErrorsFrom<E, R>(definition: CalculatorDefinition<E, R>, error: unknown): FieldErrors {
  if (typeof error === 'object' && error !== null && 'fieldErrors' in error) {
    const fieldErrors = (error as { fieldErrors: unknown }).fieldErrors;
    if (isStringRecord(fieldErrors) && Object.keys(fieldErrors).length > 0) {
      return engineErrorsToFields(definition.bindings, fieldErrors);
    }
  }
  const message = error instanceof Error && error.message ? error.message : 'Calculation failed';
  return { [CALCULATION_ERROR_KEY]: message };
}

type Outcome<R> = { ok: true; results: R } | { ok: false; error: unknown };

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
        let queued: { inputs: E; key: string } | null = null;
        /** Key of the run queued or in flight; null when idle. */
        let pendingKey: string | null = null;
        let inFlight: Promise<void> = Promise.resolve();

        const cancelQueued = () => {
          if (timer !== null) clearTimeout(timer);
          timer = null;
          queued = null;
        };

        /** Drops whatever is queued or in flight. */
        const supersede = () => {
          cancelQueued();
          seq += 1;
          pendingKey = null;
          inFlight = Promise.resolve();
        };

        const execute = (inputs: E, key: string): Promise<void> => {
          cancelQueued();
          const runId = ++seq;
          pendingKey = key;

          const finish = (outcome: Outcome<R>) => {
            if (runId !== seq) return; // superseded
            pendingKey = null;
            if (outcome.ok) {
              set({
                results: outcome.results,
                resultsInputs: inputs,
                resultsKey: key,
                errors: {},
                stale: false,
                isCalculating: false,
                hasCalculatedOnce: true,
              });
            } else {
              set((state) => ({
                errors: runErrorsFrom(definition, outcome.error),
                stale: state.results !== null,
                isCalculating: false,
              }));
            }
          };

          if (!runner) {
            try {
              finish({ ok: true, results: definition.calculate(inputs) });
            } catch (error) {
              finish({ ok: false, error });
            }
            inFlight = Promise.resolve();
            return inFlight;
          }

          let promise: Promise<R>;
          try {
            promise = runner(inputs);
          } catch (error) {
            promise = Promise.reject(error);
          }
          const settled = promise.then(
            (results) => finish({ ok: true, results }),
            (error: unknown) => finish({ ok: false, error })
          );
          inFlight = settled;
          return settled;
        };

        return {
          ...initialRunData<E, R>(),

          submit(values, opts = {}) {
            const { inputs, errors } = prepareRun(definition, values);

            if (Object.keys(errors).length > 0) {
              supersede();
              set((state) => ({ inputs, errors, stale: state.results !== null, isCalculating: false }));
              return;
            }

            const key = stableKey(inputs);
            const state = get();

            if (state.results !== null && key === state.resultsKey) {
              if (pendingKey !== null) supersede();
              set({ inputs, errors: {}, stale: false, isCalculating: false });
              return;
            }

            if (key === pendingKey) {
              // Already queued or running for these inputs: keep its timer.
              set({ inputs, errors: {} });
              if (opts.immediate && queued) void execute(queued.inputs, queued.key);
              return;
            }

            supersede();
            pendingKey = key;
            set({ inputs, errors: {}, stale: false, isCalculating: true });

            const delay = opts.immediate ? 0 : definition.debounceMs;
            if (delay <= 0) {
              void execute(inputs, key);
              return;
            }
            queued = { inputs, key };
            timer = setTimeout(() => {
              timer = null;
              if (queued) void execute(queued.inputs, queued.key);
            }, delay);
          },

          flush() {
            if (queued) return execute(queued.inputs, queued.key);
            return inFlight;
          },

          reset() {
            supersede();
            set(initialRunData<E, R>());
          },
        };
      },
      {
        name: devtoolsName ?? `CalculatorStore:${definition.id}`,
        enabled: Boolean(devtoolsName) && process.env.NODE_ENV === 'development',
      }
    )
  );
}
