/**
 * The 2026 contribution limits by age, and the high-interest debt threshold,
 * as the allocator applies them (lib/calculations/optimization.ts). The
 * results (step statuses, step cards, quick actions) read them from here so
 * each limit is written once outside the engine; a parity test pins every
 * value against the engine's own output. Figures come from
 * lib/constants/irs-2026.ts. Pure.
 */

import { CONTRIBUTION_LIMITS_2026, TOTAL_415C_BY_AGE } from '../constants/irs-2026';
import type { HSABenefits } from '../types';

/**
 * A debt above this annual rate counts as high-interest
 * (optimization.ts getHighInterestThreshold: a fixed 7% at every age).
 */
export const HIGH_INTEREST_THRESHOLD = 0.07;

/** True for the SECURE 2.0 super catch-up window, ages 60 to 63. */
function superCatchUpAge(age: number): boolean {
  return age >= 60 && age <= 63;
}

/**
 * 402(g) elective-deferral limit (traditional and Roth combined), with the
 * regular catch-up at 50+ and the super catch-up for ages 60-63 only
 * (optimization.ts calculateAdditional401k).
 */
export function limit401k(age: number): number {
  const catchUp = superCatchUpAge(age)
    ? CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k
    : age >= 50
      ? CONTRIBUTION_LIMITS_2026.catchUp['401k']
      : 0;
  return CONTRIBUTION_LIMITS_2026.traditional401k + catchUp;
}

/**
 * Combined traditional and Roth IRA limit, with the 50+ catch-up, before any
 * income phase-out (optimization.ts calculateRothIRA).
 */
export function limitIra(age: number): number {
  return CONTRIBUTION_LIMITS_2026.ira + (age >= 50 ? CONTRIBUTION_LIMITS_2026.catchUp.ira : 0);
}

/**
 * HSA limit for the coverage tier, plus the flat age-55 catch-up
 * (optimization.ts calculateHSAOptimal). Employer contributions count
 * against it.
 */
export function limitHsa(coverage: HSABenefits['coverageType'], age: number): number {
  const base = coverage === 'family'
    ? CONTRIBUTION_LIMITS_2026.hsa.family
    : CONTRIBUTION_LIMITS_2026.hsa.individual;
  return base + (age >= 55 ? CONTRIBUTION_LIMITS_2026.catchUp.hsa : 0);
}

/**
 * 415(c) annual-additions limit (employee, employer and after-tax money
 * together) for the age band (optimization.ts calculateMegaBackdoorRoth).
 */
export function limit415c(age: number): number {
  if (superCatchUpAge(age)) return TOTAL_415C_BY_AGE.superCatchUp60to63;
  if (age >= 50) return TOTAL_415C_BY_AGE.catchUp50;
  return TOTAL_415C_BY_AGE.standard;
}
