/**
 * Financial Test Helpers
 * Utilities for testing complex financial calculations with exact verification.
 *
 * IRS constants are sourced from the canonical `lib/constants/irs-2026.ts`
 * (single source of truth). Test-facing shapes are preserved for backward
 * compatibility with existing test imports.
 */

import { expect } from 'vitest'
import {
  FEDERAL_TAX_BRACKETS_2026,
  CONTRIBUTION_LIMITS_2026,
  SS_WAGE_BASE_2026,
} from '@/lib/constants/irs-2026'

// IRS tax brackets for 2026. Re-exported from the canonical source so values
// can never drift. (Rev. Proc. 2025-32, as amended by OBBBA.)
export const IRS_2026_TAX_BRACKETS = FEDERAL_TAX_BRACKETS_2026

// 2026 contribution limits. Composed from the canonical IRS constants
// (IRS Notice 2025-67, Rev. Proc. 2025-19) and remapped to the test-facing
// shape used by existing tests. The final field, highInterestDebtThreshold,
// is not an IRS value — it is BufoIndex methodology (7% threshold) and is
// kept here because it has no canonical home elsewhere.
export const IRS_2026_LIMITS = {
  retirement401k: CONTRIBUTION_LIMITS_2026.traditional401k,
  retirement401kCatchup: CONTRIBUTION_LIMITS_2026.catchUp['401k'],
  superCatchUp401k: CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k, // Ages 60-63 (SECURE 2.0)
  retirementIRA: CONTRIBUTION_LIMITS_2026.ira,
  retirementIRACatchup: CONTRIBUTION_LIMITS_2026.catchUp.ira,
  hsa: {
    individual: CONTRIBUTION_LIMITS_2026.hsa.individual,
    family: CONTRIBUTION_LIMITS_2026.hsa.family,
    catchup: CONTRIBUTION_LIMITS_2026.catchUp.hsa, // Statutory, not indexed
  },
  socialSecurityWageBase: SS_WAGE_BASE_2026,
  total415c: CONTRIBUTION_LIMITS_2026.total415c,
  highInterestDebtThreshold: 0.07, // BufoIndex methodology, not an IRS value
} as const

/**
 * Custom matchers for financial calculations
 */
export interface FinancialMatchers<R = unknown> {
  toBeCloseToCurrency: (expected: number, precision?: number) => R
}

declare module 'vitest' {
  // Vitest's own Assertion interface defaults its type parameter to `any`;
  // the augmentation must match that shape for declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends FinancialMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends FinancialMatchers {}
}

/**
 * Currency comparison with proper precision
 */
expect.extend({
  toBeCloseToCurrency(received: number, expected: number, precision: number = 2) {
    const difference = Math.abs(received - expected)
    const threshold = Math.pow(10, -precision)

    return {
      pass: difference < threshold,
      message: () =>
        `Expected ${received.toFixed(precision)} to be close to ${expected.toFixed(precision)} (within ${threshold})`
    }
  },
})

/**
 * Performance testing utilities
 */
export interface PerformanceResult<T = unknown> {
  duration: number
  result: T
  memoryUsage?: number
}

export function measureCalculationPerformance<T>(
  name: string,
  calculation: () => T,
  maxDurationMs: number = 50
): PerformanceResult<T> {
  const startTime = performance.now()
  const startMemory = process.memoryUsage?.()?.heapUsed || 0

  const result = calculation()

  const duration = performance.now() - startTime
  const endMemory = process.memoryUsage?.()?.heapUsed || 0
  const memoryUsage = endMemory - startMemory

  // Validate performance requirement
  expect(duration, `${name} calculation took ${duration.toFixed(2)}ms, expected < ${maxDurationMs}ms`)
    .toBeLessThan(maxDurationMs)

  return {
    duration,
    result,
    memoryUsage: memoryUsage > 0 ? memoryUsage : undefined
  }
}
