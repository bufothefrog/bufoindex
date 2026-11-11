import {
  PaycheckProfile,
  AllocationItem,
  EmployerBenefits
} from '../types';
import { CONTRIBUTION_LIMITS_2026, ROTH_IRA_PHASEOUT_2026, TOTAL_415C_BY_AGE } from '../constants/irs-2026';
import { calculateIncomeTaxRate, calculateHSATaxRate } from '../utils';
import { formatCurrency, formatPercent, paycheckToMonthly, monthlyToPaycheck } from './core';

/**
 * Priority attached to each allocation.
 *
 * The values mirror the Financial-Order-of-Operations execution order in
 * core.ts (`calculateOptimalAllocation`) and the step catalogue in
 * lib/constants/financialSteps.ts, so sorting a finished plan by `priority`
 * reproduces the order the steps were actually applied in. Every value is
 * distinct on purpose: with a tie, consumers that sort by priority (e.g. the
 * account-prioritization score in projections.ts, which uses a stable sort)
 * rank by array position instead of by the plan, and the winner of the tie
 * depends on which step happened to be pushed first.
 *
 * CONSTRAINT — lib/utils/stepStatusUtils.ts splits the two emergency-fund
 * allocations at a priority 2-vs-3 boundary: the `emergency-1month` step
 * matches `priority <= 2` and the `emergency-full` step matches
 * `priority >= 3`. Keep `oneMonthEmergency` at 2 or below and
 * `emergencyFundCompletion` at 3 or above, or the two steps swap allocations.
 */
export const ALLOCATION_PRIORITY = {
  oneMonthEmergency: 1,
  employerMatch: 2,
  highInterestDebt: 3,
  emergencyFundCompletion: 4,
  hsa: 5,
  rothIRA: 6,
  additional401k: 7,
  megaBackdoorRoth: 8,
  taxableInvestment: 9,
} as const;

/**
 * Roth IRA phase-out band for a profile's filing status.
 *
 * Head-of-household uses the single band (IRC 408A(c)(3)(B)(ii)); married
 * filing separately has its own, far narrower band.
 */
function getRothPhaseout(
  filingStatus: PaycheckProfile['taxes']['filingStatus']
): { start: number; end: number } {
  switch (filingStatus) {
    case 'marriedJoint':
      return ROTH_IRA_PHASEOUT_2026.marriedFilingJointly;
    case 'marriedSeparate':
      return ROTH_IRA_PHASEOUT_2026.marriedFilingSeparately;
    default:
      return ROTH_IRA_PHASEOUT_2026.single;
  }
}

/**
 * Share of an employee 401k deferral that is pre-tax, and therefore the share
 * that produces a current-year tax saving. Roth deferrals are after-tax; a
 * split election is pro-rated by the traditional/Roth percentages on file.
 */
function preTaxDeferralShare(benefits: EmployerBenefits): number {
  if (benefits.contributionType === 'roth') return 0;
  if (benefits.contributionType === 'split') {
    const traditional = Math.max(0, Number(benefits.traditionalContribution) || 0);
    const roth = Math.max(0, Number(benefits.rothContribution) || 0);
    const total = traditional + roth;
    return total > 0 ? traditional / total : 0.5;
  }
  return 1;
}

/**
 * Calculate 1-month emergency fund (FOO Step 1)
 * Now works with per-paycheck amounts
 */
