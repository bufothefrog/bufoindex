import {
  PaycheckProfile,
  AllocationItem,
  SkippedItem
} from '../types';
import { CONTRIBUTION_LIMITS_2026, ROTH_IRA_PHASEOUT_2026, TOTAL_415C_BY_AGE } from '../constants/irs-2026';
import { calculateIncomeTaxRate, calculateHSATaxRate } from '../utils';
import { formatCurrency, formatPercent, paycheckToMonthly, monthlyToPaycheck } from './core';

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
    priority: 1,
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
    priority: 4,
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
  
  return {
    id: 'employer-match',
    account: '401k Employer Match',
    amount: actualContribution, // Per-paycheck amount
    percentage: actualContribution / profile.income.netPaycheck,
    priority: 1,
    reasoning: `Free money! Your employer matches ${formatPercent(benefits.matchPercent)} up to ${formatPercent(benefits.matchLimit)} of salary`,
    taxImpact: -actualContribution * calculateIncomeTaxRate(profile.taxes.federalBracket, profile.taxes.state),
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
function getHighInterestThreshold(age: number): number {
  return 0.07; // Fixed 7% threshold for all ages
}

/**
 * Check if profile has high-interest debt based on age-adjusted thresholds
 */
export function hasHighInterestDebt(profile: PaycheckProfile): boolean {
  const threshold = getHighInterestThreshold(profile.preferences.age);
  
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
  const threshold = getHighInterestThreshold(profile.preferences.age);
  
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
  const annualSavings = monthlyEquivalent * 12 * highestRateDebt.interestRate * 0.5;

  const reasoning = `Debt over 7% = guaranteed ${formatPercent(highestRateDebt.interestRate)} return. Prioritize before investing.`;

  return {
    id: 'high-interest-debt',
    account: `${highestRateDebt.name} (${formatPercent(highestRateDebt.interestRate)})`,
    amount: extraPayment,
    percentage: extraPayment / profile.income.netPaycheck,
    priority: 3,
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

  const annualLimit = hsa.coverageType === 'family'
    ? CONTRIBUTION_LIMITS_2026.hsa.family
    : CONTRIBUTION_LIMITS_2026.hsa.individual;

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
    priority: hsa.currentContribution === 0 ? 2 : 3,
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
  const phaseout = profile.taxes.filingStatus === 'marriedJoint'
    ? ROTH_IRA_PHASEOUT_2026.marriedFilingJointly
    : ROTH_IRA_PHASEOUT_2026.single;
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
  // currentContributions are stored monthly
  const existingAnnualContributions =
    (profile.benefits.ira.currentContributions.roth +
      profile.benefits.ira.currentContributions.traditional) * 12;
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
  const expectedRetirementBracket = profile.preferences.expectedRetirementBracket || (currentBracket * 0.8);
  
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
    priority: 5,
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
  availableAmount: number
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

  const remainingContributionRoom = maxAnnualContribution - currentAnnualContribution;

  if (remainingContributionRoom <= 0) return null;

  const frequency = profile.income.frequency;
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
    priority: 6,
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
  availableAmount: number
): AllocationItem | null {
  const benefits = profile.benefits.employer401k;
  if (!benefits.available || !benefits.afterTaxAvailable) return null;
  
  const annualIncome = profile.income.gross * 12;
  
  // Check income threshold - typically beneficial for higher earners
  // who are above Roth IRA limits
  const megaPhaseout = profile.taxes.filingStatus === 'marriedJoint'
    ? ROTH_IRA_PHASEOUT_2026.marriedFilingJointly
    : ROTH_IRA_PHASEOUT_2026.single;

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

  const remainingAfterTaxRoom = totalLimit - currentAnnualContribution - employerMatch;

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
    priority: 6.5, // After regular 401k but before taxable
    reasoning: 'Convert after-tax 401k contributions to Roth for tax-free growth (high earner strategy)',
    taxImpact: 0, // After-tax contributions, no immediate tax benefit
    category: 'tax_advantaged',
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
    priority: 7,
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

/**
 * Calculate low-interest debt analysis (Step 8 - contrarian advice)
 * This is typically NOT recommended in favor of investing
 */
export function calculateLowInterestDebtAnalysis(profile: PaycheckProfile): SkippedItem | null {
  const lowInterestDebts = profile.debts.filter(debt => 
    debt.interestRate <= 0.07 && debt.balance > 0
  );
  
  if (lowInterestDebts.length === 0) return null;
  
  const totalBalance = lowInterestDebts.reduce((sum, debt) => sum + debt.balance, 0);
  const weightedRate = lowInterestDebts.reduce((sum, debt) => 
    sum + (debt.interestRate * debt.balance), 0) / totalBalance;
  
  const monthlyPayments = lowInterestDebts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  
  // Calculate opportunity cost of paying off early vs investing
  const marketReturn = 0.07; // 7% expected market return
  const opportunityCostRate = marketReturn - weightedRate;
  const annualOpportunityCost = totalBalance * opportunityCostRate;
  
  return {
    id: 'low-interest-debt-payoff',
    item: `Pay off ${lowInterestDebts.map(d => d.name).join(', ')} early`,
    reason: `Debt rates (${formatPercent(weightedRate)} avg) below expected investment returns (~7%)`,
    opportunityCost: {
      monthly: annualOpportunityCost / 12,
      annual: annualOpportunityCost,
      tenYear: annualOpportunityCost * 10, // Simplified calculation
    },
    alternative: `Invest extra payments instead - potential ${formatCurrency(annualOpportunityCost)}/year more wealth creation`,
    riskLevel: 'low',
    education: 'Low-interest debt (especially tax-deductible) should rarely be paid off early. The opportunity cost of not investing typically outweighs the guaranteed debt payoff return.',
  };
}