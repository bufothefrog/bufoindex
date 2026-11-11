/**
 * Deep links that seed each calculator from the shared profile.
 *
 * Every link carries `?from=profile` (PROFILE_HANDOFF_PARAM /
 * PROFILE_HANDOFF_VALUE). A calculator that reads the profile directly
 * (after its rebuild slice) sees the marker and ignores the rest; until then
 * the retirement, paycheck and portfolio links still carry the calculator's
 * versioned URL-hash payload, which the page decodes through its normal
 * `loadFromUrl` path, and the leverage link still carries c/y/b/l. Links are
 * plain strings; callers passing them to next/link should cast with
 * `as Route`.
 *
 * @deprecated hash builders: removed in x1 once every calculator reads the
 * profile (O6); the marker constants stay.
 */

import { encodeToUrlHash } from '@/lib/utils';
import { encodeRetirementToUrlHash } from '@/lib/utils/retirementState';
import { encodeRebalancingToUrlHash } from '@/lib/utils/portfolioRebalancingState';
import { leverageSeed, toPaycheckProfile, toRebalanceInputs, toRetirementInputs } from './mappers';
import type { FinancialProfile } from './types';

export const RETIREMENT_PATH = '/tools/retirement-calculator';
export const PAYCHECK_PATH = '/tools/paycheck-allocator';
export const PORTFOLIO_PATH = '/tools/portfolio-rebalancing-calculator';
export const LEVERAGE_PATH = '/tools/leverage-comparison';

/** Query parameter that marks a link as a hand-off from the profile. */
export const PROFILE_HANDOFF_PARAM = 'from';
/** Value of PROFILE_HANDOFF_PARAM for a profile hand-off. */
export const PROFILE_HANDOFF_VALUE = 'profile';

const HANDOFF_QUERY = `${PROFILE_HANDOFF_PARAM}=${PROFILE_HANDOFF_VALUE}`;

/** Retirement calculator seeded with the profile (today's-dollars display). */
export function retirementLink(profile: FinancialProfile): string {
  return `${RETIREMENT_PATH}?${HANDOFF_QUERY}#${encodeRetirementToUrlHash(toRetirementInputs(profile))}`;
}

/** Paycheck allocator seeded with the profile (today's-dollars display). */
export function paycheckLink(profile: FinancialProfile): string {
  const hash = encodeToUrlHash({ profile: toPaycheckProfile(profile), displayMode: 'today' });
  return `${PAYCHECK_PATH}?${HANDOFF_QUERY}#${hash}`;
}

/** Portfolio rebalancer seeded with the profile's accounts, holdings and targets. */
export function portfolioLink(profile: FinancialProfile): string {
  return `${PORTFOLIO_PATH}?${HANDOFF_QUERY}#${encodeRebalancingToUrlHash(toRebalanceInputs(profile))}`;
}

/**
 * Leverage comparison seeded through query params (see leverageSeed):
 *   c = monthly contribution, y = years, b = starting balance,
 *   l = leverage ratio, then from=profile.
 */
export function leverageLink(profile: FinancialProfile): string {
  const seed = leverageSeed(profile);
  const params = new URLSearchParams({
    c: String(seed.monthlyContribution),
    y: String(seed.years),
    b: String(seed.startingBalance),
    l: String(seed.leverageRatio),
    [PROFILE_HANDOFF_PARAM]: PROFILE_HANDOFF_VALUE,
  });
  return `${LEVERAGE_PATH}?${params.toString()}`;
}
