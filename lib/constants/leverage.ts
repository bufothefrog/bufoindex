/**
 * Leverage Comparison Constants
 *
 * Planning assumptions for the leverage comparison calculator
 * (lib/calculations/leverageComparison.ts). These are inputs to a simulation,
 * not forecasts. Every default can be changed in the calculator's
 * "Assumptions" card.
 *
 * Sources:
 *   - ProShares Ultra S&P500 (SSO) summary prospectus: expense ratio 0.89%.
 *     3x S&P 500 funds such as ProShares UltraPro S&P500 (UPRO) charge a
 *     similar amount, so 0.89% is used for every leverage ratio here.
 *   - Vanguard S&P 500 ETF (VOO) and iShares Core S&P 500 ETF (IVV)
 *     prospectuses: expense ratio 0.03%.
 *   - Leveraged ETFs get most of their exposure through total return swaps
 *     priced off a floating short-term benchmark plus a dealer spread (see the
 *     swap and counterparty disclosures in the ProShares prospectus). The
 *     financing cost is approximated here as the 3-month Treasury bill yield
 *     (FRED series DTB3, roughly 4% through 2025) plus a 0.5 percentage point
 *     spread. Check the current DTB3 value before relying on the default.
 *   - Long-run S&P 500 nominal total return of about 10% a year and annualized
 *     volatility of about 16%: Damodaran, "Historical Returns on Stocks, Bonds
 *     and Bills" (NYU Stern, updated annually) and Shiller's monthly S&P
 *     dataset (Yale). Both are rounded long-run figures; sub-periods vary
 *     widely (2000 to 2012 was roughly flat in nominal terms).
 *
 * How the simulation reads these numbers: indexMeanReturn is treated as the
 * expected annual simple return of a lognormal model, so the implied median
 * annual growth is (1 + 0.10) * exp(-0.16^2 / 2) - 1, about 8.6%. That sits
 * below the historical geometric mean on purpose: the default is meant to be
 * unremarkable, not optimistic.
 */

// ── Fund costs ──────────────────────────────────────────────────────────────

/** ProShares Ultra S&P500 (SSO) expense ratio, 0.89% a year. */
export const PROSHARES_SSO_EXPENSE_RATIO = 0.0089;

/** Broad S&P 500 index ETF expense ratio (VOO / IVV), 0.03% a year. */
export const INDEX_FUND_EXPENSE_RATIO = 0.0003;

// ── Financing ───────────────────────────────────────────────────────────────

/** 3-month Treasury bill yield assumption (FRED DTB3, approximate). */
export const SHORT_RATE_ASSUMPTION = 0.04;

/** Spread a swap counterparty charges above the short rate (assumption). */
export const SWAP_FINANCING_SPREAD = 0.005;

/**
 * Annual cost of borrowing the extra (L - 1) units of exposure:
 * short rate plus spread, 4.5%.
 */
export const DEFAULT_FINANCING_RATE = SHORT_RATE_ASSUMPTION + SWAP_FINANCING_SPREAD;

// ── Index return assumptions ───────────────────────────────────────────────

/** Long-run S&P 500 nominal total return, about 10% a year. */
export const SP500_LONG_RUN_NOMINAL_RETURN = 0.10;

/** Long-run S&P 500 annualized volatility, about 16%. */
export const SP500_LONG_RUN_VOLATILITY = 0.16;

// ── Simulation settings ─────────────────────────────────────────────────────

/** Number of Monte Carlo paths the calculator runs by default. */
export const DEFAULT_LEVERAGE_PATHS = 500;

/** Fixed seed so the same inputs always produce the same chart. */
export const DEFAULT_LEVERAGE_SEED = 20260812;

/** Leverage ratios offered in the calculator (1x is a plain index fund). */
export const LEVERAGE_RATIO_OPTIONS = [1, 2, 3] as const;

/** Input bounds used by the calculator UI and the URL query parser. */
export const LEVERAGE_INPUT_BOUNDS = {
  minYears: 1,
  maxYears: 60,
  maxMonthlyContribution: 1_000_000,
  maxStartingBalance: 100_000_000,
  minReturn: -0.5,
  maxReturn: 0.3,
  minVolatility: 0,
  maxVolatility: 0.6,
  maxFinancingRate: 0.2,
  maxExpenseRatio: 0.05,
} as const;
