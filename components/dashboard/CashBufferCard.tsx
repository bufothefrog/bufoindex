import React from 'react';
import { Shield } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { StatGrid } from '@/components/ui/results';
import { ASSUMED_PORTFOLIO_RETURN, summarizeCashBuffer } from '@/lib/dashboard/derive';
import type { StatSpec } from '@/lib/design-system/stat';
import { formatCurrency, formatMonths, formatPercent } from '@/lib/format';
import type { FinancialProfile } from '@/lib/profile/types';

export interface CashBufferCardProps {
  profile: FinancialProfile;
}

export function CashBufferCard({ profile }: CashBufferCardProps) {
  const cash = summarizeCashBuffer(profile);

  const onHand: StatSpec[] = [
    {
      id: 'balance',
      label: 'Emergency fund',
      value: cash.balance,
      format: 'currency',
      // Accounts that hold the fund (a cash account, or a brokerage with the
      // tick) are named; the typed fund shows its APY.
      hint:
        cash.heldIn.length > 0
          ? `Held in ${cash.heldIn.join(', ')}`
          : `Earning ${formatPercent(profile.cash.emergencyFundApy)} APY`,
    },
    {
      id: 'months',
      label: 'Months on hand',
      value: cash.monthsOnHand,
      format: 'months',
      hint:
        cash.monthsOnHand === null
          ? 'Necessary expenses not set'
          : `At ${formatCurrency(cash.necessaryMonthly)}/mo necessary expenses`,
    },
    {
      id: 'target',
      label: 'Target',
      value: cash.target,
      format: 'currency',
      hint: `${formatMonths(cash.targetMonths)} of necessary expenses`,
    },
  ];

  return (
    <ResultCard title="Cash buffer" icon={Shield} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-cash">
      <div className="space-y-4">
        <StatGrid stats={onHand} />

        {cash.excess > 0 ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">{formatCurrency(cash.excess)}</span> sits above
            the {formatMonths(cash.targetMonths)} target. At an assumed {formatPercent(ASSUMED_PORTFOLIO_RETURN)}{' '}
            long-run portfolio return versus {formatPercent(profile.cash.emergencyFundApy)} APY, its expected cost is
            about <span className="font-medium tabular-nums text-foreground">{formatCurrency(cash.annualCostOfExcess)}</span>{' '}
            a year, in exchange for more cushion.
          </p>
        ) : cash.shortfall > 0 ? (
          <p className="text-sm text-muted-foreground">
            The fund is <span className="font-medium tabular-nums text-foreground">{formatCurrency(cash.shortfall)}</span>{' '}
            below the {formatMonths(cash.targetMonths)} target.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">The fund matches the {formatMonths(cash.targetMonths)} target.</p>
        )}

        <p className="text-xs text-muted-foreground">
          Job stability, a second household income, available credit, and insurance all change how much cash is
          enough.
        </p>
      </div>
    </ResultCard>
  );
}

export default CashBufferCard;
