/**
 * Calculator paths and the profile handoff marker.
 *
 * A link from the wizard or the dashboard carries `?from=profile`
 * (PROFILE_HANDOFF_PARAM and PROFILE_HANDOFF_VALUE) and no hash: the
 * calculator reads its inputs from the shared profile. The registry builds
 * those links (calculatorHref in lib/calculators/registry.ts) and the
 * calculator bootstrap strips the marker on arrival.
 */

export const RETIREMENT_PATH = '/tools/retirement-calculator';
export const PAYCHECK_PATH = '/tools/paycheck-allocator';
export const PORTFOLIO_PATH = '/tools/portfolio-rebalancing-calculator';
export const LEVERAGE_PATH = '/tools/leverage-comparison';

/** Query parameter that marks a handoff from the profile: `?from=profile`. */
export const PROFILE_HANDOFF_PARAM = 'from';
export const PROFILE_HANDOFF_VALUE = 'profile';
