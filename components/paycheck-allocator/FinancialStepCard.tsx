import React from 'react';
import { CheckCircle, Info, TrendingUp, Target } from 'lucide-react';
import { ExpandableListCard, CardVariant } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { BreakdownRow } from '@/components/calculators/shared/BreakdownRow';
import { StepStatus } from '@/lib/constants/financialSteps';
import { CONTRIBUTION_LIMITS_2026 } from '@/lib/constants/irs-2026';
import { PaycheckProfile } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface FinancialStepCardProps {
  step: StepStatus;
  profile: PaycheckProfile;
  expanded: boolean;
  onToggle: () => void;
}

function getVariant(step: StepStatus): CardVariant {
  switch (step.urgencyLevel) {
    case 'critical':
      return 'danger';
    case 'important':
      return 'warning';
    case 'optimization':
      return 'success';
    case 'none':
    default:
      if (step.isComplete) return 'success';
      if (step.isNotApplicable) return 'default';
      return 'default';
  }
}

function StepHeaderRight({ step, profile }: { step: StepStatus; profile: PaycheckProfile }) {
  if (step.isComplete || step.isNotApplicable) return null;

  // For allocation-based steps, show per-paycheck allocation amount
  if (step.allocation && ['employer-match', 'high-interest-debt', 'emergency-1month', 'emergency-full', 'taxable-investment'].includes(step.id)) {
    const frequencyText = profile.income.frequency === 'bi-weekly' ? 'bi-weekly' :
                         profile.income.frequency === 'semi-monthly' ? 'semi-monthly' :
                         profile.income.frequency === 'weekly' ? 'weekly' : 'monthly';
    return (
      <div className="text-right">
        <div className="text-sm font-bold text-info font-mono tabular-nums">
          {formatCurrency(step.allocation.amount)}
        </div>
        <div className="text-xs text-muted-foreground">per {frequencyText} paycheck</div>
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

  switch (step.id) {
    case 'additional-401k':
      if (profile.benefits.employer401k.available) {
        const age = profile.preferences.age;
        // Mirrors lib/calculations/optimization.ts: SECURE 2.0 super catch-up
        // applies only for ages 60-63; regular catch-up at 50+.
        const catchUp = age >= 60 && age <= 63
          ? CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k
          : age >= 50
            ? CONTRIBUTION_LIMITS_2026.catchUp['401k']
            : 0;
        current = profile.income.gross * (profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution) * 12;
        max = CONTRIBUTION_LIMITS_2026.traditional401k + catchUp;
        progressPercent = Math.round((current / max) * 100);
      }
      break;
    case 'roth-ira': {
      const rothLimit = CONTRIBUTION_LIMITS_2026.ira
        + (profile.preferences.age >= 50 ? CONTRIBUTION_LIMITS_2026.catchUp.ira : 0);
      current = (profile.benefits.ira?.currentContributions?.roth || 0) * 12;
      max = rothLimit;
      progressPercent = Math.round((current / max) * 100);
      break;
    }
    case 'hsa-max':
      if (profile.benefits.hsa.eligible) {
        const hsaLimit = profile.benefits.hsa.coverageType === 'family'
          ? CONTRIBUTION_LIMITS_2026.hsa.family
          : CONTRIBUTION_LIMITS_2026.hsa.individual;
        current = profile.benefits.hsa.currentContribution * 12;
        max = hsaLimit;
        progressPercent = Math.round((current / max) * 100);
      }
      break;
    default:
      return null;
  }

  if (max === 0) return null;

  const additional = max - current;
  const paychecksPerMonth = profile.income.frequency === 'bi-weekly' ? 26 / 12 :
                            profile.income.frequency === 'weekly' ? 52 / 12 :
                            profile.income.frequency === 'semi-monthly' ? 2 : 1;
  const additionalPerPaycheck = additional > 0 ? additional / 12 / paychecksPerMonth : 0;

  return (
    <div className="text-right">
      <div className="text-sm font-bold text-foreground font-mono tabular-nums">
        {formatCurrency(current)} of {formatCurrency(max)}
      </div>
      <div className="text-xs text-muted-foreground">
        ({progressPercent}% maxed annually)
      </div>
      {additional > 0 && (
        <div className="text-xs text-destructive mt-1">
          <span className="font-mono tabular-nums">{formatCurrency(additionalPerPaycheck)}</span> per paycheck needed
        </div>
      )}
    </div>
  );
}

function StepExpandedContent({ step }: { step: StepStatus }) {
  return (
    <div className="space-y-4">
      {/* Why It Matters */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Info className="w-4 h-4 text-info" aria-hidden="true" />
          <h4 className="font-medium text-foreground">Why This Matters</h4>
        </div>
        <p className="text-sm text-muted-foreground">{step.whyItMatters}</p>
      </div>

      {/* Financial Impact */}
      {(step.potentialSavings.monthly > 0 || step.potentialSavings.annual > 0) && (
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-success" aria-hidden="true" />
            <h4 className="font-medium text-foreground">Financial Impact</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <BreakdownRow
              label="Monthly Impact"
              value={`${step.urgencyLevel === 'critical' ? '-' : '+'}${formatCurrency(step.potentialSavings.monthly)}`}
              variant={step.urgencyLevel === 'critical' ? 'danger' : 'success'}
            />
            <BreakdownRow
              label="Annual Impact"
              value={`${step.urgencyLevel === 'critical' ? '-' : '+'}${formatCurrency(step.potentialSavings.annual)}`}
              variant="info"
            />
          </div>
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
          <StatusAlert variant="success" icon={CheckCircle}>
            <span className="font-medium text-success">Complete.</span>
          </StatusAlert>
        ) : step.isNotApplicable ? (
          <StatusAlert variant="info">
            <strong>Future opportunity:</strong> This step might become relevant if your situation changes
            (e.g., getting HSA eligibility, higher income, employer benefits).
          </StatusAlert>
        ) : step.urgencyLevel === 'critical' ? (
          <StatusAlert variant="danger">
            <strong>Highest impact:</strong> The model places this step ahead of the others still open,
            based on the monthly cost of leaving it as is.
          </StatusAlert>
        ) : step.urgencyLevel === 'important' ? (
          <StatusAlert variant="warning">
            <strong>High impact:</strong> Significant opportunity to optimize your financial situation.
          </StatusAlert>
        ) : (
          <StatusAlert variant="info">
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
  const variant = getVariant(step);

  const subtitle = step.recommendation + (
    step.potentialSavings.monthly > 0 && step.urgencyLevel === 'critical'
      ? ` — ${formatCurrency(step.potentialSavings.monthly)}/mo opportunity cost`
      : step.potentialSavings.monthly > 0
      ? ` — ${formatCurrency(step.potentialSavings.monthly)}/mo modeled gain`
      : ''
  );

  return (
    <ExpandableListCard
      icon={step.icon}
      title={step.name}
      subtitle={subtitle}
      variant={variant}
      expanded={expanded}
      onToggle={onToggle}
      headerRight={<StepHeaderRight step={step} profile={profile} />}
    >
      <StepExpandedContent step={step} />
    </ExpandableListCard>
  );
});
