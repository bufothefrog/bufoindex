/**
 * Calculator contracts (docs/rebuild-plan.md section 2.6, as amended by
 * section 0). A CalculatorMeta is what the registry, the shell and the
 * metadata need; a CalculatorDefinition is what the run store, validation
 * and the legacy storage import need. Pure types, no runtime.
 */

import type { DisclaimerFragment } from '@/lib/constants/disclaimers';
import type { Binding } from '@/lib/fields/binding';
import type { FieldErrors, FormSpec } from '@/lib/fields/types';

export type CalculatorId = 'paycheck' | 'retirement' | 'portfolio' | 'leverage';

export interface CalculatorMeta {
  id: CalculatorId;
  title: string;
  shortTitle: string;
  path: string;
  description: string;
  metaDescription: string;
  /** Footer fragments, composed with composeDisclaimer. */
  disclaimer: readonly DisclaimerFragment[];
  liveResultsLabel: string;
  /**
   * 'inflation-input': today's dollars use the calculator's own inflation
   * input; 'fixed': they use DISPLAY_INFLATION_ASSUMPTION; 'none': no toggle.
   */
  dollarDisplay: 'inflation-input' | 'fixed' | 'none';
}

/** The one-time import of a calculator's old localStorage key (O7). */
export interface LegacyStorage<E> {
  /** The key the old hand-written store persisted under. */
  storageKey: string;
  /**
   * Engine inputs from the parsed JSON stored under storageKey (the whole
   * zustand persist envelope, `{ state, version }`), or null when the payload
   * is not one this calculator wrote.
   */
  readStorage(raw: unknown): E | null;
  /** The old store's frozen defaults; only values that differ are imported. */
  storageDefaults(): E;
}

/** What the one-time import reads of a calculator: its old storage and its bindings. */
export interface LegacyImport<E> {
  legacy: LegacyStorage<E>;
  bindings: readonly Binding<E>[];
}

export interface CalculatorDefinition<E, R> {
  id: CalculatorId;
  form: FormSpec;
  bindings: readonly Binding<E>[];
  /** Engine inputs before any binding is applied; unbound paths keep these. */
  engineBase: () => E;
  /** Engine-level checks, keyed by engine path. */
  validate: (inputs: E) => FieldErrors;
  /** Pure and deterministic, so equal inputs may reuse results. */
  calculate: (inputs: E) => R;
  /**
   * Delay between a submit and the run. 0 dispatches synchronously on
   * submit. Phase 3 values: retirement 300 (off-thread), paycheck 150,
   * portfolio 0, leverage 250 (audit H3).
   */
  debounceMs: number;
  /** Retirement and paycheck only (plan section 0.1 item 5). */
  legacy?: LegacyStorage<E>;
}