export function calculate1MonthEmergency(
  profile: PaycheckProfile,
  availableAmount: number
): AllocationItem | null {
  const monthlyExpenses = profile.preferences.necessaryExpenses;
  const currentEmergencyFund = profile.preferences.currentEmergencyFund;
  const targetAmount = monthlyExpenses; // 1 month of expenses

  // A non-positive target means monthly expenses have not been entered yet.
  // A $0 goal is not a funded emergency fund, so make no allocation rather
  // than letting `0 >= 0` read as "already complete".
  if (!(targetAmount > 0)) return null;

  // If already have 1+ months, skip this step
  if (currentEmergencyFund >= targetAmount) return null;

  const amountNeededTotal = targetAmount - currentEmergencyFund;
  const actualAllocation = Math.min(amountNeededTotal, availableAmount);
  
  if (actualAllocation <= 0) return null;
  
  const frequency = profile.income.frequency;
  const monthlyEquivalent = paycheckToMonthly(actualAllocation, frequency);
  
  return {
    id: '1-month-emergency',
    account: '1-Month Emergency Fund',
    amount: actualAllocation, // Per-paycheck amount
    percentage: actualAllocation / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.oneMonthEmergency,
    reasoning: 'Build basic financial security before optimization. One month of expenses provides essential protection.',
    taxImpact: 0, // No tax impact for emergency fund
    category: 'emergency_fund',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: actualAllocation >= amountNeededTotal 
      ? `Save ${formatCurrency(actualAllocation)} per paycheck to complete 1-month emergency fund`
      : `Save ${formatCurrency(actualAllocation)} per paycheck toward emergency fund (${formatCurrency(amountNeededTotal - actualAllocation)} more needed)`,
  };
}

/**
 * Calculate emergency fund completion (FOO Step 4)
 * Now works with per-paycheck amounts
 */
export function calculateEmergencyFundCompletion(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  const monthlyExpenses = profile.preferences.necessaryExpenses;
  const currentEmergencyFund = profile.preferences.currentEmergencyFund;
  const targetMonths = profile.preferences.emergencyFundMonths;
  const targetAmount = monthlyExpenses * targetMonths;
  
  // If already at target, skip
  if (currentEmergencyFund >= targetAmount) return null;
  
  // Make sure we have at least 1 month before moving to full fund
  const oneMonthAmount = monthlyExpenses;
  if (currentEmergencyFund < oneMonthAmount) return null; // Should be handled by Step 1
  
  const amountNeededTotal = targetAmount - currentEmergencyFund;
  const actualAllocation = Math.min(amountNeededTotal, availableAmount);
  
  if (actualAllocation <= 0) return null;
  
  const currentMonths = currentEmergencyFund / monthlyExpenses;
  const apy = profile.preferences.emergencyFundAPY;
  const frequency = profile.income.frequency;
  const monthlyEquivalent = paycheckToMonthly(actualAllocation, frequency);
  
  return {
    id: 'emergency-fund-completion',
    account: 'Emergency Fund',
    amount: actualAllocation, // Per-paycheck amount
    percentage: actualAllocation / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.emergencyFundCompletion,
    reasoning: `Build from ${currentMonths.toFixed(1)} to ${targetMonths} months expenses. ${apy >= 0.04 ? 'Good HYSA rate' : 'Consider higher-yield savings'}`,
    taxImpact: 0,
    category: 'emergency_fund',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: actualAllocation >= amountNeededTotal 
      ? `Save ${formatCurrency(actualAllocation)} per paycheck to complete ${targetMonths}-month emergency fund`
      : `Save ${formatCurrency(actualAllocation)} per paycheck toward emergency fund target`,
  };
}

/**
 * Calculate optimal employer match contribution
 * Now works with per-paycheck amounts
 */
