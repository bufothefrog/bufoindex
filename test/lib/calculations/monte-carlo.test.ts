/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Monte Carlo Simulation Utilities Test Suite
 * Tests for generateReturnSequence and shared random utilities
 */

import { describe, it, expect, vi } from 'vitest'
import {
  MonteCarloScenario,
  MonteCarloAssumptions,
  SingleSimulationResult,
  MonteCarloResults,
  generateReturnSequence
} from '@/lib/calculations/monte-carlo'
import { createSeededRng, boxMullerRandom } from '@/lib/utils/random'
import {
  measureCalculationPerformance,
} from '../../utils/financial-test-helpers'

describe('boxMullerRandom', () => {
  it('should generate normally distributed random numbers', () => {
    const samples: number[] = []
    const sampleSize = 10000

    for (let i = 0; i < sampleSize; i++) {
      samples.push(boxMullerRandom(0, 1))
    }

    const mean = samples.reduce((sum: number, val: number) => sum + val, 0) / sampleSize
    const variance = samples.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / sampleSize
    const stdDev = Math.sqrt(variance)

    expect(mean).toBeCloseToCurrency(0, 0.1)
    expect(stdDev).toBeCloseToCurrency(1, 0.15)

    const withinThreeSigma = samples.filter((val: number) => Math.abs(val) <= 3).length
    const coverage = withinThreeSigma / sampleSize
    expect(coverage).toBeGreaterThan(0.990)
  })

  it('should generate different means and standard deviations correctly', () => {
    const mean = 5
    const stdDev = 2
    const samples: number[] = []
    const sampleSize = 5000

    for (let i = 0; i < sampleSize; i++) {
      samples.push(boxMullerRandom(mean, stdDev))
    }

    const actualMean = samples.reduce((sum: number, val: number) => sum + val, 0) / sampleSize
    const actualVariance = samples.reduce((sum: number, val: number) => sum + Math.pow(val - actualMean, 2), 0) / sampleSize
    const actualStdDev = Math.sqrt(actualVariance)

    expect(actualMean).toBeCloseToCurrency(mean, 0.2)
    expect(actualStdDev).toBeCloseToCurrency(stdDev, 0.3)
  })

  it('should avoid log(0) edge case', () => {
    // Create a custom rng that returns 0 on first call to test the guard
    let callCount = 0
    const rng = () => {
      callCount++
      if (callCount === 2) return 0 // u1 would be 0, should be rejected by do-while
      return 0.5
    }

    const result = boxMullerRandom(0, 1, rng)
    expect(isFinite(result)).toBe(true)
    expect(result).not.toBe(-Infinity)
    expect(result).not.toBe(Infinity)
  })

  it('should accept a custom rng function', () => {
    const seededRng = createSeededRng(42)
    const result = boxMullerRandom(0, 1, seededRng)
    expect(typeof result).toBe('number')
    expect(isFinite(result)).toBe(true)
  })

  it('should meet performance requirements', () => {
    measureCalculationPerformance(
      'box-muller-batch',
      () => {
        for (let i = 0; i < 1000; i++) {
          boxMullerRandom(0, 1)
        }
      },
      50
    )
  })
})

describe('createSeededRng', () => {
  it('should produce deterministic results for same seed', () => {
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(42)

    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('should produce different results for different seeds', () => {
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(99)

    // At least some values should differ
    let anyDifferent = false
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) anyDifferent = true
    }
    expect(anyDifferent).toBe(true)
  })

  it('should produce values in [0, 1) range', () => {
    const rng = createSeededRng(123)
    for (let i = 0; i < 10000; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1)
    }
  })

  it('should NOT corrupt Math.random', () => {
    const originalRandom = Math.random
    const rng = createSeededRng(42)

    // Call the seeded rng many times
    for (let i = 0; i < 100; i++) {
      rng()
    }

    // Math.random should still be the original function
    expect(Math.random).toBe(originalRandom)
  })
})

describe('generateReturnSequence', () => {
  it('should generate correct number of returns', () => {
    const years = 30
    const returns = generateReturnSequence(years, 0.07, 0.15)

    expect(returns).toHaveLength(years)
    returns.forEach((ret: number) => {
      expect(typeof ret).toBe('number')
      expect(isFinite(ret)).toBe(true)
    })
  })

  it('should be deterministic with seed', () => {
    const years = 10
    const meanReturn = 0.07
    const volatility = 0.15
    const seed = 12345

    const sequence1 = generateReturnSequence(years, meanReturn, volatility, seed)
    const sequence2 = generateReturnSequence(years, meanReturn, volatility, seed)

    expect(sequence1).toEqual(sequence2)
    expect(sequence1).toHaveLength(years)
  })

  it('should generate different sequences without seed', () => {
    const years = 10
    const meanReturn = 0.07
    const volatility = 0.15

    const sequence1 = generateReturnSequence(years, meanReturn, volatility)
    const sequence2 = generateReturnSequence(years, meanReturn, volatility)

    // Sequences should be different (extremely unlikely to be identical)
    expect(sequence1).not.toEqual(sequence2)
    expect(sequence1).toHaveLength(years)
    expect(sequence2).toHaveLength(years)
  })

  it('should generate returns with approximately correct statistical properties', () => {
    const years = 1000
    const meanReturn = 0.08
    const volatility = 0.20

    const returns = generateReturnSequence(years, meanReturn, volatility, 42)

    const actualMean = returns.reduce((sum: number, ret: number) => sum + ret, 0) / years
    const actualVariance = returns.reduce((sum: number, ret: number) => sum + Math.pow(ret - actualMean, 2), 0) / years
    const actualStdDev = Math.sqrt(actualVariance)

    expect(actualMean).toBeCloseToCurrency(meanReturn, 0.02)
    expect(actualStdDev).toBeCloseToCurrency(volatility, 0.02)
  })

  it('should handle edge cases', () => {
    // Zero years
    expect(generateReturnSequence(0, 0.07, 0.15)).toHaveLength(0)

    // Very large number of years
    const largeSequence = generateReturnSequence(10000, 0.07, 0.15, 999)
    expect(largeSequence).toHaveLength(10000)

    // Zero volatility
    const zeroVolatility = generateReturnSequence(100, 0.07, 0, 123)
    expect(zeroVolatility).toHaveLength(100)
    // All returns should be very close to mean with zero volatility
    zeroVolatility.forEach((ret: number) => {
      expect(ret).toBeCloseToCurrency(0.07, 0.01)
    })
  })

  it('should NOT corrupt Math.random when using a seed', () => {
    const originalRandom = Math.random

    // Call with seed
    generateReturnSequence(100, 0.07, 0.15, 42)

    // Math.random should still be the original function
    expect(Math.random).toBe(originalRandom)
  })
})

describe('Type exports', () => {
  it('should export all required type interfaces', async () => {
    const module = await import('@/lib/calculations/monte-carlo')

    // Verify generateReturnSequence is exported
    expect(module.generateReturnSequence).toBeDefined()
    expect(typeof module.generateReturnSequence).toBe('function')
  })
})
