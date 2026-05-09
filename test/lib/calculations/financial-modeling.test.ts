/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Financial Modeling Test Suite
 */

import { describe, it, expect, vi } from 'vitest'
import FinancialModeling, {
  TaxBracket,
} from '@/lib/calculations/financial-modeling'
// Side-effect import: registers `toBeCloseToCurrency` and `toMatchTaxCalculation` matchers.
import '../../utils/financial-test-helpers'

describe('FinancialModeling', () => {
  describe('calculateProgressiveTax', () => {
    const testBrackets: TaxBracket[] = [
      { min: 0, max: 10000, rate: 0.10 },
      { min: 10000, max: 40000, rate: 0.20 },
      { min: 40000, max: Infinity, rate: 0.30 },
    ]

    it('should sum tax across bracket boundaries', () => {
      // First bracket only
      expect(FinancialModeling.calculateProgressiveTax(5000, testBrackets)).toBe(500)
      // Crosses into second bracket: 1000 + 3000
      expect(FinancialModeling.calculateProgressiveTax(25000, testBrackets)).toBe(4000)
      // Crosses into third bracket: 1000 + 6000 + 6000
      expect(FinancialModeling.calculateProgressiveTax(60000, testBrackets)).toBe(13000)
    })

    it('should handle edge cases and round to nearest integer', () => {
      expect(FinancialModeling.calculateProgressiveTax(0, testBrackets)).toBe(0)
      expect(FinancialModeling.calculateProgressiveTax(-1000, testBrackets)).toBe(0)
      // Exactly at bracket boundary
      expect(FinancialModeling.calculateProgressiveTax(10000, testBrackets)).toBe(1000)

      const oddBrackets: TaxBracket[] = [{ min: 0, max: Infinity, rate: 0.333 }]
      expect(FinancialModeling.calculateProgressiveTax(1000, oddBrackets)).toBe(333)
    })
  })

  describe('calculateFederalTax', () => {
    it('should match the IRS bracket-walked calculation across filing statuses', () => {
      // Custom matcher walks the canonical 2026 brackets and standard deduction.
      expect(FinancialModeling.calculateFederalTax(50000, 'single', 2026))
        .toMatchTaxCalculation(50000, 'single')
      expect(FinancialModeling.calculateFederalTax(100000, 'marriedFilingJointly', 2026))
        .toMatchTaxCalculation(100000, 'marriedFilingJointly')
      expect(FinancialModeling.calculateFederalTax(200000, 'single', 2026))
        .toMatchTaxCalculation(200000, 'single')
    })

    it('should apply standard deduction (zero tax below it)', () => {
      // 2026 single std ded = $16,100
      expect(FinancialModeling.calculateFederalTax(10000, 'single', 2026)).toBe(0)
      expect(FinancialModeling.calculateFederalTax(16100, 'single', 2026)).toBe(0)
      // 2026 MFJ std ded = $32,200
      expect(FinancialModeling.calculateFederalTax(20000, 'marriedFilingJointly', 2026)).toBe(0)
    })

    it('should produce single > MFJ tax at the same income', () => {
      const single = FinancialModeling.calculateFederalTax(100000, 'single', 2026)
      const married = FinancialModeling.calculateFederalTax(100000, 'marriedFilingJointly', 2026)
      expect(single).toBeGreaterThan(married)
    })

    it('should bound high-income tax below the 37% flat rate', () => {
      const tax = FinancialModeling.calculateFederalTax(1000000, 'single', 2026)
      expect(tax).toBeGreaterThan(300000)
      expect(tax).toBeLessThan(1000000 * 0.37)
    })

    it('should warn about unsupported tax years', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      FinancialModeling.calculateFederalTax(50000, 'single', 2023)
      expect(consoleSpy).toHaveBeenCalledWith('Tax calculation only supports 2026 tax year, got 2023')
      consoleSpy.mockRestore()
    })

    it('should handle zero/negative income', () => {
      expect(FinancialModeling.calculateFederalTax(0, 'single', 2026)).toBe(0)
      expect(FinancialModeling.calculateFederalTax(-1000, 'single', 2026)).toBe(0)
    })
  })

  describe('calculateCaliforniaTax', () => {
    it('should compute positive tax bounded below the top CA rate', () => {
      const tax = FinancialModeling.calculateCaliforniaTax(75000, 'single')
      expect(tax).toBeGreaterThan(0)
      expect(tax).toBeLessThan(75000 * 0.133)
    })

    it('should apply CA standard deduction (zero tax below it) and produce single > MFJ', () => {
      // CA single std ded = $5,202; MFJ = $10,404
      expect(FinancialModeling.calculateCaliforniaTax(3000, 'single')).toBe(0)
      expect(FinancialModeling.calculateCaliforniaTax(8000, 'marriedFilingJointly')).toBe(0)

      const single = FinancialModeling.calculateCaliforniaTax(100000, 'single')
      const married = FinancialModeling.calculateCaliforniaTax(100000, 'marriedFilingJointly')
      expect(single).toBeGreaterThan(married)
    })
  })

  describe('calculateTaxAnalysis', () => {
    it('should aggregate federal + state tax correctly', () => {
      const income = 100000
      const analysis = FinancialModeling.calculateTaxAnalysis(income, 'single', 'CA')

      expect(analysis.federalTax).toBeGreaterThan(0)
      expect(analysis.stateTax).toBeGreaterThan(0)
      expect(analysis.totalTax).toBe(analysis.federalTax + analysis.stateTax)
      expect(analysis.afterTaxIncome).toBe(income - analysis.totalTax)
      expect(analysis.effectiveRate).toBe(analysis.totalTax / income)
      expect(analysis.marginalRate).toBeGreaterThan(0)
      expect(analysis.marginalRate).toBeLessThan(1)
      // Marginal > effective for progressive tax
      expect(analysis.marginalRate).toBeGreaterThan(analysis.effectiveRate)
    })

    it('should treat unimplemented states as zero state tax (federal unchanged)', () => {
      const income = 75000
      const ca = FinancialModeling.calculateTaxAnalysis(income, 'single', 'CA')
      const tx = FinancialModeling.calculateTaxAnalysis(income, 'single', 'TX')

      expect(ca.stateTax).toBeGreaterThan(0)
      expect(tx.stateTax).toBe(0)
      expect(tx.federalTax).toBe(ca.federalTax)
    })

    it('should handle zero income', () => {
      const analysis = FinancialModeling.calculateTaxAnalysis(0, 'single', 'CA')
      expect(analysis.federalTax).toBe(0)
      expect(analysis.stateTax).toBe(0)
      expect(analysis.totalTax).toBe(0)
      expect(analysis.afterTaxIncome).toBe(0)
      expect(analysis.effectiveRate).toBe(0)
    })
  })

  describe('calculateMarginalTaxRate', () => {
    it('should rise with income and combine federal + state rates', () => {
      // Low: 10% federal + 1% CA
      expect(FinancialModeling.calculateMarginalTaxRate(20000, 'single', 'CA'))
        .toBeCloseToCurrency(0.11, 0.01)

      const middle = FinancialModeling.calculateMarginalTaxRate(75000, 'single', 'CA')
      expect(middle).toBeGreaterThan(0.20)
      expect(middle).toBeLessThan(0.35)

      const high = FinancialModeling.calculateMarginalTaxRate(500000, 'single', 'CA')
      expect(high).toBeGreaterThan(0.40)
    })

    it('should be lower for non-implemented states (federal-only) and lower for MFJ', () => {
      const ca = FinancialModeling.calculateMarginalTaxRate(100000, 'single', 'CA')
      const tx = FinancialModeling.calculateMarginalTaxRate(100000, 'single', 'TX')
      const married = FinancialModeling.calculateMarginalTaxRate(100000, 'marriedFilingJointly', 'CA')

      expect(tx).toBeLessThan(ca)
      expect(tx).toBeGreaterThan(0.20) // Federal marginal still applies
      expect(married).toBeLessThan(ca)
    })
  })

  describe('validateTaxOptimizationStrategy', () => {
    it('should recommend tax-advantaged investing for high earners (above 22% threshold)', () => {
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(150000, 'single')
      expect(strategy.shouldMaxTaxAdvantaged).toBe(true)
      expect(strategy.marginalRate).toBeGreaterThan(0.22)
      expect(strategy.taxSavingsOpportunity).toBeCloseToCurrency(1000 * strategy.marginalRate, 2)
      expect(strategy.reasoning).toContain('tax-advantaged')
      expect(strategy.reasoning).toContain('401k')
    })

    it('should recommend flexibility for lower earners (at/below 22% threshold)', () => {
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(40000, 'single')
      expect(strategy.shouldMaxTaxAdvantaged).toBe(false)
      expect(strategy.marginalRate).toBeLessThanOrEqual(0.22)
      expect(strategy.reasoning).toContain('flexibility')
      expect(strategy.reasoning).toContain('diversification')
    })
  })

  describe('calculateEmergencyFundOpportunityCost', () => {
    it('should compute fund size, opportunity cost, and apply BufoIndex 3-month cap', () => {
      const monthlyExpenses = 4000
      const expectedReturn = 0.07
      const timeHorizon = 30

      // Excessive (12 months): cap to 3, includes contrarian reasoning
      const excessive = FinancialModeling.calculateEmergencyFundOpportunityCost(
        monthlyExpenses, 12, expectedReturn, timeHorizon
      )
      expect(excessive.emergencyFundSize).toBe(48000) // 4000 * 12
      expect(excessive.opportunityCost).toBeGreaterThan(0)
      expect(excessive.recommendedMonths).toBe(3)
      expect(excessive.reasoning).toContain('BufoIndex recommends max 3 months')

      // Aligned (3 months and 2 months): philosophy-aligned reasoning
      expect(FinancialModeling.calculateEmergencyFundOpportunityCost(monthlyExpenses, 3).recommendedMonths).toBe(3)
      const minimal = FinancialModeling.calculateEmergencyFundOpportunityCost(monthlyExpenses, 2)
      expect(minimal.recommendedMonths).toBe(2)
      expect(minimal.reasoning).toContain('aligns with BufoIndex philosophy')
    })

    it('should compound opportunity cost correctly (FV - principal)', () => {
      const analysis = FinancialModeling.calculateEmergencyFundOpportunityCost(3000, 6, 0.08, 25)
      const principal = 18000 // 3000 * 6
      const expectedFV = principal * Math.pow(1.08, 25)
      expect(analysis.opportunityCost).toBeCloseToCurrency(expectedFV - principal, 2)
    })

    it('should handle zero edge cases', () => {
      expect(FinancialModeling.calculateEmergencyFundOpportunityCost(0, 6).opportunityCost).toBe(0)
      expect(FinancialModeling.calculateEmergencyFundOpportunityCost(4000, 0).opportunityCost).toBe(0)
      expect(FinancialModeling.calculateEmergencyFundOpportunityCost(4000, 6, 0.07, 0).opportunityCost).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format with $ prefix, no decimals, and handle negatives', () => {
      expect(FinancialModeling.formatCurrency(0)).toBe('$0')
      expect(FinancialModeling.formatCurrency(1234.56)).toBe('$1,235')
      expect(FinancialModeling.formatCurrency(1000000)).toBe('$1,000,000')
      expect(FinancialModeling.formatCurrency(-1234.56)).toBe('-$1,235')
    })
  })

  describe('browser compatibility', () => {
    it('should attach to window when available', () => {
      if (typeof window !== 'undefined') {
        expect((window as any).FinancialModeling).toBe(FinancialModeling)
      }
    })
  })
})
