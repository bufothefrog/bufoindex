import React from 'react';
import { Shield } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards';
import { formatCurrency, formatPercent } from '@/lib/calculations/core';
import type { FinancialProfile } from '@/lib/profile/types';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';
import { StatTile } from './StatTile';
import {
  ASSUMED_PORTFOLIO_RETURN,
  formatMonths,
  STRATEGY_LABELS,
  summarizeCashBuffer,
} from './derive';

export interface CashBufferCardProps {
  profile: FinancialProfile;
}

export function CashBufferCard({ profile }: CashBufferCardProps) {
  const cash = summarizeCashBuffer(profile);

  return (
    <ResultCard title="Cash buffer" icon={Shield} {...DASHBOARD_CARD_LAYOUT} testId="overview-cash">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Emergency fund"
            value={formatCurrency(cash.balance)}
            hint={`Earning ${formatPercent(profile.cash.emergencyFundApy)} APY`}
          />
          <StatTile
            label="Months on hand"
            value={cash.monthsOnHand === null ? '-' : formatMonths(cash.monthsOnHand)}
            hint={
              cash.monthsOnHand === null
                ? 'Necessary expenses not set'
                : `At ${formatCurrency(cash.necessaryMonthly)}/mo necessary expenses`
            }
          />
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Target under each preset</h4>
          <div className="grid grid-cols-2 gap-3">
            {cash.presets.map((p) => {
              const active = p.preset === cash.activePreset;
              return (
                <StatTile
                  key={p.preset}
                  label={STRATEGY_LABELS[p.preset]}
                  value={formatCurrency(p.target)}
                  hint={formatMonths(p.months)}
                  emphasis={active}
                  badge={active ? 'Active' : undefined}
                />
              );
            })}
          </div>
          {cash.usesCustomTarget && (
            <p className="mt-2 text-xs text-muted-foreground">
              Your own target of {formatMonths(cash.activeMonths)} ({formatCurrency(cash.activeTarget)}) is used
              below instead of the preset.
            </p>
          )}
        </div>

        {cash.excess > 0 ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">{formatCurrency(cash.excess)}</span> sits above
            the {formatMonths(cash.activeMonths)} target. At an assumed {formatPercent(ASSUMED_PORTFOLIO_RETURN)}{' '}
            long-run portfolio return versus {formatPercent(profile.cash.emergencyFundApy)} APY, its expected cost is
            about <span className="font-medium tabular-nums text-foreground">{formatCurrency(cash.annualCostOfExcess)}</span>{' '}
            a year, in exchange for more cushion.
          </p>
        ) : cash.shortfall > 0 ? (
          <p className="text-sm text-muted-foreground">
            The fund is <span className="font-medium tabular-nums text-foreground">{formatCurrency(cash.shortfall)}</span>{' '}
            below the {formatMonths(cash.activeMonths)} target.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">The fund matches the {formatMonths(cash.activeMonths)} target.</p>
        )}

        <p className="text-xs text-muted-foreground">
          Job stability, a second household income, available credit, and insurance all change how much cash is
          enough. Both presets are starting points to compare, not answers.
        </p>
      </div>
    </ResultCard>
  );
}

export default CashBufferCard;
