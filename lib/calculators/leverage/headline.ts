/**
 * The leverage comparison's headline figures (docs/rebuild-plan.md section
 * 2.11): the two median ending balances and the share of paths where the
 * leveraged fund ends behind, labelled and formatted once for the results
 * header and the dashboard card.
 *
 * The engine runs in nominal dollars and has no inflation input, so the
 * balances convert for display at the fixed DISPLAY_INFLATION_ASSUMPTION
 * (registry dollarDisplay 'fixed', as on the paycheck allocator) over the
 * horizon. The amount contributed is money paid in and stays as entered.
 * Display only: nothing here feeds a calculation.
 */

import {
  horizonMonths,
  type DcaComparisonInputs,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';
import type { StatSpec } from '@/lib/design-system/stat';
import { formatCurrency, formatMultiple } from '@/lib/format';
import { DISPLAY_INFLATION_ASSUMPTION, displayDollars, type DollarDisplayMode } from '@/lib/utils/displayDollars';
import { COMPACT, yearsText } from './narrative';

/** The horizon in years the ending balances lie in the future (whole months / 12). */
export function leverageHorizonYears(inputs: Pick<DcaComparisonInputs, 'years'>): number {
  return horizonMonths(inputs.years) / 12;
}

/**
 * A nominal leverage balance `yearsFromNow` out, in the given display mode,
 * at the fixed DISPLAY_INFLATION_ASSUMPTION. Display only.
 */
export function leverageDisplayDollars(nominal: number, mode: DollarDisplayMode, yearsFromNow: number): number {
  return displayDollars(nominal, mode, DISPLAY_INFLATION_ASSUMPTION, yearsFromNow);
}

function range(p10: number, p90: number): string {
  return `10th to 90th: ${formatCurrency(p10, COMPACT)} to ${formatCurrency(p90, COMPACT)}`;
}

export function leverageHeadline(
  result: DcaComparisonResult,
  inputs: DcaComparisonInputs,
  mode: DollarDisplayMode
): StatSpec[] {
  const L = formatMultiple(inputs.leverageRatio);
  const { index, leveraged } = result;
  const years = leverageHorizonYears(inputs);
  const show = (nominal: number) => leverageDisplayDollars(nominal, mode, years);
  return [
    {
      id: 'index-median',
      label: 'Index fund, median ending balance',
      value: show(index.dca.p50),
      format: 'currency',
      hint: range(show(index.dca.p10), show(index.dca.p90)),
    },
    {
      id: 'leveraged-median',
      label: `${L} fund, median ending balance`,
      value: show(leveraged.dca.p50),
      format: 'currency',
      hint: range(show(leveraged.dca.p10), show(leveraged.dca.p90)),
    },
    {
      id: 'behind',
      // The old tile printed the value first ("43% of simulated paths where
      // ..."); the label now sits above the value, so it names the share.
      label: `Share of simulated paths where the ${L} fund ends behind the index fund`,
      // Rounded to a whole percent, as the results have always shown it
      // ('percent' alone prints one decimal).
      value: Math.round(result.probLeveragedBehindDca * 100) / 100,
      format: 'percent',
      hint: `${formatCurrency(result.totalContributed)} contributed to each over ${yearsText(horizonMonths(inputs.years))} years, ${inputs.paths} paths`,
    },
  ];
}
