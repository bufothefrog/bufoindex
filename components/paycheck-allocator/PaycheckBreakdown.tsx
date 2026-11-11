import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { AllocationItem, PaycheckProfile } from '@/lib/types';
import { DollarSign, ArrowDown } from 'lucide-react';
import { FINANCIAL_STEPS } from '@/lib/constants/financialSteps';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { TONE_TEXT } from '@/lib/design-system/tone';
import { cn } from '@/lib/utils';
import { calculateStepStatus } from '@/lib/utils/stepStatusUtils';
import { StepProgressBar } from './StepProgressBar';
import { FinancialStepCard } from './FinancialStepCard';
import { PaycheckSummaryBox } from './PaycheckSummaryBox';

export interface PaycheckBreakdownProps {
  profile: PaycheckProfile;
  allocations: AllocationItem[];
}

export const PaycheckBreakdown = React.memo(function PaycheckBreakdown({ profile, allocations }: PaycheckBreakdownProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const stepStatus = useMemo(
    () => calculateStepStatus(FINANCIAL_STEPS, allocations, profile),
    [allocations, profile]
  );

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-center justify-center">
          <DollarSign className={cn('w-6 h-6', TONE_TEXT.info)} aria-hidden="true" />
          <span>Your {PAY_FREQUENCY_META[profile.income.frequency].label} Paycheck Allocation</span>
        </CardTitle>
        <div className="space-y-3">
          <div className="text-center text-sm text-muted-foreground">
            Optimized allocation from your <span className="font-mono tabular-nums">{formatCurrency(profile.income.netPaycheck)}</span> take-home pay
          </div>
          <StepProgressBar steps={stepStatus} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <PaycheckSummaryBox profile={profile} />

          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="p-4 bg-muted rounded-lg border border-border">
            <div className="text-center text-sm font-medium text-foreground mb-3">
              Financial Order of Operations
            </div>
            <div className="space-y-3">
              {stepStatus.map(step => (
                <FinancialStepCard
                  key={step.id}
                  step={step}
                  profile={profile}
                  expanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStep(step.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default PaycheckBreakdown;
