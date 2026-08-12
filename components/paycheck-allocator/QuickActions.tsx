'use client';

import React, { useMemo } from 'react';
import { monthlyToPaycheck } from '@/lib/calculations/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { AllocationItem, PaycheckProfile, SkippedItem } from '@/lib/types';
import { BreakdownRow } from '@/components/calculators/shared/BreakdownRow';
import {
  AlertTriangle,
  Target,
  TrendingUp,
  Clock,
  Zap,
  ArrowRight,
  DollarSign,
  Building2,
  CreditCard,
  Shield,
  PiggyBank
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  profile: PaycheckProfile;
  allocations: AllocationItem[];
  skippedItems: SkippedItem[];
}

interface QuickAction {
  id: string;
  title: string;
  urgency: 'critical' | 'important' | 'optimization';
  impact: string;
  timeToImplement: string;
  actionType: 'payroll' | 'bank' | 'one-time';
  actionLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  potentialSavings: {
    monthly: number;
    annual: number;
  };
  onAction: () => void;
}

const urgencyBorderStyles: Record<QuickAction['urgency'], string> = {
  critical: 'border-l-4 border-l-destructive',
  important: 'border-l-4 border-l-warning',
  optimization: 'border-l-4 border-l-success',
};

const urgencyIconStyles: Record<QuickAction['urgency'], string> = {
  critical: 'text-destructive',
  important: 'text-warning',
  optimization: 'text-success',
};

const urgencyBadgeStyles: Record<QuickAction['urgency'], string> = {
  critical: 'bg-destructive text-destructive-foreground',
  important: 'bg-warning text-warning-foreground',
  optimization: 'bg-success text-success-foreground',
};

const urgencyLabels: Record<QuickAction['urgency'], string> = {
  critical: 'URGENT',
  important: 'HIGH IMPACT',
  optimization: 'OPTIMIZATION',
};

