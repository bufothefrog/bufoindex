/**
 * The paycheck allocator's headline figures (docs/rebuild-plan.md section
 * 2.11): where one take-home paycheck goes, labelled and formatted once for
 * the results (the payroll guide's paycheck flow) and the dashboard card.
 * Pure.
 */

import { monthlyToPaycheck } from '@/lib/calculations/core';
import type { StatSpec } from '@/lib/design-system/stat';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';

export interface PaycheckFlow {
  /** The take-home pay of one paycheck. */
  takeHome: number;
  /** Necessary expenses plus the allocated fun money, per paycheck. */
  spending: number;
  /** What is left for the priority allocations, per paycheck. */
  priority: number;
}

/**
 * Splits one paycheck into spending and priority money. Necessary expenses
 * and the allocated fun money are monthly, so they are converted to the pay
 * frequency; the priority share is the rest of the take-home pay.
 */
export function paycheckFlow(result: AllocationResult, inputs: PaycheckProfile): PaycheckFlow {
  const takeHome = inputs.income.netPaycheck;
  const spending = monthlyToPaycheck(
    inputs.preferences.necessaryExpenses + result.funMoneyAllocated,
    inputs.income.frequency
  );
  return { takeHome, spending, priority: takeHome - spending };
}

export function paycheckHeadline(result: AllocationResult, inputs: PaycheckProfile): StatSpec[] {
  const flow = paycheckFlow(result, inputs);
  return [
    { id: 'take-home', label: 'Take-Home Pay', value: flow.takeHome, format: 'currency' },
    { id: 'spending', label: 'Expenses + Fun Money', value: flow.spending, format: 'currency', tone: 'positive' },
    { id: 'priority', label: 'Priority Investments', value: flow.priority, format: 'currency', tone: 'info' },
  ];
}
