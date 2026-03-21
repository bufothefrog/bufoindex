/**
 * Retirement Planning Calculations
 * Core mathematical functions for retirement planning
 */

import { RetirementConstants } from '@/lib/constants/retirement';
import { ScenarioAnalysis, analyzeRetirementScenarios } from './scenarioAnalysis';
import { CoastFireAnalysis, calculateCoastFireAnalysis } from './coastFire';
import { InflationAnalysis, analyzeInflationImpact } from './inflationAdjustment';
import { formatCurrency } from '@/lib/utils';
// Import to register retirement formulas
import '@/lib/formulas/retirement-formulas';

/**
 * Calculate Target Date Fund asset allocation for a specific age
 */
function calculateTDFAllocation(age: number) {
  const clampedAge = Math.max(18, Math.min(100, age));
  
  let stockAllocation: number;
  if (clampedAge <= 25) {
    stockAllocation = 0.90; // 90% stocks when young
  } else if (clampedAge <= 35) {
    stockAllocation = 0.90; // Hold aggressive until 35
  } else if (clampedAge <= 50) {
    // Linear decrease from 90% to 70% between ages 35-50
    stockAllocation = 0.90 - ((clampedAge - 35) / 15) * 0.20;
  } else if (clampedAge <= 65) {
    // Linear decrease from 70% to 40% between ages 50-65
    stockAllocation = 0.70 - ((clampedAge - 50) / 15) * 0.30;
  } else {
    // Linear decrease from 40% to 30% between ages 65-85+
    const ageAfter65 = Math.min(20, clampedAge - 65);
    stockAllocation = 0.40 - (ageAfter65 / 20) * 0.10;
  }
  
  const bondAllocation = 1 - stockAllocation;
  
  return {
    stocks: stockAllocation,
    bonds: bondAllocation,
    age: clampedAge
  };
}

/**
 * Calculate TDF blended return for a specific age
 */
function calculateTDFReturnForAge(age: number): number {
  const allocation = calculateTDFAllocation(age);
  const stockReturn = 0.10; // 10% expected stock return
  const bondReturn = 0.04; // 4% expected bond return
  
  return (allocation.stocks * stockReturn) + (allocation.bonds * bondReturn);
}

/**
 * Calculate TDF blended volatility for a specific age
 */
function calculateTDFVolatilityForAge(age: number): number {
  const allocation = calculateTDFAllocation(age);
  const stockVolatility = 0.18; // 18% stock volatility
  const bondVolatility = 0.06; // 6% bond volatility
  
  return Math.sqrt(
    Math.pow(allocation.stocks * stockVolatility, 2) + 
    Math.pow(allocation.bonds * bondVolatility, 2)
  );
}

export type IncomePeriod = 'hourly' | 'biweekly' | 'semimonthly' | 'monthly' | 'yearly';

export const INCOME_PERIOD_MULTIPLIERS: Record<IncomePeriod, number> = {
  hourly: 2080,       // 40 hrs/week × 52 weeks
  biweekly: 26,       // 26 pay periods/year
  semimonthly: 24,    // 24 pay periods/year (twice per month)
  monthly: 12,
  yearly: 1,
};

export function annualizeIncome(amount: number, period: IncomePeriod): number {
  return amount * INCOME_PERIOD_MULTIPLIERS[period];
}

export interface RetirementInputs {
  startingAge: number;
  retirementAge: number;
  lifeExpectancy: number; // ADDED: User-defined life expectancy instead of hardcoded value
  targetIncome: number;
  startingBalance: number;
  currentIncome: number; // Always annual — derived from incomeAmount × period multiplier
  incomeAmount: number;  // Raw user-entered income value
  incomePeriod: IncomePeriod; // Pay period for the entered amount
  monthlySavings: number;
  necessaryMonthlyExpenses: number;
  accumulationReturn: number;
  retirementReturn: number;
  inflationRate: number;
  socialSecurityAge: number;
  socialSecurityBenefit: number;
  healthcareCostMultiplier: number;
  volatility: number;
  filingStatus: 'single' | 'marriedJoint';
  state: string; // ADDED: State for tax calculations
  riskProfile: 'tdf' | 'custom'; // Risk profile: Target Date Fund or Custom
}

export interface RetirementScenario {
  id: string;
  name: string;
  retirementAge: number;
  requiredBalance: number;
  projectedBalance: number;
  monthlyWithdrawal: number;
  successProbability: number;
  yearsOfIncome: number;
}

