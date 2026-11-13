import { Shield, Building2, CreditCard, PiggyBank, TrendingUp } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { AllocationItem } from '@/lib/types';

export interface FinancialStep {
  id: string;
  name: string;
  category: string;
  priority: number;
  icon: LucideIcon;
}

export type UrgencyLevel = 'critical' | 'important' | 'optimization' | 'none';

export interface StepStatus extends FinancialStep {
  allocation: AllocationItem | undefined;
  isComplete: boolean;
  isUrgent: boolean;
  isNotApplicable: boolean;
  isRecommendation: boolean;
  recommendation: string;
  urgencyLevel: UrgencyLevel;
  potentialSavings: { monthly: number; annual: number };
  implementationTime: string;
  implementationSteps: string[];
  whyItMatters: string;
}

export const FINANCIAL_STEPS: FinancialStep[] = [
  { id: 'emergency-1month', name: 'Starter Emergency Fund', category: 'emergency_fund', priority: 1, icon: Shield },
  { id: 'employer-match', name: 'Employer 401k Match', category: 'employer_match', priority: 2, icon: Building2 },
  { id: 'high-interest-debt', name: 'High-Interest Debt (7%+)', category: 'high_interest_debt', priority: 3, icon: CreditCard },
  { id: 'emergency-full', name: 'Complete Emergency Fund', category: 'emergency_fund', priority: 4, icon: Shield },
  { id: 'hsa-max', name: 'HSA Maximum', category: 'tax_advantaged', priority: 5, icon: PiggyBank },
  { id: 'roth-ira', name: 'Roth IRA Maximum', category: 'tax_advantaged', priority: 6, icon: PiggyBank },
  { id: 'additional-401k', name: '401k Maximum', category: 'tax_advantaged', priority: 7, icon: Building2 },
  { id: 'mega-backdoor', name: 'Mega Backdoor Roth', category: 'tax_optimization', priority: 8, icon: TrendingUp },
  { id: 'taxable-investment', name: 'Taxable Investment', category: 'investment', priority: 9, icon: TrendingUp },
];

/** The account name the allocation engine gives its first emergency fund step. */
export const ENGINE_STARTER_FUND_ACCOUNT = '1-Month Emergency Fund';

/** What the starter step is called on screen. */
export const STARTER_FUND_LABEL = 'Starter Emergency Fund';

/** What the starter step says it does on screen. */
export const STARTER_FUND_REASONING =
  'A first cash buffer for small surprises, built before the steps below and before the full emergency fund target.';

/** The text of an allocation item a page shows. */
export interface AllocationDisplayText {
  account: string;
  reasoning: string;
  implementation: string;
}

/**
 * The on-screen label for an engine account name. Only the starter step is
 * renamed; every other name is returned unchanged. Comparisons that identify
 * a step keep using the raw engine name.
 */
export function allocationDisplayLabel(account: string): string {
  return account === ENGINE_STARTER_FUND_ACCOUNT ? STARTER_FUND_LABEL : account;
}

/**
 * The account, reasoning and implementation text a page shows for an
 * allocation item. The engine's starter step names one month of expenses as
 * its goal; on screen it is the starter fund, a first buffer before the full
 * target. Every other item is shown as the engine wrote it.
 */
export function allocationDisplayText(
  item: Pick<AllocationItem, 'account' | 'reasoning' | 'implementation'>
): AllocationDisplayText {
  if (item.account !== ENGINE_STARTER_FUND_ACCOUNT) {
    return { account: item.account, reasoning: item.reasoning, implementation: item.implementation };
  }
  return {
    account: STARTER_FUND_LABEL,
    reasoning: STARTER_FUND_REASONING,
    implementation: item.implementation.replace(/1-month emergency fund/gi, 'the starter emergency fund'),
  };
}
