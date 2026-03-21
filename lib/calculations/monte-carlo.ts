/**
 * Monte Carlo Simulation Engine
 * Core stochastic simulation capabilities for retirement planning
 */

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

export class MonteCarloEngine {
  // Static properties for Box-Muller algorithm
  private static _hasSpare: boolean = false;
  private static _spare: number = 0;

  /**
   * Box-Muller transform for generating normally distributed random numbers
   */
  static boxMullerRandom(mean: number = 0, stdDev: number = 1): number {
    if (MonteCarloEngine._hasSpare) {
      MonteCarloEngine._hasSpare = false;
      return MonteCarloEngine._spare * stdDev + mean;
    }

    MonteCarloEngine._hasSpare = true;
    
    // Ensure we don't get 0 for u1 (would cause log(0) = -Infinity)
    let u1: number;
    const u2: number = Math.random();
    do {
      u1 = Math.random();
    } while (u1 === 0);
    
    const mag = stdDev * Math.sqrt(-2.0 * Math.log(u1));
    MonteCarloEngine._spare = mag * Math.cos(2.0 * Math.PI * u2);
    
    return mag * Math.sin(2.0 * Math.PI * u2) + mean;
  }

  /**
   * Generate a sequence of random returns for a given year period
   */
  static generateReturnSequence(
    years: number,
    meanReturn: number,
    volatility: number,
    seed: number | null = null
  ): number[] {
    if (seed !== null) {
      // Simple seed-based random number generator for deterministic results
      let seedState = seed;
      Math.random = () => {
        seedState = (seedState * 9301 + 49297) % 233280;
        return seedState / 233280;
      };
    }

    const returns: number[] = [];
    for (let i = 0; i < years; i++) {
      returns.push(this.boxMullerRandom(meanReturn, volatility));
    }
    
    return returns;
  }

  /**
   * Simulate a single retirement scenario with stochastic returns
   */
  static simulateSingleScenario(
    scenario: MonteCarloScenario,
    assumptions: MonteCarloAssumptions,
    simulationId: number = 0
  ): SingleSimulationResult {
    const {
      retirementAge,
      targetIncome,
      startingAge,
      startingBalance,
      lifeExpectancy = 100,
      endAge = 85
    } = scenario;

    const {
      inflationRate,
      accumulationReturn,
      retirementReturn,
      volatility
    } = assumptions;

    const yearsUntilRetirement = retirementAge - startingAge;
    const yearsInRetirement = (endAge || lifeExpectancy) - retirementAge;
    
    if (yearsUntilRetirement <= 0) {
      return {
        success: false,
        portfolioAtRetirement: 0,
        yearlyProgression: [],
        failureAge: null,
        reason: 'Invalid retirement age'
      };
    }

    // Calculate inflation-adjusted target income at retirement
    const inflatedTargetIncome = targetIncome * Math.pow(1 + inflationRate, yearsUntilRetirement);
    
    // Generate return sequences for accumulation and retirement phases
    const accumulationReturns = this.generateReturnSequence(
      yearsUntilRetirement,
      accumulationReturn,
      volatility,
      simulationId // Use simulation ID as seed for reproducibility
    );
    
    const retirementReturns = this.generateReturnSequence(
      yearsInRetirement,
      retirementReturn,
      volatility,
      simulationId + 10000 // Different seed for retirement phase
    );

    let portfolioValue = startingBalance;
    const yearlyProgression: YearlyProgression[] = [];
    
    // Accumulation phase
    for (let year = 0; year < yearsUntilRetirement; year++) {
      const age = startingAge + year;
      const annualReturn = accumulationReturns[year];
      
      // Apply return
      portfolioValue *= (1 + annualReturn);
      
      yearlyProgression.push({
        age,
        portfolioValue,
        withdrawal: 0,
        return: annualReturn
      });
    }

    const portfolioAtRetirement = portfolioValue;
    
    // Retirement phase - withdrawal testing
    let currentAge = retirementAge;
    const finalAge = endAge || lifeExpectancy;
    
    for (let year = 0; year < yearsInRetirement && currentAge < finalAge; year++) {
      const annualReturn = retirementReturns[year];
      
      // Apply return first
      portfolioValue *= (1 + annualReturn);
      
      // Then withdraw (inflation-adjusted)
      const withdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, year);
      portfolioValue -= withdrawal;
      
      yearlyProgression.push({
        age: currentAge,
        portfolioValue,
        withdrawal,
        return: annualReturn
      });
      
      // Check for failure
      if (portfolioValue <= 0) {
        return {
          success: false,
          portfolioAtRetirement,
          yearlyProgression,
          failureAge: currentAge,
          finalPortfolioValue: 0,
          yearsOfWithdrawals: year + 1
        };
      }
      
      currentAge++;
    }
    
    return {
      success: true,
      portfolioAtRetirement,
      yearlyProgression,
      failureAge: null,
      finalPortfolioValue: portfolioValue,
      yearsOfWithdrawals: yearsInRetirement
    };
  }

  /**
   * Run full Monte Carlo simulation with multiple iterations
   */
  static runSimulation(
    scenario: MonteCarloScenario,
    assumptions: MonteCarloAssumptions,
    iterations: number = 1000
  ): MonteCarloResults {
    const startTime = performance.now();
    const scenarios: SingleSimulationResult[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = this.simulateSingleScenario(scenario, assumptions, i);
      scenarios.push(result);
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Calculate statistics
    const successfulScenarios = scenarios.filter(s => s.success);
    const successRate = successfulScenarios.length / iterations;
    
    const portfoliosAtRetirement = scenarios.map(s => s.portfolioAtRetirement);
    portfoliosAtRetirement.sort((a, b) => a - b);
    
    const averagePortfolioAtRetirement = portfoliosAtRetirement.reduce((a, b) => a + b, 0) / iterations;
    const medianPortfolioAtRetirement = portfoliosAtRetirement[Math.floor(iterations / 2)];
    const percentile10PortfolioAtRetirement = portfoliosAtRetirement[Math.floor(iterations * 0.1)];
    const percentile90PortfolioAtRetirement = portfoliosAtRetirement[Math.floor(iterations * 0.9)];
    
    const failedScenarios = scenarios.filter(s => !s.success && s.failureAge);
    const averageFailureAge = failedScenarios.length > 0 
      ? failedScenarios.reduce((sum, s) => sum + (s.failureAge || 0), 0) / failedScenarios.length
      : 0;
    
    return {
      scenarios,
      successRate,
      averagePortfolioAtRetirement,
      medianPortfolioAtRetirement,
      percentile10PortfolioAtRetirement,
      percentile90PortfolioAtRetirement,
      averageFailureAge,
      iterations,
      executionTime
    };
  }

  /**
   * Calculate sequence of returns risk (worst-case scenarios)
   */
  static analyzeSequenceOfReturnsRisk(
    scenario: MonteCarloScenario,
    assumptions: MonteCarloAssumptions,
    iterations: number = 10000
  ): MonteCarloResults {
    return this.runSimulation(scenario, assumptions, iterations);
  }

  /**
   * Reset Box-Muller algorithm state
   */
  static resetRandom(): void {
    MonteCarloEngine._hasSpare = false;
    MonteCarloEngine._spare = 0;
  }
}

// Export default only to avoid conflicts
export default MonteCarloEngine;

// For backward compatibility with existing code
if (typeof window !== 'undefined') {
  interface WindowWithMonteCarloEngine extends Window {
    MonteCarloEngine?: typeof MonteCarloEngine;
  }
  (window as WindowWithMonteCarloEngine).MonteCarloEngine = MonteCarloEngine;
}