export interface RetirementResults {
  scenarios: RetirementScenario[];
  netWorthByAge: { [age: number]: number };
  withdrawalsByAge: { [age: number]: number };
  insights: string[];
  safeWithdrawalRate: number;
  // Enhanced scenario analysis
  scenarioAnalysis?: ScenarioAnalysis;
  coastFireAnalysis?: CoastFireAnalysis;
  inflationAnalysis?: InflationAnalysis;
}

/**
 * Calculate future value with compound interest
 */
export function futureValue(presentValue: number, rate: number, periods: number): number {
  return presentValue * Math.pow(1 + rate, periods);
}

/**
 * Calculate present value
 */
export function presentValue(futureValue: number, rate: number, periods: number): number {
  return futureValue / Math.pow(1 + rate, periods);
}

/**
 * Calculate future value of annuity (regular payments)
 */
export function futureValueOfAnnuity(payment: number, rate: number, periods: number): number {
  if (rate === 0) return payment * periods;
  return payment * ((Math.pow(1 + rate, periods) - 1) / rate);
}

/**
 * Calculate required balance for retirement
 */
export function calculateRequiredBalance(
  targetIncome: number,
  withdrawalRate: number = RetirementConstants.WITHDRAWAL_RATE
): number {
  return targetIncome / withdrawalRate;
}

/**
 * Calculate projected balance at retirement with TDF glide path
 */
function calculateProjectedBalanceTDF(inputs: RetirementInputs): number {
  let currentBalance = inputs.startingBalance;
  
  for (let year = 0; year < (inputs.retirementAge - inputs.startingAge); year++) {
    const currentAge = inputs.startingAge + year;
    const annualReturn = calculateTDFReturnForAge(currentAge);
    
    // Apply growth for this year
    currentBalance = currentBalance * (1 + annualReturn);
    
    // Add annual contributions (monthly savings * 12)
    currentBalance += inputs.monthlySavings * 12;
  }
  
  return currentBalance;
}

/**
 * Calculate projected balance at retirement
 */
export function calculateProjectedBalance(inputs: RetirementInputs): number {
  // Use TDF-specific calculation if TDF is selected
  if (inputs.riskProfile === 'tdf') {
    return calculateProjectedBalanceTDF(inputs);
  }
  
  // Standard calculation for custom risk profile
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyRate = Math.pow(1 + inputs.accumulationReturn, 1/12) - 1;
  
  // Growth of starting balance
  const growthOfStartingBalance = futureValue(
    inputs.startingBalance, 
    inputs.accumulationReturn, 
    yearsToRetirement
  );
  
  // Growth of monthly contributions
  const growthOfContributions = futureValueOfAnnuity(
    inputs.monthlySavings, 
    monthlyRate, 
    monthsToRetirement
  );
  
  return growthOfStartingBalance + growthOfContributions;
}

/**
 * Calculate safe withdrawal rate for a given scenario
 */
export function calculateSafeWithdrawalRate(inputs: RetirementInputs): number {
  const projectedBalance = calculateProjectedBalance(inputs);
  const adjustedIncome = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, inputs.retirementAge - inputs.startingAge);
  
  if (projectedBalance <= 0) return 0;
  return adjustedIncome / projectedBalance;
}

/**
 * Calculate Social Security benefits with age adjustments
 */
export function calculateSocialSecurityBenefit(
  baseBenefit: number, 
  claimingAge: number
): number {
  const fullRetirementAge = RetirementConstants.SS_FULL_RETIREMENT_AGE;
  
  if (claimingAge < RetirementConstants.SS_MIN_AGE) return 0;
  if (claimingAge > RetirementConstants.SS_MAX_AGE) claimingAge = RetirementConstants.SS_MAX_AGE;
  
  if (claimingAge < fullRetirementAge) {
    // Early claiming reduction
    const yearsEarly = fullRetirementAge - claimingAge;
    const reductionRate = RetirementConstants.SS_REDUCTION_RATE * yearsEarly;
    return baseBenefit * (1 - reductionRate);
  } else if (claimingAge > fullRetirementAge) {
    // Delayed retirement credits
    const yearsDelayed = claimingAge - fullRetirementAge;
    const creditRate = RetirementConstants.SS_CREDIT_RATE * yearsDelayed;
    return baseBenefit * (1 + creditRate);
  }
  
  return baseBenefit; // Claiming at full retirement age
}

/**
 * Calculate healthcare costs with age adjustments
 */
