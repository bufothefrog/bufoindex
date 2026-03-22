/**
 * Monte Carlo Simulation Engine
 * Core stochastic simulation capabilities for retirement planning
 */

import { createSeededRng, boxMullerRandom } from '@/lib/utils/random';

// Type definitions for Monte Carlo simulations
export interface MonteCarloScenario {
  retirementAge: number;
  targetIncome: number;
  startingAge: number;
  startingBalance: number;
  lifeExpectancy?: number;
  endAge?: number;
}

export interface MonteCarloAssumptions {
  inflationRate: number;
  accumulationReturn: number;
  retirementReturn: number;
  volatility: number;
}

export interface YearlyProgression {
  age: number;
  portfolioValue: number;
  withdrawal: number;
  return: number;
}

export interface SingleSimulationResult {
  success: boolean;
  portfolioAtRetirement: number;
  yearlyProgression: YearlyProgression[];
  failureAge: number | null;
  reason?: string;
  finalPortfolioValue?: number;
  yearsOfWithdrawals?: number;
}

export interface MonteCarloResults {
  scenarios: SingleSimulationResult[];
  successRate: number;
  averagePortfolioAtRetirement: number;
  medianPortfolioAtRetirement: number;
  percentile10PortfolioAtRetirement: number;
  percentile90PortfolioAtRetirement: number;
  averageFailureAge: number;
  iterations: number;
  executionTime: number;
}

export interface SequenceCriteria {
  endAge?: number;
  includeFailureAge?: boolean;
  failureTolerance?: number;
}

/**
 * Generate a sequence of random returns for a given year period
 */
export function generateReturnSequence(
  years: number,
  meanReturn: number,
  volatility: number,
  seed: number | null = null
): number[] {
  const rng = seed !== null ? createSeededRng(seed) : Math.random;
  const returns: number[] = [];
  for (let i = 0; i < years; i++) {
    returns.push(boxMullerRandom(meanReturn, volatility, rng));
  }
  return returns;
}