export function calculateEmployerMatch(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  const benefits = profile.benefits.employer401k;
  if (!benefits.available) return null;

  // With a 0% match rate (or a 0% matched-salary limit) there is no match to
  // capture, so this step has nothing to recommend — the deferral would be
  // ordinary unmatched 401k saving, which `calculateAdditional401k` handles
  // further down the order. analysis.ts `analyzeMissedBenefits` already treats
  // a 0% rate as "no missed match"; the two now agree.
  if (benefits.matchPercent <= 0 || benefits.matchLimit <= 0) return null;

  const annualSalary = profile.income.gross * 12;
  const maxMatchContribution = annualSalary * benefits.matchLimit;
  const currentAnnualContribution = annualSalary * benefits.currentContribution;
  
  const additionalContributionNeeded = maxMatchContribution - currentAnnualContribution;
  const monthlyAdditionalContribution = additionalContributionNeeded / 12;
  const frequency = profile.income.frequency;
  const paycheckAdditionalContribution = monthlyToPaycheck(monthlyAdditionalContribution, frequency);
  
  if (paycheckAdditionalContribution <= 0) return null;
  
  const actualContribution = Math.min(paycheckAdditionalContribution, availableAmount);
  
  if (actualContribution <= 0) return null;
  
  const monthlyEquivalent = paycheckToMonthly(actualContribution, frequency);

  // Only the pre-tax share of the employee deferral cuts this year's taxes: a
  // Roth election saves nothing today, a split election saves pro-rata.
  const deferralTaxSaving =
    actualContribution *
    preTaxDeferralShare(benefits) *
    calculateIncomeTaxRate(profile.taxes.federalBracket, profile.taxes.state);

  return {
    id: 'employer-match',
    account: '401k Employer Match',
    amount: actualContribution, // Per-paycheck amount
    percentage: actualContribution / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.employerMatch,
    reasoning: `Employer matches ${formatPercent(benefits.matchPercent)} of contributions up to ${formatPercent(benefits.matchLimit)} of salary`,
    taxImpact: deferralTaxSaving > 0 ? -deferralTaxSaving : 0,
    category: 'employer_match',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: actualContribution === paycheckAdditionalContribution 
      ? `Increase 401k from ${formatPercent(benefits.currentContribution)} to ${formatPercent(benefits.matchLimit)}`
      : `Increase 401k by ${formatCurrency(actualContribution)} per paycheck (${formatCurrency(paycheckAdditionalContribution - actualContribution)} still needed for full match)`,
  };
}

/**
 * Determine high-interest debt threshold (simplified 7% rule)
 */
function getHighInterestThreshold(): number {
  return 0.07; // Fixed 7% threshold for all ages
}

/**
 * Check if profile has high-interest debt based on age-adjusted thresholds
 */
export function hasHighInterestDebt(profile: PaycheckProfile): boolean {
  const threshold = getHighInterestThreshold();
  
  return profile.debts.some(debt => {
    // All debt uses the 7% threshold consistently
    return debt.interestRate > threshold;
  });
}

/**
 * Calculate high-interest debt payments with Money Guy thresholds
 */
export function calculateHighInterestDebt(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  const threshold = getHighInterestThreshold();
  
  const highInterestDebts = profile.debts.filter(debt => {
    // All debt over 7% is considered high-interest
    return debt.interestRate > threshold;
  });
  
  if (highInterestDebts.length === 0) return null;

  // Sort by interest rate, highest first
  highInterestDebts.sort((a, b) => b.interestRate - a.interestRate);
  const highestRateDebt = highInterestDebts[0];

  const frequency = profile.income.frequency;
  // Minimum payments are stored monthly; availableAmount is per paycheck
  const minimumPaymentPerPaycheck = monthlyToPaycheck(highestRateDebt.minimumPayment, frequency);
  const recommendedPayment = Math.min(availableAmount, highestRateDebt.balance);

  if (recommendedPayment <= minimumPaymentPerPaycheck) return null;

  const extraPayment = recommendedPayment - minimumPaymentPerPaycheck;
  const monthlyEquivalent = paycheckToMonthly(extraPayment, frequency);
  // Average-balance correction: payments reduce balance over the year,
  // so average effective time is ~6 months, not 12
  const uncappedAnnualSavings = monthlyEquivalent * 12 * highestRateDebt.interestRate * 0.5;
  // Interest avoided can never exceed a full year of interest on the balance
  // itself: once the debt is retired there is nothing left to accrue. Without
  // this cap a payment stream larger than the balance "saves" more than the
  // debt is worth.
  const maxAnnualInterest = Math.max(0, highestRateDebt.balance) * highestRateDebt.interestRate;
  const annualSavings = Math.min(uncappedAnnualSavings, maxAnnualInterest);

  const reasoning = `Paying off debt at ${formatPercent(highestRateDebt.interestRate)} is a certain return at that rate, above typical long-run market assumptions. Clearing this balance avoids up to ${formatCurrency(annualSavings)} of interest a year.`;

  return {
    id: 'high-interest-debt',
    account: `${highestRateDebt.name} (${formatPercent(highestRateDebt.interestRate)})`,
    amount: extraPayment,
    percentage: extraPayment / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.highInterestDebt,
    reasoning: reasoning,
    taxImpact: 0, // Debt payments are not tax-deductible for most consumer debt
    category: 'debt_payoff',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: `Pay extra ${formatCurrency(extraPayment)} per paycheck toward ${highestRateDebt.name} (saves ${formatCurrency(annualSavings)}/year in interest)`,
  };
}

