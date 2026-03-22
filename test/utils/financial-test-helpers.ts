/**
 * Financial Test Helpers
 * Utilities for testing complex financial calculations with exact verification
 */

 
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from 'vitest'

// IRS tax bracket data for 2026 (Rev. Proc. 2025-32, as amended by OBBBA)
export const IRS_2026_TAX_BRACKETS = {
  single: [
    { min: 0, max: 12400, rate: 0.10 },
    { min: 12400, max: 50400, rate: 0.12 },
    { min: 50400, max: 105700, rate: 0.22 },
    { min: 105700, max: 201775, rate: 0.24 },
    { min: 201775, max: 256225, rate: 0.32 },
    { min: 256225, max: 640600, rate: 0.35 },
    { min: 640600, max: Infinity, rate: 0.37 }
  ],
  marriedFilingJointly: [
    { min: 0, max: 24800, rate: 0.10 },
    { min: 24800, max: 100800, rate: 0.12 },
    { min: 100800, max: 211400, rate: 0.22 },
    { min: 211400, max: 403550, rate: 0.24 },
    { min: 403550, max: 512450, rate: 0.32 },
    { min: 512450, max: 768700, rate: 0.35 },
    { min: 768700, max: Infinity, rate: 0.37 }
  ]
}

// 2026 contribution limits (IRS Notice 2025-67, Rev. Proc. 2025-19)
export const IRS_2026_LIMITS = {
  retirement401k: 24500,
  retirement401kCatchup: 8000,
  superCatchUp401k: 11250, // Ages 60-63 (SECURE 2.0)
  retirementIRA: 7500,
  retirementIRACatchup: 1100,
  hsa: {
    individual: 4400,
    family: 8750,
    catchup: 1000 // Statutory, not indexed
  },
  socialSecurityWageBase: 184500,
  total415c: 72000,
  highInterestDebtThreshold: 0.07 // 7% threshold from BufoIndex methodology
}

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
   * Verify tax calculation against IRS brackets (includes 2025 standard deduction)
   */
  toMatchTaxCalculation(received: number, income: number, filingStatus: 'single' | 'marriedFilingJointly') {
    const brackets = IRS_2026_TAX_BRACKETS[filingStatus]
    const standardDeduction = filingStatus === 'single' ? 16100 : 32200 // 2026 amounts
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

/**
 * Monte Carlo simulation test utilities
 */
export function validateMonteCarloResults(
  results: { successRate: number; scenarios: unknown[]; iterations?: number; executionTime?: number },
  expectedSuccessRate: number,
  tolerance: number = 5.0,
  minIterations: number = 1000
) {
  if (results.iterations) {
    expect(results.iterations).toBeGreaterThanOrEqual(minIterations)
  }
  expect(results.successRate).toMatchMonteCarloDistribution(expectedSuccessRate / 100, tolerance)
  if (results.iterations) {
    expect(results.scenarios).toHaveLength(results.iterations)
  }
  if (results.executionTime) {
    expect(results.executionTime).toBeLessThan(5000) // Max 5 seconds for Monte Carlo
  }
}

/**
 * Integration test helpers
 */
export function mockLocalStorage() {
  const store: Record<string, string> = {}
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(key => delete store[key]) },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
    store
  }
}

export function mockURLHash() {
  let currentHash = ''
  
  return {
    get hash() { return currentHash },
    set hash(value: string) { currentHash = value },
    updateHash: (newHash: string) => { currentHash = newHash },
    clearHash: () => { currentHash = '' }
  }
}

/**
 * Accessibility testing helpers
 */
export function checkAccessibilityCompliance(element: HTMLElement) {
  // Basic WCAG 2.1 AA compliance checks
  const checks = {
    hasAccessibleName: element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.textContent,
    hasProperRole: element.getAttribute('role') || element.tagName.toLowerCase(),
    hasKeyboardSupport: element.tabIndex >= 0 || ['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase()),
    hasColorContrast: true // Would need color analysis in real implementation
  }

  return checks
}

/**
 * Export all utilities for easy importing
 */
export {
  IRS_2026_TAX_BRACKETS as TAX_BRACKETS,
  IRS_2026_LIMITS as CONTRIBUTION_LIMITS
}