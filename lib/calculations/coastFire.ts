/**
 * Coast FIRE Calculations
 * Coast FIRE = having enough money saved that it will grow to your retirement target
 * without any additional contributions, allowing you to "coast" to retirement.
 */

import { RetirementInputs, calculateRequiredBalance, futureValue } from './retirement';

export interface CoastFireResult {
  isAchievable: boolean;
  ageAchievable?: number;
  currentBalanceNeeded?: number;
  currentAge: number;
  targetAge: number;
  requiredBalance: number;
  yearsToCoast?: number;
  monthlyContributionsUntilCoast?: number;
  totalContributionsNeeded?: number;
}

export interface CoastFireAnalysis {
  current: CoastFireResult;
  scenarios: {
    conservative: CoastFireResult;
    moderate: CoastFireResult;
    aggressive: CoastFireResult;
  };
  insights: string[];
}

/**
 * Calculate Coast FIRE scenario
 */
export function calculateCoastFire(inputs: RetirementInputs): CoastFireResult {
  const currentAge = inputs.startingAge;
  const targetAge = inputs.retirementAge;
  const yearsToRetirement = targetAge - currentAge;
  const requiredBalance = calculateRequiredBalance(inputs.targetIncome);
  
  // Calculate what balance we need TODAY to coast to retirement
  const currentBalanceNeeded = calculateCoastFireBalance(
    requiredBalance,
    inputs.accumulationReturn,
    yearsToRetirement
  );
  
  // Check if current balance already achieves Coast FIRE
  if (inputs.startingBalance >= currentBalanceNeeded) {
    return {
      isAchievable: true,
      ageAchievable: currentAge,
      currentBalanceNeeded,
      currentAge,
      targetAge,
      requiredBalance,
      yearsToCoast: 0,
      monthlyContributionsUntilCoast: 0,
      totalContributionsNeeded: 0
    };
  }
  
  // Calculate when Coast FIRE will be achievable with current savings rate
  const coastFireAge = findCoastFireAge(inputs);
  const yearsToCoast = coastFireAge ? coastFireAge - currentAge : undefined;
  
  // Calculate monthly contributions needed to reach Coast FIRE by target age
  const shortfall = currentBalanceNeeded - inputs.startingBalance;
  const monthlyContributionsUntilCoast = yearsToCoast ? 
    calculateMonthlyContributionsForCoastFire(shortfall, inputs.accumulationReturn, yearsToCoast) : 
    undefined;
  
  return {
    isAchievable: coastFireAge !== undefined,
    ageAchievable: coastFireAge,
    currentBalanceNeeded,
    currentAge,
    targetAge,
    requiredBalance,
    yearsToCoast,
    monthlyContributionsUntilCoast,
    totalContributionsNeeded: yearsToCoast && monthlyContributionsUntilCoast ? 
      monthlyContributionsUntilCoast * yearsToCoast * 12 : undefined
  };
}

/**
 * Calculate comprehensive Coast FIRE analysis with different return scenarios
 */
export function calculateCoastFireAnalysis(inputs: RetirementInputs): CoastFireAnalysis {
  const current = calculateCoastFire(inputs);
  
  // Calculate scenarios with different return rates
  const conservativeInputs = { ...inputs, accumulationReturn: 0.05 }; // 5% return
  const moderateInputs = { ...inputs, accumulationReturn: 0.07 };     // 7% return
  const aggressiveInputs = { ...inputs, accumulationReturn: 0.09 };   // 9% return
  
  const scenarios = {
    conservative: calculateCoastFire(conservativeInputs),
    moderate: calculateCoastFire(moderateInputs),
    aggressive: calculateCoastFire(aggressiveInputs)
  };
  
  const insights = generateCoastFireInsights(inputs, current, scenarios);
  
  return {
    current,
    scenarios,
    insights
  };
}

/**
 * Calculate the balance needed today to coast to retirement target
 */
function calculateCoastFireBalance(
  targetBalance: number,
  annualReturn: number,
  yearsToGrow: number
): number {
  // Present value calculation: PV = FV / (1 + r)^n
  return targetBalance / Math.pow(1 + annualReturn, yearsToGrow);
}

/**
 * Find the age at which Coast FIRE is achievable with current savings
 */
