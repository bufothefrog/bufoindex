import {
  PaycheckProfile,
  AllocationResult,
  AllocationItem,
  IncomeData
} from '../types';
import {
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
import { calculateProjections } from './projections';

/**
 * Paycheck frequency conversion utilities
 */
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

  // Fun money: coerce non-finite input to 0 (rather than `|| 0`, which would
  // also swallow a deliberate 0), then treat the maximum as at least the
  // minimum so the reported range is never negative when a user types a
  // maximum below their minimum.
  const rawMinFunMoney = Number(updatedProfile.preferences.funMoney.min);
  const rawMaxFunMoney = Number(updatedProfile.preferences.funMoney.max);
  const minFunMoneyMonthly = Number.isFinite(rawMinFunMoney) ? rawMinFunMoney : 0;
  const maxFunMoneyMonthly = Math.max(
    minFunMoneyMonthly,
    Number.isFinite(rawMaxFunMoney) ? rawMaxFunMoney : 0
  );
  const funMoneyPerPaycheck = monthlyToPaycheck(minFunMoneyMonthly, frequency);

  // Necessary expenses above take-home pay leave nothing to allocate. The
  // clamp below hides that, so record the gap for the UI to report.
  const incomeShortfall = necessaryExpensesPerPaycheck - netPaycheck;

  // Available amount per paycheck (this is what the user actually has to allocate)
  let availableAmount = Math.max(0, netPaycheck - necessaryExpensesPerPaycheck - funMoneyPerPaycheck);
  const allocations: AllocationItem[] = [];
  
  // Step 2: Execute Financial Order of Operations
  const priorityAllocations = [
    // Employer 401k Match
    () => calculateEmployerMatch(updatedProfile, availableAmount),
    
    // High-Interest Debt (over 7%)
    () => calculateHighInterestDebt(updatedProfile, availableAmount),
    
    // Emergency fund to the target months
    () => calculateEmergencyFundCompletion(updatedProfile, availableAmount),
    
    // Step 5: Roth IRA & HSA Max (tax-free growth)
    () => calculateHSAOptimal(updatedProfile, availableAmount), // HSA first - triple tax advantage
    () => calculateRothIRA(updatedProfile, availableAmount), // Smart Roth vs Traditional
    
    // Step 6: Max Retirement Accounts (401k/403b). The allocations made so far
    // are passed through so the top-up nets out the employee deferral the
    // match step already recommended (IRC 402(g) is a single annual limit).
    () => calculateAdditional401k(updatedProfile, availableAmount, allocations),
    
    // Step 6.5: Mega Backdoor Roth (high earners only)
    () => calculateMegaBackdoorRoth(updatedProfile, availableAmount, allocations),
    
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
  const skippedItems = identifySkippedOptimizations(updatedProfile, allocations);

  // Step 4: Calculate future projections
  const projections = calculateProjections(updatedProfile, allocations);

  return {
    allocations,
    skippedItems,
    projections,
    funMoneyAllocated: minFunMoneyMonthly, // Keep monthly for compatibility
    funMoneyRange: {
      min: minFunMoneyMonthly,
      max: maxFunMoneyMonthly,
      difference: maxFunMoneyMonthly - minFunMoneyMonthly,
    },
    remainingAmount: availableAmount, // Now per-paycheck amount
    // Only present when necessary expenses genuinely outrun the paycheck, so
    // consumers can treat its absence as "no shortfall".
    ...(incomeShortfall > 0 ? { incomeShortfall } : {}),
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
      investedBalance: 0,
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