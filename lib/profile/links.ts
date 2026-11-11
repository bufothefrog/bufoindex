/**
 * Deep links that seed each calculator from the shared profile.
 *
 * Every link reuses the calculator's existing, versioned URL-hash codec, so
 * the destination page decodes and auto-calculates through its normal
 * `loadFromUrl` path with no store changes. Hash links are plain strings;
 * callers passing them to next/link should cast with `as Route`.
 */

import { encodeToUrlHash } from '@/lib/utils';
import { encodeRetirementToUrlHash } from '@/lib/utils/retirementState';
import { encodeRebalancingToUrlHash } from '@/lib/utils/portfolioRebalancingState';
import { toPaycheckProfile, toRebalanceInputs, toRetirementInputs } from './mappers';
import type { FinancialProfile } from './types';

export const RETIREMENT_PATH = '/tools/retirement-calculator';
export const PAYCHECK_PATH = '/tools/paycheck-allocator';
export const PORTFOLIO_PATH = '/tools/portfolio-rebalancing-calculator';
export const LEVERAGE_PATH = '/tools/leverage-comparison';

/** Retirement calculator seeded with the profile (today's-dollars display). */
export function retirementLink(profile: FinancialProfile): string {
  return `${RETIREMENT_PATH}#${encodeRetirementToUrlHash(toRetirementInputs(profile))}`;
}

/** Paycheck allocator seeded with the profile (today's-dollars display). */
export function paycheckLink(profile: FinancialProfile): string {
  return `${PAYCHECK_PATH}#${encodeToUrlHash({ profile: toPaycheckProfile(profile), displayMode: 'today' })}`;
}

/** Portfolio rebalancer seeded with the profile's target mix and new cash. */
export function portfolioLink(profile: FinancialProfile): string {
  return `${PORTFOLIO_PATH}#${encodeRebalancingToUrlHash(toRebalanceInputs(profile))}`;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Leverage comparison seeded through query params:
 *   c = monthly contribution (the taxable contribution, or the total monthly
 *       contribution when no taxable contribution is set)
 *   y = years to retirement, rounded and clamped to 1..60
 *   b = starting balance (invested balance)
 *   l = leverage ratio
 */
export function leverageLink(profile: FinancialProfile): string {
  const { person, investing, strategy } = profile;
  const taxable = finiteOr(investing.taxableMonthlyContribution, 0);
  const contribution = taxable > 0 ? taxable : finiteOr(investing.monthlyContribution, 0);
  const rawYears = Math.round(finiteOr(person.retirementAge - person.age, 1));
  const years = Math.min(60, Math.max(1, rawYears));

  const params = new URLSearchParams({
    c: String(contribution),
    y: String(years),
    b: String(finiteOr(investing.investedBalance, 0)),
    l: String(finiteOr(strategy.leverageRatio, 2)),
  });
  return `${LEVERAGE_PATH}?${params.toString()}`;
}
