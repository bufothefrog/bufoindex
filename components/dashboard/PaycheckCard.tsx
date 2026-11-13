'use client';

import React, { useMemo } from 'react';
import type { Route } from 'next';
import { Wallet } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { StepProgressBar } from '@/components/paycheck-allocator/StepProgressBar';
import { BaseCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { KeyValueList } from '@/components/ui/results';
import { paycheckFlow } from '@/lib/calculators/paycheck/headline';
import { calculatorHref } from '@/lib/calculators/registry';
import { FINANCIAL_STEPS } from '@/lib/constants/financialSteps';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { sortAllocations } from '@/lib/dashboard/derive';
import { formatCurrency } from '@/lib/format';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { calculateStepStatus } from '@/lib/utils/stepStatusUtils';
import { CardLinkButton } from './CardLinkButton';

export interface PaycheckCardProps {
  /** The allocator's engine inputs for the profile (engineInputsFor). */
  inputs: PaycheckProfile;
  /** The allocation for `inputs`, or null when it could not be computed. */
  allocation: AllocationResult | null;
}

const MAX_ROWS = 4;

export function PaycheckCard({ inputs, allocation }: PaycheckCardProps) {
  const steps = useMemo(
    () => (allocation ? calculateStepStatus(FINANCIAL_STEPS, allocation.allocations, inputs) : []),
    [allocation, inputs]
  );

  const rows = allocation ? sortAllocations(allocation.allocations) : [];
  const shown = rows.slice(0, MAX_ROWS);
  const context = allocation?.paycheckContext;
  const flow = allocation ? paycheckFlow(allocation, inputs) : null;
  const frequency = PAY_FREQUENCY_META[inputs.income.frequency].phrase;

  return (
    <BaseCard title="This paycheck" icon={Wallet} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-paycheck">
      {!allocation || !flow ? (
        <p className="text-sm text-muted-foreground">
          The allocation could not be computed from the current profile. Open the allocator to check the inputs.
        </p>
      ) : (
        <div className="space-y-4">
          {context && (
            <p className="text-sm text-muted-foreground">
              Take-home{' '}
              <span className="font-medium tabular-nums text-foreground">{formatCurrency(flow.takeHome)}</span> per{' '}
              {frequency} paycheck:{' '}
              <span className="tabular-nums">{formatCurrency(context.necessaryExpensesPerPaycheck)}</span> necessary
              expenses, <span className="tabular-nums">{formatCurrency(context.funMoneyPerPaycheck)}</span> fun money
              (the minimum), and{' '}
              {/* The priority share of the paycheck flow; nothing is left to allocate when spending exceeds take-home pay. */}
              <span className="tabular-nums">{formatCurrency(Math.max(0, flow.priority))}</span> to allocate
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
            <StatusAlert tone="caution" appearance="tinted">
              Necessary expenses exceed take-home pay by{' '}
              <span className="tabular-nums">{formatCurrency(allocation.incomeShortfall)}</span> per paycheck.
            </StatusAlert>
          )}

          <StepProgressBar steps={steps} />

          {shown.length > 0 ? (
            <KeyValueList
              items={shown.map((item) => ({
                id: item.id,
                label: item.account,
                subtitle: item.reasoning,
                value: item.amount,
                format: 'currency',
              }))}
            />
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
        <CardLinkButton href={calculatorHref('paycheck', { fromProfile: true }) as Route}>Open the allocator</CardLinkButton>
      </div>
    </BaseCard>
  );
}

export default PaycheckCard;
