/**
 * Federal bracket arithmetic for the paycheck allocator.
 * Pure: no React, DOM or storage.
 *
 * - taxableIncome: yearly gross pay minus pre-tax payroll deductions (the
 *   traditional 401(k) share and HSA payroll contributions) minus the 2026
 *   standard deduction for the filing status. It may be zero or negative.
 * - federalBracketFor: the 2026 bracket that taxable income falls in. A
 *   bracket covers incomes over its lower edge and up to its upper edge, as
 *   the IRS tables word it ("over $12,400 but not over $50,400"), so an
 *   income exactly on an edge is in the lower bracket. Zero or negative
 *   income is in the lowest bracket.
 * - nearestBracketRate: the bracket rate closest to a free percent (the
 *   retirement bracket field was a free percent before); a tie goes to the
 *   lower rate.
 *
 * The tables and the standard deductions live in lib/constants/irs-2026.ts.
 */

import {
  type FilingStatusInput,
  type TaxBracket,
  getBracketsForStatus,
  getStandardDeductionForStatus,
} from '@/lib/constants/irs-2026';

/** What taxable income is computed from, all yearly dollars. */
export interface TaxableIncomeInput {
  yearlyGross: number;
  /** Pre-tax payroll deductions: the traditional 401(k) share plus HSA payroll contributions. */
  preTaxDeductions: number;
  filingStatus: FilingStatusInput;
}

/** Yearly gross pay minus pre-tax payroll deductions minus the 2026 standard deduction. */
export function taxableIncome({ yearlyGross, preTaxDeductions, filingStatus }: TaxableIncomeInput): number {
  return yearlyGross - preTaxDeductions - getStandardDeductionForStatus(filingStatus);
}

/** The 2026 bracket `income` (taxable) falls in for the filing status. */
export function federalBracketFor(income: number, filingStatus: FilingStatusInput): TaxBracket {
  const brackets = getBracketsForStatus(filingStatus);
  const found = brackets.find((bracket) => income <= bracket.max);
  // Unreachable for a finite income (the top bracket is unbounded); NaN
  // falls through to the lowest bracket.
  return found ?? brackets[0];
}

/** The rate of the bracket `income` (taxable) falls in. */
export function federalBracketRate(income: number, filingStatus: FilingStatusInput): number {
  return federalBracketFor(income, filingStatus).rate;
}

/** The marginal federal rate of a paycheck: the bracket its taxable income falls in. */
export function currentFederalBracket(input: TaxableIncomeInput): number {
  return federalBracketRate(taxableIncome(input), input.filingStatus);
}

/** The seven 2026 bracket rates, lowest first (the same for every filing status). */
export const FEDERAL_BRACKET_RATES: readonly number[] = getBracketsForStatus('single').map((bracket) => bracket.rate);

/**
 * The bracket rate nearest `value`; a tie goes to the lower rate. A value
 * that is not a finite number reads as the lowest rate.
 */
export function nearestBracketRate(value: number): number {
  if (!Number.isFinite(value)) return FEDERAL_BRACKET_RATES[0];
  let best = FEDERAL_BRACKET_RATES[0];
  for (const rate of FEDERAL_BRACKET_RATES) {
    // Compared in whole basis points so 0.17 is a true tie of 0.12 and 0.22.
    if (Math.round(Math.abs(rate - value) * 10000) < Math.round(Math.abs(best - value) * 10000)) best = rate;
  }
  return best;
}
