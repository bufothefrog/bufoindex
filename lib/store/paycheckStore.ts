/**
 * The paycheck allocator's run store (createCalculatorStore). Inputs live in
 * the profile; this store holds run state only and persists nothing.
 */

import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { createCalculatorStore, type CalculatorStore } from './createCalculatorStore';

export const usePaycheckStore: CalculatorStore<PaycheckProfile, AllocationResult> = createCalculatorStore({
  definition: PAYCHECK_CALCULATOR,
  devtoolsName: 'calculator:paycheck',
});
