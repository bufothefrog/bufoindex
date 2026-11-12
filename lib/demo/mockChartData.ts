/**
 * Fixture data for the /demo gallery's production chart (DcaPathChart in a
 * ChartFrame). Deterministic and engine-free: the curves are smooth
 * compounding paths, not simulation output, so the gallery renders the same
 * picture on every load.
 */

import type { MedianPathPoint } from '@/lib/calculations/leverageComparison';

const MONTHS = 20 * 12;
const MONTHLY_CONTRIBUTION = 500;
const INDEX_MONTHLY_RETURN = 0.07 / 12;
const LEVERAGED_MONTHLY_RETURN = 0.09 / 12;

/** Balance after `month` months of equal contributions at a fixed monthly return. */
function contributionBalance(month: number, monthlyReturn: number): number {
  return (MONTHLY_CONTRIBUTION * (Math.pow(1 + monthlyReturn, month) - 1)) / monthlyReturn;
}

/**
 * Twenty years of $500 a month into an index fund and a leveraged fund, with
 * 10th to 90th percentile bands that widen with time (wider for the
 * leveraged fund).
 */
export function demoMedianPath(): MedianPathPoint[] {
  return Array.from({ length: MONTHS + 1 }, (_, month) => {
    const indexDca = contributionBalance(month, INDEX_MONTHLY_RETURN);
    const leveragedDca = contributionBalance(month, LEVERAGED_MONTHLY_RETURN);
    const spread = Math.sqrt(month / MONTHS);
    return {
      month,
      indexDca,
      leveragedDca,
      indexDcaP10: indexDca * (1 - 0.3 * spread),
      indexDcaP90: indexDca * (1 + 0.45 * spread),
      leveragedDcaP10: leveragedDca * (1 - 0.6 * spread),
      leveragedDcaP90: leveragedDca * (1 + 0.9 * spread),
    };
  });
}
