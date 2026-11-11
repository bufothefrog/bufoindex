/**
 * Deep links that seed each calculator from the shared profile.
 *
 * Every link carries `?from=profile` (PROFILE_HANDOFF_PARAM and
 * PROFILE_HANDOFF_VALUE), which marks a handoff from the wizard or the
 * dashboard. Until a calculator reads the profile itself, its link also
 * reuses the calculator's existing, versioned URL-hash codec (or, for the
 * leverage comparison, its c/y/b/l query), so the destination page decodes
 * and auto-calculates through its normal `loadFromUrl` path with no store
 * changes. Those pages read only the hash, or only their own query keys, so
 * the extra parameter is ignored there. Links are plain strings; callers
 * passing them to next/link should cast with `as Route`.
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

/** Query parameter that marks a handoff from the profile: `?from=profile`. */
export const PROFILE_HANDOFF_PARAM = 'from';
export const PROFILE_HANDOFF_VALUE = 'profile';

const HANDOFF_QUERY = `${PROFILE_HANDOFF_PARAM}=${PROFILE_HANDOFF_VALUE}`;

/** Retirement calculator seeded with the profile (today's-dollars display). */
export function retirementLink(profile: FinancialProfile): string {
  return `${RETIREMENT_PATH}?${HANDOFF_QUERY}#${encodeRetirementToUrlHash(toRetirementInputs(profile))}`;
}

/** Paycheck allocator seeded with the profile (today's-dollars display). */
export function paycheckLink(profile: FinancialProfile): string {
  return `${PAYCHECK_PATH}?${HANDOFF_QUERY}#${encodeToUrlHash({ profile: toPaycheckProfile(profile), displayMode: 'today' })}`;
}

/** Portfolio rebalancer seeded with the profile's accounts, holdings and target mix. */
export function portfolioLink(profile: FinancialProfile): string {
  return `${PORTFOLIO_PATH}?${HANDOFF_QUERY}#${encodeRebalancingToUrlHash(toRebalanceInputs(profile))}`;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Leverage comparison seeded through query params. Each of c, y and b is the
 * profile's override (profile.leverage) when set, otherwise derived:
 *   c = monthly contribution (the taxable contribution, or the total monthly
 *       contribution when no taxable contribution is set)
 *   y = years to retirement, rounded and clamped to 1..60
 *   b = starting balance (invested balance)
 *   l = leverage ratio
 * then from=profile.
 */
export function leverageLink(profile: FinancialProfile): string {
  const { person, investing, strategy, leverage } = profile;
  const taxable = finiteOr(investing.taxableMonthlyContribution, 0);
  const contribution =
    leverage.monthlyContribution ?? (taxable > 0 ? taxable : finiteOr(investing.monthlyContribution, 0));
  const rawYears = Math.round(finiteOr(leverage.years ?? person.retirementAge - person.age, 1));
  const years = Math.min(60, Math.max(1, rawYears));

  const params = new URLSearchParams({
    c: String(contribution),
    y: String(years),
    b: String(finiteOr(leverage.startingBalance ?? investing.investedBalance, 0)),
    l: String(finiteOr(strategy.leverageRatio, 2)),
    [PROFILE_HANDOFF_PARAM]: PROFILE_HANDOFF_VALUE,
  });
  return `${LEVERAGE_PATH}?${params.toString()}`;
}