export function calculateHealthcareCosts(age: number, multiplier: number = 1): number {
  const baseCost = RetirementConstants.HEALTHCARE_BASE_COST * multiplier;
  
  // Increase healthcare costs with age
  if (age >= 65) {
    const ageMultiplier = 1 + ((age - 65) * 0.02); // 2% increase per year after 65
    return baseCost * ageMultiplier;
  }
  
  return baseCost;
}

/**
 * Run Monte Carlo simulation for retirement success probability
 */
export function runMonteCarloSimulation(
  inputs: RetirementInputs, 
  runs: number = RetirementConstants.DEFAULT_MONTE_CARLO_RUNS
): number {
  let successfulRuns = 0;
  
  for (let i = 0; i < runs; i++) {
    if (simulateSingleRetirementPath(inputs)) {
      successfulRuns++;
    }
  }
  
  return successfulRuns / runs;
}

/**
 * Simulate a single retirement path with volatility
 */
function simulateSingleRetirementPath(inputs: RetirementInputs): boolean {
  let currentBalance = calculateProjectedBalance(inputs);
  const retirementYears = inputs.lifeExpectancy - inputs.retirementAge;
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  // Start withdrawals at inflation-adjusted amount (what targetIncome will cost at retirement)
  const annualWithdrawalAtRetirement = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, yearsToRetirement);

  for (let year = 0; year < retirementYears; year++) {
    // Generate random return based on normal distribution
    const randomReturn = generateNormalReturn(inputs.retirementReturn, inputs.volatility);

    // Apply market return
    currentBalance *= (1 + randomReturn);

    // Subtract annual withdrawal (adjusted for post-retirement inflation)
    const inflationAdjustedWithdrawal = annualWithdrawalAtRetirement * Math.pow(1 + inputs.inflationRate, year);
    currentBalance -= inflationAdjustedWithdrawal;
    
    // If balance goes negative, retirement fails
    if (currentBalance <= 0) {
      return false;
    }
  }
  
  return true; // Retirement successful if balance remains positive
}

/**
 * Generate random return following normal distribution
 */
function generateNormalReturn(mean: number, volatility: number): number {
  // Box-Muller transformation for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  
  return mean + volatility * z0;
}

/**
 * Calculate complete retirement analysis with advanced scenario analysis
 */
