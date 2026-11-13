/**
 * Leverage Comparison Engine
 *
 * Compares monthly contributions (dollar-cost averaging, "DCA") into a plain
 * index fund against the same contributions into a daily-reset leveraged
 * fund, and repeats both comparisons with the same yearly amount invested at
 * the start of each year. All four streams share one set of random draws per
 * path (common random numbers), so no gap comes from comparing different
 * random markets. The summary statistics still carry sampling error from the
 * finite path set (a few percentage points at 500 paths for the defaults);
 * it shrinks with 1 / sqrt(paths), and the fixed seed only makes it repeatable.
 *
 * Model (monthly steps):
 *   sigma_m = sigma / sqrt(12)
 *   z ~ Normal((ln(1 + mu) - sigma^2 / 2) / 12, sigma_m)       index log return
 *   index fund log return      = z - indexExpenseRatio / 12
 *   leveraged fund log return  = L z + ((L - L^2) / 2) sigma^2 / 12
 *                                - ((L - 1) financingRate + expenseRatio) / 12
 *
 * Contribution timing: the monthly stream adds the contribution at the start
 * of every month, dca = (dca + c) * G_m. The start-of-year stream adds 12 c at
 * month index 0, 12, 24, ... (prorated in a final partial year by
 * yearStartDeposit), ys = (ys + yearStartDeposit(12 c, m - 1, months)) * G_m,
 * so both streams pay in the same total dollars.
 *
 * The leveraged line comes from the continuous-time result for a fund that
 * rebalances to L times exposure continuously:
 *   d ln F = L d ln S + (L - L^2) sigma^2 / 2 dt - ((L - 1) r + e) dt.
 * The (L - L^2) sigma^2 / 2 term is the volatility drag ("decay"). A monthly
 * step captures it on average but understates the extra decay of daily resets
 * in violent months.
 *
 * Pure module: no React, DOM, or storage imports.
 */

import { boxMullerRandom, createSeededRng } from '@/lib/utils/random';
import { yearStartDeposit } from '@/lib/calculations/contributionSchedule';
import {
  DEFAULT_FINANCING_RATE,
  DEFAULT_LEVERAGE_PATHS,
  DEFAULT_LEVERAGE_SEED,
  INDEX_FUND_EXPENSE_RATIO,
  PROSHARES_SSO_EXPENSE_RATIO,
  SP500_LONG_RUN_NOMINAL_RETURN,
  SP500_LONG_RUN_VOLATILITY,
} from '@/lib/constants/leverage';

export interface DcaComparisonInputs {
  /** Dollars added at the start of every month. */
  monthlyContribution: number;
  /** Horizon in years (rounded to whole months). */
  years: number;
  /** Balance already invested at month 0. */
  startingBalance: number;
  /** Daily-reset leverage ratio L (1 = plain index exposure). */
  leverageRatio: number;
  /** Expected annual simple return of the underlying index (0.10 = 10%). */
  indexMeanReturn: number;
  /** Annualized volatility of the underlying index (0.16 = 16%). */
  indexVolatility: number;
  /** Annual cost of financing the borrowed (L - 1) exposure. */
  financingRate: number;
  /** Leveraged fund expense ratio. */
  expenseRatio: number;
  /** Plain index fund expense ratio. */
  indexExpenseRatio: number;
  /** Number of Monte Carlo paths. */
  paths: number;
  /** Seed for the reproducible random number generator. */
  seed: number;
}

