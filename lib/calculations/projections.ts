import { 
  PaycheckProfile, 
  AllocationItem, 
  SkippedItem, 
  ProjectionData, 
  OptimizationScore 
} from '../types';
import { calculateCompoundGrowth } from './core';

/**
 * Calculate future projections comparing current strategy vs optimized strategy
 */
export function calculateProjections(
  profile: PaycheckProfile, 
  allocations: AllocationItem[]
): ProjectionData {
  const currentStrategy = calculateCurrentPathProjection(profile);
  const optimizedStrategy = calculateOptimizedPathProjection(profile, allocations);
  
  return {
    currentPath: currentStrategy,
    optimizedPath: optimizedStrategy,
    improvement: {
      tenYear: optimizedStrategy.tenYear - currentStrategy.tenYear,
      annualTaxSavings: currentStrategy.taxesOwed - optimizedStrategy.taxesOwed,
      fiYearsEarlier: Math.max(0, currentStrategy.fiAge - optimizedStrategy.fiAge),
    },
  };
}

/**
 * Calculate projections based on current financial strategy
 */
function calculateCurrentPathProjection(profile: PaycheckProfile) {
  const monthlyInvestment = calculateCurrentMonthlyInvestment(profile);
  const currentNetWorth = estimateCurrentNetWorth(profile);
  
  // Validate inputs to prevent NaN
  const validMonthlyInvestment = Number.isFinite(monthlyInvestment) ? monthlyInvestment : 0;
  const validCurrentNetWorth = Number.isFinite(currentNetWorth) ? currentNetWorth : 0;
  const grossIncome = Number(profile.income.gross) || 0;
  const netIncome = Number(profile.income.net) || 0;
  const federalBracket = Number(profile.taxes.federalBracket) || 0;
  
  // Assume 7% annual return - with safe calculation
  const compoundGrowth = calculateCompoundGrowth(validMonthlyInvestment * 12, 0.07, 10);
  const tenYearNetWorth = validCurrentNetWorth + (Number.isFinite(compoundGrowth) ? compoundGrowth : 0);
  
  // Current tax burden - validate calculation
  const annualTaxes = grossIncome * 12 * federalBracket;
  
  // Financial independence calculation (4% rule) - prevent division by zero
  const currentAnnualExpenses = Math.max(1, (netIncome - validMonthlyInvestment) * 12);
  const fiTarget = currentAnnualExpenses / 0.04;
  const fiAge = calculateFIAge(profile, monthlyInvestment, fiTarget, currentNetWorth);
  
  return {
    tenYear: tenYearNetWorth,
    taxesOwed: annualTaxes,
    fiAge: fiAge,
  };
}

/**
 * Calculate projections based on optimized allocation strategy
 */
function calculateOptimizedPathProjection(
  profile: PaycheckProfile, 
  allocations: AllocationItem[]
) {
  const totalOptimizedInvestment = allocations.reduce((sum, allocation) => {
    // Count tax-advantaged and investment allocations
    if (['tax_advantaged', 'investment', 'tax_optimization'].includes(allocation.category)) {
      return sum + allocation.amount;
    }
    return sum;
  }, 0);
  
  const currentNetWorth = estimateCurrentNetWorth(profile);
  
  // Account for tax advantages in growth calculation
  const averageTaxAdvantage = calculateAverageTaxAdvantage(allocations);
  const effectiveReturn = 0.07 + averageTaxAdvantage; // Base return + tax advantage
  
  const tenYearNetWorth = currentNetWorth + calculateCompoundGrowth(
    totalOptimizedInvestment * 12,
    effectiveReturn,
    10
  );
  
  // Optimized tax burden
  const totalTaxSavings = allocations.reduce((sum, allocation) => 
    sum + Math.abs(allocation.taxImpact), 0
  );
  const optimizedAnnualTaxes = (profile.income.gross * 12 * profile.taxes.federalBracket) - (totalTaxSavings * 12);
  
  // Optimized FI calculation
  const optimizedAnnualExpenses = (profile.income.net - totalOptimizedInvestment) * 12;
  const fiTarget = optimizedAnnualExpenses / 0.04;
  const fiAge = calculateFIAge(profile, totalOptimizedInvestment, fiTarget, currentNetWorth);
  
  return {
    tenYear: tenYearNetWorth,
    taxesOwed: Math.max(0, optimizedAnnualTaxes),
    fiAge: fiAge,
  };
}

/**
 * Calculate optimization score based on profile and allocations
 */
