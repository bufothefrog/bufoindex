/**
 * The portfolio rebalancer's headline figures (docs/rebuild-plan.md section
 * 2.11): the cash the plan puts to work, what it leaves over, and the total
 * drift from the target allocation before and after the plan, labelled and
 * formatted once for the results and the dashboard card. Pure.
 *
 * Every figure comes from the result, so the function takes no inputs; it
 * still fits a caller that passes (result, inputs).
 */

import type { RebalanceResultV2 } from '@/lib/calculations/portfolioRebalancing';
import type { StatSpec } from '@/lib/design-system/stat';
import { formatCurrency } from '@/lib/format';

/** The ids of the two cash figures; the other two are the drift figures. */
export const PORTFOLIO_CASH_STAT_IDS: readonly string[] = ['invested', 'cash-leftover'];

export function portfolioHeadline(result: RebalanceResultV2): StatSpec[] {
  const { totalSpent, totalDeposit, cashLeftover, totalDriftBefore, totalDriftAfter } = result;
  return [
    {
      id: 'invested',
      label: 'Invested',
      value: totalSpent,
      format: 'currency',
      hint: `of ${formatCurrency(totalDeposit)} deposit`,
    },
    {
      id: 'cash-leftover',
      label: 'Cash leftover',
      value: cashLeftover,
      format: 'currency',
      hint: cashLeftover > 0 ? 'Carry to next deposit' : 'Fully invested',
    },
    { id: 'drift-before', label: 'Total drift before', value: totalDriftBefore, format: 'percent-1' },
    { id: 'drift-after', label: 'Total drift after', value: totalDriftAfter, format: 'percent-1', tone: 'brand' },
  ];
}