/**
 * Calculate optimal HSA contribution
 */
export function calculateHSAOptimal(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  const hsa = profile.benefits.hsa;
  if (!hsa.eligible) return null;

  const baseAnnualLimit = hsa.coverageType === 'family'
    ? CONTRIBUTION_LIMITS_2026.hsa.family
    : CONTRIBUTION_LIMITS_2026.hsa.individual;

  // Age-55 catch-up (IRC 223(b)(3)): a flat, non-indexed $1,000 on top of the
  // coverage-tier limit from the year the account holder turns 55.
  const annualLimit = baseAnnualLimit
    + (profile.preferences.age >= 55 ? CONTRIBUTION_LIMITS_2026.catchUp.hsa : 0);

  // Employer contributions count against the combined IRS cap (IRC 223(b)(4)(B));
  // employerContribution is annual, currentContribution is monthly
  const remainingAnnualRoom = annualLimit - hsa.employerContribution - hsa.currentContribution * 12;

  if (remainingAnnualRoom <= 0) return null;

  const frequency = profile.income.frequency;
  const roomPerPaycheck = monthlyToPaycheck(remainingAnnualRoom / 12, frequency);
  const recommendedContribution = Math.min(roomPerPaycheck, availableAmount);

  if (recommendedContribution <= 0) return null;

  // HSA payroll deductions are FICA-exempt (IRC 3121), so include FICA in savings
  const annualGross = profile.income.gross * 12;
  const taxSavings = recommendedContribution * calculateHSATaxRate(profile.taxes.federalBracket, profile.taxes.state, annualGross, profile.taxes.filingStatus);
  const monthlyEquivalent = paycheckToMonthly(recommendedContribution, frequency);

  return {
    id: 'hsa-contribution',
    account: 'HSA Contribution',
    amount: recommendedContribution,
    percentage: recommendedContribution / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.hsa,
    reasoning: 'Triple tax advantage: deductible contributions, tax-free growth, tax-free medical withdrawals',
    taxImpact: -taxSavings,
    category: 'tax_advantaged',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: `Increase HSA by ${formatCurrency(recommendedContribution)} per paycheck (${formatCurrency(monthlyEquivalent * 12)}/year toward the ${formatCurrency(annualLimit)} limit)`,
  };
}

/**
 * Determine optimal Roth vs Traditional recommendation
 */
export function determineRothVsTraditional(profile: PaycheckProfile): 'roth' | 'traditional' | 'mixed' {
  const age = profile.preferences.age;
  const isPeakEarnings = profile.preferences.isPeakEarnings;
  const currentBracket = profile.taxes.federalBracket;
  const expectedRetirementBracket = profile.preferences.expectedRetirementBracket || (currentBracket * 0.8); // Default to 20% lower

  // Strong Roth preference: Young + not peak earnings
  if (age < 30 && !isPeakEarnings) {
    return 'roth';
  }
  
  // Strong Traditional preference: Peak earnings + higher current bracket
  if (isPeakEarnings && currentBracket > expectedRetirementBracket) {
    return 'traditional';
  }
  
  // Age 50+ - consider tax diversification
  if (age >= 50) {
    return 'mixed';
  }
  
  // Default logic based on tax brackets
  if (currentBracket <= 0.12) {
    return 'roth'; // Low bracket, pay taxes now
  } else if (currentBracket >= 0.24 && currentBracket > expectedRetirementBracket) {
    return 'traditional'; // High bracket, defer taxes
  } else {
    return 'mixed'; // Middle brackets, diversify
  }
}