export function calculateOptimizationScore(
  profile: PaycheckProfile, 
  allocations: AllocationItem[],
  skippedItems: SkippedItem[]
): OptimizationScore {
  const taxEfficiency = calculateTaxEfficiencyScore(profile, allocations);
  const employerBenefits = calculateEmployerBenefitsScore(profile, allocations);
  const debtStrategy = calculateDebtStrategyScore(profile, skippedItems);
  const emergencyFundSize = calculateEmergencyFundScore(profile, skippedItems);
  const accountPrioritization = calculateAccountPrioritizationScore(allocations);
  
  const overall = Math.round(
    (taxEfficiency * 0.25) +
    (employerBenefits * 0.25) +
    (debtStrategy * 0.20) +
    (emergencyFundSize * 0.15) +
    (accountPrioritization * 0.15)
  );
  
  // Calculate comparison score (what they'd get with typical advice)
  const currentStrategy = calculateCurrentStrategyScore(profile);
  
  return {
    overall,
    breakdown: {
      taxEfficiency,
      employerBenefits,
      debtStrategy,
      emergencyFundSize,
      accountPrioritization,
    },
    comparison: currentStrategy,
  };
}

/**
 * Estimate current monthly investment based on profile
 */
function calculateCurrentMonthlyInvestment(profile: PaycheckProfile): number {
  const benefits = profile.benefits.employer401k;
  let monthlyInvestment = 0;
  
  // Validate inputs to prevent NaN
  const grossIncome = Number(profile.income.gross) || 0;
  const netIncome = Number(profile.income.net) || 0;
  
  if (benefits.available && grossIncome > 0) {
    const annualSalary = grossIncome * 12;
    const contribution = Number(benefits.currentContribution) || 0;
    monthlyInvestment += (annualSalary * contribution) / 12;
  }
  
  // Use necessary expenses as baseline instead of hardcoded 3000
  const necessaryExpenses = Number(profile.preferences.necessaryExpenses) || 0;
  const funMoneyMin = Number(profile.preferences.funMoney.min) || 0;
  const discretionaryIncome = Math.max(0, netIncome - necessaryExpenses - funMoneyMin);
  
  // Conservative estimate: 10% of discretionary income goes to additional investing
  monthlyInvestment += discretionaryIncome * 0.1;
  
  // Ensure we return a valid number
  return Number.isFinite(monthlyInvestment) ? monthlyInvestment : 0;
}

/**
 * Estimate current net worth based on profile
 */
function estimateCurrentNetWorth(profile: PaycheckProfile): number {
  // Conservative estimation based on emergency fund and debt
  const assets = profile.preferences.currentEmergencyFund;
  const liabilities = profile.debts.reduce((sum, debt) => sum + debt.balance, 0);
  
  // Add estimated existing retirement savings (very rough)
  const estimatedRetirement = Math.max(0, profile.income.gross * 12 * 0.5); // Conservative estimate
  
  return Math.max(0, assets + estimatedRetirement - liabilities);
}

/**
 * Calculate average tax advantage across allocations
 */
function calculateAverageTaxAdvantage(allocations: AllocationItem[]): number {
  const taxAdvantagedAllocations = allocations.filter(allocation => 
    allocation.taxImpact < 0 && allocation.category === 'tax_advantaged'
  );
  
  if (taxAdvantagedAllocations.length === 0) return 0;
  
  const totalTaxAdvantaged = taxAdvantagedAllocations.reduce((sum, allocation) => 
    sum + allocation.amount, 0
  );
  const totalTaxSavings = taxAdvantagedAllocations.reduce((sum, allocation) => 
    sum + Math.abs(allocation.taxImpact), 0
  );
  
  // Convert monthly tax savings to effective return advantage
  return totalTaxAdvantaged > 0 ? (totalTaxSavings / totalTaxAdvantaged) * 12 : 0;
}

/**
 * Calculate financial independence age
 */
function calculateFIAge(
  profile: PaycheckProfile, 
  monthlyInvestment: number, 
  fiTarget: number, 
  currentNetWorth: number
): number {
  if (monthlyInvestment <= 0) return 99; // Never reach FI
  
  const annualInvestment = monthlyInvestment * 12;
  const yearsToFI = Math.log(
    (fiTarget - currentNetWorth) * 0.07 / annualInvestment + 1
  ) / Math.log(1.07);
  
  // Assume current age of 30 if not provided
  const currentAge = 30; // Could be enhanced to ask user for age
  const fiAge = currentAge + yearsToFI;
  
  return Math.min(99, Math.max(currentAge + 1, fiAge));
}

