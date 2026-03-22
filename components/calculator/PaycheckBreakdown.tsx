import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { AllocationItem, PaycheckProfile, SkippedItem } from '@/lib/types';
import { 
  DollarSign, 
  ArrowDown, 
  X, 
  CheckCircle, 
  Building2, 
  CreditCard, 
  Shield, 
  PiggyBank, 
  TrendingUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Target,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaycheckSummaryBox } from './PaycheckSummaryBox';

interface PaycheckBreakdownProps {
  profile: PaycheckProfile;
  allocations: AllocationItem[];
  skippedItems: SkippedItem[];
  remainingAmount: number;
  funMoneyAllocated: number;
}

type UrgencyLevel = 'critical' | 'important' | 'optimization' | 'none';

interface StepStatus {
  id: string;
  name: string;
  category: string;
  priority: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  allocation: AllocationItem | undefined;
  isComplete: boolean;
  isUrgent: boolean;
  isNotApplicable: boolean;
  isRecommendation: boolean;
  recommendation: string;
  urgencyLevel: UrgencyLevel;
  potentialSavings: {
    monthly: number;
    annual: number;
  };
  implementationTime: string;
  implementationSteps: string[];
  whyItMatters: string;
}

export function PaycheckBreakdown({ profile, allocations }: PaycheckBreakdownProps) {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());
  
  const toggleExpanded = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };
  
  // Define the complete financial order of operations
  const financialSteps = [
    { id: 'emergency-1month', name: '1-Month Emergency Fund', category: 'emergency_fund', priority: 1, icon: Shield, color: 'blue' },
    { id: 'employer-match', name: 'Employer 401k Match', category: 'employer_match', priority: 2, icon: Building2, color: 'green' },
    { id: 'high-interest-debt', name: 'High-Interest Debt (7%+)', category: 'high_interest_debt', priority: 3, icon: CreditCard, color: 'red' },
    { id: 'emergency-full', name: 'Complete Emergency Fund', category: 'emergency_fund', priority: 4, icon: Shield, color: 'yellow' },
    { id: 'hsa-max', name: 'HSA Maximum', category: 'tax_advantaged', priority: 5, icon: PiggyBank, color: 'purple' },
    { id: 'roth-ira', name: 'Roth IRA Maximum', category: 'tax_advantaged', priority: 6, icon: PiggyBank, color: 'indigo' },
    { id: 'additional-401k', name: '401k Maximum', category: 'tax_advantaged', priority: 7, icon: Building2, color: 'orange' },
    { id: 'mega-backdoor', name: 'Mega Backdoor Roth', category: 'tax_optimization', priority: 8, icon: TrendingUp, color: 'pink' },
    { id: 'taxable-investment', name: 'Taxable Investment', category: 'investment', priority: 9, icon: TrendingUp, color: 'teal' },
  ];

  // Calculate pre-tax deductions (401k match + additional)
  // const pretaxDeductions = allocations
  //   .filter(a => a.category === 'employer_match' || (a.category === 'tax_advantaged' && a.account.includes('401k')))
  //   .reduce((sum, a) => sum + a.amount, 0);

  // Map allocations to steps
  const stepStatus = financialSteps.map(step => {
    // More robust allocation matching
    const allocation = allocations.find(a => {
      switch (step.id) {
        case 'employer-match':
          return a.category === 'employer_match' || a.account.toLowerCase().includes('match');
        case 'emergency-1month':
          return a.category === 'emergency_fund' && a.account.toLowerCase().includes('emergency') && a.priority <= 2;
        case 'emergency-full':
          return a.category === 'emergency_fund' && a.account.toLowerCase().includes('emergency') && a.priority >= 3;
        case 'high-interest-debt':
          return a.category === 'high_interest_debt' || a.category === 'debt_payoff' || a.account.toLowerCase().includes('debt');
        case 'hsa-max':
          return a.account.toLowerCase().includes('hsa');
        case 'roth-ira':
          return a.account.toLowerCase().includes('roth') && a.account.toLowerCase().includes('ira');
        case 'additional-401k':
          return a.category === 'tax_advantaged' && a.account.toLowerCase().includes('401k') && !a.account.toLowerCase().includes('match');
        case 'mega-backdoor':
          return a.category === 'tax_optimization' && a.account.toLowerCase().includes('mega');
        case 'taxable-investment':
          return a.category === 'investment' && !a.account.toLowerCase().includes('retirement');
        default:
          return false;
      }
    });
    
    // Determine if this step is not applicable (gray)
    const isNotApplicable = (() => {
      switch (step.id) {
        case 'hsa-max':
          return !profile.benefits.hsa.eligible;
        case 'employer-match':
          return !profile.benefits.employer401k.available;
        case 'high-interest-debt':
          return !profile.debts.some(d => d.interestRate > 0.07);
        case 'mega-backdoor':
          return !profile.benefits.employer401k.afterTaxAvailable;
        default:
          return false;
      }
    })();

    // Determine if this step is complete (green) - finished optimally
    const isComplete = (() => {
      if (isNotApplicable) return false;
      
      switch (step.id) {
        case 'emergency-1month':
          return profile.preferences.currentEmergencyFund >= profile.preferences.necessaryExpenses;
        case 'employer-match':
          return profile.benefits.employer401k.available && 
                 profile.benefits.employer401k.currentContribution >= profile.benefits.employer401k.matchLimit;
        case 'high-interest-debt':
          return profile.debts.length === 0 || !profile.debts.some(d => d.interestRate > 0.07 && d.balance > 0);
        case 'emergency-full':
          return profile.preferences.currentEmergencyFund >= 
                 (profile.preferences.necessaryExpenses * profile.preferences.emergencyFundMonths);
        case 'hsa-max':
          if (!profile.benefits.hsa.eligible) return false;
          const hsaAnnualContribution = profile.benefits.hsa.currentContribution * 12;
          const hsaLimit = profile.preferences.age >= 55 
            ? (profile.benefits.hsa.coverageType === 'family' ? 9300 : 5150)
            : (profile.benefits.hsa.coverageType === 'family' ? 8300 : 4150);
          return hsaAnnualContribution >= (hsaLimit * 0.98); // 2% buffer
        case 'roth-ira':
          const rothContribution = profile.benefits.ira?.currentContributions?.roth || 0;
          const rothAnnualContribution = rothContribution * 12;
          const rothLimit = profile.preferences.age >= 50 ? 8000 : 7000;
          return rothAnnualContribution >= (rothLimit * 0.98); // 2% buffer
        case 'additional-401k':
          if (!profile.benefits.employer401k.available) return false;
          const employee401kContribution = profile.income.gross * profile.benefits.employer401k.currentContribution * 12;
          const employee401kLimit = profile.preferences.age >= 50 ? 30500 : 23000;
          return employee401kContribution >= (employee401kLimit * 0.98); // 2% buffer
        default:
          return false; // Most steps are ongoing optimizations, not "complete"
      }
    })();

    // Determine if this is urgent/costly (red) - actively costing money or blocking wealth
    const isUrgent = (() => {
      if (isNotApplicable || isComplete) return false;
      
      switch (step.id) {
        case 'high-interest-debt':
          return profile.debts.some(d => d.interestRate > 0.07 && d.balance > 0); // Always urgent until $0
        case 'employer-match':
          return profile.benefits.employer401k.available && 
                 profile.benefits.employer401k.currentContribution < profile.benefits.employer401k.matchLimit;
        case 'emergency-1month':
          return profile.preferences.currentEmergencyFund < profile.preferences.necessaryExpenses;
        default:
          return false;
      }
    })();
    
    // Calculate urgency level
    const getUrgencyLevel = (): UrgencyLevel => {
      if (isNotApplicable) return 'none';
      if (isComplete) return 'none';
      if (isUrgent) return 'critical';
      
      // Important but not urgent items
      if (['emergency-full', 'hsa-max', 'roth-ira', 'additional-401k'].includes(step.id)) {
        return 'important';
      }
      
      // Optimization items
      if (['mega-backdoor', 'taxable-investment'].includes(step.id)) {
        return 'optimization';
      }
      
      return 'important';
    };

    // Calculate potential savings
    const getPotentialSavings = () => {
      const monthlyGross = profile.income.gross;
      
      switch (step.id) {
        case 'employer-match':
          if (!profile.benefits.employer401k.available) return { monthly: 0, annual: 0 };
          const potentialMatch = monthlyGross * profile.benefits.employer401k.matchLimit * profile.benefits.employer401k.matchPercent;
          const currentMatch = monthlyGross * profile.benefits.employer401k.currentContribution * profile.benefits.employer401k.matchPercent;
          const missedMatch = Math.max(0, potentialMatch - currentMatch);
          return { monthly: missedMatch, annual: missedMatch * 12 };
        
        case 'high-interest-debt':
          const highDebt = profile.debts.find(d => d.interestRate > 0.07);
          if (!highDebt) return { monthly: 0, annual: 0 };
          const monthlyInterest = (highDebt.balance * highDebt.interestRate) / 12;
          return { monthly: monthlyInterest, annual: monthlyInterest * 12 };
        
        case 'hsa-max':
          if (!profile.benefits.hsa.eligible) return { monthly: 0, annual: 0 };
          const hsaLimit = profile.benefits.hsa.coverageType === 'family' ? 8300 : 4150;
          const currentHSA = profile.benefits.hsa.currentContribution * 12;
          const taxSavings = Math.max(0, hsaLimit - currentHSA) * 0.22; // Assume 22% tax bracket
          return { monthly: taxSavings / 12, annual: taxSavings };
        
        case 'roth-ira':
          const rothLimit = profile.preferences.age >= 50 ? 8000 : 7000;
          const currentRoth = (profile.benefits.ira?.currentContributions?.roth || 0) * 12;
          const potentialGrowth = Math.max(0, rothLimit - currentRoth) * 0.07; // Assume 7% growth
          return { monthly: potentialGrowth / 12, annual: potentialGrowth };
        
        default:
          return { monthly: 0, annual: 0 };
      }
    };

    // Get implementation steps
    const getImplementationSteps = (): string[] => {
      switch (step.id) {
        case 'emergency-1month':
          return [
            "Open a high-yield savings account (4%+ APY)",
            "Set up automatic transfer for emergency fund",
            "Start with $100-200/month until you reach target"
          ];
        
        case 'employer-match':
          return [
            "Log into your company's 401k portal",
            `Increase contribution to ${formatPercent(profile.benefits.employer401k.matchLimit)}`,
            "Change will take effect next payroll cycle"
          ];
        
        case 'high-interest-debt':
          return [
            "List all debts by interest rate (highest first)",
            "Pay minimums on all, extra on highest rate",
            "Consider balance transfer if available"
          ];
        
        case 'hsa-max':
          return [
            "Log into payroll portal",
            "Increase HSA contribution to maximum",
            "Set up investment options within HSA"
          ];
        
        case 'roth-ira':
          return [
            "Open Roth IRA at low-cost broker (Vanguard, Fidelity)",
            "Set up automatic $583/month transfer",
            "Invest in target-date fund or total market index"
          ];
        
        case 'emergency-full':
          const needed = profile.preferences.necessaryExpenses * profile.preferences.emergencyFundMonths;
          const monthlyNeeded = Math.max(0, (needed - profile.preferences.currentEmergencyFund) / 12);
          return [
            `Calculate total needed: ${formatCurrency(needed)}`,
            `Set automatic transfer for ${formatCurrency(monthlyNeeded)}/month`,
            "Park funds in high-yield savings (4%+ APY)"
          ];
        
        case 'additional-401k':
          const currentContrib = profile.benefits.employer401k.currentContribution;
          const maxLimit = profile.preferences.age >= 50 ? 30500 : 23000;
          const neededAnnual = maxLimit - (profile.income.gross * currentContrib * 12);
          const neededPercent = neededAnnual / (profile.income.gross * 12);
          return [
            "Log into company 401k portal",
            `Increase contribution by ${formatPercent(neededPercent)} more`,
            "Adjust budget for reduced take-home pay"
          ];
        
        case 'mega-backdoor':
          return [
            "Confirm after-tax 401k contributions allowed",
            "Set up in-service Roth conversions with provider",
            "Contribute up to annual limit ($69,000 total)"
          ];
        
        case 'taxable-investment':
          return [
            "Open brokerage account at low-cost provider",
            "Set up automatic monthly investment",
            "Buy low-cost index funds (VTI/VXUS)"
          ];
        
        default:
          return ["Contact your financial advisor for guidance"];
      }
    };

    // Get "why it matters" explanation
    const getWhyItMatters = (): string => {
      switch (step.id) {
        case 'emergency-1month':
          return "Prevents debt accumulation during minor emergencies. Having $1,000+ available reduces financial stress and gives you breathing room.";
        
        case 'employer-match':
          return "This is free money from your employer. Not getting the full match is leaving guaranteed returns on the table - it's an instant 50-100% return.";
        
        case 'high-interest-debt':
          return "High-interest debt compounds against you. Every month you delay costs you more in interest than most investments can earn.";
        
        case 'emergency-full':
          return "Full emergency fund provides true financial security. It allows you to invest more aggressively and take calculated risks.";
        
        case 'hsa-max':
          return "HSA is the only triple tax-advantaged account: deductible contributions, tax-free growth, tax-free medical withdrawals.";
        
        case 'roth-ira':
          return "Roth IRA provides tax-free retirement income and penalty-free access to contributions. Essential for tax diversification.";
        
        default:
          return "Optimizes your long-term wealth building strategy.";
      }
    };

    // Get implementation time estimate
    const getImplementationTime = (): string => {
      switch (step.id) {
        case 'emergency-1month':
        case 'emergency-full':
          return "3-6 months";
        case 'employer-match':
        case 'hsa-max':
          return "5 minutes";
        case 'high-interest-debt':
          return "6-24 months";
        case 'roth-ira':
          return "30 minutes setup";
        case 'additional-401k':
        case 'mega-backdoor':
        case 'taxable-investment':
          return "15 minutes";
        default:
          return "Varies";
      }
    };

    // Get recommendation text for this step
    const getRecommendation = () => {
      switch (step.id) {
        case 'emergency-1month':
          if (isComplete) return `Emergency fund complete (${formatCurrency(profile.preferences.currentEmergencyFund)})`;
          if (isUrgent) return `Need ${formatCurrency(profile.preferences.necessaryExpenses)} emergency fund`;
          return allocation ? `Building emergency fund` : `Build 1-month emergency fund`;
        
        case 'employer-match':
          if (isComplete) return `Employer match maximized`;
          if (isUrgent) return `Missing free money - increase 401k to ${formatPercent(profile.benefits.employer401k.matchLimit)}`;
          return allocation ? `Getting employer match` : `Contribute to get full employer match`;
        
        case 'high-interest-debt':
          const highDebt = profile.debts.find(d => d.interestRate > 0.07);
          if (isComplete) return `All high-interest debt paid off`;
          if (isUrgent) return `${formatPercent(highDebt?.interestRate || 0)} debt costing you money - prioritize payoff`;
          return allocation ? `Paying down high-interest debt` : `Pay off high-interest debt first`;
        
        case 'emergency-full':
          if (isComplete) return `Full emergency fund complete (${profile.preferences.emergencyFundMonths} months)`;
          return allocation ? `Building full emergency fund` : `Complete ${profile.preferences.emergencyFundMonths}-month emergency fund`;
        
        case 'hsa-max':
          return allocation ? `Maximizing HSA contributions` : profile.benefits.hsa.eligible ? `Contribute to HSA for triple tax advantage` : `Not HSA eligible`;
        
        case 'roth-ira':
          return allocation ? `Contributing to Roth IRA` : `Contribute $500/month to Roth IRA`;
        
        case 'additional-401k':
          if (!profile.benefits.employer401k.available) return `401k not available`;
          
          const currentEmployee401k = profile.benefits.employer401k.currentContribution;
          const maxEmployee401kLimit = profile.preferences.age >= 50 ? 30500 : 23000;
          const currentAnnualContribution = profile.income.gross * currentEmployee401k * 12;
          const additionalNeeded = Math.max(0, maxEmployee401kLimit - currentAnnualContribution);
          const additionalNeededMonthly = additionalNeeded / 12;
          const additionalPercentNeeded = additionalNeeded / (profile.income.gross * 12);
          
          if (isComplete) return `401k maximized at ${formatPercent(currentEmployee401k)}`;
          if (allocation) {
            return `Additional ${formatCurrency(additionalNeededMonthly)} (${formatPercent(additionalPercentNeeded)}) needed for max`;
          }
          return `Additional ${formatCurrency(additionalNeededMonthly)} (${formatPercent(additionalPercentNeeded)}) contributions needed for max`;
        
        case 'mega-backdoor':
          return allocation ? `Mega backdoor Roth strategy` : profile.benefits.employer401k.afterTaxAvailable ? `High earner mega backdoor Roth opportunity` : `Mega backdoor not available`;
        
        case 'taxable-investment':
          return allocation ? `Investing in taxable account` : `Invest remaining funds in index funds`;
        
        default:
          return allocation ? `Active` : `Available`;
      }
    };
    
    return {
      ...step,
      allocation,
      isComplete,
      isUrgent,
      isNotApplicable,
      isRecommendation: !isComplete && !isUrgent && !isNotApplicable,
      recommendation: getRecommendation(),
      urgencyLevel: getUrgencyLevel(),
      potentialSavings: getPotentialSavings(),
      implementationTime: getImplementationTime(),
      implementationSteps: getImplementationSteps(),
      whyItMatters: getWhyItMatters()
    } as StepStatus;
  });

  // Calculate progress metrics
  const totalApplicableSteps = stepStatus.filter(step => !step.isNotApplicable).length;
  const completedSteps = stepStatus.filter(step => step.isComplete).length;
  const progressPercentage = totalApplicableSteps > 0 ? Math.round((completedSteps / totalApplicableSteps) * 100) : 0;
  const criticalIssues = stepStatus.filter(step => step.urgencyLevel === 'critical').length;
  const importantItems = stepStatus.filter(step => step.urgencyLevel === 'important').length;

  // Show all steps - completed items for celebration, non-applicable for roadmap visibility
  const visibleSteps = stepStatus;


  const getUrgencyStyles = (step: StepStatus) => {
    switch (step.urgencyLevel) {
      case 'critical':
        return {
          card: 'border-destructive bg-destructive/5 shadow-lg',
          text: 'text-destructive',
          icon: 'text-destructive',
          badge: 'bg-destructive text-destructive-foreground'
        };
      case 'important':
        return {
          card: 'border-warning bg-warning/5',
          text: 'text-foreground',
          icon: 'text-warning',
          badge: 'bg-warning text-warning-foreground'
        };
      case 'optimization':
        return {
          card: 'border-success bg-success/5',
          text: 'text-foreground',
          icon: 'text-success',
          badge: 'bg-success text-success-foreground'
        };
      default:
        if (step.isComplete) {
          return {
            card: 'border-success bg-success/5',
            text: 'text-success',
            icon: 'text-success',
            badge: 'bg-success text-success-foreground'
          };
        }
        if (step.isNotApplicable) {
          return {
            card: 'border-border bg-muted',
            text: 'text-muted-foreground',
            icon: 'text-muted-foreground',
            badge: 'bg-muted text-foreground'
          };
        }
        return {
          card: 'border-info bg-info/5',
          text: 'text-info',
          icon: 'text-info',
          badge: 'bg-info text-info-foreground'
        };
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-center justify-center">
          <DollarSign className="w-6 h-6 text-info" />
          <span>Your {profile.income.frequency === 'bi-weekly' ? 'Bi-Weekly' : 
                     profile.income.frequency === 'semi-monthly' ? 'Semi-Monthly' : 
                     profile.income.frequency === 'weekly' ? 'Weekly' : 'Monthly'} Paycheck Allocation</span>
        </CardTitle>
        <div className="space-y-3">
          <div className="text-center text-sm text-muted-foreground">
            Optimized allocation from your <span className="font-mono tabular-nums">{formatCurrency(profile.income.netPaycheck)}</span> take-home pay
          </div>
          
          {/* Progress Bar and Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Optimization Progress: {completedSteps} of {totalApplicableSteps} steps
              </span>
              <span className="text-info font-semibold">{progressPercentage}% Complete</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-info h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {(criticalIssues > 0 || importantItems > 0) && (
              <div className="flex items-center space-x-4 text-sm">
                {criticalIssues > 0 && (
                  <div className="flex items-center space-x-1 text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{criticalIssues} Critical Issue{criticalIssues !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {importantItems > 0 && (
                  <div className="flex items-center space-x-1 text-warning">
                    <Target className="w-4 h-4" />
                    <span>{importantItems} Optimization{importantItems !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Paycheck Summary */}
          <PaycheckSummaryBox profile={profile} />

          <div className="flex justify-center">
            <ArrowDown className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* Enhanced Financial Order of Operations */}
          <div className="p-4 bg-muted rounded-lg border border-border">
            <div className="text-center text-sm font-medium text-foreground mb-3">
              Financial Order of Operations
            </div>
            <div className="space-y-3">
            {visibleSteps.map((step) => {
              const styles = getUrgencyStyles(step);
              const isExpanded = expandedSteps.has(step.id);
              
              return (
                <div key={step.id} className="space-y-2">
                  {/* Main Step Card */}
                  <div className={cn(
                    "border-l-4 rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer",
                    styles.card
                  )}
                  onClick={() => toggleExpanded(step.id)}>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                          styles.badge
                        )}>
                          {step.isComplete ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center text-xs font-bold text-foreground border">
                                {step.priority}
                              </div>
                            </>
                          ) : step.urgencyLevel === 'critical' ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : step.urgencyLevel === 'important' ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : step.isNotApplicable ? (
                            <>
                              <X className="w-4 h-4" />
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground border">
                                {step.priority}
                              </div>
                            </>
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className={cn("text-sm font-semibold", styles.text)}>
                            {step.name}
                            {step.urgencyLevel === 'critical' && step.potentialSavings.monthly > 0 && (
                              <span className="ml-2 text-destructive font-bold">
                                Losing <span className="font-mono tabular-nums">{formatCurrency(step.potentialSavings.monthly)}/mo</span>
                              </span>
                            )}
                          </div>
                          <div className={cn("text-xs", styles.text.replace('800', '600'))}>
                            {step.recommendation}
                            {step.potentialSavings.monthly > 0 && step.urgencyLevel !== 'critical' && (
                              <span className="ml-2 font-medium">
                                • Save <span className="font-mono tabular-nums">{formatCurrency(step.potentialSavings.monthly)}/mo</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {!step.isComplete && !step.isNotApplicable && (
                          <div className="text-right">
                            {(() => {
                              // For allocation-based steps, show per-paycheck allocation amount
                              if (step.allocation && ['employer-match', 'high-interest-debt', 'emergency-1month', 'emergency-full', 'taxable-investment'].includes(step.id)) {
                                const frequencyText = profile.income.frequency === 'bi-weekly' ? 'bi-weekly' : 
                                                     profile.income.frequency === 'semi-monthly' ? 'semi-monthly' : 
                                                     profile.income.frequency === 'weekly' ? 'weekly' : 'monthly';
                                return (
                                  <div>
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
                                    const maxLimit = profile.preferences.age >= 50 ? 30500 : 23000;
                                    current = profile.income.gross * (profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution) * 12;
                                    max = maxLimit;
                                    progressPercent = Math.round((current / max) * 100);
                                  }
                                  break;
                                case 'roth-ira':
                                  const rothLimit = profile.preferences.age >= 50 ? 8000 : 7000;
                                  current = (profile.benefits.ira?.currentContributions?.roth || 0) * 12;
                                  max = rothLimit;
                                  progressPercent = Math.round((current / max) * 100);
                                  break;
                                case 'hsa-max':
                                  if (profile.benefits.hsa.eligible) {
                                    const hsaLimit = profile.benefits.hsa.coverageType === 'family' ? 8300 : 4150;
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
                              const additionalPerPaycheck = additional > 0 ? additional / 12 / (profile.income.frequency === 'bi-weekly' ? 26/12 : profile.income.frequency === 'weekly' ? 52/12 : profile.income.frequency === 'semi-monthly' ? 2 : 1) : 0;
                              
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
                            })()}
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          {isExpanded ? 
                            <ChevronDown className="w-4 h-4 text-muted-foreground" /> : 
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className={cn(
                      "ml-6 p-4 rounded-lg border transition-all duration-200",
                      step.urgencyLevel === 'critical' ? 'bg-destructive/5 border-destructive' :
                      step.urgencyLevel === 'important' ? 'bg-warning/5 border-warning' :
                      step.isComplete ? 'bg-success/5 border-success' :
                      step.isNotApplicable ? 'bg-muted/20 border-border' :
                      'bg-info/5 border-info'
                    )}>
                      {/* Why It Matters */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <Info className="w-4 h-4 text-info" />
                            <h4 className="font-medium text-foreground">Why This Matters</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{step.whyItMatters}</p>
                        </div>

                        {/* Impact Calculator */}
                        {(step.potentialSavings.monthly > 0 || step.potentialSavings.annual > 0) && (
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-success" />
                              <h4 className="font-medium text-foreground">Financial Impact</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="p-3 bg-success/5 rounded border border-border">
                                <div className="font-semibold text-foreground">Monthly Impact</div>
                                <div className="text-lg font-bold text-success font-mono tabular-nums">
                                  {step.urgencyLevel === 'critical' ? '-' : '+'}
                                  {formatCurrency(step.potentialSavings.monthly)}
                                </div>
                              </div>
                              <div className="p-3 bg-info/5 rounded border border-border">
                                <div className="font-semibold text-foreground">Annual Impact</div>
                                <div className="text-lg font-bold text-info font-mono tabular-nums">
                                  {step.urgencyLevel === 'critical' ? '-' : '+'}
                                  {formatCurrency(step.potentialSavings.annual)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Implementation Steps */}
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <Target className="w-4 h-4 text-muted-foreground" />
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
                            <div className="flex items-center justify-center p-3 bg-success/5 rounded-lg">
                              <CheckCircle className="w-5 h-5 text-success mr-2" />
                              <span className="font-medium text-success">
                                Completed! Keep up the great work.
                              </span>
                            </div>
                          ) : step.isNotApplicable ? (
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="text-sm text-muted-foreground">
                                <strong>Future opportunity:</strong> This step might become relevant if your situation changes 
                                (e.g., getting HSA eligibility, higher income, employer benefits).
                              </div>
                            </div>
                          ) : step.urgencyLevel === 'critical' ? (
                            <div className="p-3 bg-destructive/5 rounded-lg">
                              <div className="text-sm text-destructive">
                                <strong>Critical:</strong> This is costing you money right now. Address this as soon as possible.
                              </div>
                            </div>
                          ) : step.urgencyLevel === 'important' ? (
                            <div className="p-3 bg-warning/5 rounded-lg">
                              <div className="text-sm text-warning">
                                <strong>High impact:</strong> Significant opportunity to optimize your financial situation.
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-info/5 rounded-lg">
                              <div className="text-sm text-info">
                                <strong>Optimization opportunity:</strong> Consider this step once higher priority items are complete.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}