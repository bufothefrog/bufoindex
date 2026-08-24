import { AllocationItem, DebtData, PaycheckProfile } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { FinancialStep, StepStatus, UrgencyLevel } from '@/lib/constants/financialSteps';
import { CONTRIBUTION_LIMITS_2026, TOTAL_415C_BY_AGE } from '@/lib/constants/irs-2026';

/**
 * Rate above which a debt counts as high-interest. Same threshold the allocator
 * applies (lib/calculations/optimization.ts `getHighInterestThreshold`).
 */
const HIGH_INTEREST_THRESHOLD = 0.07;

/**
 * Copy for the emergency-fund steps when necessary expenses are $0: the target
 * is unknown rather than met, so the step must not read as funded.
 */
const NO_EXPENSE_TARGET = 'Necessary monthly expenses not set - emergency fund target unknown';

/**
 * 402(g) elective-deferral limit, including the age-based catch-ups the
 * allocator applies (optimization.ts `calculateAdditional401k`): the regular
 * catch-up at 50+, and the SECURE 2.0 super catch-up for ages 60-63 only.
 * Figures come from lib/constants/irs-2026.ts.
 */
function elective401kLimit(age: number): number {
  const catchUp = age >= 60 && age <= 63
    ? CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k
    : age >= 50
      ? CONTRIBUTION_LIMITS_2026.catchUp['401k']
      : 0;
  return CONTRIBUTION_LIMITS_2026.traditional401k + catchUp;
}

/**
 * Combined traditional + Roth IRA contribution limit, with the 50+ catch-up
 * (optimization.ts `calculateRothIRA` uses the same pair of constants).
 */
function iraLimit(age: number): number {
  return CONTRIBUTION_LIMITS_2026.ira + (age >= 50 ? CONTRIBUTION_LIMITS_2026.catchUp.ira : 0);
}

/** HSA limit for the coverage tier, plus the age-55 catch-up. */
function hsaLimit(coverageType: 'individual' | 'family', age: number): number {
  const base = coverageType === 'family'
    ? CONTRIBUTION_LIMITS_2026.hsa.family
    : CONTRIBUTION_LIMITS_2026.hsa.individual;
  return base + (age >= 55 ? CONTRIBUTION_LIMITS_2026.catchUp.hsa : 0);
}

/** Total 415(c) annual-additions limit for the age band. */
function total415cLimit(age: number): number {
  if (age >= 60 && age <= 63) return TOTAL_415C_BY_AGE.superCatchUp60to63;
  if (age >= 50) return TOTAL_415C_BY_AGE.catchUp50;
  return TOTAL_415C_BY_AGE.standard;
}

/**
 * The qualifying debt the allocator actually targets: highest rate first, not
 * first in input order (optimization.ts `calculateHighInterestDebt` sorts the
 * filtered list descending by rate).
 */
