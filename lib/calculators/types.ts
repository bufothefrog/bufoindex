/**
 * Calculator contracts (docs/rebuild-plan.md section 2.6).
 *
 * A CalculatorDefinition ties a calculator's FormSpec (the profile fields it
 * asks), its Bindings (how those profile fields become engine inputs) and its
 * pure engine together. The run store factory (lib/store/createCalculatorStore)
 * and the calculator shell consume it; nothing here is calculator-specific.
 *
 * Owner decision O6 dropped legacy share links, so a definition carries no
 * hash decoder; O7 discards the old calculator storage, whose keys live in
 * lib/store/legacyImport.ts.
 *
 * Pure types only: no React, no DOM, no storage.
 */

import type { DisclaimerFragment } from '@/lib/constants/disclaimers';
import type { Binding } from '@/lib/fields/binding';
import type { FieldErrors, FormSpec } from '@/lib/fields/types';

export type CalculatorId = 'paycheck' | 'retirement' | 'portfolio' | 'leverage';

export const CALCULATOR_IDS: readonly CalculatorId[] = ['paycheck', 'retirement', 'portfolio', 'leverage'];

export function isCalculatorId(value: unknown): value is CalculatorId {
  return typeof value === 'string' && (CALCULATOR_IDS as readonly string[]).includes(value);
}

/** Registry entry (lib/calculators/registry.ts, s3): copy and routing for one calculator. */
export interface CalculatorMeta {
  id: CalculatorId;
  title: string;
  shortTitle: string;
  path: string;
  description: string;
  metaDescription: string;
  disclaimer: readonly DisclaimerFragment[];
  liveResultsLabel: string;
  /** How the results page shows dollars: a today's/future toggle driven by an inflation input, fixed, or no toggle. */
  dollarDisplay: 'inflation-input' | 'fixed' | 'none';
}

/**
 * Everything the run store needs to turn profile values into results.
 *
 * - `form` lists the profile fields the calculator reads; its field bounds and
 *   relations are validated before every run.
 * - `bindings` + `engineBase` build the engine inputs (lib/fields/binding).
 * - `validate` checks the engine inputs and returns errors keyed by engine
 *   path; the runtime maps them back onto profile paths.
 * - `calculate` is the pure, deterministic engine call.
 * - `debounceMs` is the live-recalculation delay (O8; leverage 275 ms per the
 *   production audit, portfolio 0).
 */
export interface CalculatorDefinition<E, R> {
  id: CalculatorId;
  form: FormSpec;
  bindings: readonly Binding<E>[];
  engineBase: () => E;
  /** Engine-path errors; an empty object means the inputs can run. */
  validate: (inputs: E) => FieldErrors;
  /** Pure and deterministic. May throw; a thrown error keeps the last results, marked stale. */
  calculate: (inputs: E) => R;
  debounceMs: number;
}