export function calculateRetirementAnalysis(inputs: RetirementInputs): RetirementResults {
  const start = performance.now();
  const scenarios: RetirementScenario[] = [];
  const netWorthByAge: { [age: number]: number } = {};
  const withdrawalsByAge: { [age: number]: number } = {};
  
  // Generate sophisticated scenarios based on user's trajectory
  const baseProjectedBalance = calculateProjectedBalance(inputs);
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const inflatedTargetIncome = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, yearsToRetirement);
  const baseRequiredBalance = calculateRequiredBalance(inflatedTargetIncome);
  const balanceRatio = baseProjectedBalance / baseRequiredBalance;
  const baseSuccessRate = runMonteCarloSimulation(inputs, 1000);
  
  // Determine user's status
  let userStatus: 'exceeding' | 'onTrack' | 'falling';
  if (balanceRatio > 1.2 && baseSuccessRate > 0.85) {
    userStatus = 'exceeding';
  } else if (balanceRatio >= 0.8 && baseSuccessRate >= 0.7) {
    userStatus = 'onTrack';
  } else {
    userStatus = 'falling';
  }
  
  // Generate scenarios based on status
  scenarios.push(...generateSophisticatedScenarios(inputs, userStatus, baseProjectedBalance, baseRequiredBalance));
  
  // Calculate net worth progression
  if (inputs.riskProfile === 'tdf') {
    // TDF calculation with year-by-year glide path
    let currentBalance = inputs.startingBalance;
    
    for (let age = inputs.startingAge; age <= inputs.lifeExpectancy; age++) {
      if (age < inputs.retirementAge) {
        // Accumulation phase with TDF glide path
        if (age > inputs.startingAge) {
          const annualReturn = calculateTDFReturnForAge(age);
          currentBalance = currentBalance * (1 + annualReturn);
          currentBalance += inputs.monthlySavings * 12; // Add annual contributions
        }
        netWorthByAge[age] = currentBalance;
      } else {
        // Retirement phase with TDF glide path (starts at retirementAge)
        const yearsInRetirement = age - inputs.retirementAge;
        const annualReturn = calculateTDFReturnForAge(age);
        
        // Calculate withdrawal: inflation-adjusted target income (4% rule)
        // inflatedTargetIncome is already computed above (target income at retirement in future dollars)
        const yearWithdrawal = inflatedTargetIncome * Math.pow(1 + inputs.inflationRate, yearsInRetirement);
        
        // Subtract withdrawal FIRST (beginning of year)
        currentBalance = Math.max(0, currentBalance - yearWithdrawal);
        
        // Then apply growth for remainder of year
        currentBalance = currentBalance * (1 + annualReturn);
        
        netWorthByAge[age] = currentBalance;
        
        // Store the actual withdrawal amount for the chart
        withdrawalsByAge[age] = yearWithdrawal;
      }
    }
  } else {
    // Standard calculation for custom risk profile
    const monthlyRate = Math.pow(1 + inputs.accumulationReturn, 1/12) - 1;
    const preWithdrawalBalance = calculateProjectedBalance(inputs);
    for (let age = inputs.startingAge; age <= inputs.lifeExpectancy; age++) {
      const yearsFromStart = age - inputs.startingAge;
      const monthsFromStart = yearsFromStart * 12;

      if (age < inputs.retirementAge) {
        // Accumulation phase
        const growthOfStartingBalance = futureValue(inputs.startingBalance, inputs.accumulationReturn, yearsFromStart);
        const growthOfContributions = futureValueOfAnnuity(inputs.monthlySavings, monthlyRate, monthsFromStart);
        netWorthByAge[age] = growthOfStartingBalance + growthOfContributions;
      } else {
        // Withdrawal phase - simulate year-by-year portfolio changes (starts at retirementAge)
        const yearsInRetirement = age - inputs.retirementAge;

        // Calculate balance year by year during retirement
        let currentBalance = preWithdrawalBalance;
        for (let year = 0; year <= yearsInRetirement; year++) {
          // Standard 4% rule withdrawal with inflation adjustment from retirement start
          const yearWithdrawal = inflatedTargetIncome * Math.pow(1 + inputs.inflationRate, year);
          
          // Subtract withdrawal FIRST (beginning of year)
          currentBalance = Math.max(0, currentBalance - yearWithdrawal);
          
          // Then apply growth for remainder of year
          currentBalance = currentBalance * (1 + inputs.retirementReturn);
          
          // If we've reached the target age, store withdrawal and break
          if (year === yearsInRetirement) {
            withdrawalsByAge[age] = yearWithdrawal;
            break;
          }
        }
        
        netWorthByAge[age] = currentBalance;
      }
    }
  }
  
  // Generate basic insights
  const basicInsights = generateRetirementInsights(inputs, scenarios);
  const safeWithdrawalRate = calculateSafeWithdrawalRate(inputs);
  
  // Enhanced scenario analysis
  const scenarioAnalysis = analyzeRetirementScenarios(inputs);
  const coastFireAnalysis = calculateCoastFireAnalysis(inputs);
  const inflationAnalysis = analyzeInflationImpact(inputs);
  
  // Combine all insights with prioritization
  const allInsights = [
    ...basicInsights,
    ...scenarioAnalysis.recommendations,
    ...coastFireAnalysis.insights,
    ...inflationAnalysis.insights
  ];
  
  // Prioritize and limit insights to maximum of 3
  const insights = prioritizeInsights(allInsights, inputs, scenarios);
  
  const elapsed = performance.now() - start;
  console.log(`Complete retirement analysis completed in ${elapsed.toFixed(2)}ms`);
  
  return {
    scenarios,
    netWorthByAge,
    withdrawalsByAge,
    insights,
    safeWithdrawalRate,
    scenarioAnalysis,
    coastFireAnalysis,
    inflationAnalysis
  };
}

/**
 * Generate insights based on retirement analysis
 */
