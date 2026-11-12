/**
 * The calculator registry (docs/rebuild-plan.md section 2.9): the one place
 * calculator names, paths, descriptions and disclaimers live. The calculator
 * shell, the page metadata, the sitemap, the /tools index, the home page and
 * the 404 page read from it.
 */

import type { Metadata } from 'next';
import { composeDisclaimer, DISCLAIMER } from '@/lib/constants/disclaimers';
import type { CalculatorId, CalculatorMeta } from './types';

/** The calculator's card on the /tools index. */
export interface CalculatorCard {
  title: string;
  summary: string;
  /** The call to action at the foot of the card. */
  action: string;
}

/** A registry entry: the pinned CalculatorMeta plus the /tools card copy. */
export interface CalculatorEntry extends CalculatorMeta {
  card: CalculatorCard;
}

/** Every calculator, in site order (the order of the /tools index and the sitemap). */
export const CALCULATOR_IDS: readonly CalculatorId[] = ['paycheck', 'retirement', 'portfolio', 'leverage'];

export const CALCULATORS: Readonly<Record<CalculatorId, CalculatorEntry>> = {
  paycheck: {
    id: 'paycheck',
    title: 'Paycheck Allocator Calculator',
    shortTitle: 'Paycheck Allocator',
    path: '/tools/paycheck-allocator',
    description:
      'Allocates your monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, in priority order by after-tax return. Each step shows the math behind its placement.',
    metaDescription:
      'Allocate a monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, with the arithmetic shown at each step.',
    disclaimer: [DISCLAIMER.base, DISCLAIMER.taxEstimates, DISCLAIMER.advice],
    liveResultsLabel: 'Paycheck allocation results',
    dollarDisplay: 'fixed',
    card: {
      title: 'Paycheck Allocator',
      summary:
        'Bracket-aware monthly allocation across fixed costs, tax-advantaged accounts, and flexible spending, ordered by after-tax return.',
      action: 'Allocate a Paycheck',
    },
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
    disclaimer: [DISCLAIMER.base, DISCLAIMER.simulated, DISCLAIMER.advice],
    liveResultsLabel: 'Retirement projection results',
    dollarDisplay: 'inflation-input',
    card: {
      title: 'Retirement Calculator',
      summary:
        'Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison.',
      action: 'Plan Retirement',
    },
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
    disclaimer: [DISCLAIMER.base, DISCLAIMER.prices, DISCLAIMER.advice],
    liveResultsLabel: 'Rebalancing results',
    dollarDisplay: 'none',
    card: {
      title: 'Portfolio Rebalancing',
      summary:
        'Multi-account rebalancing that directs new deposits toward underweight asset classes, with taxable selling off by default and account-placement advice.',
      action: 'Rebalance with Cash Flow',
    },
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
    disclaimer: [DISCLAIMER.base, DISCLAIMER.simulated, DISCLAIMER.leveragedEtfs, DISCLAIMER.advice],
    liveResultsLabel: 'Leverage comparison results',
    dollarDisplay: 'fixed',
    card: {
      title: 'Leverage Comparison',
      summary:
        'Cash-flow dollar-cost averaging into a 2x fund versus a plain index fund, with the lump-sum framing side by side and the drawdowns shown.',
      action: 'Compare Strategies',
    },
  },
};

/** The site-wide note at the foot of the home page. */
export const SITE_DISCLAIMER = composeDisclaimer(DISCLAIMER.siteBase, DISCLAIMER.siteAssumptions, DISCLAIMER.advice);

export function calculatorMeta(id: CalculatorId): CalculatorEntry {
  return CALCULATORS[id];
}

/** The calculator's footer disclaimer, composed from its fragments. */
export function calculatorDisclaimer(id: CalculatorId): string {
  return composeDisclaimer(...CALCULATORS[id].disclaimer);
}

/** The `metadata` export of app/tools/<id>/page.tsx. */
export function calculatorMetadata(id: CalculatorId): Metadata {
  const { shortTitle, metaDescription } = CALCULATORS[id];
  return { title: shortTitle, description: metaDescription };
}

/**
 * Query parameter and value that mark a handoff from the wizard or the
 * dashboard (`?from=profile`); the calculator bootstrap strips the marker on
 * arrival and reads its inputs from the shared profile.
 */
export const PROFILE_HANDOFF_PARAM = 'from';
export const PROFILE_HANDOFF_VALUE = 'profile';

/**
 * The calculator's path; with fromProfile, plus `?from=profile` so the page
 * opens on Results (useCalculatorBootstrap). Never a hash.
 */
export function calculatorHref(id: CalculatorId, opts: { fromProfile?: boolean } = {}): string {
  const { path } = CALCULATORS[id];
  return opts.fromProfile ? `${path}?${PROFILE_HANDOFF_PARAM}=${PROFILE_HANDOFF_VALUE}` : path;
}