/**
 * Calculate Roth IRA contribution with smart Roth vs Traditional logic
 */
export function calculateRothIRA(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  const annualIncome = profile.income.gross * 12;
  
  // Check income eligibility for Roth IRA (from single source: lib/constants/irs-2026.ts)
  const phaseout = getRothPhaseout(profile.taxes.filingStatus);
  const rothPhaseoutStart = phaseout.start;
  const rothPhaseoutEnd = phaseout.end;
  
  if (annualIncome > rothPhaseoutEnd) return null; // Not eligible

  const age = profile.preferences.age;
  let maxContribution: number = CONTRIBUTION_LIMITS_2026.ira
    + (age >= 50 ? CONTRIBUTION_LIMITS_2026.catchUp.ira : 0);

  // Reduce contribution if in phaseout range
  if (annualIncome > rothPhaseoutStart) {
    const phaseoutAmount = (annualIncome - rothPhaseoutStart) / (rothPhaseoutEnd - rothPhaseoutStart);
    maxContribution = Math.floor(maxContribution * (1 - phaseoutAmount));
  }

  // The IRS limit is combined across traditional + Roth IRAs;
  // currentContributions are stored monthly. Profiles restored from older
  // share links or saved state may lack the ira block entirely.
  const iraContributions = profile.benefits.ira?.currentContributions;
  const existingAnnualContributions =
    ((iraContributions?.roth ?? 0) + (iraContributions?.traditional ?? 0)) * 12;
  const remainingAnnualRoom = maxContribution - existingAnnualContributions;

  if (remainingAnnualRoom <= 0) return null;

  const frequency = profile.income.frequency;
  const paycheckContribution = Math.min(
    monthlyToPaycheck(remainingAnnualRoom / 12, frequency),
    availableAmount
  );

  if (paycheckContribution <= 50) return null; // Don't recommend tiny contributions
  
  // Get smart recommendation
  const recommendation = determineRothVsTraditional(profile);
  
  // Only recommend Roth IRA if Roth is preferred or mixed
  if (recommendation === 'traditional') {
    return null; // Will be handled by Traditional IRA function instead
  }
  
  const currentBracket = profile.taxes.federalBracket;

  let reasoning = '';
  if (recommendation === 'roth') {
    if (profile.preferences.age < 30 && !profile.preferences.isPeakEarnings) {
      reasoning = 'Young + not peak earnings = Roth for maximum tax-free growth';
    } else if (currentBracket <= 0.12) {
      reasoning = 'Low tax bracket makes Roth optimal for tax-free growth';
    } else {
      reasoning = 'Roth provides tax diversification and future flexibility';
    }
  } else { // mixed
    reasoning = 'Tax diversification recommended - consider splitting with Traditional';
  }
  
  const monthlyEquivalent = paycheckToMonthly(paycheckContribution, frequency);

  return {
    id: 'roth-ira',
    account: 'Roth IRA',
    amount: paycheckContribution,
    percentage: paycheckContribution / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.rothIRA,
    reasoning: reasoning,
    taxImpact: 0, // Roth contributions are after-tax
    category: 'tax_advantaged',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: `Contribute ${formatCurrency(paycheckContribution)} per paycheck to Roth IRA (${formatCurrency(monthlyEquivalent * 12)} annually)`,
  };
}

/**
 * Calculate additional 401k contribution beyond match with Roth vs Traditional choice
 */
