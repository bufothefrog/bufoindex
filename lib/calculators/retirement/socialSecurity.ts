/**
 * The Social Security benefit leaf and its Auto value. Pure.
 *
 * retirementIncome.socialSecurityBenefit is nullable: null is Auto, an
 * estimate from the visitor's yearly gross pay (estimateSocialSecurityBenefit
 * in lib/calculations/socialSecurityEstimate.ts). resolveSocialSecurityBenefit
 * is the one place the leaf turns into the number the engine and the page
 * use: the retirement binding (and through it the dashboard), the field's
 * Auto label and the claiming-age table all read it.
 *
 * A stored profile whose benefit was never answered (the old default 30000
 * left unconfirmed) loads as Auto: that rule is in normalizeProfile
 * (UNANSWERED_LOADS_AS_AUTO in lib/profile/defaults.ts).
 */

import { estimateSocialSecurityBenefit } from '@/lib/calculations/socialSecurityEstimate';
import { isFiniteNumber } from '@/lib/fields/runtime';
import type { Get } from '@/lib/fields/types';
import { yearlyGrossPay } from './income';

export const SOCIAL_SECURITY_BENEFIT_PATH = 'retirementIncome.socialSecurityBenefit';

/** The Auto benefit: the estimate at full retirement age from yearly gross pay, to the whole dollar. */
export function estimatedSocialSecurityBenefit(get: Get): number {
  const pay = yearlyGrossPay(get);
  return Math.round(estimateSocialSecurityBenefit(isFiniteNumber(pay) ? pay : 0));
}

/** The yearly benefit in use: the visitor's own number, or the estimate while the leaf is Auto (null). */
export function resolveSocialSecurityBenefit(get: Get): number {
  const value = get(SOCIAL_SECURITY_BENEFIT_PATH);
  return isFiniteNumber(value) ? value : estimatedSocialSecurityBenefit(get);
}

/** True while the benefit is on Auto. */
export function isSocialSecurityAuto(get: Get): boolean {
  return get(SOCIAL_SECURITY_BENEFIT_PATH) === null;
}
