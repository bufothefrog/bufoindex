import { PaycheckProfile, SkippedItem } from '../types';
import { formatCurrency, formatPercent, calculateOpportunityCost } from './core';
import { calculateIncomeTaxRate } from '../utils';

/**
 * Identify optimization opportunities and surface deprioritized items
 */
export function identifySkippedOptimizations(profile: PaycheckProfile): SkippedItem[] {
  const skippedItems: SkippedItem[] = [];
  
  // Check emergency fund optimization
  const emergencyFundOptimization = analyzeEmergencyFund(profile);
  if (emergencyFundOptimization) {
    skippedItems.push(emergencyFundOptimization);
  }
  
  // Check Roth vs Traditional strategy
  const rothTraditionalOptimization = analyzeRothVsTraditionalStrategy(profile);
  if (rothTraditionalOptimization) {
    skippedItems.push(rothTraditionalOptimization);
  }
  
  // Check debt strategy optimization
  const debtOptimizations = analyzeDebtStrategy(profile);
  skippedItems.push(...debtOptimizations);
  
  // Check low-interest debt prepayment strategy
  const lowInterestDebtOptimization = analyzeLowInterestDebtStrategy(profile);
  if (lowInterestDebtOptimization) {
    skippedItems.push(lowInterestDebtOptimization);
  }
  
  // Check for missed employer benefits
  const missedBenefits = analyzeMissedBenefits(profile);
  if (missedBenefits) {
    skippedItems.push(missedBenefits);
  }
  
  return skippedItems;
}

/**
 * Analyze emergency fund with enhanced opportunity cost calculations
 */
function analyzeEmergencyFund(profile: PaycheckProfile): SkippedItem | null {
  const monthlyExpenses = profile.preferences.necessaryExpenses;
  const targetMonths = profile.preferences.emergencyFundMonths;
  const currentEmergencyFund = profile.preferences.currentEmergencyFund;
  const emergencyFundAPY = profile.preferences.emergencyFundAPY;
  const targetAmount = monthlyExpenses * targetMonths;
  const currentMonths = currentEmergencyFund / monthlyExpenses;
  
  // Case 1: Current emergency fund exceeds target
  if (currentEmergencyFund > targetAmount + 500) { // $500 buffer
    const excessAmount = currentEmergencyFund - targetAmount;
    const tenYearOpportunityCost = calculateCompoundOpportunityCost(
      excessAmount, 
      emergencyFundAPY, 
      0.07, // Expected market return
      10
    );
    
    return {
      id: 'excessive-emergency-fund',
      item: 'Excessive Emergency Fund',
      reason: `You have ${formatCurrency(currentEmergencyFund)} (${currentMonths.toFixed(1)} months) but target ${targetMonths} months`,
      opportunityCost: {
        monthly: excessAmount * (0.07 - emergencyFundAPY) / 12,
        annual: excessAmount * (0.07 - emergencyFundAPY),
        tenYear: tenYearOpportunityCost,
      },
      alternative: `Invest excess ${formatCurrency(excessAmount)} in taxable accounts. Keep ${targetMonths} months + Roth IRA as backup emergency fund`,
      riskLevel: targetMonths >= 3 ? 'low' : 'medium',
      education: `Emergency funds at ${(emergencyFundAPY * 100).toFixed(1)}% APY vs 7% expected market returns = ${formatCurrency(tenYearOpportunityCost)} opportunity cost over 10 years`,
    };
  }
  
  // Case 2: Target emergency fund is excessive (BufoIndex maximum: 3 months)
  if (targetMonths > 3) {
    const excessMonths = targetMonths - 3;
    const excessAmount = monthlyExpenses * excessMonths;
    const tenYearOpportunityCost = calculateCompoundOpportunityCost(
      excessAmount,
      emergencyFundAPY,
      0.07,
      10
    );
    
    return {
      id: 'large-emergency-fund-target',
      item: 'Large Emergency Fund Target',
      reason: `${targetMonths}-month emergency fund exceeds BufoIndex maximum of 3 months - opportunity cost too high`,
      opportunityCost: {
        monthly: excessAmount * (0.07 - emergencyFundAPY) / 12,
        annual: excessAmount * (0.07 - emergencyFundAPY),
        tenYear: tenYearOpportunityCost,
      },
      alternative: `Limit to 3-month cash maximum + Roth IRA principal as extended backup. Invest the excess ${formatCurrency(excessAmount)}`,
      riskLevel: 'low',
      education: `BufoIndex philosophy: Emergency funds beyond 3 months cost more in opportunity (${formatCurrency(tenYearOpportunityCost)} over 10 years) than they provide in security`,
    };
  }
  
  // Case 3: Emergency fund APY too low
  if (currentEmergencyFund > 1000 && emergencyFundAPY < 0.04) {
    const betterAPY = 0.04; // 4.0% HYSA
    const additionalEarnings = currentEmergencyFund * (betterAPY - emergencyFundAPY);
    
    return {
      id: 'low-emergency-fund-apy',
      item: 'Low Emergency Fund APY',
      reason: `Emergency fund earning ${(emergencyFundAPY * 100).toFixed(1)}% when high-yield savings offer 3.5-4.5%`,
      opportunityCost: {
        monthly: additionalEarnings / 12,
        annual: additionalEarnings,
        tenYear: additionalEarnings * 10, // Conservative - no compounding
      },
      alternative: `Move to high-yield savings account (Marcus, Ally, etc.) for extra ${formatCurrency(additionalEarnings)}/year`,
      riskLevel: 'low',
      education: 'Moving to HYSA is risk-free arbitrage - same safety, better returns',
    };
  }
  
  // Case 4: Zero emergency fund with conservative/moderate risk tolerance
  if (currentMonths < 1 && profile.preferences.riskTolerance !== 'optimizer') {
    return {
      id: 'no-emergency-fund',
      item: 'Insufficient Emergency Fund',
      reason: 'Less than 1 month of expenses saved increases financial risk',
      opportunityCost: {
        monthly: 0,
        annual: 0,
      },
      alternative: 'Build 1-month emergency fund first, then up to 3-month maximum total',
      riskLevel: 'high',
      education: 'Emergency funds provide peace of mind and prevent debt accumulation during crises',
    };
  }
  
  return null;
}

