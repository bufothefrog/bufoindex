/**
 * The paycheck form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer), and its intake destination. The wizard and the
 * calculator page pick them up through RENDERERS in ./index.ts.
 *
 * - debtRate: a debt row's badge, placing its rate against the line the
 *   allocator uses for high-interest debt. It states the rule, not advice
 *   (the old DebtInput told visitors what to prioritize).
 * - debtTotals: the debts' total balance and monthly payments. In the
 *   intake, an empty list offers "I have no debts", which submits the
 *   screen with the empty list as the answer (O4).
 */

import React from 'react';
import type { CustomRendererProps, CustomRenderers } from '@/components/fields/types';
import { Button } from '@/components/ui/button';
import { KeyValueList } from '@/components/ui/results';
import { HIGH_INTEREST_THRESHOLD } from '@/lib/calculations/contributionLimits';
import { DEBT_RATE_RENDERER, DEBT_TOTALS_RENDERER } from '@/lib/calculators/paycheck/fields';
import { calculatorHref } from '@/lib/calculators/registry';
import { isRecord } from '@/lib/fields/paths';
import { isFiniteNumber } from '@/lib/fields/runtime';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT, type Tone } from '@/lib/design-system/tone';
import { formatPercent } from '@/lib/format';
import type { FinancialProfile } from '@/lib/profile/types';
import { cn } from '@/lib/utils';

const LINE = formatPercent(HIGH_INTEREST_THRESHOLD, { digits: 0 });

function numberIn(row: unknown, key: string): number {
  const value = isRecord(row) ? row[key] : undefined;
  return isFiniteNumber(value) ? value : 0;
}

/** The rate badge on a debt row (the row is the value). */
function DebtRate({ value }: CustomRendererProps) {
  const high = numberIn(value, 'interestRate') > HIGH_INTEREST_THRESHOLD;
  const tone: Tone = high ? 'caution' : 'neutral';
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs font-medium',
        TONE_BORDER[tone],
        TONE_SURFACE[tone],
        high ? TONE_TEXT[tone] : 'text-muted-foreground'
      )}
    >
      {high ? `High-interest (over ${LINE})` : `${LINE} or less`}
    </span>
  );
}

/** The totals under the debts list (the rows are the value); the intake's one-tap "no debts" when it is empty. */
function DebtTotals({ value, size }: CustomRendererProps) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length === 0) {
    return size === 'lg' ? (
      <Button type="submit" variant="outline" className="h-12 w-full text-base">
        I have no debts
      </Button>
    ) : null;
  }
  const balance = rows.reduce((sum: number, row) => sum + numberIn(row, 'balance'), 0);
  const payments = rows.reduce(
    (sum: number, row) => sum + numberIn(row, 'minimumPayment') + numberIn(row, 'extraPayment'),
    0
  );
  return (
    <KeyValueList
      items={[
        { id: 'balance', label: 'Total debt', value: balance, format: 'currency' },
        { id: 'payments', label: 'Monthly payments', value: payments, format: 'currency' },
      ]}
    />
  );
}

export const PAYCHECK_RENDERERS: CustomRenderers = {
  [DEBT_RATE_RENDERER]: DebtRate,
  [DEBT_TOTALS_RENDERER]: DebtTotals,
};

/**
 * Where the paycheck intake leads once finished: the allocator, which reads
 * the saved profile itself, so the link carries only the handoff marker. The
 * wizard reads it through INTAKE_DESTINATION in ./index.ts.
 */
export const PAYCHECK_INTAKE_DESTINATION: (profile: FinancialProfile) => string = () =>
  calculatorHref('paycheck', { fromProfile: true });
