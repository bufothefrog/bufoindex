/**
 * Advanced Retirement Scenario Analysis
 * Provides sophisticated scenario analysis with three distinct paths:
 * 1. Exceeding Goals - ahead of target
 * 2. On Track - meeting target within 10%
 * 3. Falling Short - below target
 */

import { RetirementInputs, calculateProjectedBalance, calculateRequiredBalance } from './retirement';
import { adjustForInflation, calculateInflatedIncome } from './inflationAdjustment';
import { calculateCoastFire } from './coastFire';

export interface ScenarioAnalysis {
  status: 'exceeding' | 'onTrack' | 'falling';
  current: {
    projectedBalance: number;
    requiredBalance: number;
    canRetireAtAge?: number; // For falling short
    incomeAtTargetAge?: number; // For falling short
    surplusAmount?: number; // For exceeding/on track
  };
  withExtra500: {
    projectedBalance: number;
    earlierRetirementAge?: number;
    additionalIncome?: number;
    canRetireAtAge?: number; // For falling short
    incomeAtTargetAge?: number; // For falling short
  };
  withExtra1000: {
    projectedBalance: number;
    earlierRetirementAge?: number;
    additionalIncome?: number;
    canRetireAtAge?: number; // For falling short
    incomeAtTargetAge?: number; // For falling short
  };
  coastFire?: {
    isAchievable: boolean;
    ageAchievable?: number;
    currentBalanceNeeded?: number;
  };
  recommendations: string[];
}

export interface ScenarioProjection {
  projectedBalance: number;
  requiredBalance: number;
  balanceRatio: number;
  earlierRetirementAge?: number;
  additionalIncome?: number;
  actualRetirementAge?: number;
  actualIncome?: number;
}

/**
 * Unified status determination function.
 * Prevents conflicting thresholds across modules.
 */
export function determineRetirementStatus(
  balanceRatio: number,
  successRate?: number
): 'exceeding' | 'onTrack' | 'falling' {
  if (balanceRatio >= 1.2 && (successRate === undefined || successRate > 0.85)) {
    return 'exceeding';
  }
  if (balanceRatio >= 0.9 && (successRate === undefined || successRate >= 0.70)) {
    return 'onTrack';
  }
  return 'falling';
}

/**
 * Perform comprehensive scenario analysis
 */
export function analyzeRetirementScenarios(inputs: RetirementInputs): ScenarioAnalysis {
  const start = performance.now();
  
  // Calculate base scenario
  const projectedBalance = calculateProjectedBalance(inputs);
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const inflatedTargetIncome = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, yearsToRetirement);
  const requiredBalance = calculateRequiredBalance(inflatedTargetIncome);
  const balanceRatio = projectedBalance / requiredBalance;
  
  // Determine scenario status using unified thresholds
  const status = determineRetirementStatus(balanceRatio);
  
  // Calculate scenarios with additional savings
  const with500Extra = calculateScenarioWithExtraSavings(inputs, 500);
  const with1000Extra = calculateScenarioWithExtraSavings(inputs, 1000);
  
  // Calculate Coast FIRE scenario
  const coastFire = calculateCoastFire(inputs);
  
  // Build current scenario data
  const current = buildCurrentScenario(inputs, projectedBalance, requiredBalance, status);
  
  // Generate recommendations
  const recommendations = generateScenarioRecommendations(inputs, status, balanceRatio);
  
  const elapsed = performance.now() - start;
  console.log(`Scenario analysis completed in ${elapsed.toFixed(2)}ms`);
  
  return {
    status,
    current,
    withExtra500: buildExtraScenario(with500Extra, status),
    withExtra1000: buildExtraScenario(with1000Extra, status),
    coastFire,
    recommendations
  };
}

/**
 * Calculate scenario with additional monthly savings
 */
