/**
 * Calculator contracts (docs/rebuild-plan.md section 2.6, as amended by
 * section 0). A CalculatorMeta is what the registry, the shell and the
 * metadata need; a CalculatorDefinition is what the run store and
 * validation need. Pure types, no runtime.
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
}