export function calculateAdditional401k(
  profile: PaycheckProfile,
  availableAmount: number,
  plannedAllocations: AllocationItem[] = []
): AllocationItem | null {
  const benefits = profile.benefits.employer401k;
  if (!benefits.available) return null;

  const annualSalary = profile.income.gross * 12;
  const currentAnnualContribution = annualSalary * benefits.currentContribution;
  const age = profile.preferences.age;
  // SECURE 2.0 super catch-up applies only for ages 60-63; regular catch-up at 50+
  const catchUp = age >= 60 && age <= 63
    ? CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k
    : age >= 50
      ? CONTRIBUTION_LIMITS_2026.catchUp['401k']
      : 0;
  const maxAnnualContribution = CONTRIBUTION_LIMITS_2026.traditional401k + catchUp; // Same limit for Roth and Traditional

  const frequency = profile.income.frequency;
  // IRC 402(g) caps elective deferrals per employee per year, across every
  // source. The match step earlier in the plan (core.ts) already recommends
  // additional employee deferral, so this top-up has to net that out on top of
  // the existing payroll election — otherwise the two steps each spend the
  // same room and their sum breaches the limit.
  const plannedAnnualDeferral = plannedAllocations
    .filter(allocation => allocation.category === 'employer_match')
    .reduce(
      (sum, allocation) => sum + paycheckToMonthly(allocation.amount, frequency) * 12,
      0
    );

  const remainingContributionRoom =
    maxAnnualContribution - currentAnnualContribution - plannedAnnualDeferral;

  if (remainingContributionRoom <= 0) return null;

  const roomPerPaycheck = monthlyToPaycheck(remainingContributionRoom / 12, frequency);
  const recommendedContribution = Math.min(roomPerPaycheck, availableAmount);

  if (recommendedContribution <= 50) return null;
  
  // Get smart Roth vs Traditional recommendation
  const recommendation = determineRothVsTraditional(profile);
  
  let accountType: string;
  let reasoning: string;
  let taxImpact: number;
  
  if (recommendation === 'roth') {
    accountType = 'Roth 401k';
    reasoning = 'Roth 401k recommended for tax-free growth and retirement flexibility';
    taxImpact = 0; // Roth contributions are after-tax
  } else if (recommendation === 'traditional') {
    accountType = 'Traditional 401k';
    reasoning = 'Traditional 401k recommended for current tax savings';
    taxImpact = -recommendedContribution * calculateIncomeTaxRate(profile.taxes.federalBracket, profile.taxes.state);
  } else { // mixed
    accountType = '401k (Roth + Traditional)';
    reasoning = 'Consider splitting between Roth and Traditional 401k for tax diversification';
    taxImpact = -recommendedContribution * 0.5 * calculateIncomeTaxRate(profile.taxes.federalBracket, profile.taxes.state);
  }
  
  const monthlyEquivalent = paycheckToMonthly(recommendedContribution, frequency);

  return {
    id: 'additional-401k',
    account: accountType,
    amount: recommendedContribution,
    percentage: recommendedContribution / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.additional401k,
    reasoning: reasoning,
    taxImpact: taxImpact,
    category: 'tax_advantaged',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: `Increase ${accountType} contribution by ${formatCurrency(recommendedContribution)} per paycheck`,
  };
}

/**
 * Calculate mega backdoor Roth opportunity for high earners
 */