// Generate quick actions based on the current situation. Module-scoped so
// the useMemo below can depend on `profile` alone.
function generateQuickActions(profile: PaycheckProfile): QuickAction[] {
  const actions: QuickAction[] = [];

  // Check for missing employer match (Critical)
  if (profile.benefits.employer401k.available &&
      profile.benefits.employer401k.currentContribution < profile.benefits.employer401k.matchLimit) {
    const monthlyGross = profile.income.gross;
    const potentialMatch = monthlyGross * profile.benefits.employer401k.matchLimit * profile.benefits.employer401k.matchPercent;
    const currentMatch = monthlyGross * profile.benefits.employer401k.currentContribution * profile.benefits.employer401k.matchPercent;
    const missedMatch = potentialMatch - currentMatch;

    // Convert to per-paycheck amount
    const frequency = profile.income.frequency;
    const missedMatchPerPaycheck = monthlyToPaycheck(missedMatch, frequency);

    const frequencyText = frequency === 'bi-weekly' ? 'bi-weekly' :
                         frequency === 'semi-monthly' ? 'semi-monthly' :
                         frequency === 'weekly' ? 'weekly' : 'monthly';

    actions.push({
      id: 'employer-match',
      title: 'Missing Free Money from Employer Match',
      urgency: 'critical',
      impact: `${formatCurrency(missedMatchPerPaycheck)} per ${frequencyText} paycheck guaranteed`,
      timeToImplement: '5 minutes',
      actionType: 'payroll',
      actionLabel: `Increase 401k to ${(profile.benefits.employer401k.matchLimit * 100).toFixed(0)}%`,
      description: 'Your employer will match contributions up to a certain percentage. Not getting the full match is leaving guaranteed returns on the table.',
      icon: Building2,
      potentialSavings: {
        monthly: missedMatch,
        annual: missedMatch * 12
      },
      onAction: () => {
        const element = document.querySelector('[data-section="employer-benefits"]');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Check for high-interest debt (Critical)
  const highInterestDebt = profile.debts.find(d => d.interestRate > 0.07);
  if (highInterestDebt) {
    const monthlyInterest = (highInterestDebt.balance * highInterestDebt.interestRate) / 12;

    // Convert to per-paycheck amount
    const frequency = profile.income.frequency;
    const interestPerPaycheck = monthlyToPaycheck(monthlyInterest, frequency);

    const frequencyText = frequency === 'bi-weekly' ? 'bi-weekly' :
                         frequency === 'semi-monthly' ? 'semi-monthly' :
                         frequency === 'weekly' ? 'weekly' : 'monthly';

    actions.push({
      id: 'high-interest-debt',
      title: `${(highInterestDebt.interestRate * 100).toFixed(1)}% Debt Costing You Money`,
      urgency: 'critical',
      impact: `${formatCurrency(interestPerPaycheck)} per ${frequencyText} paycheck in interest`,
      timeToImplement: '6-24 months',
      actionType: 'bank',
      actionLabel: 'Create Payoff Plan',
      description: 'High-interest debt compounds against you. Every paycheck you delay costs more than most investments can earn.',
      icon: CreditCard,
      potentialSavings: {
        monthly: monthlyInterest,
        annual: monthlyInterest * 12
      },
      onAction: () => {
        const element = document.querySelector('[data-section="debts"]');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Check for insufficient emergency fund (Important)
  if (profile.preferences.currentEmergencyFund < profile.preferences.necessaryExpenses) {
    actions.push({
      id: 'emergency-fund',
      title: 'Build 1-Month Emergency Fund',
      urgency: 'important',
      impact: 'Prevents debt during emergencies',
      timeToImplement: '3-6 months',
      actionType: 'bank',
      actionLabel: 'Setup Emergency Fund',
      description: 'Having at least 1 month of expenses saved prevents going into debt during minor emergencies.',
      icon: Shield,
      potentialSavings: {
        monthly: 0,
        annual: 0
      },
      onAction: () => {
        const element = document.querySelector('[data-section="emergency-fund"]');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Check for HSA opportunity (Important)
  if (profile.benefits.hsa.eligible && profile.benefits.hsa.currentContribution === 0) {
    const hsaLimit = profile.benefits.hsa.coverageType === 'family' ? 8300 : 4150;
    const monthlyMax = hsaLimit / 12;
    const taxSavings = hsaLimit * 0.22; // Assume 22% tax bracket

    actions.push({
      id: 'hsa-max',
      title: 'Triple Tax Advantage HSA',
      urgency: 'important',
      impact: `${formatCurrency(taxSavings/12)}/month tax savings`,
      timeToImplement: '5 minutes',
      actionType: 'payroll',
      actionLabel: `Contribute ${formatCurrency(monthlyMax)}/month to HSA`,
      description: 'HSA is the only triple tax-advantaged account: deductible contributions, tax-free growth, tax-free medical withdrawals.',
      icon: PiggyBank,
      potentialSavings: {
        monthly: taxSavings / 12,
        annual: taxSavings
      },
      onAction: () => {
        const element = document.querySelector('[data-section="hsa"]');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Check for Roth IRA opportunity (Important)
  const rothContribution = profile.benefits.ira?.currentContributions?.roth || 0;
  if (rothContribution === 0) {
    const rothLimit = profile.preferences.age >= 50 ? 8000 : 7000;
    const monthlyRoth = rothLimit / 12;
    const potentialGrowth = rothLimit * 0.07; // Assume 7% growth

    actions.push({
      id: 'roth-ira',
      title: 'Tax-Free Retirement Growth',
      urgency: 'important',
      impact: `${formatCurrency(potentialGrowth/12)}/month potential growth`,
      timeToImplement: '30 minutes',
      actionType: 'one-time',
      actionLabel: `Open Roth IRA - ${formatCurrency(monthlyRoth)}/month`,
      description: 'Roth IRA provides tax-free retirement income and penalty-free access to contributions for emergencies.',
      icon: TrendingUp,
      potentialSavings: {
        monthly: potentialGrowth / 12,
        annual: potentialGrowth
      },
      onAction: () => {
        const element = document.querySelector('[data-section="ira"]');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  return actions.sort((a, b) => {
    const urgencyOrder = { critical: 0, important: 1, optimization: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.potentialSavings.monthly - a.potentialSavings.monthly;
  });
}

export const QuickActions = React.memo(function QuickActions({ profile }: QuickActionsProps) {
  const quickActions = useMemo(() => generateQuickActions(profile), [profile]);
  const criticalActions = useMemo(() => quickActions.filter(action => action.urgency === 'critical'), [quickActions]);
  const importantActions = useMemo(() => quickActions.filter(action => action.urgency === 'important'), [quickActions]);
  const optimizationActions = useMemo(() => quickActions.filter(action => action.urgency === 'optimization'), [quickActions]);

  if (quickActions.length === 0) {
    return null;
  }

  const ActionCard = ({ action }: { action: QuickAction }) => {
    const IconComponent = action.icon;

    return (
      <Card className={cn("transition-all duration-200 hover:shadow-md", urgencyBorderStyles[action.urgency])}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <div className="p-2 rounded-full bg-card shadow-xs">
              <IconComponent className={cn("w-5 h-5", urgencyIconStyles[action.urgency])} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">
                  {action.title}
                </h4>
                <span
                  className={cn("px-2 py-1 rounded-full text-xs font-medium", urgencyBadgeStyles[action.urgency])}
                  aria-label={`Priority: ${action.urgency === 'critical' ? 'urgent' : action.urgency === 'important' ? 'high impact' : 'optimization'}`}
                >
                  {urgencyLabels[action.urgency]}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{action.description}</p>

              <div className="space-y-1 mb-3">
                <BreakdownRow
                  icon={DollarSign}
                  label="Impact"
                  value={action.impact}
                  variant="success"
                />
                <BreakdownRow
                  icon={Clock}
                  label="Time to implement"
                  value={action.timeToImplement}
                  variant="info"
                />
              </div>

              <Button
                onClick={action.onAction}
                className="w-full text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                size="sm"
              >
                <Zap className="w-4 h-4 mr-2" aria-hidden="true" />
                {action.actionLabel}
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Critical Actions */}
      {criticalActions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-destructive">
              Fix These First - You&apos;re Losing Money
            </h3>
          </div>
          <div className="space-y-3">
            {criticalActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </div>
      )}

      {/* Important Actions */}
      {importantActions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-warning" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">
              High-Impact Optimizations
            </h3>
          </div>
          <div className="space-y-3">
            {importantActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </div>
      )}

      {/* Optimization Actions */}
      {optimizationActions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-success" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">
              Advanced Optimizations
            </h3>
          </div>
          <div className="space-y-3">
            {optimizationActions.map(action => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