export interface PathStats {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

export interface MedianPathPoint {
  month: number;
  indexDca: number;
  leveragedDca: number;
  indexDcaP10: number;
  indexDcaP90: number;
  leveragedDcaP10: number;
  leveragedDcaP90: number;
}

export interface DcaComparisonResult {
  /** startingBalance + monthlyContribution * months; the same for both timings. */
  totalContributed: number;
  /** dca: monthly contributions; yearStart: the same yearly amount at the start of each year. */
  index: { dca: PathStats; yearStart: PathStats };
  leveraged: { dca: PathStats; yearStart: PathStats };
  /** Share of paths where the leveraged DCA balance ends below the index DCA balance. */
  probLeveragedBehindDca: number;
  /** Share of paths where the leveraged start-of-year balance ends below the index start-of-year balance. */
  probLeveragedBehindYearStart: number;
  /** Median across paths of each fund's maximum drawdown, as a fraction 0..1. */
  medianMaxDrawdown: { index: number; leveraged: number };
  /** Median across paths of the number of months leveraged DCA trailed index DCA. */
  medianMonthsBehind: number;
  /** Median gaps (leveraged minus index) under each contribution timing. */
  dcaEffect: { dcaGap: number; yearStartGap: number };
  /** One point per month (0..months) with p10/p50/p90 of each DCA balance. */
  medianPath: MedianPathPoint[];
  /** ((L^2 - L) / 2) sigma^2 + (L - 1) financingRate + expenseRatio. */
  annualDragEstimate: number;
}

export const DEFAULT_DCA_COMPARISON_INPUTS: DcaComparisonInputs = {
  monthlyContribution: 900,
  years: 20,
  startingBalance: 5000,
  leverageRatio: 2,
  indexMeanReturn: SP500_LONG_RUN_NOMINAL_RETURN,
  indexVolatility: SP500_LONG_RUN_VOLATILITY,
  financingRate: DEFAULT_FINANCING_RATE,
  expenseRatio: PROSHARES_SSO_EXPENSE_RATIO,
  indexExpenseRatio: INDEX_FUND_EXPENSE_RATIO,
  paths: DEFAULT_LEVERAGE_PATHS,
  seed: DEFAULT_LEVERAGE_SEED,
};

/** Whole months in a horizon of `years` (at least one month). */
export function horizonMonths(years: number): number {
  if (!Number.isFinite(years)) return 1;
  return Math.max(1, Math.round(years * 12));
}

/**
 * Approximate annual cost of holding an L-times daily-reset fund relative to
 * L times the index: volatility drag + financing on the borrowed exposure +
 * the fund's expense ratio.
 */
export function estimateAnnualDrag(
  leverageRatio: number,
  indexVolatility: number,
  financingRate: number,
  expenseRatio: number,
): number {
  const L = leverageRatio;
  return ((L * L - L) / 2) * indexVolatility * indexVolatility + (L - 1) * financingRate + expenseRatio;
}

/**
 * Percentile of an ascending-sorted array with linear interpolation between
 * the two nearest ranks (the "R-7" / spreadsheet PERCENTILE.INC definition).
 */
export function percentileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const rank = Math.min(1, Math.max(0, p)) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const weight = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * weight;
}

function pathStats(values: Float64Array): PathStats {
  const sorted = values.slice().sort();
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return {
    p10: percentileSorted(sorted, 0.1),
    p50: percentileSorted(sorted, 0.5),
    p90: percentileSorted(sorted, 0.9),
    mean: values.length > 0 ? sum / values.length : 0,
  };
}

function median(values: Float64Array): number {
  return percentileSorted(values.slice().sort(), 0.5);
}

