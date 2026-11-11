/**
 * The leverage comparison's headline figures (docs/rebuild-plan.md section
 * 2.11): the two median ending balances and the share of paths where the
 * leveraged fund ends behind, labelled and formatted once for the results
 * header and the dashboard card.
 */

import {
  horizonMonths,
  type DcaComparisonInputs,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';
import type { StatSpec } from '@/lib/design-system/stat';
import { formatCurrency, formatMultiple } from '@/lib/format';
import { COMPACT, yearsText } from './narrative';

function range(p10: number, p90: number): string {
  return `10th to 90th: ${formatCurrency(p10, COMPACT)} to ${formatCurrency(p90, COMPACT)}`;
}

export function leverageHeadline(result: DcaComparisonResult, inputs: DcaComparisonInputs): StatSpec[] {
  const L = formatMultiple(inputs.leverageRatio);
  const { index, leveraged } = result;
  return [
    {
      id: 'index-median',
      label: 'Index fund, median ending balance',
      value: index.dca.p50,
      format: 'currency',
      hint: range(index.dca.p10, index.dca.p90),
    },
    {
      id: 'leveraged-median',
      label: `${L} fund, median ending balance`,
      value: leveraged.dca.p50,
      format: 'currency',
      hint: range(leveraged.dca.p10, leveraged.dca.p90),
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
