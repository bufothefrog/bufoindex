import {
  PaycheckProfile,
  AllocationResult,
  AllocationItem,
  IncomeData
} from '../types';
import { 
  calculate1MonthEmergency,
  calculateEmployerMatch,
  calculateHSAOptimal,
  calculateHighInterestDebt,
  calculateEmergencyFundCompletion,
  calculateRothIRA,
  calculateAdditional401k,
  calculateMegaBackdoorRoth,
  calculateTaxableInvestment
} from './optimization';
import { identifySkippedOptimizations } from './analysis';
import { calculateProjections, calculateOptimizationScore } from './projections';

/**
 * Paycheck frequency conversion utilities
 */
export { FREQUENCY_MULTIPLIERS } from '../constants/frequency';
import { FREQUENCY_MULTIPLIERS } from '../constants/frequency';

/**
 * Convert paycheck amount to monthly amount
 */
export function paycheckToMonthly(paycheckAmount: number, frequency: keyof typeof FREQUENCY_MULTIPLIERS): number {
  return paycheckAmount * FREQUENCY_MULTIPLIERS[frequency];
}

/**
 * Convert monthly amount to per-paycheck amount
 */
export function monthlyToPaycheck(monthlyAmount: number, frequency: keyof typeof FREQUENCY_MULTIPLIERS): number {
  return monthlyAmount / FREQUENCY_MULTIPLIERS[frequency];
}

/**
 * Update legacy income fields from paycheck-based inputs
 */
export function updateLegacyIncomeFields(income: IncomeData): IncomeData {
  // Validate paycheck inputs to prevent NaN
  const grossPaycheck = Number(income.grossPaycheck) || 0;
  const netPaycheck = Number(income.netPaycheck) || 0;

  const monthlyGross = paycheckToMonthly(grossPaycheck, income.frequency);
  const monthlyNet = paycheckToMonthly(netPaycheck, income.frequency);

  // Calculate bonus monthly equivalent with validation
  let monthlyBonus = 0;
  if (income.regularBonus && income.bonusAmount > 0) {
    const bonusAmount = Number(income.bonusAmount) || 0;
    switch (income.bonusFrequency) {
      case 'quarterly':
        monthlyBonus = bonusAmount / 3;
        break;
      case 'annual':
        monthlyBonus = bonusAmount / 12;
        break;
      case 'irregular':
        monthlyBonus = bonusAmount / 12; // Assume annual average
        break;
    }
  }

  // Ensure all calculated values are valid numbers
  const validMonthlyGross = Number.isFinite(monthlyGross) ? monthlyGross : 0;
  const validMonthlyNet = Number.isFinite(monthlyNet) ? monthlyNet : 0;
  const validMonthlyBonus = Number.isFinite(monthlyBonus) ? monthlyBonus : 0;

  return {
    ...income,
    monthlyGross: validMonthlyGross,
    monthlyNet: validMonthlyNet,
    gross: validMonthlyGross,
    net: validMonthlyNet,
    bonusExpected: validMonthlyBonus,
  };
}

/**
 * Main optimization calculation engine
 * Pure function that takes a paycheck profile and returns optimal allocation
 * Now calculates in per-paycheck amounts to match user mental model
 */