export function simulateDcaComparison(inputs: DcaComparisonInputs): DcaComparisonResult {
  const months = horizonMonths(inputs.years);
  const paths = Math.max(1, Math.floor(Number.isFinite(inputs.paths) ? inputs.paths : 1));
  const L = inputs.leverageRatio;
  const sigma = Math.max(0, inputs.indexVolatility);
  const contribution = Math.max(0, inputs.monthlyContribution);
  const startingBalance = Math.max(0, inputs.startingBalance);
  const totalContributed = startingBalance + contribution * months;
  const yearlyContribution = 12 * contribution;

  // Monthly log-return parameters for the underlying index.
  const muMonthly = (Math.log(1 + inputs.indexMeanReturn) - (sigma * sigma) / 2) / 12;
  const sigmaMonthly = sigma / Math.sqrt(12);

  // Per-month deterministic adjustments for each fund.
  const indexCost = inputs.indexExpenseRatio / 12;
  const leveragedConvexity = (((L - L * L) / 2) * sigma * sigma) / 12;
  const leveragedCost = ((L - 1) * inputs.financingRate + inputs.expenseRatio) / 12;

  const rng = createSeededRng(inputs.seed);

  // Month-major storage so each month's cross-section is contiguous.
  const stride = paths;
  const indexDcaByMonth = new Float64Array((months + 1) * stride);
  const leveragedDcaByMonth = new Float64Array((months + 1) * stride);

  const indexDcaEnd = new Float64Array(paths);
  const leveragedDcaEnd = new Float64Array(paths);
  const indexYearStartEnd = new Float64Array(paths);
  const leveragedYearStartEnd = new Float64Array(paths);
  const indexMaxDrawdown = new Float64Array(paths);
  const leveragedMaxDrawdown = new Float64Array(paths);
  const monthsBehind = new Float64Array(paths);

  let leveragedBehindDcaCount = 0;
  let leveragedBehindYearStartCount = 0;

  for (let p = 0; p < paths; p++) {
    let indexDca = startingBalance;
    let leveragedDca = startingBalance;
    let indexYearStart = startingBalance;
    let leveragedYearStart = startingBalance;

    // Cumulative log price of each fund, its running peak, and max drawdown.
    let indexLogPrice = 0;
    let leveragedLogPrice = 0;
    let indexLogPeak = 0;
    let leveragedLogPeak = 0;
    let indexWorst = 0;
    let leveragedWorst = 0;

    let behind = 0;

    indexDcaByMonth[p] = indexDca;
    leveragedDcaByMonth[p] = leveragedDca;

    for (let m = 1; m <= months; m++) {
      const z = boxMullerRandom(muMonthly, sigmaMonthly, rng);
      const indexLog = z - indexCost;
      const leveragedLog = L * z + leveragedConvexity - leveragedCost;
      const indexGrowth = Math.exp(indexLog);
      const leveragedGrowth = Math.exp(leveragedLog);

      indexDca = (indexDca + contribution) * indexGrowth;
      leveragedDca = (leveragedDca + contribution) * leveragedGrowth;
      const deposit = yearStartDeposit(yearlyContribution, m - 1, months);
      indexYearStart = (indexYearStart + deposit) * indexGrowth;
      leveragedYearStart = (leveragedYearStart + deposit) * leveragedGrowth;

      indexLogPrice += indexLog;
      if (indexLogPrice > indexLogPeak) {
        indexLogPeak = indexLogPrice;
      } else {
        const drawdown = 1 - Math.exp(indexLogPrice - indexLogPeak);
        if (drawdown > indexWorst) indexWorst = drawdown;
      }

      leveragedLogPrice += leveragedLog;
      if (leveragedLogPrice > leveragedLogPeak) {
        leveragedLogPeak = leveragedLogPrice;
      } else {
        const drawdown = 1 - Math.exp(leveragedLogPrice - leveragedLogPeak);
        if (drawdown > leveragedWorst) leveragedWorst = drawdown;
      }

      if (leveragedDca < indexDca) behind++;

      const offset = m * stride + p;
      indexDcaByMonth[offset] = indexDca;
      leveragedDcaByMonth[offset] = leveragedDca;
    }

    indexDcaEnd[p] = indexDca;
    leveragedDcaEnd[p] = leveragedDca;
    indexYearStartEnd[p] = indexYearStart;
    leveragedYearStartEnd[p] = leveragedYearStart;
    indexMaxDrawdown[p] = indexWorst;
    leveragedMaxDrawdown[p] = leveragedWorst;
    monthsBehind[p] = behind;

    if (leveragedDca < indexDca) leveragedBehindDcaCount++;
    if (leveragedYearStart < indexYearStart) leveragedBehindYearStartCount++;
  }

  // Month-by-month percentile bands of each DCA balance.
  const scratch = new Float64Array(paths);
  const medianPath: MedianPathPoint[] = new Array(months + 1);
  for (let m = 0; m <= months; m++) {
    const start = m * stride;

    scratch.set(indexDcaByMonth.subarray(start, start + stride));
    scratch.sort();
    const indexP10 = percentileSorted(scratch, 0.1);
    const indexP50 = percentileSorted(scratch, 0.5);
    const indexP90 = percentileSorted(scratch, 0.9);

    scratch.set(leveragedDcaByMonth.subarray(start, start + stride));
    scratch.sort();

    medianPath[m] = {
      month: m,
      indexDca: indexP50,
      leveragedDca: percentileSorted(scratch, 0.5),
      indexDcaP10: indexP10,
      indexDcaP90: indexP90,
      leveragedDcaP10: percentileSorted(scratch, 0.1),
      leveragedDcaP90: percentileSorted(scratch, 0.9),
    };
  }

  const index = { dca: pathStats(indexDcaEnd), yearStart: pathStats(indexYearStartEnd) };
  const leveraged = { dca: pathStats(leveragedDcaEnd), yearStart: pathStats(leveragedYearStartEnd) };

  return {
    totalContributed,
    index,
    leveraged,
    probLeveragedBehindDca: leveragedBehindDcaCount / paths,
    probLeveragedBehindYearStart: leveragedBehindYearStartCount / paths,
    medianMaxDrawdown: {
      index: median(indexMaxDrawdown),
      leveraged: median(leveragedMaxDrawdown),
    },
    medianMonthsBehind: median(monthsBehind),
    dcaEffect: {
      dcaGap: leveraged.dca.p50 - index.dca.p50,
      yearStartGap: leveraged.yearStart.p50 - index.yearStart.p50,
    },
    medianPath,
    annualDragEstimate: estimateAnnualDrag(L, sigma, inputs.financingRate, inputs.expenseRatio),
  };
}
