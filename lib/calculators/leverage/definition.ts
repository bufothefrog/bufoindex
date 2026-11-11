/**
 * The leverage comparison as a CalculatorDefinition (docs/rebuild-plan.md
 * section 2.6): its form, its bindings, the engine's own check and the
 * simulation. The simulation is cheap (tens of milliseconds), so it runs
 * in-thread, 250 ms after the last edit (audit H3).
 */

import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  simulateDcaComparison,
  type DcaComparisonInputs,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import type { FieldErrors } from '@/lib/fields/types';
import { LEVERAGE_BINDINGS } from './bindings';
import { LEVERAGE_FORM } from './form';

/**
 * Engine-level checks, keyed by engine path. The form checks each field's
 * bounds; this adds the one rule that spans two inputs: something has to be
 * invested. Its binding is derived, so the message shows with the results
 * (under 'calculation') whether the contribution is an override or derived.
 */
export function validateDcaComparisonInputs(inputs: DcaComparisonInputs): FieldErrors {
  if (inputs.monthlyContribution <= 0 && inputs.startingBalance <= 0) {
    return { monthlyContribution: 'Enter a monthly contribution or a starting balance.' };
  }
  return {};
}

export const LEVERAGE_CALCULATOR: CalculatorDefinition<DcaComparisonInputs, DcaComparisonResult> = {
  id: 'leverage',
  form: LEVERAGE_FORM,
  bindings: LEVERAGE_BINDINGS,
  engineBase: () => ({ ...DEFAULT_DCA_COMPARISON_INPUTS }),
  validate: validateDcaComparisonInputs,
  calculate: simulateDcaComparison,
  debounceMs: 250,
};