function generateRetirementInsights(inputs: RetirementInputs, scenarios: RetirementScenario[]): string[] {
  const insights: string[] = [];
  
  const primaryScenario = scenarios.find(s => s.retirementAge === inputs.retirementAge);
  if (!primaryScenario) return insights;
  
  const savingsRate = (inputs.monthlySavings * 12) / inputs.currentIncome;
  const balanceRatio = primaryScenario.projectedBalance / primaryScenario.requiredBalance;
  
  // Only return the MOST critical insight
  // Priority 1: Critical failures (low success probability or insufficient balance)
  if (primaryScenario.successProbability < 0.7) {
    insights.push(`⚠️ ${Math.round((1 - primaryScenario.successProbability) * 100)}% chance of running out of money. Increase savings by $${Math.round(((primaryScenario.requiredBalance - primaryScenario.projectedBalance) / ((inputs.retirementAge - inputs.startingAge) * 12)))}/month or work ${Math.ceil((primaryScenario.requiredBalance - primaryScenario.projectedBalance) / (inputs.monthlySavings * 12 * Math.pow(1 + inputs.accumulationReturn, 1)))} years longer.`);
    return insights; // Only return critical warning
  }
  
  // Priority 2: Major opportunities (significant oversaving)
  if (balanceRatio > 1.5) {
    const extraYears = Math.floor((primaryScenario.projectedBalance - primaryScenario.requiredBalance) / (inputs.targetIncome * 1.5));
    insights.push(`✅ You could retire ${extraYears} years earlier or increase spending by $${Math.round((primaryScenario.projectedBalance - primaryScenario.requiredBalance) / (inputs.lifeExpectancy - inputs.retirementAge))}/year.`);
    return insights;
  }
  
  // Priority 3: Very low savings rate warning (actionable)
  if (savingsRate < 0.10) {
    const targetSavings = Math.max(inputs.currentIncome * 0.15 / 12, inputs.monthlySavings * 1.5);
    insights.push(`💰 Savings rate of ${Math.round(savingsRate * 100)}% may be insufficient. Target $${Math.round(targetSavings)}/month (${Math.round(targetSavings * 12 / inputs.currentIncome * 100)}% of income).`);
    return insights;
  }
  
  // If none of the above, return empty (let other modules provide insights)
  return insights;
}

/**
 * Prioritize insights and limit to most important ones
 */
function prioritizeInsights(
  allInsights: string[], 
  _inputs: RetirementInputs, 
  _scenarios: RetirementScenario[]
): string[] {
  if (allInsights.length <= 3) {
    return allInsights; // If already 3 or fewer, return all
  }
  
  const prioritizedInsights: { insight: string; priority: number }[] = [];
  
  allInsights.forEach(insight => {
    let priority = 0;
    
    // Highest priority: Critical warnings (⚠️, 🔥)
    if (insight.includes('⚠️') || insight.includes('🔥')) {
      priority = 10;
    }
    // High priority: Major opportunities (🎯, ✅, 🎉)
    else if (insight.includes('🎯') || insight.includes('✅') || insight.includes('🎉')) {
      priority = 8;
    }
    // Medium priority: Actionable insights (💰, ⚡, 🏖️)
    else if (insight.includes('💰') || insight.includes('⚡') || insight.includes('🏖️')) {
      priority = 6;
    }
    // Lower priority: General analysis (⚖️, 📊)
    else if (insight.includes('⚖️') || insight.includes('📊')) {
      priority = 4;
    }
    // Lowest priority: Everything else
    else {
      priority = 2;
    }
    
    // Boost priority for certain keywords
    if (insight.includes('running out of money') || insight.includes('years earlier')) {
      priority += 2;
    }
    
    prioritizedInsights.push({ insight, priority });
  });
  
  // Sort by priority (highest first) and take top 3
  return prioritizedInsights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(item => item.insight);
}

/**
 * Generate sophisticated scenarios based on user's financial trajectory
 */