function highestRateHighInterestDebt(debts: DebtData[]): DebtData | undefined {
  return debts
    .filter(d => d.interestRate > HIGH_INTEREST_THRESHOLD)
    .reduce<DebtData | undefined>(
      (highest, debt) => (highest === undefined || debt.interestRate > highest.interestRate ? debt : highest),
      undefined
    );
}

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
          return !profile.debts.some(d => d.interestRate > HIGH_INTEREST_THRESHOLD);
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
        // A target of $0 means necessary expenses have not been entered yet, not
        // that the fund is funded — `0 >= 0` must not read as complete.
        case 'emergency-1month':
          return profile.preferences.necessaryExpenses > 0 &&
                 profile.preferences.currentEmergencyFund >= profile.preferences.necessaryExpenses;
        case 'employer-match':
          return profile.benefits.employer401k.available &&
                 profile.benefits.employer401k.currentContribution >= profile.benefits.employer401k.matchLimit;
        case 'high-interest-debt':
          return profile.debts.length === 0 ||
                 !profile.debts.some(d => d.interestRate > HIGH_INTEREST_THRESHOLD && d.balance > 0);
        case 'emergency-full': {
          const fullTarget = profile.preferences.necessaryExpenses * profile.preferences.emergencyFundMonths;
          return fullTarget > 0 && profile.preferences.currentEmergencyFund >= fullTarget;
        }
        case 'hsa-max': {
          if (!profile.benefits.hsa.eligible) return false;
          const hsaAnnualContribution = profile.benefits.hsa.currentContribution * 12;
          const limit = hsaLimit(profile.benefits.hsa.coverageType, profile.preferences.age);
          return hsaAnnualContribution >= (limit * 0.98);
        }
        case 'roth-ira': {
          const rothContribution = profile.benefits.ira?.currentContributions?.roth || 0;
          const rothAnnualContribution = rothContribution * 12;
          return rothAnnualContribution >= (iraLimit(profile.preferences.age) * 0.98);
        }
        case 'additional-401k': {
          if (!profile.benefits.employer401k.available) return false;
          const employee401kContribution = profile.income.gross * profile.benefits.employer401k.currentContribution * 12;
          return employee401kContribution >= (elective401kLimit(profile.preferences.age) * 0.98);
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
          return profile.debts.some(d => d.interestRate > HIGH_INTEREST_THRESHOLD && d.balance > 0);
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
          const highDebt = highestRateHighInterestDebt(profile.debts);
          if (!highDebt) return { monthly: 0, annual: 0 };
          // A full year's interest on the balance is the ceiling on what payoff
          // can save. When the plan recommends a concrete payment stream, price
          // the savings on that stream with the same average-balance correction
          // the allocator applies (optimization.ts calculateHighInterestDebt).
          const fullYearInterest = Math.max(0, highDebt.balance) * highDebt.interestRate;
          const paymentStream = allocation?.monthlyEquivalent;
          const annual = paymentStream != null && Number.isFinite(paymentStream)
            ? Math.min(paymentStream * 12 * highDebt.interestRate * 0.5, fullYearInterest)
            : fullYearInterest;
          return { monthly: annual / 12, annual };
        }
        case 'hsa-max': {
          if (!profile.benefits.hsa.eligible) return { monthly: 0, annual: 0 };
          const limit = hsaLimit(profile.benefits.hsa.coverageType, profile.preferences.age);
          const currentHSA = profile.benefits.hsa.currentContribution * 12;
          // Deduction value at the profile's own federal bracket, not a fixed rate.
          const taxSavings = Math.max(0, limit - currentHSA) * Math.max(0, profile.taxes.federalBracket);
          return { monthly: taxSavings / 12, annual: taxSavings };
        }
        case 'roth-ira': {
          const currentRoth = (profile.benefits.ira?.currentContributions?.roth || 0) * 12;
          const potentialGrowth = Math.max(0, iraLimit(profile.preferences.age) - currentRoth) * 0.07;
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
        case 'roth-ira': {
          const monthlyToLimit = iraLimit(profile.preferences.age) / 12;
          return [
            "Open Roth IRA at low-cost broker (Vanguard, Fidelity)",
            `Set up automatic ${formatCurrency(monthlyToLimit)}/month transfer`,
            "Invest in target-date fund or total market index"
          ];
        }
        case 'emergency-full': {
          const needed = profile.preferences.necessaryExpenses * profile.preferences.emergencyFundMonths;
          const monthlyNeeded = Math.max(0, (needed - profile.preferences.currentEmergencyFund) / 12);
          return [
            `Calculate total needed: ${formatCurrency(needed)}`,
            `Set automatic transfer for ${formatCurrency(monthlyNeeded)}/month`,
            "Park funds in a high-yield savings account"
          ];
        }
        case 'additional-401k': {
          const currentContrib = profile.benefits.employer401k.currentContribution;
          const annualGross = profile.income.gross * 12;
          const maxLimit = elective401kLimit(profile.preferences.age);
          const neededAnnual = Math.max(0, maxLimit - (annualGross * currentContrib));
          // Without a gross figure there is no percent-of-salary to quote; the
          // dollar amount still stands on its own. "by X% more" was ambiguous
          // (relative vs percentage points), so spell out the from/to rates.
          const increaseStep = annualGross > 0
            ? `Raise your contribution rate by ${formatPercent(neededAnnual / annualGross)} of salary (from ${formatPercent(currentContrib)} to about ${formatPercent(currentContrib + neededAnnual / annualGross)})`
            : `Increase contributions by ${formatCurrency(neededAnnual / 12)}/month`;
          return [
            "Log into company 401k portal",
            increaseStep,
            "Adjust budget for reduced take-home pay"
          ];
        }
        case 'mega-backdoor':
          return [
            "Confirm after-tax 401k contributions allowed",
            "Set up in-service Roth conversions with provider",
            `Contribute up to annual limit (${formatCurrency(total415cLimit(profile.preferences.age))} total)`
          ];
        case 'taxable-investment':
          return [
            "Open brokerage account at low-cost provider",
            "Set up automatic monthly investment",
            "Choose broadly diversified, low-cost funds"
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
          return "Roth IRA provides tax-free retirement income and penalty-free access to contributions, adding tax diversification.";
        case 'additional-401k':
          return "Contributions beyond the match still grow tax-advantaged: traditional deferrals reduce taxable income now, and Roth deferrals are untaxed at withdrawal.";
        case 'mega-backdoor':
          return "After-tax 401k contributions converted to Roth grow untaxed above the elective deferral limit - room no other account type offers.";
        case 'taxable-investment':
          return "Taxable accounts carry no contribution limits or withdrawal restrictions, extending saving once tax-advantaged room is used.";
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
          if (profile.preferences.necessaryExpenses <= 0) return NO_EXPENSE_TARGET;
          if (isUrgent) return `Need ${formatCurrency(profile.preferences.necessaryExpenses)} emergency fund`;
          return allocation ? `Building emergency fund` : `Build 1-month emergency fund`;

        case 'employer-match':
          if (isComplete) return `Employer match maximized`;
          if (isUrgent) return `Below match limit - increasing 401k to ${formatPercent(profile.benefits.employer401k.matchLimit)} captures the full match`;
          return allocation ? `Getting employer match` : `Contribute to get full employer match`;

        case 'high-interest-debt': {
          const highDebt = highestRateHighInterestDebt(profile.debts);
          if (isComplete) return `All high-interest debt paid off`;
          if (isUrgent) return `${formatPercent(highDebt?.interestRate || 0)} interest debt - payoff returns that rate risk-free`;
          return allocation ? `Paying down high-interest debt` : `Pay off high-interest debt first`;
        }

        case 'emergency-full':
          if (isComplete) return `Full emergency fund complete (${profile.preferences.emergencyFundMonths} months)`;
          if (profile.preferences.necessaryExpenses <= 0) return NO_EXPENSE_TARGET;
          return allocation ? `Building full emergency fund` : `Complete ${profile.preferences.emergencyFundMonths}-month emergency fund`;

        case 'hsa-max':
          return allocation ? `Maximizing HSA contributions` : profile.benefits.hsa.eligible ? `Contribute to HSA for triple tax advantage` : `Not HSA eligible`;

        case 'roth-ira': {
          if (isComplete) return `Roth IRA maximized`;
          const monthlyToLimit = iraLimit(profile.preferences.age) / 12;
          return allocation
            ? `Contributing to Roth IRA`
            : `Contribute ${formatCurrency(monthlyToLimit)}/month to Roth IRA`;
        }

        case 'additional-401k': {
          if (!profile.benefits.employer401k.available) return `401k not available`;

          const currentEmployee401k = profile.benefits.employer401k.currentContribution;
          const annualGross = profile.income.gross * 12;
          const maxEmployee401kLimit = elective401kLimit(profile.preferences.age);
          const currentAnnualContribution = annualGross * currentEmployee401k;
          const additionalNeeded = Math.max(0, maxEmployee401kLimit - currentAnnualContribution);
          const additionalNeededMonthly = additionalNeeded / 12;
          // With no gross pay on file the percent-of-salary figure is undefined,
          // so the copy quotes dollars only. Label the period and the base —
          // "$922 (13.2%)" left the reader to guess both.
          const additionalFigure = annualGross > 0
            ? `${formatCurrency(additionalNeededMonthly)}/month (${formatPercent(additionalNeeded / annualGross)} of salary)`
            : `${formatCurrency(additionalNeededMonthly)}/month`;

          if (isComplete) return `401k maximized at ${formatPercent(currentEmployee401k)}`;
          if (allocation) {
            return `Additional ${additionalFigure} needed for max`;
          }
          return `Additional ${additionalFigure} contributions needed for max`;
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
