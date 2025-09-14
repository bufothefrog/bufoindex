'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { AllocationItem, PaycheckProfile, SkippedItem } from '@/lib/types';
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

export function QuickActions({ profile }: QuickActionsProps) {
  // Generate quick actions based on current situation
  const generateQuickActions = (): QuickAction[] => {
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
      const multiplier = frequency === 'weekly' ? 52/12 : 
                        frequency === 'bi-weekly' ? 26/12 : 
                        frequency === 'semi-monthly' ? 2 : 1;
      const missedMatchPerPaycheck = missedMatch / multiplier;
      
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
          // Scroll to 401k input section
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
      const multiplier = frequency === 'weekly' ? 52/12 : 
                        frequency === 'bi-weekly' ? 26/12 : 
                        frequency === 'semi-monthly' ? 2 : 1;
      const interestPerPaycheck = monthlyInterest / multiplier;
      
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
      // const needed = profile.preferences.necessaryExpenses - profile.preferences.currentEmergencyFund;
      
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
      // Sort by urgency first, then by potential savings
      const urgencyOrder = { critical: 0, important: 1, optimization: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.potentialSavings.monthly - a.potentialSavings.monthly;
    });
  };

  const quickActions = generateQuickActions();
  const criticalActions = quickActions.filter(action => action.urgency === 'critical');
  const importantActions = quickActions.filter(action => action.urgency === 'important');
  const optimizationActions = quickActions.filter(action => action.urgency === 'optimization');

  const getUrgencyStyles = (urgency: 'critical' | 'important' | 'optimization') => {
    switch (urgency) {
      case 'critical':
        return {
          card: 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900 hover:bg-red-100 dark:hover:bg-red-800',
          header: 'text-red-800 dark:text-red-200',
          icon: 'text-red-600 dark:text-red-400',
          button: 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white',
          badge: 'bg-red-500 dark:bg-red-600 text-white'
        };
      case 'important':
        return {
          card: 'border-yellow-200 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900 hover:bg-yellow-100 dark:hover:bg-yellow-800',
          header: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-600 dark:text-yellow-400',
          button: 'bg-yellow-600 dark:bg-yellow-700 hover:bg-yellow-700 dark:hover:bg-yellow-800 text-white',
          badge: 'bg-yellow-500 dark:bg-yellow-600 text-white'
        };
      case 'optimization':
        return {
          card: 'border-green-200 dark:border-green-600 bg-green-50 dark:bg-green-900 hover:bg-green-100 dark:hover:bg-green-800',
          header: 'text-green-800 dark:text-green-200',
          icon: 'text-green-600 dark:text-green-400',
          button: 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800 text-white',
          badge: 'bg-green-500 dark:bg-green-600 text-white'
        };
    }
  };

  if (quickActions.length === 0) {
    return null;
  }

  const ActionCard = ({ action }: { action: QuickAction }) => {
    const styles = getUrgencyStyles(action.urgency);
    const IconComponent = action.icon;

    return (
      <Card className={cn("transition-all duration-200 hover:shadow-md", styles.card)}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            <div className="p-2 rounded-full bg-white shadow-sm">
              <IconComponent className={cn("w-5 h-5", styles.icon)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className={cn("font-semibold text-sm", styles.header)}>
                  {action.title}
                </h4>
                <div className={cn("px-2 py-1 rounded-full text-xs font-medium", styles.badge)}>
                  {action.urgency === 'critical' ? 'URGENT' : 
                   action.urgency === 'important' ? 'HIGH IMPACT' : 'OPTIMIZATION'}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">{action.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
                <div className="flex items-center space-x-1">
                  <DollarSign className="w-3 h-3 text-green-500 dark:text-green-400" />
                  <span className="text-gray-600">{action.impact}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                  <span className="text-gray-600">{action.timeToImplement}</span>
                </div>
              </div>
              
              <Button 
                onClick={action.onAction}
                className={cn("w-full text-sm", styles.button)}
                size="sm"
              >
                <Zap className="w-4 h-4 mr-2" />
                {action.actionLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
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
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
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
            <Target className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
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
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
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
}