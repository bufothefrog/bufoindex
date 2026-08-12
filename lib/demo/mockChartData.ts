/**
 * Mock Chart Data Generator for Demo Page
 * Generates realistic financial data for demonstrating chart components
 */

import { getChartTheme, getSageVariants } from '@/lib/chart-theme';

export interface PortfolioGrowthData {
  year: number;
  age: number;
  portfolioValue: number;
  contributions: number;
  growth: number;
  realValue: number; // Inflation-adjusted
}

export interface IncomeExpenseData {
  month: string;
  income: number;
  necessaryExpenses: number;
  discretionaryExpenses: number;
  savings: number;
  netCashFlow: number;
}

export interface AssetAllocationData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface MonteCarloRunData {
  year: number;
  portfolioValue: number;
  runId: number;
}

export interface ScenarioComparisonData {
  age: number;
  currentScenario: number;
  optimizedScenario: number;
  aggressiveScenario: number;
}

/**
 * Generate portfolio growth data over time
 */
export function generatePortfolioGrowth(
  startingAge: number = 25,
  retirementAge: number = 65,
  startingBalance: number = 10000,
  monthlySavings: number = 1500,
  annualReturn: number = 0.07,
  inflationRate: number = 0.03
): PortfolioGrowthData[] {
  const data: PortfolioGrowthData[] = [];
  const currentYear = new Date().getFullYear();

  let portfolioValue = startingBalance;
  let totalContributions = startingBalance;

  for (let age = startingAge; age <= Math.min(retirementAge + 10, 85); age++) {
    const year = currentYear + (age - startingAge);
    const yearsFromStart = age - startingAge;

    // Add annual contributions (except first year)
    if (age > startingAge && age <= retirementAge) {
      totalContributions += monthlySavings * 12;
      portfolioValue += monthlySavings * 12;
    }

    // Apply market growth
    portfolioValue *= (1 + annualReturn);

    // Calculate inflation-adjusted value
    const realValue = portfolioValue / Math.pow(1 + inflationRate, yearsFromStart);

    data.push({
      year,
      age,
      portfolioValue: Math.round(portfolioValue),
      contributions: Math.round(totalContributions),
      growth: Math.round(portfolioValue - totalContributions),
      realValue: Math.round(realValue)
    });
  }

  return data;
}

/**
 * Generate monthly income vs expenses data
 */
export function generateIncomeExpenses(months: number = 12): IncomeExpenseData[] {
  const data: IncomeExpenseData[] = [];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const baseIncome = 6500;
  const baseNecessaryExpenses = 3200;
  const baseDiscretionaryExpenses = 1800;

  for (let i = 0; i < months; i++) {
    const month = monthNames[i % 12];

    // Add some realistic variation
    const income = baseIncome + (Math.random() - 0.5) * 1000;
    const necessaryExpenses = baseNecessaryExpenses + (Math.random() - 0.5) * 200;
    const discretionaryExpenses = baseDiscretionaryExpenses + (Math.random() - 0.5) * 600;
    const savings = income - necessaryExpenses - discretionaryExpenses;

    data.push({
      month,
      income: Math.round(income),
      necessaryExpenses: Math.round(necessaryExpenses),
      discretionaryExpenses: Math.round(discretionaryExpenses),
      savings: Math.round(savings),
      netCashFlow: Math.round(savings)
    });
  }

  return data;
}

/**
 * Generate asset allocation data for pie charts
 */
export function generateAssetAllocation(): AssetAllocationData[] {
  const sage = getSageVariants();
  return [
    {
      name: 'Total Stock Market (VTI)',
      value: 45000,
      percentage: 60,
      color: sage.sage600
    },
    {
      name: 'International (VTIAX)',
      value: 15000,
      percentage: 20,
      color: sage.sage400
    },
    {
      name: 'Bonds (VBTLX)',
      value: 7500,
      percentage: 10,
      color: sage.sage300
    },
    {
      name: 'REITs (VGSLX)',
      value: 4500,
      percentage: 6,
      color: sage.sage500
    },
    {
      name: 'Cash/Emergency Fund',
      value: 3000,
      percentage: 4,
      color: sage.sage200
    }
  ];
}