export function calculateOptimalAllocation(profile: PaycheckProfile): AllocationResult {
  // Ensure legacy income fields are updated from paycheck-based inputs
  const updatedProfile = {
    ...profile,
    income: updateLegacyIncomeFields(profile.income),
  };

  // Calculate per-paycheck amounts (user's actual paycheck scope)
  const netPaycheck = Number(updatedProfile.income.netPaycheck) || 0;
  const frequency = updatedProfile.income.frequency;

  // Convert necessary expenses and fun money to per-paycheck amounts
  const necessaryExpensesMonthly = Number(updatedProfile.preferences.necessaryExpenses) || 0;
  const necessaryExpensesPerPaycheck = monthlyToPaycheck(necessaryExpensesMonthly, frequency);

  const minFunMoneyMonthly = Number(updatedProfile.preferences.funMoney.min) || 0;
  const maxFunMoneyMonthly = Number(updatedProfile.preferences.funMoney.max) || minFunMoneyMonthly || 0;
  const funMoneyPerPaycheck = monthlyToPaycheck(minFunMoneyMonthly, frequency);
  
  // Available amount per paycheck (this is what the user actually has to allocate)
  let availableAmount = Math.max(0, netPaycheck - necessaryExpensesPerPaycheck - funMoneyPerPaycheck);
  const allocations: AllocationItem[] = [];
  
  // Step 2: Execute Financial Order of Operations
  const priorityAllocations = [
    // Step 1: 1-Month Emergency Fund (basic security first)
    () => calculate1MonthEmergency(updatedProfile, availableAmount),
    
    // Step 2: Employer 401k Match
    () => calculateEmployerMatch(updatedProfile, availableAmount),
    
    // Step 3: High-Interest Debt (over 7%)
    () => calculateHighInterestDebt(updatedProfile, availableAmount),
    
    // Step 4: Complete Emergency Fund (1 month → 3 months)
    () => calculateEmergencyFundCompletion(updatedProfile, availableAmount),
    
    // Step 5: Roth IRA & HSA Max (tax-free growth)
    () => calculateHSAOptimal(updatedProfile, availableAmount), // HSA first - triple tax advantage
    () => calculateRothIRA(updatedProfile, availableAmount), // Smart Roth vs Traditional
    
    // Step 6: Max Retirement Accounts (401k/403b)
    () => calculateAdditional401k(updatedProfile, availableAmount),
    
    // Step 6.5: Mega Backdoor Roth (high earners only)
    () => calculateMegaBackdoorRoth(updatedProfile, availableAmount),
    
    // Step 7: Hyper-Accumulation (taxable investing)
    () => calculateTaxableInvestment(updatedProfile, availableAmount),
    
    // Step 8: Low-Interest Debt (under 7%) - rarely pay off early
    // Handled by the opportunity analysis as optional
  ];
  
  // Execute allocations in priority order
  for (let i = 0; i < priorityAllocations.length; i++) {
    if (availableAmount <= 0) break;

    const allocation = priorityAllocations[i]();
    if (allocation && allocation.amount > 0 && allocation.amount <= availableAmount) {
      allocations.push(allocation);
      availableAmount -= allocation.amount;
    }
  }

  // Step 3: Identify optimization opportunities and deprioritized items
  const skippedItems = identifySkippedOptimizations(updatedProfile);

  // Step 4: Calculate future projections
  const projections = calculateProjections(updatedProfile, allocations);

  // Step 5: Calculate optimization score
  const optimizationScore = calculateOptimizationScore(updatedProfile, allocations, skippedItems);
  
  return {
    allocations,
    skippedItems,
    projections,
    optimizationScore,
    funMoneyAllocated: minFunMoneyMonthly, // Keep monthly for compatibility
    funMoneyRange: {
      min: minFunMoneyMonthly,
      max: maxFunMoneyMonthly,
      difference: maxFunMoneyMonthly - minFunMoneyMonthly,
    },
    remainingAmount: availableAmount, // Now per-paycheck amount
    paycheckContext: {
      netPaycheck,
      frequency,
      necessaryExpensesPerPaycheck,
      funMoneyPerPaycheck,
      availablePerPaycheck: availableAmount,
    },
  };
}

/**
 * Get default profile for new users
 */
export function getDefaultProfile(): PaycheckProfile {
  return {
    income: {
      // Paycheck-based inputs (user-facing)
      grossPaycheck: 2500,
      netPaycheck: 1900,
      frequency: 'bi-weekly',
      
      // Bonus tracking
      regularBonus: false,
      bonusAmount: 0,
      bonusFrequency: 'annual',
      
      // Calculated monthly values
      monthlyGross: 5417, // 2500 * 2.17
      monthlyNet: 4123,   // 1900 * 2.17
      
      // Legacy fields for backward compatibility
      gross: 5417,
      net: 4123,
      bonusExpected: 0,
    },
    taxes: {
      federalBracket: 0.22,
      state: 'CA',
      filingStatus: 'single',
      currentWithholding: {
        federal: 800,
        state: 200,
        fica: 382,
      },
    },
    benefits: {
      employer401k: {
        available: true,
        matchPercent: 0.50,
        matchLimit: 0.06,
        currentContribution: 0.03,
        contributionType: 'traditional',
        traditionalContribution: 0.03,
        rothContribution: 0.00,
        afterTaxAvailable: false,
        currentYTD: 0,
      },
      hsa: {
        eligible: false,
        employerContribution: 0,
        currentContribution: 0,
        currentYTD: 0,
        coverageType: 'individual',
        investmentStrategy: false,
      },
      ira: {
        hasIRA: false,
        accountTypes: {
          traditional: false,
          roth: false,
        },
        currentContributions: {
          traditional: 0,
          roth: 0,
        },
        currentBalances: {
          traditional: 0,
          roth: 0,
        },
      },
      other: {
        fsaElection: 0,
        transitBenefits: 0,
        lifeInsurance: 0,
      },
    },
    debts: [],
    preferences: {
      emergencyFundMonths: 3,
      currentEmergencyFund: 0,
      emergencyFundAPY: 0.04, // 4.0% HYSA
      necessaryExpenses: 2500,
      funMoney: {
        min: 300,
        max: 600,
        current: 450,
      },
      age: 30,
      hasTaxableAccount: false,
      taxableAccountContribution: 0,
      isPeakEarnings: false,
      expectedRetirementBracket: 0.12, // Optional, defaults to 12% bracket
      riskTolerance: 'moderate',
      optimizationGoal: 'balanced',
    },
    version: '1.0',
    lastUpdated: Date.now(),
    source: 'user_input',
  };
}

