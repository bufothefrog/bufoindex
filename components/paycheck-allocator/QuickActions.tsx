'use client';

import React, { useId, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRevealInputs } from '@/components/ui/layouts/CalculatorLayout';
import { KeyValueList } from '@/components/ui/results';
import { monthlyToPaycheck } from '@/lib/calculations/core';
import { limitHsa, limitIra } from '@/lib/calculations/contributionLimits';
import { PAYCHECK_FORM } from '@/lib/calculators/paycheck/form';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT, type Tone } from '@/lib/design-system/tone';
import { formatCurrency, formatMonths, formatPercent } from '@/lib/format';
import { PaycheckProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { highestRateHighInterestDebt } from '@/lib/utils/stepStatusUtils';

export interface QuickActionsProps {
  profile: PaycheckProfile;
}

type Urgency = 'critical' | 'important' | 'optimization';

/**
 * The impact of an action is split into a short figure and a prose qualifier.
 * The figure sits in the row's value column, which never shrinks, so a full
 * sentence there would overflow the row and paint over the label. The
 * qualifier wraps in the label column.
 */
interface QuickActionImpact {
  /** Short figure for the row's value column, e.g. "$45" or "$92/month". */
  value: string;
  /** Prose qualifier rendered under the row label, where it can wrap. */
  detail: string;
}

interface QuickAction {
  id: string;
  title: string;
  urgency: Urgency;
  impact: QuickActionImpact;
  timeToImplement: string;
  actionLabel: string;
  description: string;
  icon: LucideIcon;
  /** Monthly value of the action; orders actions of equal urgency. */
  monthlySavings: number;
  /** The id of the paycheck form screen that holds the inputs to change. */
  screen: string;
}

/** Each urgency's group heading, badge and tone, in display order. */
const URGENCY: Readonly<Record<Urgency, { heading: string; badge: string; tone: Tone; icon: LucideIcon }>> = {
  critical: { heading: 'Highest-Impact Items', badge: 'HIGHEST IMPACT', tone: 'negative', icon: AlertTriangle },
  important: { heading: 'High-Impact Optimizations', badge: 'HIGH IMPACT', tone: 'caution', icon: Target },
  optimization: { heading: 'Advanced Optimizations', badge: 'OPTIMIZATION', tone: 'positive', icon: TrendingUp },
};

const URGENCY_ORDER: readonly Urgency[] = ['critical', 'important', 'optimization'];

/**
 * Scrolls the calculator's input section for a form screen into view and
 * moves focus to it, so keyboard and screen-reader users land there too.
 * With a sticky tab bar over the viewport (topInset, the phone layout) the
 * section stops just below the bar, so its heading stays visible.
 */
function focusScreen(screenId: string, topInset = 0) {
  const title = PAYCHECK_FORM.screens.find((screen) => screen.id === screenId)?.title;
  if (!title) return;
  const section = document.querySelector<HTMLElement>(`section[aria-label="${title}"]`);
  if (!section) return;
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
  if (topInset > 0) {
    window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - topInset, behavior });
  } else {
    section.scrollIntoView({ behavior });
  }
  // A section is not focusable by default; -1 lets a script focus it without
  // adding it to the tab order.
  if (!section.hasAttribute('tabindex')) section.setAttribute('tabindex', '-1');
  section.focus({ preventScroll: true });
}