export function calculateMegaBackdoorRoth(
  profile: PaycheckProfile,
  availableAmount: number,
  plannedAllocations: AllocationItem[] = []
): AllocationItem | null {
  const benefits = profile.benefits.employer401k;
  if (!benefits.available || !benefits.afterTaxAvailable) return null;

  const annualIncome = profile.income.gross * 12;

  // Check income threshold - typically beneficial for higher earners
  // who are above Roth IRA limits
  const megaPhaseout = getRothPhaseout(profile.taxes.filingStatus);

  if (annualIncome < megaPhaseout.end) return null; // Regular Roth IRA is better

  const annualSalary = profile.income.gross * 12;
  const currentAnnualContribution = annualSalary * benefits.currentContribution;

  // Total 401k limit including after-tax contributions (from lib/constants/irs-2026.ts)
  const age = profile.preferences.age;
  const totalLimit = age >= 60 && age <= 63
    ? TOTAL_415C_BY_AGE.superCatchUp60to63
    : age >= 50
      ? TOTAL_415C_BY_AGE.catchUp50
      : TOTAL_415C_BY_AGE.standard;
  const employerMatch = annualSalary * benefits.matchPercent * Math.min(benefits.matchLimit, benefits.currentContribution);

  // IRC 415(c) caps ALL annual additions — employee deferrals, employer match,
  // and after-tax contributions. The match top-up and additional-401k steps
  // earlier in the same plan already consumed part of that room (same defect
  // class as the 402(g) netting in calculateAdditional401k), so subtract them.
  // A match-step deferral also induces employer matching dollars on top of the
  // employee amount, and those count against 415(c) too.
  const frequency401k = profile.income.frequency;
  const plannedAnnualAdditions = plannedAllocations
    .filter(allocation => allocation.category === 'employer_match' || allocation.id === 'additional-401k')
    .reduce((sum, allocation) => {
      const annual = paycheckToMonthly(allocation.amount, frequency401k) * 12;
      const inducedMatch = allocation.category === 'employer_match' ? annual * benefits.matchPercent : 0;
      return sum + annual + inducedMatch;
    }, 0);

  const remainingAfterTaxRoom =
    totalLimit - currentAnnualContribution - employerMatch - plannedAnnualAdditions;

  if (remainingAfterTaxRoom <= 0) return null;

  const frequency = profile.income.frequency;
  const roomPerPaycheck = monthlyToPaycheck(remainingAfterTaxRoom / 12, frequency);
  const recommendedContribution = Math.min(roomPerPaycheck, availableAmount);

  if (recommendedContribution <= 100) return null; // Only recommend for meaningful amounts

  const monthlyEquivalent = paycheckToMonthly(recommendedContribution, frequency);

  return {
    id: 'mega-backdoor-roth',
    account: 'Mega Backdoor Roth',
    amount: recommendedContribution,
    percentage: recommendedContribution / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.megaBackdoorRoth, // After regular 401k but before taxable
    reasoning: 'Convert after-tax 401k contributions to Roth for tax-free growth (high earner strategy)',
    taxImpact: 0, // After-tax contributions, no immediate tax benefit
    // 'tax_optimization' is the taxonomy the mega-backdoor step uses in
    // lib/constants/financialSteps.ts and lib/utils/stepStatusUtils.ts; tagging
    // it 'tax_advantaged' left the step unable to find its own allocation.
    category: 'tax_optimization',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: `Make after-tax 401k contributions of ${formatCurrency(recommendedContribution)} per paycheck, then convert to Roth`,
  };
}

/**
 * Calculate taxable investment recommendation
 */
export function calculateTaxableInvestment(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  if (availableAmount <= 0) return null;

  const monthlyEquivalent = paycheckToMonthly(availableAmount, profile.income.frequency);

  return {
    id: 'taxable-investment',
    account: 'Taxable Investment',
    amount: availableAmount,
    percentage: availableAmount / profile.income.netPaycheck,
    priority: ALLOCATION_PRIORITY.taxableInvestment,
    reasoning: 'Build wealth with tax-efficient index funds (VTI/VTSAX)',
    taxImpact: 0, // No immediate tax impact
    category: 'investment',
    monthlyEquivalent,
    annualEquivalent: monthlyEquivalent * 12,
    implementation: `Invest ${formatCurrency(availableAmount)} per paycheck in low-cost index funds`,
  };
}

/**
 * Check if profile has low-interest debt (under 7%)
 */
export function hasLowInterestDebt(profile: PaycheckProfile): boolean {
  return profile.debts.some(debt => debt.interestRate <= 0.07 && debt.balance > 0);
}

// Low-interest debt (FOO Step 8) is surfaced as a skipped item by
// `analyzeLowInterestDebtStrategy` in lib/calculations/analysis.ts, which
// `identifySkippedOptimizations` calls. A second, never-called implementation
// of the same idea used to live here and has been removed.