/**
 * The calculator registry against what each page shows today: the metadata
 * each app/tools page exports, the layout heading and description, and the
 * footer disclaimer each shell passes to CalculatorLayout (copied here as
 * golden strings, since the shells keep them inline until phase 3).
 */

import { describe, expect, it } from 'vitest';
import { metadata as leverageMetadata } from '@/app/tools/leverage-comparison/page';
import { metadata as paycheckMetadata } from '@/app/tools/paycheck-allocator/page';
import { metadata as portfolioMetadata } from '@/app/tools/portfolio-rebalancing-calculator/page';
import { metadata as retirementMetadata } from '@/app/tools/retirement-calculator/page';
import {
  CALCULATOR_IDS,
  CALCULATORS,
  SITE_DISCLAIMER,
  calculatorDisclaimer,
  calculatorHref,
  calculatorMeta,
  calculatorMetadata,
} from '@/lib/calculators/registry';
import type { CalculatorId } from '@/lib/calculators/types';

const PAGE_METADATA = {
  paycheck: paycheckMetadata,
  retirement: retirementMetadata,
  portfolio: portfolioMetadata,
  leverage: leverageMetadata,
} as const;

/**
 * Each page's metadata as it shipped before the rebuild (6fb0576), as golden
 * strings: once phase 3 makes the pages export calculatorMetadata(id), the
 * comparison above compares the registry with itself, and these still pin
 * the titles and meta descriptions. The leverage description and meta
 * description changed in PR 5, when the comparison with the whole total at
 * month 0 gave way to the same yearly amount at the start of each year.
 */
const GOLDEN_METADATA: Record<CalculatorId, { title: string; description: string }> = {
  paycheck: {
    title: 'Paycheck Allocator',
    description:
      'Allocate a monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, with the arithmetic shown at each step.',
  },
  retirement: {
    title: 'Retirement Calculator',
    description:
      'Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison.',
  },
  portfolio: {
    title: 'Portfolio Rebalancer',
    description:
      'Compute the trades needed to bring a multi-account portfolio back to its target allocation, with custom asset classes and account-placement guidance.',
  },
  leverage: {
    title: 'Leverage Comparison',
    description:
      'Simulate monthly contributions into a plain index fund and a daily-reset leveraged fund on the same dates, with ending-balance percentiles, drawdowns, and the same yearly amount invested at the start of each year, side by side.',
  },
};

/** What each shell renders today (CalculatorLayout title, description and disclaimer). */
const SHELLS: Record<CalculatorId, { path: string; title: string; description: string; disclaimer: string }> = {
  paycheck: {
    path: '/tools/paycheck-allocator',
    title: 'Paycheck Allocator Calculator',
    description:
      'Allocates your monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, in priority order by after-tax return. Each step shows the math behind its placement.',
    disclaimer:
      'Educational tool only. Tax amounts are estimates from published 2026 federal and state tables applied to the inputs you enter. Not tax or investment advice.',
  },
  retirement: {
    path: '/tools/retirement-calculator',
    title: 'Retirement Planning Calculator',
    description:
      'Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison.',
    disclaimer:
      'Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Not tax or investment advice.',
  },
  portfolio: {
    path: '/tools/portfolio-rebalancing-calculator',
    title: 'Portfolio Rebalancing Calculator',
    description:
      'Rebalance toward your asset-class targets using new deposits across one or more accounts, with whole or fractional shares and tax-aware placement advice.',
    disclaimer: 'Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice.',
  },
  leverage: {
    path: '/tools/leverage-comparison',
    title: 'Leverage Comparison',
    description:
      'Monthly contributions into a plain index fund versus the same contributions into a daily-reset leveraged fund, across simulated markets, alongside the same yearly amount invested at the start of each year.',
    disclaimer:
      'Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Leveraged ETFs can lose most of their value in a severe decline. Not tax or investment advice.',
  },
};

describe('calculator registry', () => {
  it('describes the leverage comparison as monthly against the start of each year, with no lump-sum wording', () => {
    const leverage = CALCULATORS.leverage;
    expect(leverage.card.summary).toBe(
      'Cash-flow dollar-cost averaging into a 2x fund versus a plain index fund, with start-of-year contributions side by side and the drawdowns shown.'
    );
    expect(JSON.stringify(leverage)).not.toMatch(/lump/i);
  });

  it('lists every calculator once, in site order, keyed by its own id', () => {
    expect(CALCULATOR_IDS).toEqual(['paycheck', 'retirement', 'portfolio', 'leverage']);
    expect(Object.keys(CALCULATORS)).toEqual([...CALCULATOR_IDS]);
    for (const id of CALCULATOR_IDS) {
      expect(CALCULATORS[id].id).toBe(id);
      expect(calculatorMeta(id)).toBe(CALCULATORS[id]);
    }
  });

  it.each(CALCULATOR_IDS)('%s: metadata equals what the page exports', (id) => {
    expect(calculatorMetadata(id)).toEqual(PAGE_METADATA[id]);
  });

  it.each(CALCULATOR_IDS)('%s: metadata equals the golden title and description', (id) => {
    expect(calculatorMetadata(id)).toEqual(GOLDEN_METADATA[id]);
  });

  it.each(CALCULATOR_IDS)('%s: path, heading and description equal the shell', (id) => {
    const { path, title, description } = SHELLS[id];
    expect(calculatorMeta(id)).toMatchObject({ path, title, description });
  });

  it.each(CALCULATOR_IDS)('%s: the composed disclaimer equals the shell footer', (id) => {
    expect(calculatorDisclaimer(id)).toBe(SHELLS[id].disclaimer);
  });

  it('keeps the names the site shows today', () => {
    expect(CALCULATOR_IDS.map((id) => CALCULATORS[id].shortTitle)).toEqual([
      'Paycheck Allocator',
      'Retirement Calculator',
      'Portfolio Rebalancer',
      'Leverage Comparison',
    ]);
    expect(CALCULATOR_IDS.map((id) => CALCULATORS[id].card.title)).toEqual([
      'Paycheck Allocator',
      'Retirement Calculator',
      'Portfolio Rebalancing',
      'Leverage Comparison',
    ]);
  });

  it('composes the home page note', () => {
    expect(SITE_DISCLAIMER).toBe(
      'Educational tools only. Results depend on the assumptions you enter and are not predictions. Not tax or investment advice.'
    );
  });

  it("pairs the today's-dollars display with the calculators that offer it", () => {
    expect(CALCULATOR_IDS.map((id) => CALCULATORS[id].dollarDisplay)).toEqual([
      'fixed',
      'inflation-input',
      'none',
      // The leverage engine has no inflation input: its balances use the fixed 3%.
      'fixed',
    ]);
  });
});

describe('calculatorHref', () => {
  it('is the bare path by default', () => {
    expect(calculatorHref('paycheck')).toBe('/tools/paycheck-allocator');
    expect(calculatorHref('leverage', { fromProfile: false })).toBe('/tools/leverage-comparison');
  });

  it('adds ?from=profile for a handoff, and never a hash', () => {
    for (const id of CALCULATOR_IDS) {
      const href = calculatorHref(id, { fromProfile: true });
      expect(href).toBe(`${SHELLS[id].path}?from=profile`);
      expect(href).not.toContain('#');
    }
  });
});
