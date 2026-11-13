/**
 * The portfolio rebalancer's run store (createCalculatorStore). Accounts,
 * holdings, targets and settings live in the profile, so they survive a
 * reload whatever their names contain; this store holds run state only and
 * persists nothing.
 */

import type { RebalanceInputsV2, RebalanceResultV2 } from '@/lib/calculations/portfolioRebalancing';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { createCalculatorStore, type CalculatorStore } from './createCalculatorStore';

export const usePortfolioRebalancingStore: CalculatorStore<RebalanceInputsV2, RebalanceResultV2> = createCalculatorStore({
  definition: PORTFOLIO_CALCULATOR,
});