function generateSophisticatedScenarios(
  inputs: RetirementInputs,
  status: 'exceeding' | 'onTrack' | 'falling',
  baseProjectedBalance: number,
  baseRequiredBalance: number
): RetirementScenario[] {
  const scenarios: RetirementScenario[] = [];
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const inflationFactor = Math.pow(1 + inputs.inflationRate, yearsToRetirement);

  if (status === 'exceeding') {
    // SCENARIO 1: Current Plan (Baseline)
    scenarios.push({
      id: 'current-plan-exceeding',
      name: 'Your Current Plan',
      retirementAge: inputs.retirementAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: baseProjectedBalance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation(inputs, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });

    // SCENARIO 2: Early Retirement Option
    const earliestAge = Math.max(inputs.startingAge + 10, inputs.retirementAge - 5);
    const earlyInputs = { ...inputs, retirementAge: earliestAge };
    const earlyBalance = calculateProjectedBalance(earlyInputs);
    const yearsDifference = inputs.retirementAge - earliestAge;
    const earlyInflatedIncome = inputs.targetIncome * Math.pow(1 + inputs.inflationRate, earliestAge - inputs.startingAge);

    if (yearsDifference > 0) {
      scenarios.push({
        id: 'early-retirement',
        name: `Retire ${yearsDifference} ${yearsDifference === 1 ? 'year' : 'years'} early at ${earliestAge}`,
        retirementAge: earliestAge,
        requiredBalance: calculateRequiredBalance(earlyInflatedIncome),
        projectedBalance: earlyBalance,
        monthlyWithdrawal: inputs.targetIncome / 12,
        successProbability: runMonteCarloSimulation(earlyInputs, 1000),
        yearsOfIncome: inputs.lifeExpectancy - earliestAge
      });
    } else {
      // If can't retire early, show increased lifestyle option
      const enhancedIncome = inputs.targetIncome * 1.25;
      const enhancedInflated = enhancedIncome * inflationFactor;
      scenarios.push({
        id: 'enhanced-lifestyle',
        name: `Enhanced lifestyle: ${formatCurrency(Math.round(enhancedIncome / 12 / 100) * 100)}/month`,
        retirementAge: inputs.retirementAge,
        requiredBalance: calculateRequiredBalance(enhancedInflated),
        projectedBalance: baseProjectedBalance,
        monthlyWithdrawal: enhancedIncome / 12,
        successProbability: runMonteCarloSimulation({ ...inputs, targetIncome: enhancedIncome }, 1000),
        yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
      });
    }

    // SCENARIO 3: Conservative spending with wealth building
    const conservativeWithdrawal = inputs.targetIncome * 0.80;
    const conservativeInflated = conservativeWithdrawal * inflationFactor;
    const extraWealth = (baseProjectedBalance * 0.04) - conservativeInflated;
    const totalExtraWealth = extraWealth * (inputs.lifeExpectancy - inputs.retirementAge);

    scenarios.push({
      id: 'conservative-wealth-building',
      name: `Conservative: ${formatCurrency(Math.round(conservativeWithdrawal / 12 / 100) * 100)}/month, leave ${formatCurrency(Math.round(Math.max(0, totalExtraWealth) / 1000) * 1000)} legacy`,
      retirementAge: inputs.retirementAge,
      requiredBalance: calculateRequiredBalance(conservativeInflated),
      projectedBalance: baseProjectedBalance,
      monthlyWithdrawal: conservativeWithdrawal / 12,
      successProbability: runMonteCarloSimulation({ ...inputs, targetIncome: conservativeWithdrawal }, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });
    
    // SCENARIO 4: Coast option - reduce current savings
    const reducedSavings = Math.max(500, inputs.monthlySavings * 0.5); // Cut savings in half, minimum $500
    const coastInputs = { ...inputs, monthlySavings: reducedSavings };
    const coastBalance = calculateProjectedBalance(coastInputs);
    const monthlySavingsReduction = inputs.monthlySavings - reducedSavings;
    
    scenarios.push({
      id: 'coast-mode',
      name: `Coast: Save only ${formatCurrency(reducedSavings)}/month (enjoy extra ${formatCurrency(monthlySavingsReduction)}/month now)`,
      retirementAge: inputs.retirementAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: coastBalance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation(coastInputs, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });
    
  } else if (status === 'onTrack') {
    // SCENARIO 1: Current Plan (Baseline)
    scenarios.push({
      id: 'current-plan-baseline',
      name: 'Your Current Plan',
      retirementAge: inputs.retirementAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: baseProjectedBalance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation(inputs, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });
    
    // SCENARIO 2: Small Improvement (+$500/month)
    const plus500Inputs = { ...inputs, monthlySavings: inputs.monthlySavings + 500 };
    const plus500Balance = calculateProjectedBalance(plus500Inputs);
    const plus500EarlyAge = findEarlierRetirementAgeWithBalance(plus500Balance, inputs.targetIncome);
    const yearsDifference = Math.abs(inputs.retirementAge - plus500EarlyAge);
    const isEarlier = plus500EarlyAge < inputs.retirementAge;
    
    scenarios.push({
      id: 'small-improvement',
      name: `Save extra $500/month → Retire ${yearsDifference} ${yearsDifference === 1 ? 'year' : 'years'} ${isEarlier ? 'early' : 'later'}`,
      retirementAge: plus500EarlyAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: plus500Balance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation({ ...plus500Inputs, retirementAge: plus500EarlyAge }, 1000),
      yearsOfIncome: inputs.lifeExpectancy - plus500EarlyAge
    });
    
    // SCENARIO 3: Conservative buffer approach
    const conservativeWithdrawal = inputs.targetIncome * 0.90; // 90% of target for safety buffer
    const conservativeInflated = conservativeWithdrawal * inflationFactor;
    const bufferAmount = inputs.targetIncome - conservativeWithdrawal;

    scenarios.push({
      id: 'conservative-buffer',
      name: `Conservative: ${formatCurrency(Math.round(conservativeWithdrawal / 12 / 100) * 100)}/month with ${formatCurrency(bufferAmount)} annual buffer`,
      retirementAge: inputs.retirementAge,
      requiredBalance: calculateRequiredBalance(conservativeInflated),
      projectedBalance: baseProjectedBalance,
      monthlyWithdrawal: conservativeWithdrawal / 12,
      successProbability: runMonteCarloSimulation({ ...inputs, targetIncome: conservativeWithdrawal }, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });
    
  } else { // falling short
    // SCENARIO 1: Current Plan (Baseline)
    scenarios.push({
      id: 'current-plan-falling-short',
      name: 'Your Current Plan',
      retirementAge: inputs.retirementAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: baseProjectedBalance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation(inputs, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });
    
    // SCENARIO 2: Reality Check - Age
    const actualRetirementAge = findActualRetirementAge(baseProjectedBalance, inputs.targetIncome);
    const realityAgeInputs = { ...inputs, retirementAge: actualRetirementAge };
    const realityAgeBalance = calculateProjectedBalance(realityAgeInputs);
    scenarios.push({
      id: 'reality-age',
      name: `Work until age ${actualRetirementAge}`,
      retirementAge: actualRetirementAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: realityAgeBalance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation(realityAgeInputs, 1000),
      yearsOfIncome: inputs.lifeExpectancy - actualRetirementAge
    });
    
    // SCENARIO 3: Reality Check - Income
    const affordableIncome = calculateAffordableIncome(baseProjectedBalance);
    const realityIncomeInputs = { ...inputs, targetIncome: affordableIncome };
    scenarios.push({
      id: 'reality-income',
      name: `Live on ${formatCurrency(Math.round(affordableIncome / 12 / 100) * 100)}/month at ${inputs.retirementAge}`,
      retirementAge: inputs.retirementAge,
      requiredBalance: calculateRequiredBalance(affordableIncome),
      projectedBalance: baseProjectedBalance, // This stays the same - it's what we can afford with current balance
      monthlyWithdrawal: affordableIncome / 12,
      successProbability: runMonteCarloSimulation(realityIncomeInputs, 1000),
      yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
    });
    
    // SCENARIO 4: Modest Fix (+$500/month)
    const plus500Inputs = { ...inputs, monthlySavings: inputs.monthlySavings + 500 };
    const plus500Balance = calculateProjectedBalance(plus500Inputs);
    const plus500RetirementAge = findActualRetirementAge(plus500Balance, inputs.targetIncome);
    
    scenarios.push({
      id: 'modest-fix',
      name: `Save extra $500/month → Retire at ${plus500RetirementAge}`,
      retirementAge: plus500RetirementAge,
      requiredBalance: baseRequiredBalance,
      projectedBalance: plus500Balance,
      monthlyWithdrawal: inputs.targetIncome / 12,
      successProbability: runMonteCarloSimulation({ ...plus500Inputs, retirementAge: plus500RetirementAge }, 1000),
      yearsOfIncome: inputs.lifeExpectancy - plus500RetirementAge
    });
    
    // SCENARIO 5: Full Solution (only if reasonable)
    const fullAmountNeeded = calculateMinimumSavingsNeeded(inputs, baseRequiredBalance);
    const additionalSavingsNeeded = Math.round(fullAmountNeeded - inputs.monthlySavings);
    
    // Only show if additional savings needed is reasonable (less than 40% of income)
    if (additionalSavingsNeeded > 0 && additionalSavingsNeeded <= (inputs.currentIncome * 0.4) / 12) {
      const fullSolutionInputs = { ...inputs, monthlySavings: inputs.monthlySavings + additionalSavingsNeeded };
      const fullSolutionBalance = calculateProjectedBalance(fullSolutionInputs);
      
      scenarios.push({
        id: 'full-solution',
        name: `Save extra ${formatCurrency(additionalSavingsNeeded)}/month → Meet goal`,
        retirementAge: inputs.retirementAge,
        requiredBalance: baseRequiredBalance,
        projectedBalance: fullSolutionBalance,
        monthlyWithdrawal: inputs.targetIncome / 12,
        successProbability: runMonteCarloSimulation(fullSolutionInputs, 1000),
        yearsOfIncome: inputs.lifeExpectancy - inputs.retirementAge
      });
    }
  }
  
  // Filter scenarios based on success probability
  // For "exceeding" and "onTrack": only show scenarios with ≥70% success rate
  // For "falling short": show all scenarios to illustrate the problem
  if (status !== 'falling') {
    return scenarios.filter(scenario => 
      scenario.id.includes('current-plan') || // Always show current plan
      scenario.successProbability >= 0.7      // Only show viable alternatives
    );
  }
  
  return scenarios;
}

/**
 * Find the earliest retirement age possible with current plan
 */
function findEarlierRetirementAge(inputs: RetirementInputs): number {
  const projectedBalance = calculateProjectedBalance(inputs);
  return findEarlierRetirementAgeWithBalance(projectedBalance, inputs.targetIncome);
}

/**
 * Find earliest retirement age given a specific balance
 */
function findEarlierRetirementAgeWithBalance(balance: number, targetIncome: number): number {
  const withdrawalRate = 0.04; // 4% rule
  const requiredBalance = targetIncome / withdrawalRate;
  
  // If balance exceeds required, calculate how much earlier we can retire
  if (balance > requiredBalance) {
    const excessBalance = balance - requiredBalance;
    // Simplified calculation - could be more sophisticated
    const yearsEarlier = Math.min(10, Math.floor(excessBalance / (targetIncome * 2))); // Conservative estimate
    return Math.max(50, 65 - yearsEarlier); // Don't go below reasonable retirement age
  }
  
  return 65; // Default retirement age if not enough excess
}

/**
 * Calculate what income is affordable with given balance
 */
function calculateAffordableIncome(projectedBalance: number): number {
  const withdrawalRate = 0.04; // 4% rule
  return projectedBalance * withdrawalRate;
}

/**
 * Find actual retirement age given current trajectory
 */
function findActualRetirementAge(projectedBalance: number, targetIncome: number): number {
  const withdrawalRate = 0.04;
  const requiredBalance = targetIncome / withdrawalRate;
  
  if (projectedBalance < requiredBalance) {
    // Need to work longer - simplified calculation
    const shortfallYears = Math.ceil((requiredBalance - projectedBalance) / (targetIncome * 0.25)); // Assume 25% savings rate
    return Math.min(75, 65 + shortfallYears); // Cap at reasonable maximum
  }
  
  return 65; // Can retire at normal age
}

/**
 * Calculate minimum monthly savings needed to hit target
 */
function calculateMinimumSavingsNeeded(inputs: RetirementInputs, requiredBalance: number): number {
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyRate = Math.pow(1 + inputs.accumulationReturn, 1/12) - 1;
  
  // Account for growth of existing balance
  const growthOfStartingBalance = futureValue(inputs.startingBalance, inputs.accumulationReturn, yearsToRetirement);
  const additionalNeeded = requiredBalance - growthOfStartingBalance;
  
  if (additionalNeeded <= 0) return 0;
  
  // Calculate required monthly savings using future value of annuity
  let requiredMonthlySavings = 0;
  if (monthlyRate === 0) {
    requiredMonthlySavings = additionalNeeded / monthsToRetirement;
  } else {
    const denominator = (Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate;
    requiredMonthlySavings = additionalNeeded / denominator;
  }
  
  // Cap at reasonable maximum (50% of income)
  const maxReasonableSavings = (inputs.currentIncome * 0.5) / 12;
  return Math.min(requiredMonthlySavings, maxReasonableSavings);
}

/**
 * Calculate halfway savings between current +500 and full amount needed
 */
function calculateHalfwaySavings(inputs: RetirementInputs, requiredBalance: number): number {
  const fullAmountNeeded = calculateMinimumSavingsNeeded(inputs, requiredBalance);
  const currentSavings = inputs.monthlySavings;
  const plus500 = currentSavings + 500;
  
  // Find retirement age with +$500/month
  const plus500Inputs = { ...inputs, monthlySavings: plus500 };
  const plus500Balance = calculateProjectedBalance(plus500Inputs);
  
  if (plus500Balance >= requiredBalance) {
    // +$500 is enough, so halfway is between current and +$500
    return currentSavings + 250;
  }
  
  // Halfway between +$500 and full amount needed
  const additionalNeeded = fullAmountNeeded - currentSavings;
  const halfwayAdditional = (500 + additionalNeeded) / 2;
  return Math.round(halfwayAdditional);
}

/**
 * Apply conservative assumptions for risk management scenarios
 */
function applyConservativeAssumptions(inputs: RetirementInputs): RetirementInputs {
  return {
    ...inputs,
    accumulationReturn: inputs.accumulationReturn - 0.01, // 1% lower returns
    retirementReturn: inputs.retirementReturn - 0.01,
    inflationRate: inputs.inflationRate + 0.005, // 0.5% higher inflation
    volatility: inputs.volatility + 0.02 // Higher volatility
  };
}