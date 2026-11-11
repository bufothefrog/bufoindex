import { describe, expect, it } from 'vitest';
import {
  CALCULATORS,
  CALCULATOR_LIST,
  PROFILE_HANDOFF_PARAM,
  PROFILE_HANDOFF_VALUE,
  calculatorHref,
  calculatorMeta,
  calculatorMetadata,
} from '@/lib/calculators/registry';
import { CALCULATOR_IDS } from '@/lib/calculators/types';
import { DISCLAIMERS, composeDisclaimer } from '@/lib/constants/disclaimers';
import * as links from '@/lib/profile/links';
import sitemap from '@/app/sitemap';

describe('calculator registry', () => {
  it('has one entry per calculator id, keyed by its own id, in id order', () => {
    expect(Object.keys(CALCULATORS)).toEqual([...CALCULATOR_IDS]);
    expect(CALCULATOR_LIST.map((c) => c.id)).toEqual([...CALCULATOR_IDS]);
    for (const id of CALCULATOR_IDS) {
      expect(calculatorMeta(id).id).toBe(id);
      expect(calculatorMeta(id).path).toMatch(/^\/tools\/[a-z-]+$/);
    }
  });

  it('composes each disclaimer byte-identically to the page disclaimers', () => {
    for (const id of CALCULATOR_IDS) {
      expect(composeDisclaimer(...CALCULATORS[id].disclaimer)).toBe(DISCLAIMERS[id]);
    }
  });

  it('agrees with the profile link paths and hand-off marker', () => {
    expect(CALCULATORS.paycheck.path).toBe(links.PAYCHECK_PATH);
    expect(CALCULATORS.retirement.path).toBe(links.RETIREMENT_PATH);
    expect(CALCULATORS.portfolio.path).toBe(links.PORTFOLIO_PATH);
    expect(CALCULATORS.leverage.path).toBe(links.LEVERAGE_PATH);
    expect(PROFILE_HANDOFF_PARAM).toBe(links.PROFILE_HANDOFF_PARAM);
    expect(PROFILE_HANDOFF_VALUE).toBe(links.PROFILE_HANDOFF_VALUE);
  });

  it('builds plain and profile hand-off hrefs', () => {
    expect(calculatorHref('retirement')).toBe('/tools/retirement-calculator');
    expect(calculatorHref('leverage', { fromProfile: false })).toBe('/tools/leverage-comparison');
    expect(calculatorHref('paycheck', { fromProfile: true })).toBe('/tools/paycheck-allocator?from=profile');
  });

  it('builds page metadata from the short title and meta description', () => {
    expect(calculatorMetadata('portfolio')).toEqual({
      title: 'Portfolio Rebalancer',
      description: CALCULATORS.portfolio.metaDescription,
    });
  });

  it('lists every calculator path (and the methodology page) in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      'https://bufoindex.com',
      'https://bufoindex.com/tools',
      'https://bufoindex.com/tools/paycheck-allocator',
      'https://bufoindex.com/tools/retirement-calculator',
      'https://bufoindex.com/tools/retirement-calculator/methodology',
      'https://bufoindex.com/tools/portfolio-rebalancing-calculator',
      'https://bufoindex.com/tools/leverage-comparison',
    ]);
  });
});

describe('registry metadata matches each page', () => {
  const pages = {
    paycheck: () => import('@/app/tools/paycheck-allocator/page'),
    retirement: () => import('@/app/tools/retirement-calculator/page'),
    portfolio: () => import('@/app/tools/portfolio-rebalancing-calculator/page'),
    leverage: () => import('@/app/tools/leverage-comparison/page'),
  } as const;

  for (const id of CALCULATOR_IDS) {
    it(`${id}: page metadata equals calculatorMetadata`, async () => {
      const page = await pages[id]();
      expect(page.metadata).toMatchObject(calculatorMetadata(id));
    });
  }
});