/** The actions for the current situation, most urgent first, then by monthly value. */
function generateQuickActions(profile: PaycheckProfile): QuickAction[] {
  const actions: QuickAction[] = [];
  const { frequency } = profile.income;
  const perPaycheck = PAY_FREQUENCY_META[frequency].phrase;
  const age = profile.preferences.age;

  // Missing employer match (critical)
  const plan = profile.benefits.employer401k;
  if (plan.available && plan.currentContribution < plan.matchLimit) {
    const monthlyGross = profile.income.gross;
    const potentialMatch = monthlyGross * plan.matchLimit * plan.matchPercent;
    const currentMatch = monthlyGross * plan.currentContribution * plan.matchPercent;
    const missedMatch = potentialMatch - currentMatch;
    const matchLimit = formatPercent(plan.matchLimit, { digits: 0 });

    actions.push({
      id: 'employer-match',
      title: 'Employer Match Not Fully Captured',
      urgency: 'critical',
      impact: {
        value: formatCurrency(monthlyToPaycheck(missedMatch, frequency)),
        detail: `unclaimed match per ${perPaycheck} paycheck`,
      },
      timeToImplement: '5 minutes',
      actionLabel: `Increase 401k to ${matchLimit}`,
      description: `Your employer matches contributions up to ${matchLimit} of salary. Contributing below that limit leaves the unmatched portion of the benefit unpaid.`,
      icon: Building2,
      monthlySavings: missedMatch,
      screen: '401k',
    });
  }

  // High-interest debt (critical). The allocator targets the highest-rate
  // qualifying debt, so this card names that same debt.
  const highInterestDebt = highestRateHighInterestDebt(profile.debts);
  if (highInterestDebt) {
    const monthlyInterest = (highInterestDebt.balance * highInterestDebt.interestRate) / 12;
    const rate = formatPercent(highInterestDebt.interestRate, { digits: 1 });

    actions.push({
      id: 'high-interest-debt',
      title: `${rate} Debt Accruing Interest`,
      urgency: 'critical',
      impact: {
        value: formatCurrency(monthlyToPaycheck(monthlyInterest, frequency)),
        detail: `in interest per ${perPaycheck} paycheck`,
      },
      timeToImplement: '6-24 months',
      actionLabel: 'Create Payoff Plan',
      description: `This balance accrues interest at ${rate} a year. Paying it down avoids that rate; whether that compares favorably to investing the same dollars depends on the return you expect.`,
      icon: CreditCard,
      monthlySavings: monthlyInterest,
      screen: 'debts',
    });
  }

  // Emergency fund under one month of expenses (important). The figure is
  // the months on hand, rounded down so it never reads as a full month; the
  // one-month line describes cash on hand; it is not a target.
  const { currentEmergencyFund, necessaryExpenses } = profile.preferences;
  if (currentEmergencyFund < necessaryExpenses) {
    const monthsOnHand = Math.max(0, Math.floor((currentEmergencyFund / necessaryExpenses) * 10) / 10);
    actions.push({
      id: 'emergency-fund',
      title: 'Emergency Fund Below One Month of Expenses',
      urgency: 'important',
      impact: {
        value: formatMonths(monthsOnHand),
        detail: 'of necessary expenses on hand',
      },
      timeToImplement: '3-6 months',
      actionLabel: 'Setup Emergency Fund',
      description:
        'Cash on hand covers less than one month of necessary expenses, so a minor emergency may mean borrowing at credit-card rates.',
      icon: Shield,
      monthlySavings: 0,
      screen: 'emergency-fund',
    });
  }

  // No HSA contributions (important)
  if (profile.benefits.hsa.eligible && profile.benefits.hsa.currentContribution === 0) {
    const hsaLimit = limitHsa(profile.benefits.hsa.coverageType, age);
    // Deduction value at the profile's own federal bracket, not a fixed rate.
    const bracket = Math.max(0, profile.taxes.federalBracket);
    const taxSavings = hsaLimit * bracket;

    actions.push({
      id: 'hsa-max',
      title: 'No HSA Contributions',
      urgency: 'important',
      impact: {
        value: `${formatCurrency(taxSavings / 12)}/month`,
        detail: `deferred tax at your ${formatPercent(bracket)} federal bracket`,
      },
      timeToImplement: '5 minutes',
      actionLabel: `Contribute ${formatCurrency(hsaLimit / 12)}/month to HSA`,
      description: 'HSA contributions are deductible, growth is untaxed, and withdrawals for qualified medical costs are untaxed. Non-medical withdrawals after 65 are taxed as income.',
      icon: PiggyBank,
      monthlySavings: taxSavings / 12,
      screen: 'hsa',
    });
  }

  // No Roth IRA contributions (important)
  if ((profile.benefits.ira?.currentContributions?.roth || 0) === 0) {
    const rothLimit = limitIra(age);
    const potentialGrowth = rothLimit * 0.07; // Assume 7% growth

    actions.push({
      id: 'roth-ira',
      title: 'No Roth IRA Contributions',
      urgency: 'important',
      impact: {
        value: `${formatCurrency(potentialGrowth / 12)}/month`,
        detail: 'at an assumed 7% return',
      },
      timeToImplement: '30 minutes',
      actionLabel: `Open Roth IRA - ${formatCurrency(rothLimit / 12)}/month`,
      description: 'Roth IRA contributions are made after tax; qualified withdrawals are untaxed, and contributions themselves can be withdrawn at any time without penalty.',
      icon: TrendingUp,
      monthlySavings: potentialGrowth / 12,
      screen: 'ira-taxable',
    });
  }

  return actions.sort((a, b) =>
    URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency) || b.monthlySavings - a.monthlySavings
  );
}

interface ActionCardProps {
  action: QuickAction;
}

function ActionCard({ action }: ActionCardProps) {
  const titleId = useId();
  const revealInputs = useRevealInputs();
  const Icon = action.icon;
  const { tone, badge } = URGENCY[action.urgency];

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      className={cn('transition-all duration-200 hover:shadow-md', TONE_BORDER[tone], TONE_SURFACE[tone])}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="p-2 rounded-full bg-card shadow-xs">
            <Icon className={cn('w-5 h-5', TONE_TEXT[tone])} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 id={titleId} className="font-semibold text-sm">
                {action.title}
              </h4>
              <span
                className={cn(
                  'shrink-0 px-2 py-1 rounded-full border bg-card text-xs font-medium',
                  TONE_BORDER[tone],
                  TONE_TEXT[tone]
                )}
              >
                {badge}
              </span>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{action.description}</p>

            <KeyValueList
              className="space-y-1 mb-3"
              items={[
                {
                  id: 'impact',
                  icon: DollarSign,
                  label: 'Impact',
                  subtitle: action.impact.detail,
                  value: action.impact.value,
                  tone: 'positive',
                },
                {
                  id: 'time',
                  icon: Clock,
                  label: 'Time to implement',
                  value: action.timeToImplement,
                  tone: 'info',
                },
              ]}
            />

            <Button onClick={() => revealInputs(({ topInset }) => focusScreen(action.screen, topInset))} className="w-full text-sm" size="sm">
              <Zap className="w-4 h-4 mr-2" aria-hidden="true" />
              {action.actionLabel}
              <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const QuickActions = React.memo(function QuickActions({ profile }: QuickActionsProps) {
  const quickActions = useMemo(() => generateQuickActions(profile), [profile]);

  if (quickActions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {URGENCY_ORDER.map((urgency) => {
        const actions = quickActions.filter((action) => action.urgency === urgency);
        if (actions.length === 0) return null;
        const { heading, tone, icon: Icon } = URGENCY[urgency];
        return (
          <div key={urgency} className="space-y-3">
            <div className="flex items-center space-x-2">
              <Icon className={cn('w-5 h-5', TONE_TEXT[tone])} aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">{heading}</h3>
            </div>
            <div className="space-y-3">
              {actions.map((action) => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default QuickActions;