/**
 * Generate Monte Carlo simulation runs
 */
export function generateMonteCarloRuns(
  years: number = 30,
  numberOfRuns: number = 100,
  startingValue: number = 500000,
  withdrawalRate: number = 0.04
): MonteCarloRunData[] {
  const data: MonteCarloRunData[] = [];

  for (let run = 0; run < numberOfRuns; run++) {
    let portfolioValue = startingValue;

    for (let year = 0; year <= years; year++) {
      if (year === 0) {
        data.push({
          year,
          portfolioValue: startingValue,
          runId: run
        });
        continue;
      }

      // Apply random market return (normal distribution around 7% with 20% volatility)
      const marketReturn = 0.07 + (Math.random() - 0.5) * 0.4;
      portfolioValue *= (1 + marketReturn);

      // Apply withdrawal
      const withdrawal = startingValue * withdrawalRate;
      portfolioValue -= withdrawal;

      // Ensure it doesn't go negative
      portfolioValue = Math.max(0, portfolioValue);

      data.push({
        year,
        portfolioValue: Math.round(portfolioValue),
        runId: run
      });
    }
  }

  return data;
}

/**
 * Generate scenario comparison data
 */
export function generateScenarioComparison(
  startingAge: number = 30,
  endAge: number = 70
): ScenarioComparisonData[] {
  const data: ScenarioComparisonData[] = [];

  let currentValue = 50000;
  let optimizedValue = 50000;
  let aggressiveValue = 50000;

  for (let age = startingAge; age <= endAge; age++) {
    // Current scenario: Conservative approach
    currentValue += 1200 * 12; // $1,200/month
    currentValue *= 1.05; // 5% return

    // Optimized scenario: Balanced approach
    optimizedValue += 1800 * 12; // $1,800/month
    optimizedValue *= 1.07; // 7% return

    // Aggressive scenario: High savings + high return
    aggressiveValue += 2500 * 12; // $2,500/month
    aggressiveValue *= 1.09; // 9% return

    data.push({
      age,
      currentScenario: Math.round(currentValue),
      optimizedScenario: Math.round(optimizedValue),
      aggressiveScenario: Math.round(aggressiveValue)
    });
  }

  return data;
}

/**
 * Generate sample net worth breakdown over time
 */
export function generateNetWorthBreakdown(years: number = 40) {
  const data = [];
  const currentYear = new Date().getFullYear();

  let cash = 15000;
  let investments = 25000;
  let realEstate = 0;
  let retirement = 5000;

  for (let i = 0; i <= years; i++) {
    const year = currentYear + i;
    const age = 25 + i;

    // Simulate growth and additions
    cash += 2000; // Small cash additions
    investments += 18000; // Regular investments
    investments *= 1.07; // 7% growth

    retirement += 6000; // 401k contributions
    retirement *= 1.07; // 7% growth

    // Buy house after 5 years
    if (i === 5) {
      realEstate = 400000;
      cash -= 80000; // Down payment
    }

    // Real estate appreciation
    if (realEstate > 0) {
      realEstate *= 1.03; // 3% appreciation
    }

    data.push({
      year,
      age,
      cash: Math.round(cash),
      investments: Math.round(investments),
      realEstate: Math.round(realEstate),
      retirement: Math.round(retirement),
      total: Math.round(cash + investments + realEstate + retirement)
    });
  }

  return data;
}

/**
 * Demo constants for consistent demo values
 */
export const DEMO_CONSTANTS = {
  STARTING_AGE: 25,
  RETIREMENT_AGE: 65,
  STARTING_BALANCE: 10000,
  MONTHLY_SAVINGS: 1500,
  ANNUAL_RETURN: 0.07,
  INFLATION_RATE: 0.03,
  WITHDRAWAL_RATE: 0.04,
  MONTE_CARLO_RUNS: 50, // Reduced for demo performance
} as const;