/**
 * The retirement calculator for the run store, validation and the legacy
 * import (docs/rebuild-plan.md section 2.6). Pure; the off-thread runner is
 * added by lib/store/retirementStore.ts.
 */

import {
  calculateRetirementAnalysis,
  validateRetirementInputs,
  type RetirementInputs,
  type RetirementResults,
} from '@/lib/calculations/retirement';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { toEngineInputs } from '@/lib/fields/binding';
import { makeGet } from '@/lib/fields/paths';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { RETIREMENT_BINDINGS } from './bindings';
import { RETIREMENT_FORM } from './form';
import { RETIREMENT_LEGACY } from './legacy';

let base: RetirementInputs | null = null;

/**
 * The engine inputs of the default profile. Every RetirementInputs leaf is
 * bound (test/lib/calculators/retirement/bindings.test.ts), so applying the
 * bindings to an empty object builds the whole shape, and the defaults stay
 * in one place: the profile. toEngineInputs copies on write, so the cached
 * object is never changed.
 */
function retirementEngineBase(): RetirementInputs {
  base ??= toEngineInputs(RETIREMENT_BINDINGS, {} as RetirementInputs, makeGet(getDefaultFinancialProfile()));
  return base;
}

export const RETIREMENT_CALCULATOR: CalculatorDefinition<RetirementInputs, RetirementResults> = {
  id: 'retirement',
  form: RETIREMENT_FORM,
  bindings: RETIREMENT_BINDINGS,
  engineBase: retirementEngineBase,
  validate: validateRetirementInputs,
  calculate: calculateRetirementAnalysis,
  debounceMs: 300,
  legacy: RETIREMENT_LEGACY,
};
