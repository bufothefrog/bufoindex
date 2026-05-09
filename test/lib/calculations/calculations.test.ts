/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Core Financial Calculations Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import FinancialCalculations, {
  ScenarioParams,
} from '@/lib/calculations/calculations'
import {
  FINANCIAL_TEST_CASES,
} from '../../utils/financial-test-helpers'

describe('FinancialCalculations', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      delete (window as any).FinancialConstants
    }
  })

  describe('formatCurrency', () => {
    it('should format representative cases correctly', () => {
      // zero, normal, large with separators, negative, sub-cent rounding
      expect(FinancialCalculations.formatCurrency(0)).toBe('0')
      expect(FinancialCalculations.formatCurrency(1234.56)).toBe('1,235')
      expect(FinancialCalculations.formatCurrency(1000000)).toBe('1,000,000')
      expect(FinancialCalculations.formatCurrency(-1234.56)).toBe('-1,235')
      expect(FinancialCalculations.formatCurrency(0.1)).toBe('0')
    })
  })

  describe('parseCurrency', () => {
    it('should parse strings, numbers, and invalid inputs gracefully', () => {
      expect(FinancialCalculations.parseCurrency('$1,234.56')).toBe(1234.56)
      expect(FinancialCalculations.parseCurrency('')).toBe(0)
      expect(FinancialCalculations.parseCurrency(-1234.56)).toBe(-1234.56)
      expect(FinancialCalculations.parseCurrency('invalid')).toBe(0)
      expect(FinancialCalculations.parseCurrency(null as any)).toBe(0)
      expect(FinancialCalculations.parseCurrency(undefined as any)).toBe(0)
    })
  })

  describe('futureValue', () => {
    it('should compute compound interest for a known TVM case', () => {
      // $10,000 at 7% for 10 years
      const result = FinancialCalculations.futureValue(10000, 0.07, 10)
      expect(result).toBeCloseToCurrency(FINANCIAL_TEST_CASES.compoundInterest.basic.expected, 2)
    })

    it('should handle boundary cases (zero rate, zero periods, deflation, negative principal)', () => {
      expect(FinancialCalculations.futureValue(10000, 0, 10)).toBe(10000)
      expect(FinancialCalculations.futureValue(10000, 0.07, 0)).toBe(10000)
      // 10000 * 0.97^10
      expect(FinancialCalculations.futureValue(10000, -0.03, 10)).toBeCloseToCurrency(7374.24, 2)
      expect(FinancialCalculations.futureValue(-10000, 0.07, 10)).toBeCloseToCurrency(-19671.51, 2)
    })
  })

  describe('presentValue', () => {
    it('should be the inverse of future value and handle boundary cases', () => {
      const principal = 10000
      const rate = 0.07
      const periods = 10
      const fv = FinancialCalculations.futureValue(principal, rate, periods)
      expect(FinancialCalculations.presentValue(fv, rate, periods)).toBeCloseToCurrency(principal, 2)

      expect(FinancialCalculations.presentValue(100000, 0, 10)).toBe(100000)
      expect(FinancialCalculations.presentValue(100000, 0.07, 0)).toBe(100000)
    })

    it('should compute basic PV correctly', () => {
      const result = FinancialCalculations.presentValue(100000, 0.07, 10)
      expect(result).toBeCloseToCurrency(FINANCIAL_TEST_CASES.presentValue.basic.expected, 2)
    })
  })

  describe('calculateRequiredPayment', () => {
    it('should compute annuity payment, handle zero rate, zero periods, and loan scenario', () => {
      // PMT = FV * r / ((1+r)^n - 1) = 100000 * 0.07 / (1.07^10 - 1)
      expect(FinancialCalculations.calculateRequiredPayment(0, 100000, 0.07, 10))
        .toBeCloseToCurrency(7237.75, 2)
      expect(FinancialCalculations.calculateRequiredPayment(0, 100000, 0, 10)).toBe(10000)
      expect(FinancialCalculations.calculateRequiredPayment(0, 100000, 0.07, 0)).toBe(0)
      // Loan: $100k @ 5% for 30 years => -6505.14 annual outflow
      expect(FinancialCalculations.calculateRequiredPayment(100000, 0, 0.05, 30))
        .toBeCloseToCurrency(-6505.14, 2)
    })
  })

  describe('calculateRequiredMonthlyPayment', () => {
    it('should compute monthly payment with geometric monthly rate', () => {
      // 120 monthly payments compound to exactly 1.07^10
      const payment = FinancialCalculations.calculateRequiredMonthlyPayment(0, 100000, 0.07, 10)
      expect(payment).toBeCloseToCurrency(584.62, 2)
    })
  })

  describe('inflationAdjustedIncome', () => {
    it('should handle inflation, deflation, and zero cases', () => {
      // 50000 * 1.03^10
      expect(FinancialCalculations.inflationAdjustedIncome(50000, 0.03, 10)).toBeCloseToCurrency(67195.82, 2)
      expect(FinancialCalculations.inflationAdjustedIncome(50000, 0, 10)).toBe(50000)
      expect(FinancialCalculations.inflationAdjustedIncome(50000, 0.03, 0)).toBe(50000)
      // Deflation: 50000 * 0.98^10
      expect(FinancialCalculations.inflationAdjustedIncome(50000, -0.02, 10)).toBeCloseToCurrency(40853.64, 2)
    })
  })

  describe('portfolioSizeForWithdrawal', () => {
    it('should apply 4% rule by default and accept custom rates / edge cases', () => {
      expect(FinancialCalculations.portfolioSizeForWithdrawal(100000)).toBe(2500000)
      expect(FinancialCalculations.portfolioSizeForWithdrawal(100000, 0.03))
        .toBeCloseToCurrency(3333333.33, 2)
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

    it('should calculate a valid retirement scenario with correct compound math', () => {
      const result = FinancialCalculations.calculateScenario(validParams)

      expect(result.valid).toBe(true)
      expect(result.yearsUntilRetirement).toBe(35)
      expect(result.targetPortfolioSize).toBeGreaterThan(0)
      expect(result.monthlyContribution).toBeGreaterThan(0)
      expect(result.annualContribution).toBe(result.monthlyContribution * 12)
      expect(result.error).toBeUndefined()

      // Verify inflation adjustment + 4% withdrawal rule
      const expectedInflated = validParams.targetIncome * Math.pow(1 + validParams.inflationRate, 35)
      expect(result.inflatedTargetIncome).toBeCloseToCurrency(expectedInflated, 2)
      expect(result.targetPortfolioSize).toBeCloseToCurrency(result.inflatedTargetIncome / 0.04, 2)
    })

    it('should support Coast FIRE (large starting balance, low income needs)', () => {
      const result = FinancialCalculations.calculateScenario({
        ...validParams,
        startingBalance: 500000,
        targetIncome: 40000,
      })
      expect(result.valid).toBe(true)
      expect(result.targetPortfolioSize).toBeGreaterThan(0)
    })

    it('should reject invalid input parameters', () => {
      const invalidInputs: ScenarioParams[] = [
        { ...validParams, startingAge: 10 },        // Too young
        { ...validParams, startingAge: 150 },       // Too old
        { ...validParams, retirementAge: 10 },      // Too young
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
        expect(result.valid, `case ${index}`).toBe(false)
        expect(result.error, `case ${index}`).toBeDefined()
      })
    })

    it('should reject retirement age <= starting age', () => {
      const result = FinancialCalculations.calculateScenario({
        ...validParams,
        startingAge: 65,
        retirementAge: 60,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Retirement age must be greater than starting age')
      expect(result.yearsUntilRetirement).toBe(0)
      expect(result.monthlyContribution).toBe(0)
    })

    it('should handle malformed input (null/undefined/wrong types) gracefully', () => {
      const malformedInputs = [null, undefined, {}, { startingAge: 'invalid' }, { startingAge: null }]

      malformedInputs.forEach((params) => {
        const result = FinancialCalculations.calculateScenario(params as any)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.targetPortfolioSize).toBe(0)
        expect(result.monthlyContribution).toBe(0)
      })
    })

    it('should respect window-injected FinancialConstants overrides', () => {
      if (typeof window === 'undefined') return

      ;(window as any).FinancialConstants = {
        MIN_STARTING_AGE: 25,
        WITHDRAWAL_RATE: 0.035,
      }

      const result = FinancialCalculations.calculateScenario({ ...validParams, startingAge: 20 })
      expect(result.valid).toBe(false)
      delete (window as any).FinancialConstants
    })
  })

  describe('error handling', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('should log errors and preserve original params on validation failure', () => {
      const invalidParams = {
        startingAge: 30,
        retirementAge: 65,
        targetIncome: -1000,
        startingBalance: 50000,
        inflationRate: 0.03,
        annualReturn: 0.07,
      }

      const result = FinancialCalculations.calculateScenario(invalidParams)

      expect(result.valid).toBe(false)
      expect(result.inflatedTargetIncome).toBe(invalidParams.targetIncome)
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('browser compatibility', () => {
    it('should attach to window when available', () => {
      if (typeof window !== 'undefined') {
        expect((window as any).FinancialCalculations).toBe(FinancialCalculations)
      }
    })
  })
})
