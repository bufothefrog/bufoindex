import { AllocationItem, PaycheckProfile } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { FinancialStep, StepStatus, UrgencyLevel } from '@/lib/constants/financialSteps';

/**
 * Calculate the full status for each financial step given the user's profile and allocations.
 */
export function calculateStepStatus(
  steps: FinancialStep[],
  allocations: AllocationItem[],
  profile: PaycheckProfile
): StepStatus[] {
  return steps.map(step => {
    // Robust allocation matching
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

    // Determine if this step is not applicable
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

    // Determine if this step is complete
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
        case 'hsa-max': {
          if (!profile.benefits.hsa.eligible) return false;
          const hsaAnnualContribution = profile.benefits.hsa.currentContribution * 12;
          const hsaLimit = profile.preferences.age >= 55
            ? (profile.benefits.hsa.coverageType === 'family' ? 9300 : 5150)
            : (profile.benefits.hsa.coverageType === 'family' ? 8300 : 4150);
          return hsaAnnualContribution >= (hsaLimit * 0.98);
        }
        case 'roth-ira': {
          const rothContribution = profile.benefits.ira?.currentContributions?.roth || 0;
          const rothAnnualContribution = rothContribution * 12;
          const rothLimit = profile.preferences.age >= 50 ? 8000 : 7000;
          return rothAnnualContribution >= (rothLimit * 0.98);
        }
        case 'additional-401k': {
          if (!profile.benefits.employer401k.available) return false;
          const employee401kContribution = profile.income.gross * profile.benefits.employer401k.currentContribution * 12;
          const employee401kLimit = profile.preferences.age >= 50 ? 30500 : 23000;
          return employee401kContribution >= (employee401kLimit * 0.98);
        }
        default:
          return false;
      }
    })();

    // Determine if this is urgent
    const isUrgent = (() => {
      if (isNotApplicable || isComplete) return false;

      switch (step.id) {
        case 'high-interest-debt':
          return profile.debts.some(d => d.interestRate > 0.07 && d.balance > 0);
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

      if (['emergency-full', 'hsa-max', 'roth-ira', 'additional-401k'].includes(step.id)) {
        return 'important';
      }

      if (['mega-backdoor', 'taxable-investment'].includes(step.id)) {
        return 'optimization';
      }

      return 'important';
    };

    // Calculate potential savings
    const getPotentialSavings = () => {
      const monthlyGross = profile.income.gross;

      switch (step.id) {
        case 'employer-match': {
          if (!profile.benefits.employer401k.available) return { monthly: 0, annual: 0 };
          const potentialMatch = monthlyGross * profile.benefits.employer401k.matchLimit * profile.benefits.employer401k.matchPercent;
          const currentMatch = monthlyGross * profile.benefits.employer401k.currentContribution * profile.benefits.employer401k.matchPercent;
          const missedMatch = Math.max(0, potentialMatch - currentMatch);
          return { monthly: missedMatch, annual: missedMatch * 12 };
        }
        case 'high-interest-debt': {
          const highDebt = profile.debts.find(d => d.interestRate > 0.07);
          if (!highDebt) return { monthly: 0, annual: 0 };
          const monthlyInterest = (highDebt.balance * highDebt.interestRate) / 12;
          return { monthly: monthlyInterest, annual: monthlyInterest * 12 };
        }
        case 'hsa-max': {
          if (!profile.benefits.hsa.eligible) return { monthly: 0, annual: 0 };
          const hsaLimit = profile.benefits.hsa.coverageType === 'family' ? 8300 : 4150;
          const currentHSA = profile.benefits.hsa.currentContribution * 12;
          const taxSavings = Math.max(0, hsaLimit - currentHSA) * 0.22;
          return { monthly: taxSavings / 12, annual: taxSavings };
        }
        case 'roth-ira': {
          const rothLimit = profile.preferences.age >= 50 ? 8000 : 7000;
          const currentRoth = (profile.benefits.ira?.currentContributions?.roth || 0) * 12;
          const potentialGrowth = Math.max(0, rothLimit - currentRoth) * 0.07;
          return { monthly: potentialGrowth / 12, annual: potentialGrowth };
        }
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
        case 'emergency-full': {
          const needed = profile.preferences.necessaryExpenses * profile.preferences.emergencyFundMonths;
          const monthlyNeeded = Math.max(0, (needed - profile.preferences.currentEmergencyFund) / 12);
          return [
            `Calculate total needed: ${formatCurrency(needed)}`,
            `Set automatic transfer for ${formatCurrency(monthlyNeeded)}/month`,
            "Park funds in high-yield savings (4%+ APY)"
          ];
        }
        case 'additional-401k': {
          const currentContrib = profile.benefits.employer401k.currentContribution;
          const maxLimit = profile.preferences.age >= 50 ? 30500 : 23000;
          const neededAnnual = maxLimit - (profile.income.gross * currentContrib * 12);
          const neededPercent = neededAnnual / (profile.income.gross * 12);
          return [
            "Log into company 401k portal",
            `Increase contribution by ${formatPercent(neededPercent)} more`,
            "Adjust budget for reduced take-home pay"
          ];
        }
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
          return "An employer match adds contributions on top of yours, up to the match limit. Contributing below the limit forgoes part of that match - an immediate return at the match rate.";
        case 'high-interest-debt':
          return "High-interest debt compounds against you. Every month you delay costs you more in interest than most investments can earn.";
        case 'emergency-full':
          return "Full emergency fund provides true financial security. It allows you to invest more aggressively and take calculated risks.";
        case 'hsa-max':
          return "HSA is the only triple tax-advantaged account: deductible contributions, tax-free growth, tax-free medical withdrawals.";
        case 'roth-ira':
          return "Roth IRA provides tax-free retirement income and penalty-free access to contributions. Essential for tax diversification.";
        default:
          return "Adds to long-term savings capacity.";
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

    // Get recommendation text
    const getRecommendation = () => {
      switch (step.id) {
        case 'emergency-1month':
          if (isComplete) return `Emergency fund complete (${formatCurrency(profile.preferences.currentEmergencyFund)})`;
          if (isUrgent) return `Need ${formatCurrency(profile.preferences.necessaryExpenses)} emergency fund`;
          return allocation ? `Building emergency fund` : `Build 1-month emergency fund`;

        case 'employer-match':
          if (isComplete) return `Employer match maximized`;
          if (isUrgent) return `Below match limit - increasing 401k to ${formatPercent(profile.benefits.employer401k.matchLimit)} captures the full match`;
          return allocation ? `Getting employer match` : `Contribute to get full employer match`;

        case 'high-interest-debt': {
          const highDebt = profile.debts.find(d => d.interestRate > 0.07);
          if (isComplete) return `All high-interest debt paid off`;
          if (isUrgent) return `${formatPercent(highDebt?.interestRate || 0)} interest debt - payoff returns that rate risk-free`;
          return allocation ? `Paying down high-interest debt` : `Pay off high-interest debt first`;
        }

        case 'emergency-full':
          if (isComplete) return `Full emergency fund complete (${profile.preferences.emergencyFundMonths} months)`;
          return allocation ? `Building full emergency fund` : `Complete ${profile.preferences.emergencyFundMonths}-month emergency fund`;

        case 'hsa-max':
          return allocation ? `Maximizing HSA contributions` : profile.benefits.hsa.eligible ? `Contribute to HSA for triple tax advantage` : `Not HSA eligible`;

        case 'roth-ira':
          return allocation ? `Contributing to Roth IRA` : `Contribute $500/month to Roth IRA`;

        case 'additional-401k': {
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
        }

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
    };
  });
}