function calculateScenarioWithExtraSavings(inputs: RetirementInputs, extraAmount: number): ScenarioProjection {
  const modifiedInputs = {
    ...inputs,
    monthlySavings: inputs.monthlySavings + extraAmount
  };
  
  const projectedBalance = calculateProjectedBalance(modifiedInputs);
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const inflatedTargetIncome = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, yearsToRetirement);
  const requiredBalance = calculateRequiredBalance(inflatedTargetIncome);
  const balanceRatio = projectedBalance / requiredBalance;

  // Calculate earlier retirement age if exceeding target
  let earlierRetirementAge: number | undefined;
  let additionalIncome: number | undefined;
  let actualRetirementAge: number | undefined;
  let actualIncome: number | undefined;
  
  if (balanceRatio > 1.0) {
    // Can either retire earlier with same income OR have more income at target age
    earlierRetirementAge = findEarlierRetirementAge(modifiedInputs, inputs.targetIncome);
    additionalIncome = calculateAdditionalIncomeAtTargetAge(projectedBalance, inputs.targetIncome);
  } else {
    // Still falling short - calculate what's actually achievable
    actualRetirementAge = findActualRetirementAge(modifiedInputs, inputs.targetIncome);
    actualIncome = calculateActualIncomeAtTargetAge(projectedBalance);
  }
  
  return {
    projectedBalance,
    requiredBalance,
    balanceRatio,
    earlierRetirementAge,
    additionalIncome,
    actualRetirementAge,
    actualIncome
  };
}

/**
 * Build current scenario data based on status
 */
function buildCurrentScenario(
  inputs: RetirementInputs, 
  projectedBalance: number, 
  requiredBalance: number, 
  status: 'exceeding' | 'onTrack' | 'falling'
) {
  const base = { projectedBalance, requiredBalance };
  
  if (status === 'falling') {
    return {
      ...base,
      canRetireAtAge: findActualRetirementAge(inputs, inputs.targetIncome),
      incomeAtTargetAge: calculateActualIncomeAtTargetAge(projectedBalance)
    };
  } else {
    return {
      ...base,
      surplusAmount: projectedBalance - requiredBalance
    };
  }
}

/**
 * Build extra savings scenario data
 */
function buildExtraScenario(projection: ScenarioProjection, status: 'exceeding' | 'onTrack' | 'falling') {
  const base = { projectedBalance: projection.projectedBalance };
  
  if (projection.balanceRatio >= 1.0) {
    // Meeting or exceeding target
    return {
      ...base,
      earlierRetirementAge: projection.earlierRetirementAge,
      additionalIncome: projection.additionalIncome
    };
  } else {
    // Still falling short
    return {
      ...base,
      canRetireAtAge: projection.actualRetirementAge,
      incomeAtTargetAge: projection.actualIncome
    };
  }
}

/**
 * Find the earliest age at which retirement is possible with target income
 */
function findEarlierRetirementAge(inputs: RetirementInputs, targetIncome: number): number {
  for (let age = inputs.startingAge + 1; age < inputs.retirementAge; age++) {
    const yearsToAge = age - inputs.startingAge;
    const inflatedIncome = targetIncome * Math.pow(1 + inputs.inflationRate, yearsToAge);
    const requiredBalance = calculateRequiredBalance(inflatedIncome);
    const modifiedInputs = { ...inputs, retirementAge: age };
    const projectedBalance = calculateProjectedBalance(modifiedInputs);

    if (projectedBalance >= requiredBalance) {
      return age;
    }
  }

  return inputs.retirementAge; // Fallback to original retirement age
}

/**
 * Calculate additional annual income possible at target retirement age
 */
function calculateAdditionalIncomeAtTargetAge(projectedBalance: number, baseTargetIncome: number): number {
  const withdrawalRate = 0.04; // 4% rule
  const totalPossibleIncome = projectedBalance * withdrawalRate;
  return totalPossibleIncome - baseTargetIncome;
}

/**
 * Find actual retirement age when falling short (when balance can support target income)
 */
function findActualRetirementAge(inputs: RetirementInputs, targetIncome: number): number {
  const maxAge = Math.min(inputs.lifeExpectancy - 5, 75); // Don't work past reasonable age

  for (let age = inputs.retirementAge; age <= maxAge; age++) {
    const yearsToAge = age - inputs.startingAge;
    const inflatedIncome = targetIncome * Math.pow(1 + inputs.inflationRate, yearsToAge);
    const requiredBalance = calculateRequiredBalance(inflatedIncome);
    const modifiedInputs = { ...inputs, retirementAge: age };
    const projectedBalance = calculateProjectedBalance(modifiedInputs);

    if (projectedBalance >= requiredBalance) {
      return age;
    }
  }

  return maxAge; // Fallback - may still be short but this is realistic limit
}

