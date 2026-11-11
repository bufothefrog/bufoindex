/**
 * Per-calculator custom renderers and intake hooks, so the wizard and the
 * calculator page reach each calculator's bespoke pieces without a shared
 * registry edit (docs/rebuild-plan.md sections 2.12 and 4). Each calculator
 * slice fills in its own file.
 */

import type { CustomRenderers } from '@/components/fields/types';
import type { CalculatorId } from '@/lib/calculators/types';
import { LEVERAGE_RENDERERS } from './leverage';
import { PAYCHECK_RENDERERS } from './paycheck';
import { PORTFOLIO_RENDERERS } from './portfolio';
import { RETIREMENT_INTAKE_PREWARM, RETIREMENT_RENDERERS } from './retirement';

export const RENDERERS: Readonly<Record<CalculatorId, CustomRenderers>> = {
  paycheck: PAYCHECK_RENDERERS,
  retirement: RETIREMENT_RENDERERS,
  portfolio: PORTFOLIO_RENDERERS,
  leverage: LEVERAGE_RENDERERS,
};

/** Every calculator's renderers in one map, for the profile intake that asks all of them. */
export const ALL_RENDERERS: CustomRenderers = Object.values(RENDERERS).reduce<CustomRenderers>(
  (all, renderers) => ({ ...all, ...renderers }),
  {}
);

/**
 * Work an intent's intake starts while the visitor is still answering: the
 * wizard calls it once, when the browser is idle, never during render and
 * never on the server.
 */
export const INTAKE_PREWARM: Readonly<Partial<Record<CalculatorId, () => void>>> = {
  retirement: RETIREMENT_INTAKE_PREWARM,
};
