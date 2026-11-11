/**
 * Generic CalculatorDefinition helpers (docs/rebuild-plan.md section 2.6).
 *
 * Pure: no React, no DOM, no storage.
 */

import { engineErrorsToFields, fromEngineInputs, toEngineInputs } from '@/lib/fields/binding';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import { validateFields } from '@/lib/fields/runtime';
import type { FieldErrors, Write } from '@/lib/fields/types';
import { normalizeProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import type { CalculatorDefinition } from './types';

/** The engine inputs the profile values bind to: engineBase() with every binding applied in order. */
export function engineInputsFor<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): E {
  return toEngineInputs(def.bindings, def.engineBase(), makeGet(values));
}

export interface PreparedRun<E> {
  inputs: E;
  /** Profile-path errors; empty when the inputs can run. */
  errors: FieldErrors;
}

/**
 * Engine inputs plus every error that blocks a run, built in one pass: the
 * form's field bounds and relations, then the definition's engine validation
 * mapped onto profile paths. A field's own error wins over an engine error
 * on the same path.
 */
export function prepareRun<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): PreparedRun<E> {
  const get = makeGet(values);
  const inputs = toEngineInputs(def.bindings, def.engineBase(), get);
  const formErrors = validateFields(def.form, get);
  const engineErrors = engineErrorsToFields(def.bindings, def.validate(inputs));
  return { inputs, errors: { ...engineErrors, ...formErrors } };
}

/** Profile-path errors for the values (see prepareRun). Empty object means the calculator can run. */
export function validateFor<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): FieldErrors {
  return prepareRun(def, values).errors;
}

/** The profile writes that reproduce an engine object (the reverse bindings). */
export function profileWritesFor<E, R>(def: CalculatorDefinition<E, R>, engine: E): Write[] {
  return fromEngineInputs(def.bindings, engine);
}

/**
 * A complete profile holding `engine`'s values on top of `base`, normalized
 * so it is always a valid v2 record. `base.provided` is kept as-is: this does
 * not mark anything answered.
 */
export function scenarioFrom<E, R>(
  def: CalculatorDefinition<E, R>,
  base: FinancialProfile,
  engine: E
): FinancialProfile {
  return normalizeProfile(applyWrites(base, profileWritesFor(def, engine)), base);
}
