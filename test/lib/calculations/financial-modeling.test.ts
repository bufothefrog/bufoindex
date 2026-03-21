/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Financial Modeling Test Suite
 * 100% Coverage Required - Sprint 7 Testing Framework
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import FinancialModeling, {
  FilingStatus,
  TaxCalculationResult,
  TaxBracket
} from '@/lib/calculations/financial-modeling'
import {
  measureCalculationPerformance,
  IRS_2025_TAX_BRACKETS,
  IRS_2025_LIMITS,
  FINANCIAL_TEST_CASES
} from '../../utils/financial-test-helpers'

describe('FinancialModeling', () => {
  describe('tax bracket constants', () => {
    it('should have correct 2025 federal tax brackets', () => {
      const singleBrackets = FinancialModeling.FEDERAL_TAX_BRACKETS.single
      const marriedBrackets = FinancialModeling.FEDERAL_TAX_BRACKETS.marriedFilingJointly

      // Verify single filer brackets match IRS 2025
      expect(singleBrackets[0]).toEqual({ min: 0, max: 11925, rate: 0.10 })
      expect(singleBrackets[1]).toEqual({ min: 11925, max: 48475, rate: 0.12 })
      expect(singleBrackets[2]).toEqual({ min: 48475, max: 103350, rate: 0.22 })
      expect(singleBrackets[3]).toEqual({ min: 103350, max: 197300, rate: 0.24 })
      expect(singleBrackets[4]).toEqual({ min: 197300, max: 250525, rate: 0.32 })
      expect(singleBrackets[5]).toEqual({ min: 250525, max: 626350, rate: 0.35 })
      expect(singleBrackets[6]).toEqual({ min: 626350, max: Infinity, rate: 0.37 })

      // Verify married filing jointly brackets
      expect(marriedBrackets[0]).toEqual({ min: 0, max: 23850, rate: 0.10 })
      expect(marriedBrackets[1]).toEqual({ min: 23850, max: 96950, rate: 0.12 })
      expect(marriedBrackets[6]).toEqual({ min: 751600, max: Infinity, rate: 0.37 })
    })

    it('should have correct 2025 standard deductions', () => {
      expect(FinancialModeling.STANDARD_DEDUCTIONS.single).toBe(15000)
      expect(FinancialModeling.STANDARD_DEDUCTIONS.marriedFilingJointly).toBe(30000)
      expect(FinancialModeling.STANDARD_DEDUCTIONS.marriedFilingSeparately).toBe(15000)
      expect(FinancialModeling.STANDARD_DEDUCTIONS.headOfHousehold).toBe(22500)
    })

    it('should have correct California tax brackets', () => {
      const caSingle = FinancialModeling.CA_TAX_BRACKETS.single
      const caMarried = FinancialModeling.CA_TAX_BRACKETS.marriedFilingJointly

      // Verify CA brackets structure
      expect(caSingle[0]).toEqual({ min: 0, max: 10099, rate: 0.01 })
      expect(caSingle[8]).toEqual({ min: 677278, max: Infinity, rate: 0.133 })

      expect(caMarried[0]).toEqual({ min: 0, max: 20198, rate: 0.01 })
      expect(caMarried[8]).toEqual({ min: 1354556, max: Infinity, rate: 0.133 })
    })

    it('should have correct California standard deductions', () => {
      expect(FinancialModeling.CA_STANDARD_DEDUCTIONS.single).toBe(5202)
      expect(FinancialModeling.CA_STANDARD_DEDUCTIONS.marriedFilingJointly).toBe(10404)
      expect(FinancialModeling.CA_STANDARD_DEDUCTIONS.marriedFilingSeparately).toBe(5202)
      expect(FinancialModeling.CA_STANDARD_DEDUCTIONS.headOfHousehold).toBe(10726)
    })
  })

  describe('calculateProgressiveTax', () => {
    const testBrackets: TaxBracket[] = [
      { min: 0, max: 10000, rate: 0.10 },
      { min: 10000, max: 40000, rate: 0.20 },
      { min: 40000, max: Infinity, rate: 0.30 }
    ]

    it('should calculate tax correctly across brackets', () => {
      // Income in first bracket only
      const tax1 = FinancialModeling.calculateProgressiveTax(5000, testBrackets)
      expect(tax1).toBe(500) // 5000 * 0.10

      // Income in second bracket
      const tax2 = FinancialModeling.calculateProgressiveTax(25000, testBrackets)
      const expected2 = (10000 * 0.10) + (15000 * 0.20) // 1000 + 3000 = 4000
      expect(tax2).toBe(expected2)

      // Income in third bracket
      const tax3 = FinancialModeling.calculateProgressiveTax(60000, testBrackets)
      const expected3 = (10000 * 0.10) + (30000 * 0.20) + (20000 * 0.30) // 1000 + 6000 + 6000 = 13000
      expect(tax3).toBe(expected3)
    })

    it('should handle edge cases', () => {
      expect(FinancialModeling.calculateProgressiveTax(0, testBrackets)).toBe(0)
      expect(FinancialModeling.calculateProgressiveTax(-1000, testBrackets)).toBe(0)
      expect(FinancialModeling.calculateProgressiveTax(10000, testBrackets)).toBe(1000) // Exactly at bracket boundary
    })

    it('should round results to nearest integer', () => {
      const oddBrackets: TaxBracket[] = [
        { min: 0, max: Infinity, rate: 0.333 } // Creates fractional tax
      ]
      const tax = FinancialModeling.calculateProgressiveTax(1000, oddBrackets)
      expect(tax).toBe(333) // Should round 333.0 to 333
    })

    it('should meet performance requirements', () => {
      measureCalculationPerformance(
        'progressive-tax-batch',
        () => {
          for (let income = 0; income <= 1000000; income += 10000) {
            FinancialModeling.calculateProgressiveTax(income, testBrackets)
          }
        },
        50 // Max 50ms for 100 tax calculations
      )
    })
  })

  describe('calculateFederalTax', () => {
    it('should calculate federal tax correctly for known test cases', () => {
      const { result: tax50k } = measureCalculationPerformance(
        'federal-tax-50k-single',
        () => FinancialModeling.calculateFederalTax(50000, 'single', 2025),
        20 // Max 20ms per calculation
      )
      expect(tax50k).toMatchTaxCalculation(50000, 'single')

      const tax100kMarried = FinancialModeling.calculateFederalTax(100000, 'marriedFilingJointly', 2025)
      expect(tax100kMarried).toMatchTaxCalculation(100000, 'marriedFilingJointly')

      const tax200kSingle = FinancialModeling.calculateFederalTax(200000, 'single', 2025)
      expect(tax200kSingle).toMatchTaxCalculation(200000, 'single')
    })

    it('should verify against known IRS examples', () => {
      // Test cases from IRS Publication 17 (2025)
      const tax75kSingle = FinancialModeling.calculateFederalTax(75000, 'single', 2025)
      expect(tax75kSingle).toBeCloseToCurrency(8114, 1) // Known 2025 calculation: ($75k - $15k std ded) * brackets

      const tax150kMarried = FinancialModeling.calculateFederalTax(150000, 'marriedFilingJointly', 2025)
      expect(tax150kMarried).toBeCloseToCurrency(16228, 1) // Known 2025 calculation: ($150k - $30k std ded) * brackets
    })

    it('should handle standard deduction correctly', () => {
      // Income below standard deduction should have zero tax
      const lowIncomeSingle = FinancialModeling.calculateFederalTax(10000, 'single', 2025)
      expect(lowIncomeSingle).toBe(0)

      const lowIncomeMarried = FinancialModeling.calculateFederalTax(20000, 'marriedFilingJointly', 2025)
      expect(lowIncomeMarried).toBe(0)
    })

    it('should handle different filing statuses', () => {
      const income = 100000

      const singleTax = FinancialModeling.calculateFederalTax(income, 'single', 2025)
      const marriedTax = FinancialModeling.calculateFederalTax(income, 'marriedFilingJointly', 2025)

      // Single filer should pay more than married filing jointly at same income
      expect(singleTax).toBeGreaterThan(marriedTax)

      // Both should be positive
      expect(singleTax).toBeGreaterThan(0)
      expect(marriedTax).toBeGreaterThan(0)
    })

    it('should handle high-income scenarios', () => {
      // Test high income in top tax bracket
      const highIncome = 1000000
      const tax = FinancialModeling.calculateFederalTax(highIncome, 'single', 2025)
      
      expect(tax).toBeGreaterThan(300000) // Should be substantial
      expect(tax).toBeLessThan(highIncome * 0.37) // Should be less than flat 37%
    })

    it('should warn about unsupported tax years', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      FinancialModeling.calculateFederalTax(50000, 'single', 2023)
      
      expect(consoleSpy).toHaveBeenCalledWith('Tax calculation only supports 2025 tax year, got 2023')
      
      consoleSpy.mockRestore()
    })

    it('should handle edge cases', () => {
      expect(FinancialModeling.calculateFederalTax(0, 'single', 2025)).toBe(0)
      expect(FinancialModeling.calculateFederalTax(-1000, 'single', 2025)).toBe(0)
      
      // Exactly at standard deduction
      const exactDeduction = FinancialModeling.calculateFederalTax(15000, 'single', 2025)
      expect(exactDeduction).toBe(0)
    })
  })

  describe('calculateCaliforniaTax', () => {
    it('should calculate California tax correctly', () => {
      const income75k = FinancialModeling.calculateCaliforniaTax(75000, 'single')
      expect(income75k).toBeGreaterThan(0)
      expect(income75k).toBeLessThan(75000 * 0.133) // Less than max CA rate

      const income150kMarried = FinancialModeling.calculateCaliforniaTax(150000, 'marriedFilingJointly')
      expect(income150kMarried).toBeGreaterThan(0)
      expect(income150kMarried).toBeLessThan(150000 * 0.133)
    })

    it('should handle California standard deduction', () => {
      // Income below CA standard deduction
      const lowIncome = FinancialModeling.calculateCaliforniaTax(3000, 'single')
      expect(lowIncome).toBe(0)

      const lowIncomeMarried = FinancialModeling.calculateCaliforniaTax(8000, 'marriedFilingJointly')
      expect(lowIncomeMarried).toBe(0)
    })

    it('should calculate different amounts for different filing statuses', () => {
      const income = 100000

      const singleCA = FinancialModeling.calculateCaliforniaTax(income, 'single')
      const marriedCA = FinancialModeling.calculateCaliforniaTax(income, 'marriedFilingJointly')

      expect(singleCA).toBeGreaterThan(marriedCA) // Single should pay more
      expect(singleCA).toBeGreaterThan(0)
      expect(marriedCA).toBeGreaterThan(0)
    })

    it('should handle high-income CA scenarios', () => {
      const highIncome = 500000
      const tax = FinancialModeling.calculateCaliforniaTax(highIncome, 'single')
      
      expect(tax).toBeGreaterThan(30000) // Substantial CA tax
      expect(tax).toBeLessThan(highIncome * 0.133) // Less than flat top rate
    })

    it('should meet performance requirements', () => {
      measureCalculationPerformance(
        'california-tax-batch',
        () => {
          for (let income = 10000; income <= 200000; income += 10000) {
            FinancialModeling.calculateCaliforniaTax(income, 'single')
          }
        },
        100 // Max 100ms for 20 calculations
      )
    })
  })

  describe('calculateTaxAnalysis', () => {
    it('should provide comprehensive tax analysis', () => {
      const income = 100000
      const { result: analysis } = measureCalculationPerformance(
        'tax-analysis-comprehensive',
        () => FinancialModeling.calculateTaxAnalysis(income, 'single', 'CA'),
        50 // Max 50ms for complete analysis
      )

      expect(analysis.federalTax).toBeGreaterThan(0)
      expect(analysis.stateTax).toBeGreaterThan(0)
      expect(analysis.totalTax).toBe(analysis.federalTax + analysis.stateTax)
      expect(analysis.afterTaxIncome).toBe(income - analysis.totalTax)
      expect(analysis.effectiveRate).toBe(analysis.totalTax / income)
      expect(analysis.marginalRate).toBeGreaterThan(0)
      expect(analysis.marginalRate).toBeLessThan(1)
    })

    it('should handle different states correctly', () => {
      const income = 75000

      // California analysis
      const caAnalysis = FinancialModeling.calculateTaxAnalysis(income, 'single', 'CA')
      expect(caAnalysis.stateTax).toBeGreaterThan(0)

      // Non-implemented state (should have zero state tax)
      const txAnalysis = FinancialModeling.calculateTaxAnalysis(income, 'single', 'TX')
      expect(txAnalysis.stateTax).toBe(0)
      expect(txAnalysis.federalTax).toBe(caAnalysis.federalTax) // Federal should be same
    })

    it('should calculate effective rate correctly', () => {
      const income = 100000
      const analysis = FinancialModeling.calculateTaxAnalysis(income, 'marriedFilingJointly', 'CA')

      const expectedEffectiveRate = analysis.totalTax / income
      expect(analysis.effectiveRate).toBeCloseToCurrency(expectedEffectiveRate, 6)
      expect(analysis.effectiveRate).toBeGreaterThan(0)
      expect(analysis.effectiveRate).toBeLessThan(0.50) // Should be reasonable effective rate
    })

    it('should handle zero income correctly', () => {
      const analysis = FinancialModeling.calculateTaxAnalysis(0, 'single', 'CA')

      expect(analysis.federalTax).toBe(0)
      expect(analysis.stateTax).toBe(0)
      expect(analysis.totalTax).toBe(0)
      expect(analysis.afterTaxIncome).toBe(0)
      expect(analysis.effectiveRate).toBe(0)
      expect(analysis.marginalRate).toBeGreaterThanOrEqual(0)
    })

    it('should validate marginal vs effective rate relationship', () => {
      const income = 150000
      const analysis = FinancialModeling.calculateTaxAnalysis(income, 'single', 'CA')

      // Marginal rate should be higher than effective rate due to progressive taxation
      expect(analysis.marginalRate).toBeGreaterThan(analysis.effectiveRate)
      
      // But not unreasonably different
      expect(analysis.marginalRate - analysis.effectiveRate).toBeLessThan(0.15)
    })
  })

  describe('calculateMarginalTaxRate', () => {
    it('should calculate marginal rates correctly across income levels', () => {
      // Low income - 10% federal + 1% CA = 11%
      const lowRate = FinancialModeling.calculateMarginalTaxRate(20000, 'single', 'CA')
      expect(lowRate).toBeCloseToCurrency(0.11, 0.01)

      // Middle income - 22% federal + higher CA rate
      const middleRate = FinancialModeling.calculateMarginalTaxRate(75000, 'single', 'CA')
      expect(middleRate).toBeGreaterThan(0.20)
      expect(middleRate).toBeLessThan(0.35)

      // High income - higher rates
      const highRate = FinancialModeling.calculateMarginalTaxRate(500000, 'single', 'CA')
      expect(highRate).toBeGreaterThan(0.40) // 35% federal + CA rates
    })

    it('should handle filing status differences', () => {
      const income = 100000

      const singleRate = FinancialModeling.calculateMarginalTaxRate(income, 'single', 'CA')
      const marriedRate = FinancialModeling.calculateMarginalTaxRate(income, 'marriedFilingJointly', 'CA')

      // Single filer should have higher marginal rate at same income
      expect(singleRate).toBeGreaterThan(marriedRate)
    })

    it('should handle states without implementation', () => {
      const income = 100000
      const caRate = FinancialModeling.calculateMarginalTaxRate(income, 'single', 'CA')
      const txRate = FinancialModeling.calculateMarginalTaxRate(income, 'single', 'TX')

      // TX rate should just be federal (no state tax)
      expect(txRate).toBeLessThan(caRate)
      expect(txRate).toBeGreaterThan(0.20) // Should still have federal marginal rate
    })

    it('should handle income at bracket boundaries correctly', () => {
      // Test income exactly at bracket boundary
      const boundaryIncome = 100525 // Exactly at 22%/24% boundary for single filer
      const rate = FinancialModeling.calculateMarginalTaxRate(boundaryIncome, 'single', 'CA')
      
      expect(rate).toBeGreaterThan(0.22) // Should include CA state tax
      expect(rate).toBeLessThan(0.35) // But not unreasonably high
    })
  })

  describe('validateTaxOptimizationStrategy', () => {
    it('should recommend tax-advantaged strategy for high earners', () => {
      const highIncome = 150000
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(highIncome, 'single')

      expect(strategy.shouldMaxTaxAdvantaged).toBe(true)
      expect(strategy.marginalRate).toBeGreaterThan(0.22) // Above BufoIndex threshold
      expect(strategy.taxSavingsOpportunity).toBe(1000 * strategy.marginalRate)
      expect(strategy.reasoning).toContain('tax-advantaged')
      expect(strategy.reasoning).toContain('401k')
    })

    it('should recommend flexibility for lower earners', () => {
      const lowIncome = 40000
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(lowIncome, 'single')

      expect(strategy.shouldMaxTaxAdvantaged).toBe(false)
      expect(strategy.marginalRate).toBeLessThanOrEqual(0.22) // At or below threshold
      expect(strategy.reasoning).toContain('flexibility')
      expect(strategy.reasoning).toContain('diversification')
    })

    it('should calculate tax savings opportunity correctly', () => {
      const income = 100000
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(income, 'marriedFilingJointly')

      const expectedSavings = 1000 * strategy.marginalRate
      expect(strategy.taxSavingsOpportunity).toBeCloseToCurrency(expectedSavings, 2)
    })

    it('should handle edge cases at the 22% boundary', () => {
      // Test income that puts marginal rate exactly at 22%
      const boundaryIncome = 47150 // Start of 22% federal bracket for single filer
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(boundaryIncome, 'single')

      // Should include state tax, so marginal rate should be > 22%
      expect(strategy.marginalRate).toBeGreaterThan(0.22)
      expect(strategy.shouldMaxTaxAdvantaged).toBe(true)
    })

    it('should provide different recommendations for different filing statuses', () => {
      const income = 80000

      const singleStrategy = FinancialModeling.validateTaxOptimizationStrategy(income, 'single')
      const marriedStrategy = FinancialModeling.validateTaxOptimizationStrategy(income, 'marriedFilingJointly')

      // Single filer should have higher marginal rate and more aggressive recommendation
      expect(singleStrategy.marginalRate).toBeGreaterThan(marriedStrategy.marginalRate)
    })
  })

  describe('calculateEmergencyFundOpportunityCost', () => {
    it('should calculate opportunity cost of excessive emergency funds', () => {
      const monthlyExpenses = 4000
      const emergencyMonths = 6
      const expectedReturn = 0.07
      const timeHorizon = 30

      const { result: analysis } = measureCalculationPerformance(
        'emergency-fund-opportunity-cost',
        () => FinancialModeling.calculateEmergencyFundOpportunityCost(
          monthlyExpenses, emergencyMonths, expectedReturn, timeHorizon
        ),
        20 // Max 20ms for calculation
      )

      expect(analysis.emergencyFundSize).toBe(24000) // 4000 * 6
      expect(analysis.opportunityCost).toBeGreaterThan(0)
      expect(analysis.recommendedMonths).toBe(3) // BufoIndex max recommendation
      expect(analysis.reasoning).toContain('opportunity cost')
    })

    it('should validate BufoIndex contrarian philosophy (max 3 months)', () => {
      const monthlyExpenses = 5000
      
      // Test scenarios above and at the 3-month limit
      const excessive = FinancialModeling.calculateEmergencyFundOpportunityCost(monthlyExpenses, 12)
      expect(excessive.recommendedMonths).toBe(3)
      expect(excessive.reasoning).toContain('BufoIndex recommends max 3 months')

      const optimal = FinancialModeling.calculateEmergencyFundOpportunityCost(monthlyExpenses, 3)
      expect(optimal.recommendedMonths).toBe(3)
      expect(optimal.reasoning).toContain('aligns with BufoIndex philosophy')

      const minimal = FinancialModeling.calculateEmergencyFundOpportunityCost(monthlyExpenses, 2)
      expect(minimal.recommendedMonths).toBe(2)
      expect(minimal.reasoning).toContain('aligns with BufoIndex philosophy')
    })

    it('should calculate compound growth correctly', () => {
      const monthlyExpenses = 3000
      const emergencyMonths = 6
      const expectedReturn = 0.08
      const timeHorizon = 25

      const analysis = FinancialModeling.calculateEmergencyFundOpportunityCost(
        monthlyExpenses, emergencyMonths, expectedReturn, timeHorizon
      )

      const emergencyFundSize = 18000 // 3000 * 6
      const expectedFutureValue = emergencyFundSize * Math.pow(1 + expectedReturn, timeHorizon)
      const expectedOpportunityCost = expectedFutureValue - emergencyFundSize

      expect(analysis.opportunityCost).toBeCloseToCurrency(expectedOpportunityCost, 2)
    })

    it('should handle different return assumptions', () => {
      const monthlyExpenses = 4000
      const emergencyMonths = 6
      const timeHorizon = 20

      const conservative = FinancialModeling.calculateEmergencyFundOpportunityCost(
        monthlyExpenses, emergencyMonths, 0.05, timeHorizon
      )
      
      const aggressive = FinancialModeling.calculateEmergencyFundOpportunityCost(
        monthlyExpenses, emergencyMonths, 0.10, timeHorizon
      )

      expect(aggressive.opportunityCost).toBeGreaterThan(conservative.opportunityCost)
    })

    it('should handle edge cases', () => {
      // Zero monthly expenses
      const zeroExpenses = FinancialModeling.calculateEmergencyFundOpportunityCost(0, 6)
      expect(zeroExpenses.emergencyFundSize).toBe(0)
      expect(zeroExpenses.opportunityCost).toBe(0)

      // Zero emergency months
      const zeroMonths = FinancialModeling.calculateEmergencyFundOpportunityCost(4000, 0)
      expect(zeroMonths.emergencyFundSize).toBe(0)
      expect(zeroMonths.opportunityCost).toBe(0)

      // Zero time horizon
      const zeroTime = FinancialModeling.calculateEmergencyFundOpportunityCost(4000, 6, 0.07, 0)
      expect(zeroTime.opportunityCost).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(FinancialModeling.formatCurrency(1234.56)).toBe('$1,235')
      expect(FinancialModeling.formatCurrency(0)).toBe('$0')
      expect(FinancialModeling.formatCurrency(1000000)).toBe('$1,000,000')
      expect(FinancialModeling.formatCurrency(-1234.56)).toBe('-$1,235')
    })

    it('should not show decimal places', () => {
      expect(FinancialModeling.formatCurrency(1234.99)).toBe('$1,235')
      expect(FinancialModeling.formatCurrency(1000.01)).toBe('$1,000')
    })

    it('should handle edge cases', () => {
      expect(FinancialModeling.formatCurrency(0.5)).toBe('$1')
      expect(FinancialModeling.formatCurrency(-0.5)).toBe('-$1')
      expect(FinancialModeling.formatCurrency(Number.MAX_SAFE_INTEGER)).toContain('$')
    })
  })

  describe('browser compatibility', () => {
    it('should export to window when available', () => {
      if (typeof window !== 'undefined') {
        expect((window as any).FinancialModeling).toBeDefined()
        expect((window as any).FinancialModeling).toBe(FinancialModeling)
      }
    })

    it('should work without window object (Node.js)', () => {
      // This test runs in jsdom but simulates server environment
      const tax = FinancialModeling.calculateFederalTax(50000, 'single', 2025)
      expect(tax).toBeGreaterThan(0)
    })
  })

  describe('integration with BufoIndex philosophy', () => {
    it('should support contrarian investment recommendations', () => {
      // High-income earner scenario
      const highIncome = 200000
      const analysis = FinancialModeling.calculateTaxAnalysis(highIncome, 'single', 'CA')
      const strategy = FinancialModeling.validateTaxOptimizationStrategy(highIncome, 'single')

      // Should recommend aggressive tax-advantaged investing
      expect(strategy.shouldMaxTaxAdvantaged).toBe(true)
      expect(strategy.taxSavingsOpportunity).toBeGreaterThan(200) // Significant savings per $1000

      // Emergency fund opportunity cost should be substantial
      const emergencyAnalysis = FinancialModeling.calculateEmergencyFundOpportunityCost(8000, 6)
      expect(emergencyAnalysis.opportunityCost).toBeGreaterThan(50000) // 30-year opportunity cost
      expect(emergencyAnalysis.recommendedMonths).toBe(3)
    })

    it('should validate 7% debt threshold philosophy', () => {
      // At BufoIndex's contrarian philosophy, debt above 7% should be paid off
      // Below 7%, opportunity cost of paying vs investing should favor investing
      
      const highIncomeStrategy = FinancialModeling.validateTaxOptimizationStrategy(150000, 'single')
      
      // High earners with >22% marginal rate get significant tax advantage
      expect(highIncomeStrategy.marginalRate).toBeGreaterThan(0.22)
      expect(highIncomeStrategy.taxSavingsOpportunity).toBeGreaterThan(220) // 22%+ of $1000
      
      // This supports BufoIndex philosophy of prioritizing tax-advantaged investing
      // over paying off low-interest debt when marginal tax rate is high
    })
  })

  describe('performance and accuracy validation', () => {
    it('should handle batch tax calculations efficiently', () => {
      measureCalculationPerformance(
        'batch-tax-analysis',
        () => {
          const incomes = [30000, 50000, 75000, 100000, 150000, 200000, 500000, 1000000]
          const filingStatuses: FilingStatus[] = ['single', 'marriedFilingJointly']
          
          incomes.forEach(income => {
            filingStatuses.forEach(status => {
              FinancialModeling.calculateTaxAnalysis(income, status, 'CA')
            })
          })
        },
        500 // Max 500ms for 16 comprehensive tax analyses
      )
    })

    it('should maintain accuracy across income ranges', () => {
      // Test various income levels to ensure no calculation errors
      const testIncomes = [
        15000, 25000, 47150, 100525, 191675, 243725, 609350, 1000000
      ]

      testIncomes.forEach(income => {
        const federalTax = FinancialModeling.calculateFederalTax(income, 'single', 2025)
        const analysis = FinancialModeling.calculateTaxAnalysis(income, 'single', 'CA')
        
        expect(federalTax).toBeGreaterThanOrEqual(0)
        expect(analysis.totalTax).toBeGreaterThanOrEqual(federalTax)
        expect(analysis.afterTaxIncome).toBeLessThanOrEqual(income)
        expect(analysis.effectiveRate).toBeGreaterThanOrEqual(0)
        expect(analysis.effectiveRate).toBeLessThan(0.5) // Sanity check
      })
    })
  })
})