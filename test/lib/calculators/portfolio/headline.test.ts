/**
 * portfolioHeadline: the cash the plan puts to work and the total drift
 * before and after, labelled and formatted the way the results printed them
 * before the rebuild. The first case runs the engine on a small portfolio
 * (hand-computed below); the others use fixed result objects.
 */

import { describe, expect, it } from 'vitest';
import {
  rebalancePortfolioV2,
  type RebalanceInputsV2,
  type RebalanceResultV2,
} from '@/lib/calculations/portfolioRebalancing';
import { PORTFOLIO_CASH_STAT_IDS, portfolioHeadline } from '@/lib/calculators/portfolio/headline';
import { formatStatValue } from '@/lib/design-system/stat';

const shown = (result: RebalanceResultV2) =>
  portfolioHeadline(result).map(({ id, label, value, format, tone, hint }) => ({
    id,
    label,
    value: formatStatValue(value, format),
    tone,
    hint,
  }));

function result(overrides: Partial<RebalanceResultV2>): RebalanceResultV2 {
  return {
    setupMode: 'single',
    mode: 'whole',
    accounts: [],
    totalValueBefore: 0,
    totalValueAfter: 0,
    totalDeposit: 0,
    totalSpent: 0,
    totalReceived: 0,
    cashLeftover: 0,
    taxEventDollars: 0,
    totalDriftBefore: 0,
    totalDriftAfter: 0,
    classDrift: [],
    ...overrides,
  };
}

describe('portfolioHeadline', () => {
  it('reads cash and drift from a real rebalance', () => {
    // One account, $1,000 to invest, 60/40 target. Before: VTI 10 x $100 =
    // $1,000 and BND 0, so us-stock is 100% (+40 points) and bonds 0% (-40):
    // total drift 80 points. The $2,000 after the deposit splits 60/40 as
    // VTI $1,200 and BND $800: whole shares buy 2 VTI ($200) and 20 BND
    // ($800), all of the deposit, and land exactly on target (drift 0).
    const inputs: RebalanceInputsV2 = {
      setupMode: 'single',
      securities: [
        { id: 's-vti', ticker: 'VTI', price: 100, assetClass: 'us-stock' },
        { id: 's-bnd', ticker: 'BND', price: 40, assetClass: 'bonds' },
      ],
      classTargets: [
        { accountId: null, assetClass: 'us-stock', target: 0.6 },
        { accountId: null, assetClass: 'bonds', target: 0.4 },
      ],
      accounts: [{ id: 'a', name: 'Brokerage', accountType: 'taxable', deposit: 1000 }],
      holdings: [
        { id: 'h-vti', accountId: 'a', securityId: 's-vti', shares: 10 },
        { id: 'h-bnd', accountId: 'a', securityId: 's-bnd', shares: 0 },
      ],
      allowTaxableSelling: false,
      showPlacementAdvice: false,
      mode: 'whole',
      customAssetClasses: [],
    };
    const rebalance = rebalancePortfolioV2(inputs);
    const stats = portfolioHeadline(rebalance);

    expect(stats.map((stat) => stat.value)).toEqual([
      rebalance.totalSpent,
      rebalance.cashLeftover,
      rebalance.totalDriftBefore,
      rebalance.totalDriftAfter,
    ]);
    expect(rebalance.totalDeposit).toBe(1000);
    expect(rebalance.totalSpent).toBeCloseTo(1000, 6);
    expect(rebalance.cashLeftover).toBeCloseTo(0, 6);
    expect(rebalance.totalDriftBefore).toBeCloseTo(0.8, 6);
    expect(rebalance.totalDriftAfter).toBeCloseTo(0, 6);
    expect(shown(rebalance).map(({ value, hint }) => [value, hint])).toEqual([
      ['$1,000', 'of $1,000 deposit'],
      ['$0', 'Fully invested'],
      ['80.0%', undefined],
      ['0.0%', undefined],
    ]);
  });

  it('labels and formats the four figures as the results always have', () => {
    expect(
      shown(result({ totalSpent: 987.65, totalDeposit: 1000, cashLeftover: 12.35, totalDriftBefore: 0.125, totalDriftAfter: 0.034 }))
    ).toEqual([
      { id: 'invested', label: 'Invested', value: '$988', tone: undefined, hint: 'of $1,000 deposit' },
      { id: 'cash-leftover', label: 'Cash leftover', value: '$12', tone: undefined, hint: 'Carry to next deposit' },
      { id: 'drift-before', label: 'Total drift before', value: '12.5%', tone: undefined, hint: undefined },
      { id: 'drift-after', label: 'Total drift after', value: '3.4%', tone: 'brand', hint: undefined },
    ]);
  });

  it('says the deposit is fully invested when no cash is left over', () => {
    const [invested, leftover, before, after] = shown(result({ totalSpent: 500, totalDeposit: 500 }));
    expect(invested).toMatchObject({ value: '$500', hint: 'of $500 deposit' });
    expect(leftover).toMatchObject({ value: '$0', hint: 'Fully invested' });
    expect(before.value).toBe('0.0%');
    expect(after.value).toBe('0.0%');
  });

  it('splits into the two cash figures and the two drift figures by id', () => {
    const ids = portfolioHeadline(result({})).map((stat) => stat.id);
    expect(ids.filter((id) => PORTFOLIO_CASH_STAT_IDS.includes(id))).toEqual(['invested', 'cash-leftover']);
    expect(ids.filter((id) => !PORTFOLIO_CASH_STAT_IDS.includes(id))).toEqual(['drift-before', 'drift-after']);
  });
});
