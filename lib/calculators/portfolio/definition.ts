/**
 * The portfolio rebalancer as a CalculatorDefinition (docs/rebuild-plan.md
 * section 2.6): its form, its bindings, the engine's own checks and the
 * rebalance. The rebalance is cheap and synchronous, so it runs in-thread on
 * every edit, with no delay.
 */

import {
  rebalancePortfolioV2,
  validateRebalanceInputsV2,
  type RebalanceInputsV2,
  type RebalanceResultV2,
} from '@/lib/calculations/portfolioRebalancing';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import type { FieldErrors } from '@/lib/fields/types';
import { PORTFOLIO_BINDINGS } from './bindings';
import { PORTFOLIO_FORM } from './form';

/**
 * The engine's checks keyed by engine path ('accounts[0].deposit',
 * 'classTargets.sum'), the first message per path. The bindings map them
 * onto the fields that show them.
 */
export function validateRebalanceInputs(inputs: RebalanceInputsV2): FieldErrors {
  const errors: FieldErrors = {};
  for (const { field, message } of validateRebalanceInputsV2(inputs)) {
    if (!Object.prototype.hasOwnProperty.call(errors, field)) errors[field] = message;
  }
  return errors;
}

export const PORTFOLIO_CALCULATOR: CalculatorDefinition<RebalanceInputsV2, RebalanceResultV2> = {
  id: 'portfolio',
  form: PORTFOLIO_FORM,
  bindings: PORTFOLIO_BINDINGS,
  engineBase: () => ({
    setupMode: 'multi-shared',
    securities: [],
    accounts: [],
    holdings: [],
    classTargets: [],
    customAssetClasses: [],
    allowTaxableSelling: false,
    showPlacementAdvice: true,
    mode: 'whole',
  }),
  validate: validateRebalanceInputs,
  calculate: rebalancePortfolioV2,
  debounceMs: 0,
};
