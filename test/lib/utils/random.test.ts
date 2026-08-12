/**
 * Random Utility Test Suite
 *
 * Covers the shared Box-Muller transform (distribution shape, log(0) guard)
 * and the seeded LCG PRNG (determinism, range, Math.random isolation).
 * Ported from the deleted monte-carlo engine's test suite — these utilities
 * now back the retirement Monte Carlo simulation directly.
 */

import { describe, it, expect } from 'vitest'
import { createSeededRng, boxMullerRandom } from '@/lib/utils/random'

describe('boxMullerRandom', () => {
  it('generates normally distributed numbers (mean ~0, std ~1) from a seeded source', () => {
    // Seeded source makes this distribution test fully deterministic.
    const rng = createSeededRng(42)
    const sampleSize = 10000
    const samples: number[] = []
    for (let i = 0; i < sampleSize; i++) {
      samples.push(boxMullerRandom(0, 1, rng))
    }

    const mean = samples.reduce((sum, val) => sum + val, 0) / sampleSize
    const variance =
      samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleSize
    const stdDev = Math.sqrt(variance)

    // Standard error of the mean for n=10000 draws of a unit normal is 0.01,
    // so |mean| < 0.05 is a 5-sigma bound; std within 5% likewise generous.
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(stdDev).toBeGreaterThan(0.95)
    expect(stdDev).toBeLessThan(1.05)

    // ~99.7% of samples should fall within 3 sigma
    const withinThreeSigma = samples.filter((val) => Math.abs(val) <= 3).length
    expect(withinThreeSigma / sampleSize).toBeGreaterThan(0.99)
  })

  it('applies mean and standard deviation scaling', () => {
    const rng = createSeededRng(7)
    const sampleSize = 10000
    const samples: number[] = []
    for (let i = 0; i < sampleSize; i++) {
      samples.push(boxMullerRandom(0.07, 0.15, rng))
    }

    const mean = samples.reduce((sum, val) => sum + val, 0) / sampleSize
    const variance =
      samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleSize
    const stdDev = Math.sqrt(variance)

    // Sample mean of N(0.07, 0.15^2) has std error 0.0015; allow ~5 sigma.
    expect(Math.abs(mean - 0.07)).toBeLessThan(0.0075)
    expect(Math.abs(stdDev - 0.15)).toBeLessThan(0.0075)
  })

  it('avoids log(0) via the do-while guard when the source returns 0', () => {
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

  it('defaults to Math.random without corrupting it', () => {
    const originalRandom = Math.random
    const result = boxMullerRandom(0, 1)
    expect(isFinite(result)).toBe(true)
    expect(Math.random).toBe(originalRandom)
  })
})

describe('createSeededRng', () => {
  it('produces identical sequences for the same seed and does not touch Math.random', () => {
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

  it('produces different sequences for different seeds', () => {
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(99)

    let anyDifferent = false
    for (let i = 0; i < 10; i++) {
      if (rng1() !== rng2()) anyDifferent = true
    }
    expect(anyDifferent).toBe(true)
  })
})
