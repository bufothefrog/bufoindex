/**
 * The Social Security claiming-age control of the retirement calculator page:
 * three choices (early, full, late) and the yearly benefit at each of them.
 * Pure.
 *
 * The claiming age is a calculator-only question (the 'claiming' screen in
 * ./form.ts, surface 'calculator'): it compares one run against another and
 * is not asked by the profile form or any intake. The benefit at each age
 * comes from the engine's own claiming-age adjustment
 * (calculateSocialSecurityBenefit), never a copy of its formula.
 */

import { calculateSocialSecurityBenefit } from '@/lib/calculations/retirement';
import { RetirementConstants } from '@/lib/constants/retirement';
import { isFiniteNumber } from '@/lib/fields/runtime';

export const SOCIAL_SECURITY_AGE_PATH = 'retirementIncome.socialSecurityAge';

export interface ClaimingAgeChoice {
  age: number;
  /** "62 (early)": what the control and the table show. */
  label: string;
}

/** The three claiming ages the page offers, earliest first. */
export const CLAIMING_AGE_CHOICES: readonly ClaimingAgeChoice[] = [
  { age: RetirementConstants.SS_MIN_AGE, label: `${RetirementConstants.SS_MIN_AGE} (early)` },
  { age: RetirementConstants.SS_FULL_RETIREMENT_AGE, label: `${RetirementConstants.SS_FULL_RETIREMENT_AGE} (full)` },
  { age: RetirementConstants.SS_MAX_AGE, label: `${RetirementConstants.SS_MAX_AGE} (late)` },
];

/**
 * The offered claiming age nearest to a stored one, for display only: a
 * stored 65 shows as 67, a stored 63 as 62. A tie (64.5) goes to the earlier
 * age. A value that is not a number shows as the full retirement age. The
 * stored value is not rewritten until the visitor picks a choice.
 */
export function nearestClaimingAge(stored: unknown): number {
  if (!isFiniteNumber(stored)) return RetirementConstants.SS_FULL_RETIREMENT_AGE;
  let nearest = CLAIMING_AGE_CHOICES[0].age;
  for (const { age } of CLAIMING_AGE_CHOICES) {
    if (Math.abs(age - stored) < Math.abs(nearest - stored)) nearest = age;
  }
  return nearest;
}

/** The label of the offered age nearest to a stored one ("67 (full)"). */
export function claimingAgeLabel(stored: unknown): string {
  const age = nearestClaimingAge(stored);
  return CLAIMING_AGE_CHOICES.find((choice) => choice.age === age)?.label ?? String(age);
}

export interface ClaimingAgeBenefit extends ClaimingAgeChoice {
  /** The yearly benefit when claimed at this age, in the same dollars as the entered benefit. */
  yearlyBenefit: number;
}

/**
 * The yearly benefit at each offered claiming age, from the entered benefit
 * (the amount at the full retirement age) through the engine's adjustment.
 * A benefit that is not a number counts as 0.
 */
export function claimingAgeBenefits(benefit: unknown): ClaimingAgeBenefit[] {
  const base = isFiniteNumber(benefit) ? benefit : 0;
  return CLAIMING_AGE_CHOICES.map((choice) => ({
    ...choice,
    yearlyBenefit: calculateSocialSecurityBenefit(base, choice.age),
  }));
}
