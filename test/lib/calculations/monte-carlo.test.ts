/**
 * Monte Carlo Simulation Utilities Test Suite
 * Tests for generateReturnSequence and shared random utilities
 */

import { describe, it, expect } from 'vitest'
import { generateReturnSequence } from '@/lib/calculations/monte-carlo'
import { createSeededRng, boxMullerRandom } from '@/lib/utils/random'
// Side-effect import: registers `toBeCloseToCurrency` custom matcher.
import '../../utils/financial-test-helpers'

describe('boxMullerRandom', () => {
  it('should generate normally distributed random numbers (mean ~0, std ~1)', () => {
    const samples: number[] = []
    const sampleSize = 10000

    for (let i = 0; i < sampleSize; i++) {
      samples.push(boxMullerRandom(0, 1))
    }

    const mean = samples.reduce((sum, val) => sum + val, 0) / sampleSize
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleSize
    const stdDev = Math.sqrt(variance)

    expect(mean).toBeCloseToCurrency(0, 0.1)
    expect(stdDev).toBeCloseToCurrency(1, 0.15)

    // ~99.7% of samples should fall within 3 sigma
    const withinThreeSigma = samples.filter((val) => Math.abs(val) <= 3).length
    expect(withinThreeSigma / sampleSize).toBeGreaterThan(0.990)
  })

  it('should avoid log(0) edge case via do-while guard', () => {
    // Custom rng returning 0 on the call that would become u1 forces the guard path.
    let callCount = 0
    const rng = () => {
      callCount++
      if (callCount === 2) return 0
      return 0.5
    }

    const result = boxMullerRandom(0, 1, rng)
    expect(isFinite(result)).toBe(true)
  })
})

describe('createSeededRng', () => {
  it('should produce deterministic sequences for the same seed and not corrupt Math.random', () => {
    const originalRandom = Math.random
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(42)

    for (let i = 0; i < 100; i++) {
      const a = rng1()
      const b = rng2()
      expect(a).toBe(b)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(1)
    }

    expect(Math.random).toBe(originalRandom)
  })

  it('should produce different sequences for different seeds', () => {
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(99)

    let anyDifferent = false
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) anyDifferent = true
    }
    expect(anyDifferent).toBe(true)
  })
})

describe('generateReturnSequence', () => {
  it('should be deterministic with seed and produce correct length / finite values', () => {
    const years = 30
    const sequence1 = generateReturnSequence(years, 0.07, 0.15, 12345)
    const sequence2 = generateReturnSequence(years, 0.07, 0.15, 12345)

    expect(sequence1).toHaveLength(years)
    expect(sequence1).toEqual(sequence2)
    sequence1.forEach((ret) => {
      expect(typeof ret).toBe('number')
      expect(isFinite(ret)).toBe(true)
    })
  })

  it('should generate returns with approximately correct mean and stddev over many years', () => {
    const years = 1000
    const meanReturn = 0.08
    const volatility = 0.20

    const returns = generateReturnSequence(years, meanReturn, volatility, 42)
    const actualMean = returns.reduce((sum, ret) => sum + ret, 0) / years
    const actualVariance = returns.reduce((sum, ret) => sum + Math.pow(ret - actualMean, 2), 0) / years
    const actualStdDev = Math.sqrt(actualVariance)

    expect(actualMean).toBeCloseToCurrency(meanReturn, 0.02)
    expect(actualStdDev).toBeCloseToCurrency(volatility, 0.02)
  })

  it('should handle edge cases (zero years, zero volatility) and not corrupt Math.random', () => {
    const originalRandom = Math.random

    expect(generateReturnSequence(0, 0.07, 0.15)).toHaveLength(0)

    const zeroVolatility = generateReturnSequence(100, 0.07, 0, 123)
    expect(zeroVolatility).toHaveLength(100)
    zeroVolatility.forEach((ret) => {
      expect(ret).toBeCloseToCurrency(0.07, 0.01)
    })

    expect(Math.random).toBe(originalRandom)
  })
})

describe('Type exports', () => {
  it('should export generateReturnSequence', async () => {
    const mod = await import('@/lib/calculations/monte-carlo')
    expect(typeof mod.generateReturnSequence).toBe('function')
  })
})