/**
 * Validate profile data and return errors
 */
export function validateProfile(profile: PaycheckProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // Income validation
  if (profile.income.gross <= 0) {
    errors.grossIncome = 'Gross income must be greater than 0';
  }
  
  if (profile.income.net <= 0) {
    errors.netIncome = 'Net income must be greater than 0';
  }
  
  if (profile.income.net >= profile.income.gross) {
    errors.netIncome = 'Net income cannot be greater than gross income';
  }
  
  // Tax bracket validation
  const validBrackets = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
  if (!validBrackets.includes(profile.taxes.federalBracket)) {
    errors.federalBracket = 'Please select a valid federal tax bracket';
  }
  
  // Benefits validation
  if (profile.benefits.employer401k.available) {
    if (profile.benefits.employer401k.matchPercent < 0 || profile.benefits.employer401k.matchPercent > 1) {
      errors.employerMatch = 'Employer match percentage must be between 0% and 100%';
    }
    
    if (profile.benefits.employer401k.currentContribution < 0 || profile.benefits.employer401k.currentContribution > 1) {
      errors.currentContribution = 'Current contribution must be between 0% and 100%';
    }
  }
  
  // Debt validation
  profile.debts.forEach((debt, index) => {
    if (debt.balance <= 0) {
      errors[`debt_${index}_balance`] = 'Debt balance must be greater than 0';
    }
    
    if (debt.interestRate < 0 || debt.interestRate > 0.50) {
      errors[`debt_${index}_rate`] = 'Interest rate must be between 0% and 50%';
    }
    
    if (debt.minimumPayment <= 0) {
      errors[`debt_${index}_payment`] = 'Minimum payment must be greater than 0';
    }
  });
  
  // Preferences validation
  if (profile.preferences.emergencyFundMonths < 0 || profile.preferences.emergencyFundMonths > 12) {
    errors.emergencyFundMonths = 'Emergency fund target must be between 0 and 12 months';
  }
  
  if (profile.preferences.funMoney.min < 0) {
    errors.funMoneyMin = 'Fun money minimum cannot be negative';
  }
  
  if (profile.preferences.funMoney.max < profile.preferences.funMoney.min) {
    errors.funMoneyMax = 'Fun money maximum must be greater than minimum';
  }
  
  return errors;
}

/**
 * Calculate estimated monthly expenses based on profile
 */
export function estimateMonthlyExpenses(profile: PaycheckProfile): number {
  // Basic estimation: net income minus typical savings/discretionary spending
  const baseLiving = profile.income.net * 0.7; // Assume 70% goes to fixed expenses
  const debtPayments = profile.debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  
  return baseLiving + debtPayments;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(decimal: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(decimal);
}

/**
 * Calculate compound growth
 */
export function calculateCompoundGrowth(principal: number, rate: number, years: number): number {
  // Validate inputs to prevent NaN
  const validPrincipal = Number.isFinite(principal) ? principal : 0;
  const validRate = Number.isFinite(rate) ? rate : 0;
  const validYears = Number.isFinite(years) ? Math.max(0, years) : 0;
  
  if (validPrincipal <= 0) {
    return 0;
  }

  const result = validPrincipal * Math.pow(1 + validRate, validYears);
  return Number.isFinite(result) ? result : 0;
}

/**
 * Calculate opportunity cost of keeping money in low-yield investments
 */
export function calculateOpportunityCost(amount: number, years: number, lowYield = 0.02, highYield = 0.07): number {
  const lowGrowth = calculateCompoundGrowth(amount, lowYield, years);
  const highGrowth = calculateCompoundGrowth(amount, highYield, years);
  return highGrowth - lowGrowth;
}