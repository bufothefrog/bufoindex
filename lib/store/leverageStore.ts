/**
 * The leverage comparison's run store (createCalculatorStore). Inputs live in
 * the profile, so the leverage ratio and every override survive a reload;
 * this store holds run state only and persists nothing.
 */

import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import type { DcaComparisonInputs, DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { createCalculatorStore, type CalculatorStore } from './createCalculatorStore';

export const useLeverageStore: CalculatorStore<DcaComparisonInputs, DcaComparisonResult> = createCalculatorStore({
  definition: LEVERAGE_CALCULATOR,
  devtoolsName: 'leverage-comparison',
});
