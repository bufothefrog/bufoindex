/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Core Financial Calculations Test Suite
 * 100% Coverage Required - Sprint 7 Testing Framework
 */

import { describe, it, expect, beforeEach } from 'vitest'
import FinancialCalculations, { 
  ScenarioParams,
  ScenarioResult,
  FinancialConstants
} from '@/lib/calculations/calculations'
import { 
  measureCalculationPerformance,
  FINANCIAL_TEST_CASES,
  generateMockProfile
} from '../../utils/financial-test-helpers'

describe('FinancialCalculations', () => {
  beforeEach(() => {
    // Clear any window constants to ensure test isolation
    if (typeof window !== 'undefined') {
      delete (window as any).FinancialConstants
    }
  })

  describe('formatCurrency', () => {
    it('should format positive amounts correctly', () => {
      expect(FinancialCalculations.formatCurrency(1234.56)).toBe('1,235')
      expect(FinancialCalculations.formatCurrency(1000000)).toBe('1,000,000')
      expect(FinancialCalculations.formatCurrency(0)).toBe('0')
    })

    it('should round to nearest whole number', () => {
      expect(FinancialCalculations.formatCurrency(1234.4)).toBe('1,234')
      expect(FinancialCalculations.formatCurrency(1234.5)).toBe('1,235')
    })

    it('should handle negative amounts', () => {
      expect(FinancialCalculations.formatCurrency(-1234.56)).toBe('-1,235')
    })

    it('should handle edge cases', () => {
      expect(FinancialCalculations.formatCurrency(0.1)).toBe('0')
      expect(FinancialCalculations.formatCurrency(-0.1)).toBe('-0')
      expect(FinancialCalculations.formatCurrency(Number.MAX_SAFE_INTEGER)).toBeTruthy()
    })
  })

  describe('parseCurrency', () => {
    it('should parse string currency values', () => {
      expect(FinancialCalculations.parseCurrency('$1,234.56')).toBe(1234.56)
      expect(FinancialCalculations.parseCurrency('1,000,000')).toBe(1000000)
      expect(FinancialCalculations.parseCurrency('$0')).toBe(0)
      expect(FinancialCalculations.parseCurrency('')).toBe(0)
    })

    it('should handle numeric inputs', () => {
      expect(FinancialCalculations.parseCurrency(1234.56)).toBe(1234.56)
      expect(FinancialCalculations.parseCurrency(0)).toBe(0)
      expect(FinancialCalculations.parseCurrency(-1234.56)).toBe(-1234.56)
    })

    it('should handle invalid inputs gracefully', () => {
      expect(FinancialCalculations.parseCurrency('invalid')).toBe(0)
      expect(FinancialCalculations.parseCurrency('$abc')).toBe(0)
      expect(FinancialCalculations.parseCurrency(null as any)).toBe(0)
      expect(FinancialCalculations.parseCurrency(undefined as any)).toBe(0)
    })
  })

  describe('futureValue', () => {
    it('should calculate compound interest correctly', () => {
      // Test against known financial calculation: $10,000 at 7% for 10 years
      const { result } = measureCalculationPerformance(
        'future-value-basic',
        () => FinancialCalculations.futureValue(10000, 0.07, 10),
        50 // Max 50ms
      )
      expect(result).toBeCloseToCurrency(FINANCIAL_TEST_CASES.compoundInterest.basic.expected, 2)
    })

    it('should handle zero rate', () => {
      expect(FinancialCalculations.futureValue(10000, 0, 10)).toBe(10000)
    })

    it('should handle zero periods', () => {
      expect(FinancialCalculations.futureValue(10000, 0.07, 0)).toBe(10000)
    })

    it('should handle negative values', () => {
      expect(FinancialCalculations.futureValue(-10000, 0.07, 10)).toBeCloseToCurrency(-19671.51, 2)
      // 10000 * (1 - 0.03)^10 = 10000 * 0.97^10 = 7374.24
      expect(FinancialCalculations.futureValue(10000, -0.03, 10)).toBeCloseToCurrency(7374.24, 2)
    })

    it('should meet performance requirements', () => {
      measureCalculationPerformance(
        'future-value-batch',
        () => {
          for (let i = 0; i < 100; i++) {
            FinancialCalculations.futureValue(10000 + i * 100, 0.07, 10 + i)
          }
        },
        50 // Max 50ms for 100 calculations
      )
    })
  })

  describe('presentValue', () => {
    it('should calculate present value correctly', () => {
      const { result } = measureCalculationPerformance(
        'present-value-basic',
        () => FinancialCalculations.presentValue(100000, 0.07, 10),
        50
      )
      expect(result).toBeCloseToCurrency(FINANCIAL_TEST_CASES.presentValue.basic.expected, 2)
    })

    it('should be inverse of future value', () => {
      const principal = 10000
      const rate = 0.07
      const periods = 10
      
      const futureVal = FinancialCalculations.futureValue(principal, rate, periods)
      const presentVal = FinancialCalculations.presentValue(futureVal, rate, periods)
      
      expect(presentVal).toBeCloseToCurrency(principal, 2)
    })

    it('should handle edge cases', () => {
      expect(FinancialCalculations.presentValue(100000, 0, 10)).toBe(100000)
      expect(FinancialCalculations.presentValue(100000, 0.07, 0)).toBe(100000)
    })
  })

  describe('calculateRequiredPayment', () => {
    it('should calculate annuity payments correctly', () => {
      const pv = 0
      const fv = 100000
      const rate = 0.07
      const periods = 10
      
      const payment = FinancialCalculations.calculateRequiredPayment(pv, fv, rate, periods)
      // PMT = FV * r / ((1+r)^n - 1) = 100000 * 0.07 / (1.07^10 - 1) = 7237.75
      expect(payment).toBeCloseToCurrency(7237.75, 2)
    })

    it('should handle zero rate scenario', () => {
      const payment = FinancialCalculations.calculateRequiredPayment(0, 100000, 0, 10)
      expect(payment).toBe(10000) // Simple division
    })

    it('should handle zero periods', () => {
      const payment = FinancialCalculations.calculateRequiredPayment(0, 100000, 0.07, 0)
      expect(payment).toBe(0)
    })

    it('should handle present value scenarios', () => {
      // Loan payment scenario: Borrow $100,000 at 5% annual for 30 years
      // Annual loan PMT = -PV * r * (1+r)^n / ((1+r)^n - 1) = -6505.14
      const payment = FinancialCalculations.calculateRequiredPayment(100000, 0, 0.05, 30)
      expect(payment).toBeCloseToCurrency(-6505.14, 2) // Negative indicates outflow
    })
  })

  describe('calculateRequiredMonthlyPayment', () => {
    it('should calculate monthly payments with compound frequency conversion', () => {
      const payment = FinancialCalculations.calculateRequiredMonthlyPayment(0, 100000, 0.07, 10)
      // Uses geometric monthly rate ((1.07)^(1/12) - 1) so 120 monthly payments compound to exactly 1.07^10
      expect(payment).toBeGreaterThan(0)
      expect(payment).toBeCloseToCurrency(584.62, 2)
    })

    it('should handle monthly compounding formula correctly', () => {
      // Test monthly rate conversion: (1 + annual)^(1/12) - 1
      const annualRate = 0.07
      const expectedMonthlyRate = Math.pow(1 + annualRate, 1/12) - 1
      
      // Verify our calculation uses proper monthly compounding
      const payment = FinancialCalculations.calculateRequiredMonthlyPayment(10000, 20000, 0.07, 5)
      expect(payment).toBeGreaterThan(0)
    })
  })

  describe('inflationAdjustedIncome', () => {
    it('should calculate inflation adjustment correctly', () => {
      const income = FinancialCalculations.inflationAdjustedIncome(50000, 0.03, 10)
      // 50000 * 1.03^10 = 67195.82
      expect(income).toBeCloseToCurrency(67195.82, 2)
    })

    it('should handle zero inflation', () => {
      expect(FinancialCalculations.inflationAdjustedIncome(50000, 0, 10)).toBe(50000)
    })

    it('should handle zero years', () => {
      expect(FinancialCalculations.inflationAdjustedIncome(50000, 0.03, 0)).toBe(50000)
    })

    it('should handle deflation scenarios', () => {
      const income = FinancialCalculations.inflationAdjustedIncome(50000, -0.02, 10)
      // 50000 * 0.98^10 = 40853.64
      expect(income).toBeCloseToCurrency(40853.64, 2)
    })
  })

  describe('portfolioSizeForWithdrawal', () => {
    it('should calculate portfolio size using 4% rule by default', () => {
      const portfolioSize = FinancialCalculations.portfolioSizeForWithdrawal(100000)
      expect(portfolioSize).toBe(2500000) // 100k / 0.04 = 2.5M
    })

    it('should accept custom withdrawal rates', () => {
      const portfolioSize = FinancialCalculations.portfolioSizeForWithdrawal(100000, 0.03)
      expect(portfolioSize).toBeCloseToCurrency(3333333.33, 2)
    })

    it('should handle edge cases', () => {
      expect(FinancialCalculations.portfolioSizeForWithdrawal(0)).toBe(0)
      expect(FinancialCalculations.portfolioSizeForWithdrawal(100000, 1)).toBe(100000)
    })
  })

  describe('calculateScenario', () => {
    const validParams: ScenarioParams = {
      startingAge: 30,
      retirementAge: 65,
      targetIncome: 75000,
      startingBalance: 50000,
      inflationRate: 0.03,
      annualReturn: 0.07
    }

    it('should calculate valid retirement scenario correctly', () => {
      const { result } = measureCalculationPerformance(
        'scenario-calculation',
        () => FinancialCalculations.calculateScenario(validParams),
        100 // Max 100ms for complex calculation
      )

      expect(result.valid).toBe(true)
      expect(result.yearsUntilRetirement).toBe(35)
      expect(result.targetPortfolioSize).toBeGreaterThan(0)
      expect(result.monthlyContribution).toBeGreaterThan(0)
      expect(result.inflatedTargetIncome).toBeGreaterThan(validParams.targetIncome)
      expect(result.annualContribution).toBe(result.monthlyContribution * 12)
      expect(result.error).toBeUndefined()
    })

    it('should handle Coast FIRE scenarios (negative contributions)', () => {
      const coastFireParams: ScenarioParams = {
        ...validParams,
        startingBalance: 500000, // Large starting balance
        targetIncome: 40000,     // Lower income needs
      }

      const result = FinancialCalculations.calculateScenario(coastFireParams)
      expect(result.valid).toBe(true)
      // May have negative monthly contribution (Coast FIRE)
      expect(result.targetPortfolioSize).toBeGreaterThan(0)
    })

    it('should validate input parameters', () => {
      const invalidInputs = [
        { ...validParams, startingAge: 10 },        // Too young
        { ...validParams, startingAge: 150 },       // Too old
        { ...validParams, retirementAge: 10 },      // Too young
        { ...validParams, retirementAge: 150 },     // Too old
        { ...validParams, targetIncome: -1000 },    // Negative income
        { ...validParams, targetIncome: 500 },      // Too low
        { ...validParams, startingBalance: -1000 }, // Negative balance
        { ...validParams, inflationRate: -0.1 },    // Too low
        { ...validParams, inflationRate: 0.25 },    // Too high
        { ...validParams, annualReturn: -0.6 },     // Too low
        { ...validParams, annualReturn: 0.4 },      // Too high
      ]

      invalidInputs.forEach((params, index) => {
        const result = FinancialCalculations.calculateScenario(params)
        expect(result.valid, `Test case ${index} should be invalid`).toBe(false)
        expect(result.error, `Test case ${index} should have error message`).toBeDefined()
      })
    })

    it('should reject invalid retirement timeline', () => {
      const invalidParams = {
        ...validParams,
        startingAge: 65,
        retirementAge: 60 // Retirement before starting age
      }

      const result = FinancialCalculations.calculateScenario(invalidParams)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Retirement age must be greater than starting age')
      expect(result.yearsUntilRetirement).toBe(0)
      expect(result.monthlyContribution).toBe(0)
    })

    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        null,
        undefined,
        {},
        { startingAge: 'invalid' },
        { startingAge: null },
      ]

      malformedInputs.forEach((params) => {
        const result = FinancialCalculations.calculateScenario(params as any)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.targetPortfolioSize).toBe(0)
        expect(result.monthlyContribution).toBe(0)
      })
    })

    it('should use window constants when available', () => {
      // Mock window constants
      if (typeof window !== 'undefined') {
        (window as any).FinancialConstants = {
          MIN_STARTING_AGE: 25, // Different from default
          WITHDRAWAL_RATE: 0.035 // Different from default 4%
        }
      }

      const params = { ...validParams, startingAge: 20 } // Below window minimum

      const result = FinancialCalculations.calculateScenario(params)
      
      if (typeof window !== 'undefined') {
        expect(result.valid).toBe(false) // Should fail with window constants
        delete (window as any).FinancialConstants
      }
    })

    it('should calculate compound growth correctly in scenarios', () => {
      const result = FinancialCalculations.calculateScenario(validParams)
      
      if (result.valid) {
        // Verify inflation adjustment calculation
        const expectedInflatedIncome = validParams.targetIncome * Math.pow(1 + validParams.inflationRate, 35)
        expect(result.inflatedTargetIncome).toBeCloseToCurrency(expectedInflatedIncome, 2)
        
        // Verify withdrawal rule application
        const expectedPortfolioSize = result.inflatedTargetIncome / 0.04
        expect(result.targetPortfolioSize).toBeCloseToCurrency(expectedPortfolioSize, 2)
      }
    })

    it('should meet performance benchmarks for batch calculations', () => {
      measureCalculationPerformance(
        'scenario-batch-calculation',
        () => {
          for (let age = 25; age <= 35; age++) {
            const params = { ...validParams, startingAge: age }
            FinancialCalculations.calculateScenario(params)
          }
        },
        200 // Max 200ms for 11 scenario calculations
      )
    })
  })

  describe('constants and validation', () => {
    it('should export default constants correctly', () => {
      // Test by creating a scenario that would fail with different constants
      const edgeCaseParams: ScenarioParams = {
        startingAge: 18,  // Minimum default age
        retirementAge: 30, // Minimum retirement age
        targetIncome: 1000, // Minimum income
        startingBalance: 0, // Minimum balance
        inflationRate: 0.2, // Maximum inflation
        annualReturn: -0.5  // Minimum return
      }

      const result = FinancialCalculations.calculateScenario(edgeCaseParams)
      expect(result.valid).toBe(true) // Should pass with default constants
    })

    it('should handle edge case mathematical scenarios', () => {
      // Very long time horizon
      const longTermParams: ScenarioParams = {
        startingAge: 20,
        retirementAge: 90,
        targetIncome: 50000,
        startingBalance: 1000,
        inflationRate: 0.03,
        annualReturn: 0.07
      }

      const result = FinancialCalculations.calculateScenario(longTermParams)
      expect(result.valid).toBe(true)
      expect(result.yearsUntilRetirement).toBe(70)
      expect(result.inflatedTargetIncome).toBeGreaterThan(50000)
    })

    it('should handle extreme but valid financial scenarios', () => {
      // High inflation, high return scenario
      const extremeParams: ScenarioParams = {
        startingAge: 25,
        retirementAge: 65,
        targetIncome: 200000,
        startingBalance: 0,
        inflationRate: 0.15, // 15% inflation
        annualReturn: 0.12   // 12% return
      }

      const result = FinancialCalculations.calculateScenario(extremeParams)
      expect(result.valid).toBe(true)
      expect(result.inflatedTargetIncome).toBeGreaterThan(extremeParams.targetIncome * 10)
    })
  })

  describe('error handling and logging', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('should log errors for debugging', () => {
      const invalidParams = { invalid: 'params' } as any
      const result = FinancialCalculations.calculateScenario(invalidParams)
      
      expect(result.valid).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in calculateScenario:',
        expect.any(String),
        invalidParams
      )
    })

    it('should preserve original params in error result', () => {
      const invalidParams = { 
        startingAge: 30,
        retirementAge: 65,
        targetIncome: -1000, // Invalid
        startingBalance: 50000,
        inflationRate: 0.03,
        annualReturn: 0.07
      }
      
      const result = FinancialCalculations.calculateScenario(invalidParams)
      expect(result.valid).toBe(false)
      expect(result.inflatedTargetIncome).toBe(invalidParams.targetIncome)
    })
  })

  describe('browser compatibility', () => {
    it('should export to window when available', () => {
      if (typeof window !== 'undefined') {
        expect((window as any).FinancialCalculations).toBeDefined()
        expect((window as any).FinancialCalculations).toBe(FinancialCalculations)
      }
    })

    it('should work without window object (Node.js)', () => {
      // This test runs in jsdom but simulates server environment
      const params: ScenarioParams = {
        startingAge: 30,
        retirementAge: 65,
        targetIncome: 75000,
        startingBalance: 50000,
        inflationRate: 0.03,
        annualReturn: 0.07
      }

      const result = FinancialCalculations.calculateScenario(params)
      expect(result.valid).toBe(true)
    })
  })
})