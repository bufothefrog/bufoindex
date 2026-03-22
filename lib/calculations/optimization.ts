import { 
  PaycheckProfile, 
  AllocationItem,
  SkippedItem,
  TAX_BRACKETS,
  CONTRIBUTION_LIMITS
} from '../types';
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
  
  // Calculate recommended payment (minimum plus available amount)
  const recommendedPayment = Math.min(availableAmount, highestRateDebt.balance);
  
  if (recommendedPayment <= highestRateDebt.minimumPayment) return null;
  
  const extraPayment = recommendedPayment - highestRateDebt.minimumPayment;
  // Average-balance correction: payments reduce balance over the year,
  // so average effective time is ~6 months, not 12
  const annualSavings = extraPayment * 12 * highestRateDebt.interestRate * 0.5;
  
  const reasoning = `Debt over 7% = guaranteed ${formatPercent(highestRateDebt.interestRate)} return. Prioritize before investing.`;
  
  return {
    id: 'high-interest-debt',
    account: `${highestRateDebt.name} (${formatPercent(highestRateDebt.interestRate)})`,
    amount: extraPayment,
    percentage: extraPayment / profile.income.net,
    priority: 3,
    reasoning: reasoning,
    taxImpact: 0, // Debt payments are not tax-deductible for most consumer debt
    category: 'debt_payoff',
    implementation: `Pay extra ${formatCurrency(extraPayment)}/month toward ${highestRateDebt.name} (saves ${formatCurrency(annualSavings)}/year in interest)`,
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
    ? CONTRIBUTION_LIMITS[2026].hsa.family 
    : CONTRIBUTION_LIMITS[2026].hsa.individual;
    
  const monthlyLimit = annualLimit / 12;
  const additionalContribution = monthlyLimit - hsa.currentContribution;
  
  if (additionalContribution <= 0) return null;
  
  const recommendedContribution = Math.min(additionalContribution, availableAmount);
  
  // HSA payroll deductions are FICA-exempt (IRC 3121), so include FICA in savings
  const annualGross = profile.income.gross * 12;
  const taxSavings = recommendedContribution * calculateHSATaxRate(profile.taxes.federalBracket, profile.taxes.state, annualGross);
  
  return {
    id: 'hsa-contribution',
    account: 'HSA Contribution',
    amount: recommendedContribution,
    percentage: recommendedContribution / profile.income.net,
    priority: hsa.currentContribution === 0 ? 2 : 3,
    reasoning: 'Triple tax advantage: deductible contributions, tax-free growth, tax-free medical withdrawals',
    taxImpact: -taxSavings,
    category: 'tax_advantaged',
    implementation: `Increase HSA to ${formatCurrency(hsa.currentContribution + recommendedContribution)}/month (${formatPercent((hsa.currentContribution + recommendedContribution) / profile.income.gross)} of gross income)`,
  };
}

/**
 * Calculate tax bracket optimization opportunities
 */