function findCoastFireAge(inputs: RetirementInputs): number | undefined {
  const requiredBalance = calculateRequiredBalance(inputs.targetIncome);
  const maxAge = Math.min(inputs.retirementAge - 1, inputs.startingAge + 40); // Don't go beyond reasonable limits
  
  for (let age = inputs.startingAge; age <= maxAge; age++) {
    const yearsFromStart = age - inputs.startingAge;
    const monthsFromStart = yearsFromStart * 12;
    const monthlyRate = inputs.accumulationReturn / 12;
    
    // Calculate projected balance at this age
    const growthOfStartingBalance = futureValue(
      inputs.startingBalance,
      inputs.accumulationReturn,
      yearsFromStart
    );
    
    const growthOfContributions = inputs.monthlySavings > 0 ?
      inputs.monthlySavings * ((Math.pow(1 + monthlyRate, monthsFromStart) - 1) / monthlyRate) :
      0;
    
    const projectedBalanceAtAge = growthOfStartingBalance + growthOfContributions;
    
    // Calculate what this balance would grow to by retirement (coasting from this age)
    const yearsToRetirement = inputs.retirementAge - age;
    const coastedBalance = futureValue(
      projectedBalanceAtAge,
      inputs.accumulationReturn,
      yearsToRetirement
    );
    
    if (coastedBalance >= requiredBalance) {
      return age;
    }
  }
  
  return undefined; // Coast FIRE not achievable
}

/**
 * Calculate monthly contributions needed to reach Coast FIRE balance
 */
function calculateMonthlyContributionsForCoastFire(
  shortfall: number,
  annualReturn: number,
  yearsAvailable: number
): number {
  const monthsAvailable = yearsAvailable * 12;
  const monthlyRate = annualReturn / 12;
  
  if (monthlyRate === 0) {
    return shortfall / monthsAvailable;
  }
  
  // PMT formula: PMT = FV * r / ((1 + r)^n - 1)
  return shortfall * monthlyRate / (Math.pow(1 + monthlyRate, monthsAvailable) - 1);
}

/**
 * Calculate Coast FIRE number for a specific age and return rate
 */
export function calculateCoastFireNumber(
  targetIncome: number,
  currentAge: number,
  retirementAge: number,
  annualReturn: number,
  withdrawalRate: number = 0.04
): number {
  const requiredBalance = targetIncome / withdrawalRate;
  const yearsToRetirement = retirementAge - currentAge;
  
  return calculateCoastFireBalance(requiredBalance, annualReturn, yearsToRetirement);
}

/**
 * Check if current position achieves Coast FIRE
 */
export function isCoastFireAchieved(
  currentBalance: number,
  targetIncome: number,
  currentAge: number,
  retirementAge: number,
  annualReturn: number,
  withdrawalRate: number = 0.04
): boolean {
  const coastFireNumber = calculateCoastFireNumber(
    targetIncome,
    currentAge,
    retirementAge,
    annualReturn,
    withdrawalRate
  );
  
  return currentBalance >= coastFireNumber;
}

/**
 * Calculate time to Coast FIRE with current savings rate
 */
export function calculateTimeToCoastFire(inputs: RetirementInputs): {
  years: number;
  months: number;
  totalMonths: number;
} | null {
  const coastFire = calculateCoastFire(inputs);
  
  if (!coastFire.yearsToCoast) {
    return null;
  }
  
  const totalMonths = coastFire.yearsToCoast * 12;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  
  return {
    years,
    months,
    totalMonths
  };
}

/**
 * Generate insights about Coast FIRE scenario
 */
function generateCoastFireInsights(
  inputs: RetirementInputs,
  current: CoastFireResult,
  _scenarios: { conservative: CoastFireResult; moderate: CoastFireResult; aggressive: CoastFireResult; }
): string[] {
  // Only return 1 most relevant Coast FIRE insight
  
  if (current.isAchievable && current.ageAchievable !== undefined) {
    if (current.ageAchievable <= inputs.startingAge) {
      return [`🎉 Coast FIRE achieved! Stop contributions now - your $${inputs.startingBalance.toLocaleString()} will grow to fund retirement. Reallocate $${inputs.monthlySavings.toLocaleString()}/month to current experiences.`];
    } else if (current.yearsToCoast && current.yearsToCoast <= 10) {
      const totalNeeded = current.monthlyContributionsUntilCoast ? 
        Math.round(current.monthlyContributionsUntilCoast * current.yearsToCoast * 12) : 0;
      return [`🏖️ Coast FIRE at age ${current.ageAchievable}: ${current.yearsToCoast} years of saving, then financial freedom. Total investment: $${totalNeeded.toLocaleString()}.`];
    }
  } else if (current.currentBalanceNeeded) {
    const shortfall = current.currentBalanceNeeded - inputs.startingBalance;
    const monthsToRetirement = (inputs.retirementAge - inputs.startingAge) * 12;
    const additionalMonthlyNeeded = Math.round(shortfall / monthsToRetirement);
    
    if (additionalMonthlyNeeded < inputs.currentIncome * 0.2) { // Less than 20% of income
      return [`🎯 Coast FIRE achievable: Add $${additionalMonthlyNeeded.toLocaleString()}/month to enable coasting to retirement target.`];
    }
  }
  
  return []; // No Coast FIRE insight if not relevant
}