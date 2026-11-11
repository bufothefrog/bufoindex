/**
 * Per-calculator custom renderers (docs/rebuild-plan.md section 2.12). The
 * wizard and the calculator pages look up a form's renderers here; the
 * profile intent merges all four (PROFILE_RENDERERS).
 */

import type { CustomRenderers } from '@/components/fields/types';
import type { CalculatorId } from '@/lib/calculators/types';
import { LEVERAGE_RENDERERS } from './leverage';
import { PAYCHECK_RENDERERS } from './paycheck';
import { PORTFOLIO_RENDERERS } from './portfolio';
import { RETIREMENT_RENDERERS } from './retirement';

export { LEVERAGE_RENDERERS, PAYCHECK_RENDERERS, PORTFOLIO_RENDERERS, RETIREMENT_RENDERERS };

export const RENDERERS: Readonly<Record<CalculatorId, CustomRenderers>> = {
  paycheck: PAYCHECK_RENDERERS,
  retirement: RETIREMENT_RENDERERS,
  portfolio: PORTFOLIO_RENDERERS,
  leverage: LEVERAGE_RENDERERS,
};

/** Every calculator's renderers, for the profile intake. */
export const PROFILE_RENDERERS: CustomRenderers = {
  ...PAYCHECK_RENDERERS,
  ...RETIREMENT_RENDERERS,
  ...PORTFOLIO_RENDERERS,
  ...LEVERAGE_RENDERERS,
};

/** The renderers a wizard flow needs ('core' uses none). */
export function renderersForFlow(flow: 'core' | 'profile' | CalculatorId): CustomRenderers {
  if (flow === 'core') return {};
  if (flow === 'profile') return PROFILE_RENDERERS;
  return RENDERERS[flow];
}