/**
 * Calculate compound opportunity cost between two investment returns
 */
function calculateCompoundOpportunityCost(
  amount: number,
  currentReturn: number,
  betterReturn: number,
  years: number
): number {
  const currentValue = amount * Math.pow(1 + currentReturn, years);
  const betterValue = amount * Math.pow(1 + betterReturn, years);
  return betterValue - currentValue;
}

/**
 * Analyze debt payment strategy for optimization opportunities
 */
function analyzeDebtStrategy(profile: PaycheckProfile): SkippedItem[] {
  const skippedItems: SkippedItem[] = [];
  
  profile.debts.forEach(debt => {
    if (debt.extraPayment > 0) {
      const effectiveRate = debt.taxDeductible 
        ? debt.interestRate * (1 - calculateIncomeTaxRate(profile.taxes.federalBracket, profile.taxes.state))
        : debt.interestRate;
      
      const expectedMarketReturn = 0.07; // Conservative market return assumption
      const riskAdjustedThreshold = 0.05; // 5% threshold for switching to investing
      
      if (effectiveRate < riskAdjustedThreshold) {
        const monthlyOpportunityCost = debt.extraPayment * ((expectedMarketReturn - effectiveRate) / 12);
        const twentyYearOpportunityCost = calculateTwentyYearDebtOpportunityCost(
          debt.extraPayment, 
          expectedMarketReturn - effectiveRate
        );
        
        skippedItems.push({
          id: `debt-strategy-${debt.id}`,
          item: `Extra ${debt.name} Payment`,
          reason: `${formatPercent(effectiveRate)} effective rate vs ${formatPercent(expectedMarketReturn)} expected market return`,
          opportunityCost: {
            monthly: monthlyOpportunityCost,
            annual: monthlyOpportunityCost * 12,
            twentyYear: twentyYearOpportunityCost,
          },
          alternative: `Pay minimum on ${debt.name}, invest extra ${formatCurrency(debt.extraPayment)}/month`,
          riskLevel: effectiveRate < 0.04 ? 'low' : 'medium',
          education: debt.taxDeductible 
            ? 'Tax-deductible debt is often better kept than paid off early, especially at low rates'
            : 'Low-rate debt allows you to leverage cheap money for potentially higher investment returns',
        });
      }
    }
  });
  
  return skippedItems;
}

