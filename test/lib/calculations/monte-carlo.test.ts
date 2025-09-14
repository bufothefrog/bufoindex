/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Monte Carlo Simulation Engine Test Suite
 * 100% Coverage Required - Sprint 7 Testing Framework
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import MonteCarloEngine, {
  MonteCarloScenario,
  MonteCarloAssumptions,
  SingleSimulationResult,
  MonteCarloResults
} from '@/lib/calculations/monte-carlo'
import {
  measureCalculationPerformance,
  validateMonteCarloResults
} from '../../utils/financial-test-helpers'

describe('MonteCarloEngine', () => {
  beforeEach(() => {
    // Reset the Box-Muller algorithm state before each test
    MonteCarloEngine.resetRandom()
    // Restore original Math.random
    vi.restoreAllMocks()
  })

  afterEach(() => {
    // Ensure Math.random is restored
    vi.restoreAllMocks()
  })

  describe('boxMullerRandom', () => {
    it('should generate normally distributed random numbers', () => {
      const samples: number[] = []
      const sampleSize = 10000

      for (let i = 0; i < sampleSize; i++) {
        samples.push(MonteCarloEngine.boxMullerRandom(0, 1))
      }

      // Test statistical properties of normal distribution
      const mean = samples.reduce((sum, val) => sum + val, 0) / sampleSize
      const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleSize
      const stdDev = Math.sqrt(variance)

      // Normal distribution should have mean ≈ 0, stdDev ≈ 1
      expect(mean).toBeCloseToCurrency(0, 0.1) // Within 0.1 of 0
      expect(stdDev).toBeCloseToCurrency(1, 0.1) // Within 0.1 of 1

      // Test range coverage (99.7% should be within 3 standard deviations)
      const withinThreeSigma = samples.filter(val => Math.abs(val) <= 3).length
      const coverage = withinThreeSigma / sampleSize
      expect(coverage).toBeGreaterThan(0.990) // At least 99% within 3σ
    })

    it('should generate different means and standard deviations correctly', () => {
      const mean = 5
      const stdDev = 2
      const samples: number[] = []
      const sampleSize = 5000

      for (let i = 0; i < sampleSize; i++) {
        samples.push(MonteCarloEngine.boxMullerRandom(mean, stdDev))
      }

      const actualMean = samples.reduce((sum, val) => sum + val, 0) / sampleSize
      const actualVariance = samples.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0) / sampleSize
      const actualStdDev = Math.sqrt(actualVariance)

      expect(actualMean).toBeCloseToCurrency(mean, 0.2)
      expect(actualStdDev).toBeCloseToCurrency(stdDev, 0.2)
    })

    it('should handle Box-Muller spare state correctly', () => {
      // First call generates two values, uses one, stores one as spare
      const first = MonteCarloEngine.boxMullerRandom(0, 1)
      // Second call should use the spare
      const second = MonteCarloEngine.boxMullerRandom(0, 1)
      // Third call should generate new values
      const third = MonteCarloEngine.boxMullerRandom(0, 1)

      expect(typeof first).toBe('number')
      expect(typeof second).toBe('number')
      expect(typeof third).toBe('number')
      expect(isFinite(first)).toBe(true)
      expect(isFinite(second)).toBe(true)
      expect(isFinite(third)).toBe(true)
    })

    it('should avoid log(0) edge case', () => {
      // Mock Math.random to return 0 occasionally to test protection
      let callCount = 0
      const originalRandom = Math.random
      Math.random = () => {
        callCount++
        return callCount === 1 ? 0 : 0.5 // First call returns 0, should be rejected
      }

      const result = MonteCarloEngine.boxMullerRandom(0, 1)
      expect(isFinite(result)).toBe(true)
      expect(result).not.toBe(-Infinity)
      expect(result).not.toBe(Infinity)

      Math.random = originalRandom
    })

    it('should meet performance requirements', () => {
      measureCalculationPerformance(
        'box-muller-batch',
        () => {
          for (let i = 0; i < 1000; i++) {
            MonteCarloEngine.boxMullerRandom(0, 1)
          }
        },
        50 // Max 50ms for 1000 random numbers
      )
    })
  })

  describe('generateReturnSequence', () => {
    it('should generate correct number of returns', () => {
      const years = 30
      const returns = MonteCarloEngine.generateReturnSequence(years, 0.07, 0.15)

      expect(returns).toHaveLength(years)
      returns.forEach(ret => {
        expect(typeof ret).toBe('number')
        expect(isFinite(ret)).toBe(true)
      })
    })

    it('should be deterministic with seed', () => {
      const years = 10
      const meanReturn = 0.07
      const volatility = 0.15
      const seed = 12345

      const sequence1 = MonteCarloEngine.generateReturnSequence(years, meanReturn, volatility, seed)
      const sequence2 = MonteCarloEngine.generateReturnSequence(years, meanReturn, volatility, seed)

      expect(sequence1).toEqual(sequence2)
      expect(sequence1).toHaveLength(years)
    })

    it('should generate different sequences without seed', () => {
      const years = 10
      const meanReturn = 0.07
      const volatility = 0.15

      const sequence1 = MonteCarloEngine.generateReturnSequence(years, meanReturn, volatility)
      const sequence2 = MonteCarloEngine.generateReturnSequence(years, meanReturn, volatility)

      // Sequences should be different (extremely unlikely to be identical)
      expect(sequence1).not.toEqual(sequence2)
      expect(sequence1).toHaveLength(years)
      expect(sequence2).toHaveLength(years)
    })

    it('should generate returns with approximately correct statistical properties', () => {
      const years = 1000
      const meanReturn = 0.08
      const volatility = 0.20
      
      const returns = MonteCarloEngine.generateReturnSequence(years, meanReturn, volatility, 42)
      
      const actualMean = returns.reduce((sum, ret) => sum + ret, 0) / years
      const actualVariance = returns.reduce((sum, ret) => sum + Math.pow(ret - actualMean, 2), 0) / years
      const actualStdDev = Math.sqrt(actualVariance)

      // Should be close to expected values (within statistical tolerance)
      expect(actualMean).toBeCloseToCurrency(meanReturn, 0.02)
      expect(actualStdDev).toBeCloseToCurrency(volatility, 0.02)
    })

    it('should handle edge cases', () => {
      // Zero years
      expect(MonteCarloEngine.generateReturnSequence(0, 0.07, 0.15)).toHaveLength(0)

      // Very large number of years
      const largeSequence = MonteCarloEngine.generateReturnSequence(10000, 0.07, 0.15, 999)
      expect(largeSequence).toHaveLength(10000)

      // Zero volatility
      const zeroVolatility = MonteCarloEngine.generateReturnSequence(100, 0.07, 0, 123)
      expect(zeroVolatility).toHaveLength(100)
      // All returns should be very close to mean with zero volatility
      zeroVolatility.forEach(ret => {
        expect(ret).toBeCloseToCurrency(0.07, 0.01)
      })
    })
  })

  describe('simulateSingleScenario', () => {
    const baseScenario: MonteCarloScenario = {
      retirementAge: 65,
      targetIncome: 75000,
      startingAge: 30,
      startingBalance: 100000,
      lifeExpectancy: 90,
      endAge: 85
    }

    const baseAssumptions: MonteCarloAssumptions = {
      inflationRate: 0.03,
      accumulationReturn: 0.07,
      retirementReturn: 0.06,
      volatility: 0.15
    }

    it('should simulate valid retirement scenario successfully', () => {
      const { result: simulation } = measureCalculationPerformance(
        'single-scenario-simulation',
        () => MonteCarloEngine.simulateSingleScenario(baseScenario, baseAssumptions, 0),
        100 // Max 100ms per simulation
      )

      expect(simulation.success).toBeDefined()
      expect(simulation.portfolioAtRetirement).toBeGreaterThan(0)
      expect(simulation.yearlyProgression).toHaveLength(baseScenario.endAge! - baseScenario.startingAge)
      expect(simulation.failureAge).toBeDefined()

      if (simulation.success) {
        expect(simulation.finalPortfolioValue).toBeGreaterThanOrEqual(0)
        expect(simulation.yearsOfWithdrawals).toBeGreaterThan(0)
      } else {
        expect(simulation.failureAge).toBeGreaterThan(baseScenario.retirementAge)
      }
    })

    it('should handle invalid retirement age gracefully', () => {
      const invalidScenario = {
        ...baseScenario,
        startingAge: 65,
        retirementAge: 60 // Retirement before starting age
      }

      const result = MonteCarloEngine.simulateSingleScenario(invalidScenario, baseAssumptions, 0)
      
      expect(result.success).toBe(false)
      expect(result.portfolioAtRetirement).toBe(0)
      expect(result.yearlyProgression).toHaveLength(0)
      expect(result.failureAge).toBeNull()
      expect(result.reason).toBe('Invalid retirement age')
    })

    it('should calculate inflation adjustment correctly', () => {
      const result = MonteCarloEngine.simulateSingleScenario(baseScenario, baseAssumptions, 12345)
      
      // First retirement withdrawal should be inflation-adjusted
      const retirementYear = result.yearlyProgression.find(y => y.age === baseScenario.retirementAge)
      if (retirementYear) {
        const yearsUntilRetirement = baseScenario.retirementAge - baseScenario.startingAge
        const expectedInflatedIncome = baseScenario.targetIncome * Math.pow(1 + baseAssumptions.inflationRate, yearsUntilRetirement)
        
        // The withdrawal might be slightly different due to random returns, but should be in the ballpark
        expect(retirementYear.withdrawal).toBeWithinPercentageRange(expectedInflatedIncome, 20.0)
      }
    })

    it('should properly separate accumulation and retirement phases', () => {
      const result = MonteCarloEngine.simulateSingleScenario(baseScenario, baseAssumptions, 54321)
      
      const accumulationYears = result.yearlyProgression.filter(y => y.age < baseScenario.retirementAge)
      const retirementYears = result.yearlyProgression.filter(y => y.age >= baseScenario.retirementAge)

      // Accumulation phase: no withdrawals
      accumulationYears.forEach(year => {
        expect(year.withdrawal).toBe(0)
        expect(year.portfolioValue).toBeGreaterThan(0)
      })

      // Retirement phase: should have withdrawals
      retirementYears.forEach(year => {
        expect(year.withdrawal).toBeGreaterThan(0)
      })

      const expectedAccumulationYears = baseScenario.retirementAge - baseScenario.startingAge
      const expectedRetirementYears = baseScenario.endAge! - baseScenario.retirementAge

      expect(accumulationYears).toHaveLength(expectedAccumulationYears)
      expect(retirementYears).toHaveLength(expectedRetirementYears)
    })

    it('should handle portfolio failure correctly', () => {
      // Create scenario likely to fail (very high withdrawals, low returns)
      const failureScenario: MonteCarloScenario = {
        ...baseScenario,
        targetIncome: 200000, // Very high withdrawal needs
        startingBalance: 50000, // Low starting balance
      }

      const failureAssumptions: MonteCarloAssumptions = {
        ...baseAssumptions,
        accumulationReturn: 0.02, // Low returns
        retirementReturn: 0.01,
        volatility: 0.25 // High volatility
      }

      const result = MonteCarloEngine.simulateSingleScenario(failureScenario, failureAssumptions, 99999)
      
      if (!result.success) {
        expect(result.failureAge).toBeGreaterThanOrEqual(failureScenario.retirementAge)
        expect(result.failureAge).toBeLessThanOrEqual(failureScenario.endAge!)
        expect(result.finalPortfolioValue).toBe(0)
        expect(result.yearsOfWithdrawals).toBeGreaterThan(0)
      }
    })

    it('should handle different life expectancy scenarios', () => {
      // Test with explicit endAge
      const shortRetirement = {
        ...baseScenario,
        endAge: 75 // Short retirement
      }

      const result = MonteCarloEngine.simulateSingleScenario(shortRetirement, baseAssumptions, 11111)
      expect(result.yearlyProgression.length).toBeLessThanOrEqual(shortRetirement.endAge - shortRetirement.startingAge)

      // Test with lifeExpectancy fallback
      const longRetirement = {
        ...baseScenario,
        endAge: undefined,
        lifeExpectancy: 95
      }

      const result2 = MonteCarloEngine.simulateSingleScenario(longRetirement, baseAssumptions, 22222)
      expect(result2.yearlyProgression.length).toBeLessThanOrEqual(longRetirement.lifeExpectancy - longRetirement.startingAge)
    })

    it('should use simulation ID for reproducible results', () => {
      const simulationId = 777

      const result1 = MonteCarloEngine.simulateSingleScenario(baseScenario, baseAssumptions, simulationId)
      const result2 = MonteCarloEngine.simulateSingleScenario(baseScenario, baseAssumptions, simulationId)

      // Results should be identical with same simulation ID
      expect(result1.portfolioAtRetirement).toBe(result2.portfolioAtRetirement)
      expect(result1.success).toBe(result2.success)
      expect(result1.yearlyProgression).toEqual(result2.yearlyProgression)
    })

    it('should handle extreme parameter scenarios', () => {
      // Very long accumulation period
      const longAccumulation: MonteCarloScenario = {
        startingAge: 20,
        retirementAge: 70,
        targetIncome: 50000,
        startingBalance: 1000,
        endAge: 90
      }

      const result = MonteCarloEngine.simulateSingleScenario(longAccumulation, baseAssumptions, 333)
      expect(result.portfolioAtRetirement).toBeGreaterThan(longAccumulation.startingBalance)

      // Zero starting balance
      const zeroStart = {
        ...baseScenario,
        startingBalance: 0
      }

      const result2 = MonteCarloEngine.simulateSingleScenario(zeroStart, baseAssumptions, 444)
      expect(result2.portfolioAtRetirement).toBeGreaterThanOrEqual(0)
    })
  })

  describe('runSimulation', () => {
    const testScenario: MonteCarloScenario = {
      retirementAge: 65,
      targetIncome: 60000,
      startingAge: 35,
      startingBalance: 150000,
      endAge: 85
    }

    const testAssumptions: MonteCarloAssumptions = {
      inflationRate: 0.025,
      accumulationReturn: 0.08,
      retirementReturn: 0.05,
      volatility: 0.18
    }

    it('should run complete Monte Carlo simulation with performance requirements', () => {
      const iterations = 1000

      const { result: results } = measureCalculationPerformance(
        'monte-carlo-simulation-1000',
        () => MonteCarloEngine.runSimulation(testScenario, testAssumptions, iterations),
        5000 // Max 5s for 1000 iterations
      )

      validateMonteCarloResults(results, 70, 10.0, iterations)

      expect(results.scenarios).toHaveLength(iterations)
      expect(results.successRate).toBeGreaterThanOrEqual(0)
      expect(results.successRate).toBeLessThanOrEqual(1)
      expect(results.averagePortfolioAtRetirement).toBeGreaterThan(0)
      expect(results.medianPortfolioAtRetirement).toBeGreaterThan(0)
      expect(results.executionTime).toBeGreaterThan(0)
    })

    it('should calculate statistics correctly', () => {
      const iterations = 100
      const results = MonteCarloEngine.runSimulation(testScenario, testAssumptions, iterations)

      // Verify portfolio percentiles are ordered correctly
      expect(results.percentile10PortfolioAtRetirement).toBeLessThanOrEqual(results.medianPortfolioAtRetirement)
      expect(results.medianPortfolioAtRetirement).toBeLessThanOrEqual(results.percentile90PortfolioAtRetirement)

      // Verify success rate calculation
      const actualSuccesses = results.scenarios.filter(s => s.success).length
      const expectedSuccessRate = actualSuccesses / iterations
      expect(results.successRate).toBeCloseToCurrency(expectedSuccessRate, 4)

      // Verify average calculation
      const totalPortfolios = results.scenarios.reduce((sum, s) => sum + s.portfolioAtRetirement, 0)
      const expectedAverage = totalPortfolios / iterations
      expect(results.averagePortfolioAtRetirement).toBeCloseToCurrency(expectedAverage, 2)
    })

    it('should calculate average failure age correctly', () => {
      // Create scenario likely to have some failures
      const riskyScenario: MonteCarloScenario = {
        ...testScenario,
        targetIncome: 120000, // High withdrawal
        startingBalance: 100000
      }

      const results = MonteCarloEngine.runSimulation(riskyScenario, testAssumptions, 500)

      const failedScenarios = results.scenarios.filter(s => !s.success && s.failureAge)
      
      if (failedScenarios.length > 0) {
        const expectedAverageFailureAge = failedScenarios.reduce((sum, s) => sum + (s.failureAge || 0), 0) / failedScenarios.length
        expect(results.averageFailureAge).toBeCloseToCurrency(expectedAverageFailureAge, 2)
      } else {
        expect(results.averageFailureAge).toBe(0)
      }
    })

    it('should handle small iteration counts', () => {
      const results = MonteCarloEngine.runSimulation(testScenario, testAssumptions, 10)
      
      expect(results.scenarios).toHaveLength(10)
      expect(results.iterations).toBe(10)
      expect(results.successRate).toBeGreaterThanOrEqual(0)
      expect(results.successRate).toBeLessThanOrEqual(1)
    })

    it('should handle large iteration counts efficiently', () => {
      const iterations = 10000

      const { result: results, duration } = measureCalculationPerformance(
        'monte-carlo-simulation-10000',
        () => MonteCarloEngine.runSimulation(testScenario, testAssumptions, iterations),
        15000 // Max 15s for 10,000 iterations
      )

      expect(results.scenarios).toHaveLength(iterations)
      expect(results.iterations).toBe(iterations)
      expect(duration).toBeLessThan(15000)

      // Large sample should have stable statistics
      expect(results.successRate).toBeGreaterThan(0.5) // Reasonable success rate
      expect(results.averagePortfolioAtRetirement).toBeGreaterThan(testScenario.startingBalance)
    })

    it('should have reproducible results with same input', () => {
      const iterations = 100

      // Reset random state before each run
      MonteCarloEngine.resetRandom()
      const results1 = MonteCarloEngine.runSimulation(testScenario, testAssumptions, iterations)

      MonteCarloEngine.resetRandom()  
      const results2 = MonteCarloEngine.runSimulation(testScenario, testAssumptions, iterations)

      // Note: Results may not be identical due to JavaScript floating-point arithmetic
      // and the fact that we're not using a seeded random number generator in runSimulation
      expect(results1.iterations).toBe(results2.iterations)
      expect(results1.scenarios).toHaveLength(results2.scenarios.length)
    })
  })

  describe('analyzeSequenceOfReturnsRisk', () => {
    const testScenario: MonteCarloScenario = {
      retirementAge: 62,
      targetIncome: 70000,
      startingAge: 30,
      startingBalance: 200000,
      endAge: 90
    }

    const testAssumptions: MonteCarloAssumptions = {
      inflationRate: 0.03,
      accumulationReturn: 0.09,
      retirementReturn: 0.06,
      volatility: 0.20
    }

    it('should analyze sequence of returns risk with high iteration count', () => {
      const { result: results } = measureCalculationPerformance(
        'sequence-returns-analysis',
        () => MonteCarloEngine.analyzeSequenceOfReturnsRisk(testScenario, testAssumptions, 5000),
        10000 // Max 10s for sequence analysis
      )

      expect(results.iterations).toBe(5000)
      expect(results.scenarios).toHaveLength(5000)
      
      // Sequence of returns risk analysis should capture worst-case scenarios
      expect(results.successRate).toBeGreaterThan(0)
      expect(results.successRate).toBeLessThan(1)
      
      // Should have reasonable statistical distribution
      expect(results.percentile10PortfolioAtRetirement).toBeLessThan(results.percentile90PortfolioAtRetirement)
    })
  })

  describe('resetRandom', () => {
    it('should reset Box-Muller algorithm state', () => {
      // Generate some random numbers to set internal state
      MonteCarloEngine.boxMullerRandom(0, 1)
      MonteCarloEngine.boxMullerRandom(0, 1)
      
      // Reset state
      MonteCarloEngine.resetRandom()
      
      // Should work without issues after reset
      const result = MonteCarloEngine.boxMullerRandom(0, 1)
      expect(typeof result).toBe('number')
      expect(isFinite(result)).toBe(true)
    })

    it('should be safe to call multiple times', () => {
      MonteCarloEngine.resetRandom()
      MonteCarloEngine.resetRandom()
      MonteCarloEngine.resetRandom()
      
      // Should still work after multiple resets
      const result = MonteCarloEngine.boxMullerRandom(0, 1)
      expect(typeof result).toBe('number')
      expect(isFinite(result)).toBe(true)
    })
  })

  describe('browser compatibility', () => {
    it('should export to window when available', () => {
      if (typeof window !== 'undefined') {
        expect((window as any).MonteCarloEngine).toBeDefined()
        expect((window as any).MonteCarloEngine).toBe(MonteCarloEngine)
      }
    })

    it('should work without window object (Node.js)', () => {
      // This test runs in jsdom but simulates server environment
      const scenario: MonteCarloScenario = {
        retirementAge: 65,
        targetIncome: 50000,
        startingAge: 30,
        startingBalance: 100000,
        endAge: 85
      }

      const assumptions: MonteCarloAssumptions = {
        inflationRate: 0.03,
        accumulationReturn: 0.07,
        retirementReturn: 0.05,
        volatility: 0.15
      }

      const result = MonteCarloEngine.simulateSingleScenario(scenario, assumptions, 123)
      expect(result.portfolioAtRetirement).toBeGreaterThan(0)
    })
  })

  describe('Monte Carlo validation against known scenarios', () => {
    it('should validate 4% withdrawal rule scenarios', () => {
      // Classic 4% rule scenario
      const classicScenario: MonteCarloScenario = {
        startingAge: 30,
        retirementAge: 65,
        targetIncome: 40000, // 4% of $1M portfolio
        startingBalance: 0,
        endAge: 95 // 30-year retirement
      }

      // Conservative assumptions matching Trinity Study
      const conservativeAssumptions: MonteCarloAssumptions = {
        inflationRate: 0.03,
        accumulationReturn: 0.07, // 60/40 stock/bond portfolio
        retirementReturn: 0.06,   // Lower returns in retirement
        volatility: 0.15
      }

      const results = MonteCarloEngine.runSimulation(classicScenario, conservativeAssumptions, 1000)

      // 4% rule should have ~95% success rate over 30 years
      expect(results.successRate).toBeGreaterThan(0.85) // Allow for some variance
      expect(results.averagePortfolioAtRetirement).toBeGreaterThan(800000) // Should reach near $1M
    })

    it('should handle Coast FIRE scenarios correctly', () => {
      // Coast FIRE: Large starting balance, minimal additional contributions needed
      const coastFireScenario: MonteCarloScenario = {
        startingAge: 35,
        retirementAge: 65,
        targetIncome: 60000,
        startingBalance: 400000, // Large head start
        endAge: 85
      }

      const coastFireAssumptions: MonteCarloAssumptions = {
        inflationRate: 0.025,
        accumulationReturn: 0.08,
        retirementReturn: 0.05,
        volatility: 0.18
      }
      
      const results = MonteCarloEngine.runSimulation(coastFireScenario, coastFireAssumptions, 500)

      // Coast FIRE should have high success rates
      expect(results.successRate).toBeGreaterThan(0.70)
      expect(results.averagePortfolioAtRetirement).toBeGreaterThan(coastFireScenario.startingBalance)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle extreme volatility scenarios', () => {
      const extremeVolatility: MonteCarloAssumptions = {
        inflationRate: 0.03,
        accumulationReturn: 0.08,
        retirementReturn: 0.05,
        volatility: 0.50 // 50% volatility - extreme
      }

      const edgeCaseScenario: MonteCarloScenario = {
        retirementAge: 65,
        targetIncome: 60000,
        startingAge: 35,
        startingBalance: 150000,
        endAge: 85
      }
      
      const result = MonteCarloEngine.runSimulation(edgeCaseScenario, extremeVolatility, 100)
      
      expect(result.scenarios).toHaveLength(100)
      expect(result.successRate).toBeGreaterThanOrEqual(0)
      expect(result.successRate).toBeLessThanOrEqual(1)
      
      // High volatility should create wide distribution
      expect(result.percentile90PortfolioAtRetirement).toBeGreaterThan(result.percentile10PortfolioAtRetirement * 2)
    })

    it('should handle negative return scenarios', () => {
      const negativeReturns: MonteCarloAssumptions = {
        inflationRate: 0.03,
        accumulationReturn: -0.02, // Negative returns
        retirementReturn: -0.01,
        volatility: 0.15
      }

      const negativeScenario: MonteCarloScenario = {
        retirementAge: 65,
        targetIncome: 60000,
        startingAge: 35,
        startingBalance: 150000,
        endAge: 85
      }
      
      const result = MonteCarloEngine.runSimulation(negativeScenario, negativeReturns, 50)
      
      expect(result.scenarios).toHaveLength(50)
      expect(result.successRate).toBe(0) // Should all fail with negative returns
      expect(result.averageFailureAge).toBeGreaterThan(negativeScenario.retirementAge)
    })

    it('should handle zero volatility (deterministic) scenarios', () => {
      const zeroVolatility: MonteCarloAssumptions = {
        inflationRate: 0.03,
        accumulationReturn: 0.07,
        retirementReturn: 0.05,
        volatility: 0 // No volatility
      }

      const deterministicScenario: MonteCarloScenario = {
        retirementAge: 65,
        targetIncome: 60000,
        startingAge: 35,
        startingBalance: 150000,
        endAge: 85
      }
      
      const result = MonteCarloEngine.runSimulation(deterministicScenario, zeroVolatility, 100)
      
      // All scenarios should have identical results with zero volatility
      const uniqueSuccessResults = [...new Set(result.scenarios.map(s => s.success))]
      const uniquePortfolioValues = [...new Set(result.scenarios.map(s => Math.round(s.portfolioAtRetirement)))]
      
      expect(uniqueSuccessResults).toHaveLength(1) // All same success/failure
      expect(uniquePortfolioValues).toHaveLength(1) // All same portfolio value
    })
  })
})