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
  { id: 'emergency-1month', name: '1-Month Emergency Fund', category: 'emergency_fund', priority: 1, icon: Shield },
  { id: 'employer-match', name: 'Employer 401k Match', category: 'employer_match', priority: 2, icon: Building2 },
  { id: 'high-interest-debt', name: 'High-Interest Debt (7%+)', category: 'high_interest_debt', priority: 3, icon: CreditCard },
  { id: 'emergency-full', name: 'Complete Emergency Fund', category: 'emergency_fund', priority: 4, icon: Shield },
  { id: 'hsa-max', name: 'HSA Maximum', category: 'tax_advantaged', priority: 5, icon: PiggyBank },
  { id: 'roth-ira', name: 'Roth IRA Maximum', category: 'tax_advantaged', priority: 6, icon: PiggyBank },
  { id: 'additional-401k', name: '401k Maximum', category: 'tax_advantaged', priority: 7, icon: Building2 },
  { id: 'mega-backdoor', name: 'Mega Backdoor Roth', category: 'tax_optimization', priority: 8, icon: TrendingUp },
  { id: 'taxable-investment', name: 'Taxable Investment', category: 'investment', priority: 9, icon: TrendingUp },
];
