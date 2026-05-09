/**
 * Financial Test Helpers
 * Utilities for testing complex financial calculations with exact verification.
 *
 * IRS constants are sourced from the canonical `lib/constants/irs-2026.ts`
 * (single source of truth). Test-facing shapes are preserved for backward
 * compatibility with existing test imports.
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from 'vitest'
import {
  FEDERAL_TAX_BRACKETS_2026,
  CONTRIBUTION_LIMITS_2026,
  STANDARD_DEDUCTIONS_2026,
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
  toMatchTaxCalculation: (income: number, filingStatus: 'single' | 'marriedFilingJointly') => R
  toBeWithinPercentageRange: (expected: number, tolerance: number) => R
  toMatchMonteCarloDistribution: (expectedSuccessRate: number, tolerance: number) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends FinancialMatchers<T> {}
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

  /**
   * Verify tax calculation against IRS brackets (includes 2026 standard deduction)
   */
  toMatchTaxCalculation(received: number, income: number, filingStatus: 'single' | 'marriedFilingJointly') {
    const brackets = IRS_2026_TAX_BRACKETS[filingStatus]
    const standardDeduction = STANDARD_DEDUCTIONS_2026[filingStatus]
    const taxableIncome = Math.max(0, income - standardDeduction)

    let expectedTax = 0
    let remainingIncome = taxableIncome

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break

      const taxableInThisBracket = Math.min(remainingIncome, bracket.max - bracket.min)
      expectedTax += taxableInThisBracket * bracket.rate
      remainingIncome -= taxableInThisBracket
    }

    expectedTax = Math.round(expectedTax)
    const difference = Math.abs(received - expectedTax)

    return {
      pass: difference < 0.01,
      message: () =>
        `Expected tax ${received.toFixed(2)} to match IRS calculation ${expectedTax.toFixed(2)} for income ${income.toLocaleString()} (${filingStatus})`
    }
  },

  /**
   * Percentage-based range comparison for volatile calculations
   */
  toBeWithinPercentageRange(received: number, expected: number, tolerance: number) {
    const percentageDifference = Math.abs((received - expected) / expected) * 100

    return {
      pass: percentageDifference <= tolerance,
      message: () =>
        `Expected ${received} to be within ${tolerance}% of ${expected} (actual difference: ${percentageDifference.toFixed(2)}%)`
    }
  },

  /**
   * Monte Carlo success rate validation
   */
  toMatchMonteCarloDistribution(received: number, expectedSuccessRate: number, tolerance: number) {
    const difference = Math.abs(received - expectedSuccessRate) * 100

    return {
      pass: difference <= tolerance,
      message: () =>
        `Expected Monte Carlo success rate ${(received * 100).toFixed(1)}% to be within ${tolerance}% of expected ${(expectedSuccessRate * 100).toFixed(1)}%`
    }
  }
})

/**
 * Performance testing utilities
 */
export interface PerformanceResult {
  duration: number
  result: any
  memoryUsage?: number
}

export function measureCalculationPerformance<T>(
  name: string,
  calculation: () => T,
  maxDurationMs: number = 50
): PerformanceResult {
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

/**
 * Known financial calculation test cases for exact verification
 */
export const FINANCIAL_TEST_CASES = {
  compoundInterest: {
    // $10,000 at 7% annually for 10 years = $19,671.51
    basic: { principal: 10000, rate: 0.07, time: 10, expected: 19671.51 },
    // $1,000 at 12% monthly for 5 years = $1,816.70
    monthly: { principal: 1000, rate: 0.12, time: 5, frequency: 12, expected: 1816.70 }
  },

  presentValue: {
    // $100,000 in 10 years at 7% = $50,834.93 today
    basic: { futureValue: 100000, rate: 0.07, time: 10, expected: 50834.93 }
  },

  annuity: {
    // $1,000/month for 10 years at 7% annual = $138,975.05
    ordinaryAnnuity: { payment: 1000, rate: 0.07, periods: 10, expected: 138975.05 }
  },

  retirement401k: {
    // $23,000 annual limit for 2024
    contributionLimit: { year: 2024, expected: 23000 },
    // 6% employer match on $100,000 salary = $6,000
    employerMatch: { salary: 100000, matchRate: 0.06, expected: 6000 }
  },

  taxCalculations: {
    // Single filer, $75,000 income -> $12,238 federal tax (2024 brackets)
    singleFiler75k: { income: 75000, filingStatus: 'single', expectedTax: 12238 },
    // Married filing jointly, $150,000 -> $20,850 federal tax (2024 brackets)
    marriedFiling150k: { income: 150000, filingStatus: 'marriedFilingJointly', expectedTax: 20850 }
  }
} as const

/**
 * Mock data generators for consistent testing
 */
export function generateMockProfile(overrides: Partial<any> = {}) {
  return {
    personalInfo: {
      age: 30,
      filingStatus: 'single',
      state: 'CA'
    },
    income: {
      grossMonthly: 8333.33, // $100k annually
      paycheckFrequency: 'bi-weekly'
    },
    expenses: {
      fixedMonthly: 4000,
      variableMonthly: 1500
    },
    currentSavings: {
      checking: 5000,
      savings: 15000,
      retirement401k: 25000,
      rothIRA: 10000
    },
    ...overrides
  }
}