/**
 * Check for missed employer benefits
 */
function analyzeMissedBenefits(profile: PaycheckProfile): SkippedItem | null {
  const benefits = profile.benefits.employer401k;
  
  if (!benefits.available) return null;
  
  const annualSalary = profile.income.gross * 12;
  const maxMatchContribution = annualSalary * benefits.matchLimit;
  const currentAnnualContribution = annualSalary * benefits.currentContribution;
  const maxEmployerMatch = maxMatchContribution * benefits.matchPercent;
  const currentEmployerMatch = currentAnnualContribution * benefits.matchPercent;
  
  const missedMatch = maxEmployerMatch - currentEmployerMatch;
  
  if (missedMatch > 100) { // Only flag if missing >$100/year
    return {
      id: 'missed-employer-match',
      item: 'Missed Employer Match',
      reason: `Not getting full employer 401k match - leaving ${formatCurrency(missedMatch)} on the table`,
      opportunityCost: {
        monthly: missedMatch / 12,
        annual: missedMatch,
        tenYear: calculateOpportunityCost(missedMatch, 10, 0, 0.07) + (missedMatch * 10), // Lost match + growth
      },
      alternative: `Increase 401k contribution from ${formatPercent(benefits.currentContribution)} to ${formatPercent(benefits.matchLimit)}`,
      riskLevel: 'low',
      education: 'An employer match is an immediate return on contributions at the match rate; most allocation orderings place it ahead of unmatched investing',
    };
  }
  
  return null;
}

/**
 * Calculate opportunity cost of extra debt payments over 20 years
 */
function calculateTwentyYearDebtOpportunityCost(
  monthlyExtra: number, 
  returnDifferential: number
): number {
  // Future value of investing the extra payments instead
  const monthlyRate = returnDifferential / 12;
  const months = 20 * 12;
  
  if (monthlyRate === 0) {
    return monthlyExtra * months;
  }
  
  // Future value of annuity formula
  const futureValue = monthlyExtra * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  
  // Subtract what they would have saved by paying off debt early
  const debtSavings = monthlyExtra * months; // Simplified - actual calculation would need debt balance and rate
  
  return Math.max(0, futureValue - debtSavings);
}

/**
 * Analyze investment fee impact
 */
export function analyzeInvestmentFees(
  portfolioValue: number, 
  currentFeeRatio: number
): SkippedItem | null {
  const optimalFeeRatio = 0.0003; // Target ultra-low-cost index funds
  const excessFees = currentFeeRatio - optimalFeeRatio;
  
  if (excessFees > 0.002) { // Only flag if fees >0.2% excessive
    const annualExcessFees = portfolioValue * excessFees;
    const twentyYearCost = calculateOpportunityCost(annualExcessFees, 20);
    
    return {
      id: 'high-investment-fees',
      item: 'High Investment Fees',
      reason: `Paying ${formatPercent(currentFeeRatio)} vs optimal ${formatPercent(optimalFeeRatio)} fees`,
      opportunityCost: {
        monthly: annualExcessFees / 12,
        annual: annualExcessFees,
        twentyYear: twentyYearCost,
      },
      alternative: 'Switch to low-cost index funds (VTI, VTSAX) with <0.05% expense ratios',
      riskLevel: 'low',
      education: 'High fees compound against you - a 1% fee can cost 25% of your returns over 30 years',
    };
  }
  
  return null;
}

/**
 * Analyze Roth vs Traditional strategy
 */
