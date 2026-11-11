/**
 * Calculator registry (docs/rebuild-plan.md section 2.9): the one place that
 * names each calculator, its route, its copy and its disclaimer. Pages,
 * the sitemap, /tools, the landing page, the 404 page and the calculator
 * shell read from here instead of repeating the strings.
 *
 * Pure data and string helpers: safe to import from server components.
 */

import type { Metadata } from 'next';
import type { CalculatorId, CalculatorMeta } from './types';
import { CALCULATOR_IDS } from './types';

/** Query parameter that marks a link as a hand-off from the shared profile (same as lib/profile/links). */
export const PROFILE_HANDOFF_PARAM = 'from';
/** Value of PROFILE_HANDOFF_PARAM for a profile hand-off. */
export const PROFILE_HANDOFF_VALUE = 'profile';

export const CALCULATORS: Readonly<Record<CalculatorId, CalculatorMeta>> = {
  paycheck: {
    id: 'paycheck',
    title: 'Paycheck Allocator Calculator',
    shortTitle: 'Paycheck Allocator',
    path: '/tools/paycheck-allocator',
    description:
      'Allocates your monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, in priority order by after-tax return. Each step shows the math behind its placement.',
    metaDescription:
      'Allocate a monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, with the arithmetic shown at each step.',
    disclaimer: ['educational', 'taxEstimates', 'notAdvice'],
    liveResultsLabel: 'Updating the allocation…',
    dollarDisplay: 'inflation-input',
  },
  retirement: {
    id: 'retirement',
    title: 'Retirement Planning Calculator',
    shortTitle: 'Retirement Calculator',
    path: '/tools/retirement-calculator',
    description:
      'Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison.',
    metaDescription:
      'Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison.',
    disclaimer: ['educational', 'simulated', 'notAdvice'],
    liveResultsLabel: 'Running the Monte Carlo simulation…',
    dollarDisplay: 'inflation-input',
  },
  portfolio: {
    id: 'portfolio',
    title: 'Portfolio Rebalancing Calculator',
    shortTitle: 'Portfolio Rebalancer',
    path: '/tools/portfolio-rebalancing-calculator',
    description:
      'Rebalance toward your asset-class targets using new deposits across one or more accounts, with whole or fractional shares and tax-aware placement advice.',
    metaDescription:
      'Compute the trades needed to bring a multi-account portfolio back to its target allocation, with custom asset classes and account-placement guidance.',
    disclaimer: ['educational', 'pricesExecutable', 'notAdvice'],
    liveResultsLabel: 'Updating the rebalancing plan…',
    dollarDisplay: 'none',
  },
  leverage: {
    id: 'leverage',
    title: 'Leverage Comparison',
    shortTitle: 'Leverage Comparison',
    path: '/tools/leverage-comparison',
    description:
      'Monthly contributions into a plain index fund versus the same contributions into a daily-reset leveraged fund, across simulated markets, alongside the usual lump-sum framing on the same dollars.',
    metaDescription:
      'Simulate monthly contributions into a plain index fund and a daily-reset leveraged fund on the same dates, with ending-balance percentiles, drawdowns, and the lump-sum framing shown side by side.',
    disclaimer: ['educational', 'simulated', 'leveragedEtfLoss', 'notAdvice'],
    liveResultsLabel: 'Updating the comparison…',
    dollarDisplay: 'fixed',
  },
};

/** Every calculator in display order. */
export const CALCULATOR_LIST: readonly CalculatorMeta[] = CALCULATOR_IDS.map((id) => CALCULATORS[id]);

/** Extra public routes that belong to a calculator (sitemap). */
export const CALCULATOR_SUBPAGES: Readonly<Partial<Record<CalculatorId, readonly string[]>>> = {
  retirement: ['/tools/retirement-calculator/methodology'],
};

export function calculatorMeta(id: CalculatorId): CalculatorMeta {
  return CALCULATORS[id];
}

/** Page metadata for app/tools/<calculator>/page.tsx. */
export function calculatorMetadata(id: CalculatorId): Metadata {
  const meta = CALCULATORS[id];
  return { title: meta.shortTitle, description: meta.metaDescription };
}

export interface CalculatorHrefOptions {
  /** Append `?from=profile`: the page reads the shared profile and phones open on Results. */
  fromProfile?: boolean;
}

/**
 * The calculator's path, optionally marked as a profile hand-off. Callers
 * passing it to next/link or router.push cast with `as Route`.
 */
export function calculatorHref(id: CalculatorId, opts: CalculatorHrefOptions = {}): string {
  const { path } = CALCULATORS[id];
  return opts.fromProfile ? `${path}?${PROFILE_HANDOFF_PARAM}=${PROFILE_HANDOFF_VALUE}` : path;
}
