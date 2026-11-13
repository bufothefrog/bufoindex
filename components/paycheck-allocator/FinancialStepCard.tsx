import React from 'react';
import { CheckCircle, Info, TrendingUp, Target } from 'lucide-react';
import { ExpandableListCard } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { KeyValueList } from '@/components/ui/results';
import { monthlyToPaycheck } from '@/lib/calculations/core';
import { limit401k, limitHsa, limitIra } from '@/lib/calculations/contributionLimits';
import { StepStatus } from '@/lib/constants/financialSteps';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { TONE_TEXT, type Tone } from '@/lib/design-system/tone';
import { formatCurrency } from '@/lib/format';
import { PaycheckProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface FinancialStepCardProps {
  step: StepStatus;
  profile: PaycheckProfile;
  expanded: boolean;
  onToggle: () => void;
}

function stepTone(step: StepStatus): Tone {
  switch (step.urgencyLevel) {
    case 'critical':
      return 'negative';
    case 'important':
      return 'caution';
    case 'optimization':
      return 'positive';
    default:
      return step.isComplete ? 'positive' : 'neutral';
  }
}

function StepHeaderRight({ step, profile }: { step: StepStatus; profile: PaycheckProfile }) {
  if (step.isComplete || step.isNotApplicable) return null;

  // For allocation-based steps, show per-paycheck allocation amount
  if (step.allocation && ['employer-match', 'high-interest-debt', 'emergency-full', 'taxable-investment'].includes(step.id)) {
    return (
      <div className="text-right">
        <div className={cn('text-sm font-bold font-mono tabular-nums', TONE_TEXT.info)}>
          {formatCurrency(step.allocation.amount)}
        </div>
        <div className="text-xs text-muted-foreground">per {PAY_FREQUENCY_META[profile.income.frequency].phrase} paycheck</div>
        {step.allocation.monthlyEquivalent && (
          <div className="text-xs text-muted-foreground">
            (<span className="font-mono tabular-nums">{formatCurrency(step.allocation.monthlyEquivalent)}/month</span>)
          </div>
        )}
      </div>
    );
  }

  // For maximization steps, show progress display
  let current = 0;
  let max = 0;
  let progressPercent = 0;

  const age = profile.preferences.age;
  switch (step.id) {
    case 'additional-401k':
      if (profile.benefits.employer401k.available) {
        current = profile.income.gross * (profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution) * 12;
        max = limit401k(age);
        progressPercent = Math.round((current / max) * 100);
      }
      break;
    case 'roth-ira':
      current = (profile.benefits.ira?.currentContributions?.roth || 0) * 12;
      max = limitIra(age);
      progressPercent = Math.round((current / max) * 100);
      break;
    case 'hsa-max':
      if (profile.benefits.hsa.eligible) {
        current = profile.benefits.hsa.currentContribution * 12;
        max = limitHsa(profile.benefits.hsa.coverageType, age);
        progressPercent = Math.round((current / max) * 100);
      }
      break;
    default:
      return null;
  }

  if (max === 0) return null;

  const additional = max - current;
  const additionalPerPaycheck = additional > 0
    ? monthlyToPaycheck(additional / 12, profile.income.frequency)
    : 0;

  return (
    <div className="text-right">
      <div className="text-sm font-bold text-foreground font-mono tabular-nums">
        {formatCurrency(current)} of {formatCurrency(max)}
      </div>
      <div className="text-xs text-muted-foreground">
        ({progressPercent}% of the annual limit)
      </div>
      {additional > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          <span className="font-mono tabular-nums">{formatCurrency(additionalPerPaycheck)}</span> per paycheck to reach the limit
        </div>
      )}
    </div>
  );
}

function StepExpandedContent({ step }: { step: StepStatus }) {
  const critical = step.urgencyLevel === 'critical';
  return (
    <div className="space-y-4">
      {/* Why It Matters */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Info className={cn('w-4 h-4', TONE_TEXT.info)} aria-hidden="true" />
          <h4 className="font-medium text-foreground">Why This Matters</h4>
        </div>
        <p className="text-sm text-muted-foreground">{step.whyItMatters}</p>
      </div>

      {/* Financial Impact */}
      {(step.potentialSavings.monthly > 0 || step.potentialSavings.annual > 0) && (
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className={cn('w-4 h-4', TONE_TEXT.positive)} aria-hidden="true" />
            <h4 className="font-medium text-foreground">Financial Impact</h4>
          </div>
          <KeyValueList
            layout="grid"
            items={[
              {
                id: 'monthly',
                label: 'Monthly Impact',
                value: step.potentialSavings.monthly,
                format: 'currency',
                prefix: critical ? '-' : '+',
                tone: critical ? 'negative' : 'positive',
              },
              {
                id: 'annual',
                label: 'Annual Impact',
                value: step.potentialSavings.annual,
                format: 'currency',
                prefix: critical ? '-' : '+',
                tone: 'info',
              },
            ]}
          />
        </div>
      )}

      {/* Implementation Steps */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Target className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <h4 className="font-medium text-foreground">How to Implement</h4>
        </div>
        <ol className="space-y-1 text-sm text-muted-foreground">
          {step.implementationSteps.map((stepText, idx) => (
            <li key={idx} className="flex items-start space-x-2">
              <span className="font-medium text-foreground min-w-[20px]">{idx + 1}.</span>
              <span>{stepText}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Status Messages */}
      <div className="pt-2 border-t border-border">
        {step.isComplete ? (
          <StatusAlert tone="positive" icon={CheckCircle}>
            <span className={cn('font-medium', TONE_TEXT.positive)}>Complete.</span>
          </StatusAlert>
        ) : step.isNotApplicable ? (
          <StatusAlert tone="info">
            <strong>Future opportunity:</strong> This step might become relevant if your situation changes
            (e.g., getting HSA eligibility, higher income, employer benefits).
          </StatusAlert>
        ) : critical ? (
          <StatusAlert tone="negative">
            <strong>Highest impact:</strong> The model places this step ahead of the others still open,
            based on the monthly cost of leaving it as is.
          </StatusAlert>
        ) : step.urgencyLevel === 'important' ? (
          <StatusAlert tone="caution">
            <strong>High impact:</strong> The dollar amounts in this step are large relative to the other open steps.
          </StatusAlert>
        ) : (
          <StatusAlert tone="info">
            <strong>Optimization opportunity:</strong> Consider this step once higher priority items are complete.
          </StatusAlert>
        )}
      </div>
    </div>
  );
}

export const FinancialStepCard = React.memo(function FinancialStepCard({
  step,
  profile,
  expanded,
  onToggle,
}: FinancialStepCardProps) {
  const subtitle = step.recommendation + (
    step.potentialSavings.monthly > 0 && step.urgencyLevel === 'critical'
      ? ` \u2014 ${formatCurrency(step.potentialSavings.monthly)}/mo opportunity cost`
      : step.potentialSavings.monthly > 0
      ? ` \u2014 ${formatCurrency(step.potentialSavings.monthly)}/mo modeled gain`
      : ''
  );

  return (
    <ExpandableListCard
      icon={step.icon}
      title={step.name}
      subtitle={subtitle}
      tone={stepTone(step)}
      expanded={expanded}
      onToggle={onToggle}
      headerRight={<StepHeaderRight step={step} profile={profile} />}
    >
      <StepExpandedContent step={step} />
    </ExpandableListCard>
  );
});

export default FinancialStepCard;
