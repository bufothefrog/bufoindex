import { describe, expect, it } from 'vitest';
import { EXAMPLE_FUND_PRICES } from '@/lib/constants/example-prices';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';

describe('EXAMPLE_FUND_PRICES', () => {
  it('holds the sourced prices, rounded to the nearest 5 dollars', () => {
    expect(EXAMPLE_FUND_PRICES).toEqual({ VTI: 375, VXUS: 85, BND: 70 });
    for (const price of Object.values(EXAMPLE_FUND_PRICES)) expect(price % 5).toBe(0);
  });

  it('is where the worked example portfolio takes its prices from', () => {
    const prices = Object.fromEntries(
      getDefaultFinancialProfile().portfolio.securities.map((security) => [security.ticker, security.price])
    );
    expect(prices).toEqual(EXAMPLE_FUND_PRICES);
  });
});
