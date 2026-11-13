/**
 * Prices of the three funds in the profile's worked example portfolio
 * (lib/profile/defaults.ts), in dollars per share.
 *
 * Source: the closing price on 2026-11-12, read on 2026-11-13 from two
 * market data pages that agreed to the cent or within 0.02%: Yahoo Finance
 * chart data (query1.finance.yahoo.com/v8/finance/chart/<ticker>: VTI
 * 372.62, VXUS 82.66, BND 70.65) and the Nasdaq quote page
 * (api.nasdaq.com/api/quote/<ticker>/info: VTI 372.57, VXUS 82.66, BND
 * 70.65), each rounded to the nearest 5 dollars.
 */
export const EXAMPLE_FUND_PRICES = {
  VTI: 375,
  VXUS: 85,
  BND: 70,
} as const;