// Optimization score calculation helpers

function calculateTaxEfficiencyScore(profile: PaycheckProfile, allocations: AllocationItem[]): number {
  const taxSavingAllocations = allocations.filter(allocation => allocation.taxImpact < 0);
  const totalTaxSavings = taxSavingAllocations.reduce((sum, allocation) => 
    sum + Math.abs(allocation.taxImpact), 0
  );
  
  // Score based on tax savings as percentage of income
  const taxSavingsRate = totalTaxSavings / profile.income.gross;
  
  if (taxSavingsRate > 0.15) return 100;
  if (taxSavingsRate > 0.10) return 85;
  if (taxSavingsRate > 0.05) return 70;
  if (taxSavingsRate > 0.02) return 55;
  return 30;
}

function calculateEmployerBenefitsScore(profile: PaycheckProfile, allocations: AllocationItem[]): number {
  const hasEmployerMatch = allocations.some(allocation => allocation.category === 'employer_match');
  const hasHSA = allocations.some(allocation => allocation.id === 'hsa-contribution');
  
  if (!profile.benefits.employer401k.available && !profile.benefits.hsa.eligible) return 100; // N/A
  
  let score = 0;
  if (hasEmployerMatch || !profile.benefits.employer401k.available) score += 70;
  if (hasHSA || !profile.benefits.hsa.eligible) score += 30;
  
  return score;
}

function calculateDebtStrategyScore(profile: PaycheckProfile, skippedItems: SkippedItem[]): number {
  if (profile.debts.length === 0) return 100; // No debt = perfect score
  
  const highInterestDebt = profile.debts.filter(debt => debt.interestRate > 0.07);
  const suboptimalDebtStrategy = skippedItems.filter(item => item.item.includes('Payment'));
  
  let score = 60; // Base score
  
  // Penalty for high-interest debt
  if (highInterestDebt.length > 0) score -= 30;
  
  // Bonus for optimizing low-interest debt strategy
  if (suboptimalDebtStrategy.length > 0) score += 25;
  
  return Math.max(0, Math.min(100, score));
}

function calculateEmergencyFundScore(profile: PaycheckProfile, skippedItems: SkippedItem[]): number {
  const emergencyFundIssues = skippedItems.filter(item => 
    item.item.includes('Emergency Fund')
  );
  
  if (emergencyFundIssues.length === 0) return 90; // Good emergency fund strategy
  
  const months = profile.preferences.emergencyFundMonths;
  
  if (months === 0) return 70; // Risky but can be optimal
  if (months <= 3) return 95; // Optimal range
  if (months <= 6) return 80; // Acceptable
  return 40; // Too large
}

function calculateAccountPrioritizationScore(allocations: AllocationItem[]): number {
  // Score based on optimal prioritization
  let score = 70; // Base score
  
  const priorities = allocations.map(allocation => ({
    priority: allocation.priority,
    category: allocation.category
  })).sort((a, b) => a.priority - b.priority);
  
  // Check if employer match comes first
  if (priorities.length > 0 && priorities[0].category === 'employer_match') {
    score += 15;
  }
  
  // Check if high-interest debt comes early
  const highInterestDebtIndex = priorities.findIndex(p => p.category === 'high_interest_debt');
  if (highInterestDebtIndex <= 1 && highInterestDebtIndex !== -1) {
    score += 10;
  }
  
  // Check if tax-advantaged accounts come before taxable
  const taxAdvantagedIndex = priorities.findIndex(p => p.category === 'tax_advantaged');
  const investmentIndex = priorities.findIndex(p => p.category === 'investment');
  
  if (taxAdvantagedIndex < investmentIndex && taxAdvantagedIndex !== -1) {
    score += 5;
  }
  
  return Math.min(100, score);
}

function calculateCurrentStrategyScore(profile: PaycheckProfile): number {
  // Estimate score for typical financial advice
  let score = 40; // Base typical advice score
  
  // Check if they're getting employer match
  if (profile.benefits.employer401k.available && profile.benefits.employer401k.currentContribution >= profile.benefits.employer401k.matchLimit) {
    score += 20;
  }
  
  // Check emergency fund (BufoIndex philosophy = 1-3 months maximum)
  if (profile.preferences.emergencyFundMonths >= 1 && profile.preferences.emergencyFundMonths <= 3) {
    score += 10;
  }
  
  // Check if contributing to retirement at all
  if (profile.benefits.employer401k.currentContribution > 0) {
    score += 10;
  }
  
  return Math.min(75, score); // Cap typical advice at 75
}