function analyzeRothVsTraditionalStrategy(profile: PaycheckProfile): SkippedItem | null {
  const age = profile.preferences.age;
  const isPeakEarnings = profile.preferences.isPeakEarnings;
  const currentBracket = profile.taxes.federalBracket;
  const expectedRetirementBracket = profile.preferences.expectedRetirementBracket || (currentBracket * 0.8);
  
  // Case 1: High earner in peak years choosing Roth
  if (isPeakEarnings && currentBracket >= 0.24 && currentBracket > expectedRetirementBracket) {
    const annualContribution = 7000; // IRA limit
    const currentTaxSavings = annualContribution * currentBracket;
    const investedTaxSavings = currentTaxSavings * Math.pow(1.07, 10); // 10-year growth
    const rothBenefit = annualContribution * Math.pow(1.07, 10) - annualContribution; // Tax-free growth

    if (investedTaxSavings > rothBenefit * 0.8) { // Allow some buffer
      return {
        id: 'roth-vs-traditional',
        item: 'Roth vs Traditional Strategy',
        reason: `Peak earnings + ${(currentBracket * 100).toFixed(0)}% bracket: Traditional may beat Roth`,
        opportunityCost: {
          monthly: currentTaxSavings * 0.07 / 12, // Tax savings invested monthly
          annual: currentTaxSavings * 0.07, // Tax savings invested annually
          tenYear: investedTaxSavings - rothBenefit,
        },
        alternative: `Traditional IRA/401k saves ${formatCurrency(currentTaxSavings)}/year in taxes to invest now`,
        riskLevel: 'low',
        education: `Peak earners often benefit from tax deferral: save ${(currentBracket * 100).toFixed(0)}% now, pay ${(expectedRetirementBracket * 100).toFixed(0)}% later`,
      };
    }
  }
  
  // Case 2: Young person not in peak earnings choosing Traditional
  if (age < 30 && !isPeakEarnings && currentBracket <= 0.12) {
    return {
      id: 'traditional-vs-roth',
      item: 'Traditional vs Roth Strategy', 
      reason: `Age ${age} + not peak earnings + ${(currentBracket * 100).toFixed(0)}% bracket: Roth likely optimal`,
      opportunityCost: {
        monthly: 0, // No immediate monthly cost
        annual: 0,
        tenYear: 15000, // Rough estimate of tax-free growth benefit
      },
      alternative: 'Roth IRA provides tax-free growth for decades - pay low taxes now',
      riskLevel: 'low',
      education: 'Young + low bracket = Roth sweet spot. Tax-free growth compounds for 35+ years',
    };
  }
  
  return null;
}

/**
 * Analyze low-interest debt prepayment strategy  
 */
function analyzeLowInterestDebtStrategy(profile: PaycheckProfile): SkippedItem | null {
  // Find low-interest debt (under 7%) that user might be paying extra on
  const lowInterestDebt = profile.debts.filter(debt => {
    const isLowInterest = debt.interestRate <= 0.07;
    const isPayingExtra = debt.extraPayment > 0;
    
    return isLowInterest && isPayingExtra;
  });
  
  if (lowInterestDebt.length === 0) return null;
  
  const debt = lowInterestDebt[0]; // Focus on first one
  const extraPayment = debt.extraPayment;
  const expectedMarketReturn = 0.07;
  const arbitrageReturn = expectedMarketReturn - debt.interestRate;
  
  const tenYearOpportunityCost = calculateCompoundOpportunityCost(
    extraPayment * 12, // Annual extra payment
    debt.interestRate,
    expectedMarketReturn,
    10
  );
  
  return {
    id: 'low-interest-debt-prepayment',
    item: 'Low-Interest Debt Prepayment',
    reason: `Paying extra on ${(debt.interestRate * 100).toFixed(1)}% debt instead of investing`,
    opportunityCost: {
      monthly: extraPayment * arbitrageReturn / 12,
      annual: extraPayment * 12 * arbitrageReturn,
      tenYear: tenYearOpportunityCost,
    },
    alternative: `Invest extra ${formatCurrency(extraPayment)}/month instead. Expected arbitrage: ${(arbitrageReturn * 100).toFixed(1)}%/year`,
    riskLevel: 'medium',
    education: `BufoIndex debt threshold: Only prepay debt above 7% interest rate. Below 7%, invest instead. ${formatCurrency(tenYearOpportunityCost)} opportunity cost over 10 years.`,
  };
}