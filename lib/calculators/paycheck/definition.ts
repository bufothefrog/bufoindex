/**
 * The paycheck allocator for the run store, validation and the legacy
 * import (docs/rebuild-plan.md section 2.6). The allocation is cheap, so it
 * runs in-thread, 150 ms after the last edit; the old store's artificial
 * 300 ms delay is gone (audit H4). Pure.
 */

import { calculateOptimalAllocation, getDefaultProfile } from '@/lib/calculations/core';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import type { FieldErrors } from '@/lib/fields/types';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { PAYCHECK_BINDINGS } from './bindings';
import { PAYCHECK_FORM } from './form';
import { PAYCHECK_LEGACY } from './legacy';

let base: PaycheckProfile | null = null;

/**
 * The allocator's own defaults, for the leaves no binding sets (the fixed
 * federal bracket, withholding, year-to-date amounts, other benefits,
 * isPeakEarnings; see PAYCHECK_ENGINE_ONLY). Its metadata is fixed, so equal
 * profiles give equal engine inputs (getDefaultProfile stamps Date.now()).
 * toEngineInputs copies on write, so the cached object is never changed.
 */
function paycheckEngineBase(): PaycheckProfile {
  base ??= { ...getDefaultProfile(), lastUpdated: 0, source: 'user_input' };
  return base;
}

/**
 * No engine-level checks: validateProfile stays unwired (O18); its rules
 * live on as the form's field bounds and relations.
 */
function noEngineChecks(): FieldErrors {
  return {};
}

export const PAYCHECK_CALCULATOR: CalculatorDefinition<PaycheckProfile, AllocationResult> = {
  id: 'paycheck',
  form: PAYCHECK_FORM,
  bindings: PAYCHECK_BINDINGS,
  engineBase: paycheckEngineBase,
  validate: noEngineChecks,
  calculate: calculateOptimalAllocation,
  debounceMs: 150,
  legacy: PAYCHECK_LEGACY,
};
