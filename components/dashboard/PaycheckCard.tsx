'use client';

import React, { useMemo } from 'react';
import type { Route } from 'next';
import { Wallet } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { StepProgressBar } from '@/components/paycheck-allocator/StepProgressBar';
import { formatCurrency } from '@/lib/calculations/core';
import { FINANCIAL_STEPS } from '@/lib/constants/financialSteps';
import { paycheckLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { calculateStepStatus } from '@/lib/utils/stepStatusUtils';
import { CardLinkButton } from './CardLinkButton';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';
import { PAY_FREQUENCY_LABELS, sortAllocations } from './derive';

export interface PaycheckCardProps {
  profile: FinancialProfile;
  paycheckProfile: PaycheckProfile;
  allocation: AllocationResult | null;
}

const MAX_ROWS = 4;

export function PaycheckCard({ profile, paycheckProfile, allocation }: PaycheckCardProps) {
  const steps = useMemo(
    () => (allocation ? calculateStepStatus(FINANCIAL_STEPS, allocation.allocations, paycheckProfile) : []),
    [allocation, paycheckProfile]
  );

  const rows = allocation ? sortAllocations(allocation.allocations) : [];
  const shown = rows.slice(0, MAX_ROWS);
  const allocated = rows.reduce((sum, row) => sum + row.amount, 0);
  const context = allocation?.paycheckContext;
  const frequency = PAY_FREQUENCY_LABELS[profile.income.frequency];

  return (
    <BaseCard title="This paycheck" icon={Wallet} {...DASHBOARD_CARD_LAYOUT} testId="overview-paycheck">
      {!allocation ? (
        <p className="text-sm text-muted-foreground">
          The allocation could not be computed from the current profile. Open the allocator to check the inputs.
        </p>
      ) : (
        <div className="space-y-4">
          {context && (
            <p className="text-sm text-muted-foreground">
              Take-home{' '}
              <span className="font-medium tabular-nums text-foreground">{formatCurrency(context.netPaycheck)}</span>{' '}
              per {frequency} paycheck: <span className="tabular-nums">{formatCurrency(context.necessaryExpensesPerPaycheck)}</span>{' '}
              necessary expenses, <span className="tabular-nums">{formatCurrency(context.funMoneyPerPaycheck)}</span> fun money
              (the minimum), and <span className="tabular-nums">{formatCurrency(allocated + context.availablePerPaycheck)}</span>{' '}
              to allocate
              {context.availablePerPaycheck >= 1 && (
                <>
                  , of which <span className="tabular-nums">{formatCurrency(context.availablePerPaycheck)}</span> is not
                  assigned to a step
                </>
              )}
              .
            </p>
          )}

          {allocation.incomeShortfall !== undefined && (
            <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Necessary expenses exceed take-home pay by{' '}
              <span className="tabular-nums">{formatCurrency(allocation.incomeShortfall)}</span> per paycheck.
            </p>
          )}

          <StepProgressBar steps={steps} />

          {shown.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {shown.map((item) => (
                <li key={item.id} className="p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium text-foreground">{item.account}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reasoning}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing is left to allocate after necessary expenses and fun money.
            </p>
          )}

          {rows.length > shown.length && (
            <p className="text-xs text-muted-foreground">
              {rows.length - shown.length} more {rows.length - shown.length === 1 ? 'step' : 'steps'} in the allocator.
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <CardLinkButton href={paycheckLink(profile) as Route}>Open the allocator</CardLinkButton>
      </div>
    </BaseCard>
  );
}

export default PaycheckCard;