/**
 * Calculate actual income achievable at target retirement age
 */
function calculateActualIncomeAtTargetAge(projectedBalance: number): number {
  const withdrawalRate = 0.04; // 4% rule
  return projectedBalance * withdrawalRate;
}

/**
 * Generate BufoIndex contrarian recommendations
 */
function generateScenarioRecommendations(
  inputs: RetirementInputs, 
  status: 'exceeding' | 'onTrack' | 'falling',
  _balanceRatio: number
): string[] {
  // Only return 1 most relevant recommendation based on status
  
  if (status === 'exceeding') {
    const earlierAge = findEarlierRetirementAge(inputs, inputs.targetIncome);
    const yearsSaved = inputs.retirementAge - earlierAge;
    if (yearsSaved > 0) {
      return [`🎯 Opportunity cost advantage: You could retire ${yearsSaved} years earlier (age ${earlierAge}) with your current plan. Consider if ${yearsSaved * 365} additional days of freedom outweigh higher current savings.`];
    }
  }
  
  if (status === 'onTrack') {
    const extra500Impact = calculateScenarioWithExtraSavings(inputs, 500);
    const yearsSaved = inputs.retirementAge - (extra500Impact.earlierRetirementAge || inputs.retirementAge);
    
    if (yearsSaved > 0) {
      return [`⚡ Marginal opportunity: Adding $500/month buys ${yearsSaved} additional retirement years. Cost: $${(500 * 12 * (inputs.retirementAge - inputs.startingAge)).toLocaleString()} total investment.`];
    }
  }
  
  if (status === 'falling') {
    const ytr = inputs.retirementAge - inputs.startingAge;
    const inflatedIncome = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, ytr);
    const shortfall = calculateRequiredBalance(inflatedIncome) - calculateProjectedBalance(inputs);
    const monthlyShortfall = Math.round(shortfall / (ytr * 12));
    const actualAge = findActualRetirementAge(inputs, inputs.targetIncome);
    
    return [`⚠️ Gap analysis: Need +$${monthlyShortfall.toLocaleString()}/month to hit target, or retire at age ${actualAge} instead (${actualAge - inputs.retirementAge} years later).`];
  }
  
  return []; // No insights if none of the above apply
}

/**
 * Calculate impact of working additional years
 */
export function calculateWorkingLongerImpact(inputs: RetirementInputs, additionalYears: number): {
  newProjectedBalance: number;
  additionalBalance: number;
  newSafeWithdrawal: number;
} {
  const modifiedInputs = {
    ...inputs,
    retirementAge: inputs.retirementAge + additionalYears
  };
  
  const newProjectedBalance = calculateProjectedBalance(modifiedInputs);
  const originalProjectedBalance = calculateProjectedBalance(inputs);
  const additionalBalance = newProjectedBalance - originalProjectedBalance;
  const newSafeWithdrawal = newProjectedBalance * 0.04; // 4% rule
  
  return {
    newProjectedBalance,
    additionalBalance,
    newSafeWithdrawal
  };
}

/**
 * Calculate impact of reducing target income
 */
export function calculateReducedIncomeImpact(inputs: RetirementInputs, reductionPercent: number): {
  newTargetIncome: number;
  newRequiredBalance: number;
  balanceSurplus: number;
  earlierRetirementAge: number;
} {
  const newTargetIncome = inputs.targetIncome * (1 - reductionPercent);
  const newRequiredBalance = calculateRequiredBalance(newTargetIncome);
  const projectedBalance = calculateProjectedBalance(inputs);
  const balanceSurplus = projectedBalance - newRequiredBalance;
  
  const earlierRetirementAge = findEarlierRetirementAge(inputs, newTargetIncome);
  
  return {
    newTargetIncome,
    newRequiredBalance,
    balanceSurplus,
    earlierRetirementAge
  };
}