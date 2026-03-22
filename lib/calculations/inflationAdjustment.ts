/**
 * Inflation Adjustment Calculations
 * Handles inflation adjustments for retirement planning with focus on
 * showing both current and future dollar values for clear understanding.
 */

import { RetirementInputs } from './retirement';
import { boxMullerRandom } from '@/lib/utils/random';

export interface InflationAdjustedValues {
  currentDollars: number;
  futureDollars: number;
  inflationRate: number;
  yearsToInflation: number;
  purchasingPowerLoss: number; // Percentage loss of purchasing power
}

export interface InflationAnalysis {
  targetIncomeInflated: InflationAdjustedValues;
  monthlyExpensesInflated: InflationAdjustedValues;
  totalInflationImpact: number;
  breakeven: {
    investmentReturnNeeded: number; // Return needed to maintain purchasing power
    savingsRateAdjustment: number; // Additional savings rate needed
  };
  insights: string[];
}

/**
 * Adjust a dollar amount for inflation over a specified period
 */
export function adjustForInflation(
  currentAmount: number,
  inflationRate: number,
  years: number
): InflationAdjustedValues {
  const futureDollars = currentAmount * Math.pow(1 + inflationRate, years);
  const purchasingPowerLoss = (1 - (currentAmount / futureDollars)) * 100;
  
  return {
    currentDollars: currentAmount,
    futureDollars,
    inflationRate,
    yearsToInflation: years,
    purchasingPowerLoss
  };
}

/**
 * Calculate inflation-adjusted target income
 */
export function calculateInflatedIncome(
  targetIncome: number,
  inflationRate: number,
  yearsUntilRetirement: number
): InflationAdjustedValues {
  return adjustForInflation(targetIncome, inflationRate, yearsUntilRetirement);
}

/**
 * Calculate comprehensive inflation analysis for retirement planning
 */
export function analyzeInflationImpact(inputs: RetirementInputs): InflationAnalysis {
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  
  // Calculate inflated values
  const targetIncomeInflated = calculateInflatedIncome(
    inputs.targetIncome,
    inputs.inflationRate,
    yearsToRetirement
  );
  
  const monthlyExpensesInflated = adjustForInflation(
    inputs.necessaryMonthlyExpenses * 12, // Convert to annual
    inputs.inflationRate,
    yearsToRetirement
  );
  
  // Calculate total inflation impact on retirement corpus needed
  const currentRequired = inputs.targetIncome / 0.04; // 4% rule
  const inflatedRequired = targetIncomeInflated.futureDollars / 0.04;
  const totalInflationImpact = inflatedRequired - currentRequired;
  
  // Calculate breakeven requirements
  const breakeven = calculateInflationBreakeven(inputs, yearsToRetirement);
  
  // Generate insights
  const insights = generateInflationInsights(inputs, targetIncomeInflated, totalInflationImpact, breakeven);
  
  return {
    targetIncomeInflated,
    monthlyExpensesInflated,
    totalInflationImpact,
    breakeven,
    insights
  };
}

/**
 * Calculate what's needed to break even with inflation
 */
function calculateInflationBreakeven(inputs: RetirementInputs, yearsToRetirement: number): {
  investmentReturnNeeded: number;
  savingsRateAdjustment: number;
} {
  // Investment return needed to maintain purchasing power
  const investmentReturnNeeded = inputs.inflationRate;
  
  // Calculate additional savings rate needed to offset inflation
  const currentRequired = inputs.targetIncome / 0.04;
  const inflatedRequired = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, yearsToRetirement) / 0.04;
  const additionalCorpusNeeded = inflatedRequired - currentRequired;
  
  // Calculate additional monthly savings needed (simplified)
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyRate = Math.pow(1 + inputs.accumulationReturn, 1/12) - 1;
  
  let additionalMonthlySavings = 0;
  if (monthlyRate > 0) {
    // PMT formula for future value of annuity
    additionalMonthlySavings = additionalCorpusNeeded * monthlyRate / 
      (Math.pow(1 + monthlyRate, monthsToRetirement) - 1);
  } else {
    additionalMonthlySavings = additionalCorpusNeeded / monthsToRetirement;
  }
  
  const currentSavingsRate = (inputs.monthlySavings * 12) / inputs.currentIncome;
  const additionalSavingsRate = (additionalMonthlySavings * 12) / inputs.currentIncome;
  
  return {
    investmentReturnNeeded,
    savingsRateAdjustment: additionalSavingsRate
  };
}

/**
 * Calculate year-by-year inflation impact on withdrawals
 */
export function calculateInflationAdjustedWithdrawals(
  baseWithdrawal: number,
  inflationRate: number,
  retirementYears: number
): { [year: number]: InflationAdjustedValues } {
  const withdrawals: { [year: number]: InflationAdjustedValues } = {};
  
  for (let year = 1; year <= retirementYears; year++) {
    withdrawals[year] = adjustForInflation(baseWithdrawal, inflationRate, year);
  }
  
  return withdrawals;
}

/**
 * Calculate real (inflation-adjusted) return rate
 */
