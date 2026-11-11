/**
 * The per-paycheck breakdown behind the results' gross-to-take-home summary:
 * the employee 401(k) deferrals, the taxes and other deductions left as a
 * residual of the gross and take-home pay the visitor typed, the effective
 * rate of that residual, and the employer match on top of pay. Pure.
 */

import type { PaycheckProfile } from '../types';

export interface PaycheckSummary {
  /** Pre-tax employee 401(k) deferral per paycheck (0 without a plan). */
  traditional: number;
  /** After-tax (Roth) employee 401(k) deferral per paycheck (0 without a plan). */
  roth: number;
  /** Taxes and other deductions per paycheck, never below 0. */
  residualTaxes: number;
  /**
   * residualTaxes over taxable pay (gross less the pre-tax deferral), as a
   * fraction; 0 when there is no taxable pay.
   */
  effectiveRate: number;
  /** Employer match per paycheck, paid on top of pay. */
  match: number;
}

export function paycheckSummary(inputs: PaycheckProfile): PaycheckSummary {
  const { grossPaycheck, netPaycheck } = inputs.income;
  const plan = inputs.benefits.employer401k;

  const traditional = plan.available ? grossPaycheck * plan.traditionalContribution : 0;
  const roth = plan.available ? grossPaycheck * plan.rothContribution : 0;

  // The match is on both deferrals up to the match limit, and is not taken
  // out of pay.
  const match = plan.available
    ? Math.min(grossPaycheck * (plan.traditionalContribution + plan.rothContribution), grossPaycheck * plan.matchLimit) *
      plan.matchPercent
    : 0;

  // The take-home the visitor typed already has every employee deferral
  // withheld, the pre-tax traditional one and the after-tax Roth one, so both
  // come out of the residual. Otherwise the Roth deferral is counted twice
  // and the rate silently absorbs it.
  const residualTaxes = Math.max(0, grossPaycheck - traditional - roth - netPaycheck);

  const taxable = grossPaycheck - traditional;
  const effectiveRate = taxable > 0 ? residualTaxes / taxable : 0;

  return { traditional, roth, residualTaxes, effectiveRate, match };
}
