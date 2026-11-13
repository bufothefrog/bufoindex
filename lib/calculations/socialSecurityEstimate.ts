/**
 * A Social Security benefit estimate from yearly pay, with the Social
 * Security Administration's primary insurance amount (PIA) formula. Pure.
 *
 * - Average indexed monthly earnings (AIME) = yearly gross pay, capped at the
 *   contribution and benefit base, divided by 12.
 * - Monthly benefit at full retirement age = 90% of the AIME up to the first
 *   bend point + 32% of the part between the bend points + 15% of the part
 *   above the second bend point.
 * - Yearly benefit = monthly benefit x 12, in today's dollars.
 *
 * Simplifications, stated on the retirement methodology page too:
 * - Current pay stands for the average of the 35 highest years of indexed
 *   earnings, so a career with lower or missing years gets a lower benefit
 *   than this estimate.
 * - It is one worker's own benefit. A married couple's pay figure is treated
 *   as one worker's pay; spousal and survivor benefits are not modeled.
 * - No rounding to the dime as SSA does; the result is not rounded.
 *
 * The bend points and base live in lib/constants/social-security-2026.ts.
 */

import {
  CONTRIBUTION_AND_BENEFIT_BASE_2026,
  PIA_FACTORS,
  PIA_FIRST_BEND_POINT_2026,
  PIA_SECOND_BEND_POINT_2026,
} from '@/lib/constants/social-security-2026';

/** Average indexed monthly earnings for a yearly pay figure (capped at the base; negatives count as 0). */
export function averageIndexedMonthlyEarnings(yearlyPay: number): number {
  const counted = Math.min(Math.max(yearlyPay, 0), CONTRIBUTION_AND_BENEFIT_BASE_2026);
  return counted / 12;
}

/** The monthly primary insurance amount for an AIME. */
export function primaryInsuranceAmount(aime: number): number {
  const first = Math.min(aime, PIA_FIRST_BEND_POINT_2026);
  const second = Math.min(Math.max(aime - PIA_FIRST_BEND_POINT_2026, 0), PIA_SECOND_BEND_POINT_2026 - PIA_FIRST_BEND_POINT_2026);
  const third = Math.max(aime - PIA_SECOND_BEND_POINT_2026, 0);
  return PIA_FACTORS.first * first + PIA_FACTORS.second * second + PIA_FACTORS.third * third;
}

/**
 * The estimated yearly Social Security benefit at full retirement age, in
 * today's dollars, from yearly gross pay. A pay figure that is not a finite
 * number estimates 0.
 */
export function estimateSocialSecurityBenefit(yearlyPay: number): number {
  if (!Number.isFinite(yearlyPay)) return 0;
  return primaryInsuranceAmount(averageIndexedMonthlyEarnings(yearlyPay)) * 12;
}