export function calculateRealReturn(nominalReturn: number, inflationRate: number): number {
  // Fisher equation: (1 + nominal) = (1 + real) * (1 + inflation)
  // Therefore: real = ((1 + nominal) / (1 + inflation)) - 1
  return ((1 + nominalReturn) / (1 + inflationRate)) - 1;
}

/**
 * Calculate purchasing power equivalents
 */
export function calculatePurchasingPowerEquivalent(
  futureAmount: number,
  inflationRate: number,
  years: number
): number {
  return futureAmount / Math.pow(1 + inflationRate, years);
}

/**
 * Calculate inflation-protected savings requirement
 */
export function calculateInflationProtectedSavings(
  targetRealIncome: number,
  currentAge: number,
  retirementAge: number,
  inflationRate: number,
  realReturn: number
): number {
  const yearsToRetirement = retirementAge - currentAge;
  
  // Calculate nominal income needed at retirement
  const nominalIncomeAtRetirement = targetRealIncome * Math.pow(1 + inflationRate, yearsToRetirement);
  
  // Calculate corpus needed for inflation-protected withdrawals
  // This accounts for the fact that withdrawals need to increase with inflation
  const realWithdrawalRate = 0.04; // Assuming 4% real withdrawal rate
  const corpusNeeded = nominalIncomeAtRetirement / realWithdrawalRate;
  
  return corpusNeeded;
}

/**
 * Generate inflation-focused insights with BufoIndex contrarian perspective
 */
function generateInflationInsights(
  inputs: RetirementInputs,
  targetIncomeInflated: InflationAdjustedValues,
  totalInflationImpact: number,
  _breakeven: { investmentReturnNeeded: number; savingsRateAdjustment: number; }
): string[] {
  // Only return 1 most critical inflation insight
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const realReturn = calculateRealReturn(inputs.accumulationReturn, inputs.inflationRate);
  
  // Priority 1: High inflation warning (critical)
  if (inputs.inflationRate > 0.04) { // Above 4%
    const inflationMultiplier = Math.pow(1 + inputs.inflationRate, yearsToRetirement);
    return [`🔥 High inflation alert: At ${(inputs.inflationRate * 100).toFixed(1)}% inflation, you need ${((inflationMultiplier - 1) * 100).toFixed(0)}% more money just to break even. Your target $${inputs.targetIncome.toLocaleString()} becomes $${Math.round(targetIncomeInflated.futureDollars).toLocaleString()} in future dollars.`];
  }
  
  // Priority 2: Low real return warning (actionable)
  if (realReturn < 0.03) { // Real return below 3%
    return [`⚖️ Real return only ${(realReturn * 100).toFixed(1)}% after inflation. Your ${(inputs.accumulationReturn * 100).toFixed(1)}% nominal return barely outpaces inflation - consider higher-growth investments.`];
  }
  
  // Priority 3: Significant inflation impact (if substantial)
  if (totalInflationImpact > inputs.targetIncome * 2) { // More than 2x annual income
    const earlyRetirementSavings = Math.round(totalInflationImpact / ((inputs.retirementAge - 5 - inputs.startingAge) * 12));
    return [`🎯 Inflation adds $${Math.round(totalInflationImpact).toLocaleString()} to retirement needs - purely to maintain purchasing power. Retiring 5 years earlier saves $${earlyRetirementSavings}/month in inflation costs.`];
  }
  
  // Return empty if inflation impact is manageable
  return [];
}

/**
 * Calculate sequence of returns risk with inflation
 */
export function calculateSequenceRiskWithInflation(
  startingBalance: number,
  annualWithdrawal: number,
  averageReturn: number,
  volatility: number,
  inflationRate: number,
  years: number,
  simulations: number = 1000
): {
  successRate: number;
  medianFinalBalance: number;
  worstCase10thPercentile: number;
} {
  const results: number[] = [];
  
  for (let sim = 0; sim < simulations; sim++) {
    let balance = startingBalance;
    let currentWithdrawal = annualWithdrawal;
    
    for (let year = 0; year < years; year++) {
      // Generate random return
      const randomReturn = generateNormalReturn(averageReturn, volatility);
      
      // Apply return
      balance *= (1 + randomReturn);
      
      // Subtract inflation-adjusted withdrawal
      balance -= currentWithdrawal;
      
      // Adjust withdrawal for next year's inflation
      currentWithdrawal *= (1 + inflationRate);
      
      // If balance goes negative, record failure
      if (balance <= 0) {
        balance = 0;
        break;
      }
    }
    
    results.push(balance);
  }
  
  // Calculate statistics
  results.sort((a, b) => a - b);
  const successRate = results.filter(r => r > 0).length / simulations;
  const medianIndex = Math.floor(simulations / 2);
  const tenthPercentileIndex = Math.floor(simulations * 0.1);
  
  return {
    successRate,
    medianFinalBalance: results[medianIndex],
    worstCase10thPercentile: results[tenthPercentileIndex]
  };
}

/**
 * Generate normal distribution random return
 */
function generateNormalReturn(mean: number, standardDeviation: number): number {
  return boxMullerRandom(mean, standardDeviation);
}