export function calculateTaxBracketOptimization(
  profile: PaycheckProfile, 
  availableAmount: number
): AllocationItem | null {
  const annualGross = profile.income.gross * 12;
  const brackets = profile.taxes.filingStatus === 'marriedJoint' 
    ? TAX_BRACKETS[2026].marriedJoint 
    : TAX_BRACKETS[2026].single;
  
  const currentBracket = brackets.find(bracket => 
    annualGross > bracket.min && annualGross <= bracket.max
  );
  
  if (!currentBracket) return null;
  
  const nextLowerBracket = brackets.find(bracket => 
    bracket.max === currentBracket.min
  );
  
  if (!nextLowerBracket) return null;
  
  const amountToReduceBracket = annualGross - currentBracket.min;
  const monthlyReduction = Math.min(amountToReduceBracket / 12, availableAmount);
  
  if (monthlyReduction <= 0 || monthlyReduction < 50) return null; // Don't optimize for tiny amounts
  
  const annualTaxSavings = amountToReduceBracket * (currentBracket.rate - nextLowerBracket.rate);
  
  return {
    id: 'tax-optimization',
    account: '401k Tax Optimization',
    amount: monthlyReduction,
    percentage: monthlyReduction / profile.income.net,
    priority: 4,
    reasoning: `Reduces taxable income to ${formatPercent(nextLowerBracket.rate)} bracket, saving ${formatPercent(currentBracket.rate - nextLowerBracket.rate)} on ${formatCurrency(amountToReduceBracket)}`,
    taxImpact: -annualTaxSavings / 12,
    category: 'tax_optimization',
    implementation: `Additional 401k contribution to optimize tax bracket (${formatCurrency(annualTaxSavings)} annual tax savings)`,
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
  
  // Check income eligibility for Roth IRA (2026 limits - IRS Notice 2025-67)
  const rothPhaseoutStart = profile.taxes.filingStatus === 'marriedJoint' ? 242000 : 153000;
  const rothPhaseoutEnd = profile.taxes.filingStatus === 'marriedJoint' ? 252000 : 168000;
  
  if (annualIncome > rothPhaseoutEnd) return null; // Not eligible
  
  let maxContribution: number = CONTRIBUTION_LIMITS[2026].ira;
  
  // Reduce contribution if in phaseout range
  if (annualIncome > rothPhaseoutStart) {
    const phaseoutAmount = (annualIncome - rothPhaseoutStart) / (rothPhaseoutEnd - rothPhaseoutStart);
    maxContribution = Math.floor(maxContribution * (1 - phaseoutAmount));
  }
  
  const monthlyContribution = Math.min(maxContribution / 12, availableAmount);
  
  if (monthlyContribution <= 50) return null; // Don't recommend tiny contributions
  
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
  
  return {
    id: 'roth-ira',
    account: 'Roth IRA',
    amount: monthlyContribution,
    percentage: monthlyContribution / profile.income.net,
    priority: 5,
    reasoning: reasoning,
    taxImpact: 0, // Roth contributions are after-tax
    category: 'tax_advantaged',
    implementation: `Contribute ${formatCurrency(monthlyContribution)}/month to Roth IRA (${formatCurrency(monthlyContribution * 12)} annually)`,
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
  const maxAnnualContribution = CONTRIBUTION_LIMITS[2026].traditional401k; // Same limit for both
  
  const remainingContributionRoom = maxAnnualContribution - currentAnnualContribution;
  const monthlyRemainingRoom = remainingContributionRoom / 12;
  
  if (monthlyRemainingRoom <= 0) return null;
  
  const recommendedContribution = Math.min(monthlyRemainingRoom, availableAmount);
  
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
  
  return {
    id: 'additional-401k',
    account: accountType,
    amount: recommendedContribution,
    percentage: recommendedContribution / profile.income.net,
    priority: 6,
    reasoning: reasoning,
    taxImpact: taxImpact,
    category: 'tax_advantaged',
    implementation: `Increase ${accountType} contribution by ${formatCurrency(recommendedContribution)}/month`,
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
  const rothPhaseoutEnd = profile.taxes.filingStatus === 'marriedJoint' ? 252000 : 168000;

  if (annualIncome < rothPhaseoutEnd) return null; // Regular Roth IRA is better

  const annualSalary = profile.income.gross * 12;
  const currentAnnualContribution = annualSalary * benefits.currentContribution;

  // Total 401k limit including after-tax contributions (2026: $72,000 or $80,000/$83,250 with catch-up)
  const age = profile.preferences.age;
  const totalLimit = age >= 60 && age <= 63 ? 83250 : age >= 50 ? 80000 : 72000;
  const employerMatch = annualSalary * benefits.matchPercent * Math.min(benefits.matchLimit, benefits.currentContribution);
  
  const remainingAfterTaxRoom = totalLimit - currentAnnualContribution - employerMatch;
  const monthlyAfterTaxRoom = remainingAfterTaxRoom / 12;
  
  if (monthlyAfterTaxRoom <= 0) return null;
  
  const recommendedContribution = Math.min(monthlyAfterTaxRoom, availableAmount);
  
  if (recommendedContribution <= 100) return null; // Only recommend for meaningful amounts
  
  return {
    id: 'mega-backdoor-roth',
    account: 'Mega Backdoor Roth',
    amount: recommendedContribution,
    percentage: recommendedContribution / profile.income.net,
    priority: 6.5, // After regular 401k but before taxable
    reasoning: 'Convert after-tax 401k contributions to Roth for tax-free growth (high earner strategy)',
    taxImpact: 0, // After-tax contributions, no immediate tax benefit
    category: 'tax_advantaged',
    implementation: `Make after-tax 401k contributions of ${formatCurrency(recommendedContribution)}/month, then convert to Roth`,
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
  
  return {
    id: 'taxable-investment',
    account: 'Taxable Investment',
    amount: availableAmount,
    percentage: availableAmount / profile.income.net,
    priority: 7,
    reasoning: 'Build wealth with tax-efficient index funds (VTI/VTSAX)',
    taxImpact: 0, // No immediate tax impact
    category: 'investment',
    implementation: `Invest ${formatCurrency(availableAmount)}/month in low-cost index funds`,
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