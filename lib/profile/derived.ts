/**
 * Derived typical values: leaves whose typical value follows the visitor's
 * own answers instead of being a fixed number. Pure.
 *
 * While a derived leaf is unanswered (its path is not in profile.provided),
 * its value is computed from other leaves; the value stored for it is not
 * read. An answered leaf is never touched. A dependency that is itself
 * unanswered contributes the value the profile holds for it, which is its
 * typical value.
 *
 * withDerivedValues is the one place these rules live. Every reader that
 * turns a profile into engine inputs, dashboard figures, summaries or the
 * wizard's grey typical values goes through it (engineInputsFor and
 * prepareRun in lib/calculators/runtime.ts, useCalculatorValues, the
 * overview dashboard and the wizard), so a calculator, the dashboard and the
 * wizard cannot disagree. Reading never rewrites the stored profile: the
 * function returns a new object and the store is not written.
 *
 * The rules (change them here):
 * - cash.emergencyFundBalance = 3 x spending.necessaryMonthly;
 * - spending.targetRetirementIncome = 12 x (must-pay costs + the midpoint of
 *   the fun money range), rounded to the nearest 1,000;
 * - hsa.coverage = 'family' for married filing jointly, else 'individual';
 * - assumptions.paycheck.expectedRetirementBracket = the 2026 federal
 *   bracket the target retirement income (answered, or derived by the rule
 *   above) falls in after the standard deduction for the filing status.
 */

import { federalBracketRate, taxableIncome } from '@/lib/calculations/taxBracket';
import { getAt, setAt } from '@/lib/fields/paths';
import type { FinancialProfile, HsaCoverage } from './types';

/** Months of must-pay costs the typical emergency fund balance holds. */
const DERIVED_EMERGENCY_FUND_MONTHS = 3;

/** Typical emergency fund balance: three months of must-pay costs. */
export function derivedEmergencyFundBalance(necessaryMonthly: number): number {
  return DERIVED_EMERGENCY_FUND_MONTHS * necessaryMonthly;
}

/**
 * Typical retirement income per year: twelve months of must-pay costs plus
 * the midpoint of the fun money range, rounded to the nearest 1,000.
 */
export function derivedTargetRetirementIncome(
  necessaryMonthly: number,
  funMoneyMin: number,
  funMoneyMax: number
): number {
  const yearly = 12 * (necessaryMonthly + (funMoneyMin + funMoneyMax) / 2);
  return Math.round(yearly / 1000) * 1000;
}

/** Typical HSA coverage: family when filing jointly, otherwise individual. */
export function derivedHsaCoverage(filingStatus: FinancialProfile['person']['filingStatus']): HsaCoverage {
  return filingStatus === 'marriedJoint' ? 'family' : 'individual';
}

/**
 * Typical retirement bracket: the 2026 federal bracket a yearly retirement
 * income falls in after the standard deduction (no payroll deductions).
 */
export function derivedRetirementBracket(
  targetRetirementIncome: number,
  filingStatus: FinancialProfile['person']['filingStatus']
): number {
  return federalBracketRate(
    taxableIncome({ yearlyGross: targetRetirementIncome, preTaxDeductions: 0, filingStatus }),
    filingStatus
  );
}

/**
 * Each derived leaf and how it is computed from the profile. The rules run
 * in this order over the profile as filled so far, so the retirement
 * bracket reads the target retirement income after its own rule ran.
 */
const DERIVED_RULES: Readonly<Record<string, (profile: FinancialProfile) => unknown>> = {
  'cash.emergencyFundBalance': (p) => derivedEmergencyFundBalance(p.spending.necessaryMonthly),
  'spending.targetRetirementIncome': (p) =>
    derivedTargetRetirementIncome(p.spending.necessaryMonthly, p.spending.funMoneyMin, p.spending.funMoneyMax),
  'hsa.coverage': (p) => derivedHsaCoverage(p.person.filingStatus),
  'assumptions.paycheck.expectedRetirementBracket': (p) =>
    derivedRetirementBracket(p.spending.targetRetirementIncome, p.person.filingStatus),
};

/** The leaf paths whose typical value is derived. */
export const DERIVED_PATHS: readonly string[] = Object.keys(DERIVED_RULES);

/**
 * The profile with every unanswered derived leaf filled from the answers.
 * `answered` defaults to profile.provided; the wizard passes its own list
 * (answered on arrival, answered in this visit, or edited on a screen).
 * Returns the same object when nothing changes. Each rule reads the
 * profile as filled by the rules before it (the retirement bracket reads
 * the target retirement income, derived or answered).
 */
export function withDerivedValues(
  profile: FinancialProfile,
  answered: readonly string[] = profile.provided
): FinancialProfile {
  const done = new Set(answered);
  let out = profile;
  for (const path of DERIVED_PATHS) {
    if (done.has(path)) continue;
    const value = DERIVED_RULES[path](out);
    if (getAt(out, path) === value) continue;
    out = setAt(out, path, value);
  }
  return out;
}
