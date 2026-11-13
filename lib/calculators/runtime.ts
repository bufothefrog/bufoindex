/**
 * The two pure steps between the profile and a calculator run: engine inputs
 * from the profile (through each calculator's bindings) and
 * validation of what the calculator page shows. No React, no storage.
 */

import { engineErrorsToFields, toEngineInputs } from '@/lib/fields/binding';
import { makeGet } from '@/lib/fields/paths';
import { screensFor, validateFields } from '@/lib/fields/runtime';
import type { FieldErrors } from '@/lib/fields/types';
import { withDerivedValues } from '@/lib/profile/derived';
import type { FinancialProfile } from '@/lib/profile/types';
import type { CalculatorDefinition } from './types';

/**
 * The engine inputs `def` computes from the profile `values`, with every
 * unanswered derived leaf filled first (withDerivedValues). This and
 * prepareRun are the only callers of toEngineInputs on a visitor's profile,
 * so no binding reads a derived leaf's stored value
 * (test/lib/profile/derived.test.ts checks both).
 */
export function engineInputsFor<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): E {
  return toEngineInputs(def.bindings, def.engineBase(), makeGet(withDerivedValues(values)));
}

/** Engine inputs and validation errors from one pass over the profile. */
export interface PreparedRun<E> {
  inputs: E;
  /** Keyed by profile path ('calculation' for errors with no field). */
  errors: FieldErrors;
}

/**
 * The engine inputs (as engineInputsFor) and the validation errors in one
 * pass, so the run store builds the engine inputs once per submit.
 *
 * Form checks first: validateFields has no surface filter, so this validates
 * screen by screen over the form's calculator-surface screens ('both' and
 * 'calculator'), which is what the calculator page shows; intake-only
 * screens are not checked. Then def.validate on the engine inputs, mapped
 * back through engineErrorsToFields. On the same path the form message wins,
 * because it names the field and its bounds the way the input shows them;
 * engine errors fill only the paths the form left clean.
 */
export function prepareRun<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): PreparedRun<E> {
  const get = makeGet(withDerivedValues(values));
  const inputs = toEngineInputs(def.bindings, def.engineBase(), get);
  const errors: FieldErrors = {};
  const add = (more: FieldErrors) => {
    for (const [path, message] of Object.entries(more)) {
      if (!Object.prototype.hasOwnProperty.call(errors, path)) errors[path] = message;
    }
  };
  for (const screen of screensFor(def.form, get, { mode: 'all', surface: 'calculator' })) {
    add(validateFields(def.form, get, { screen }));
  }
  add(engineErrorsToFields(def.bindings, def.validate(inputs), get));
  return { inputs, errors };
}

