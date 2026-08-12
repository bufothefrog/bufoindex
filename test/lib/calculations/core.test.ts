/**
 * Core Paycheck Optimization Test Suite
 * Covers allocation ordering, validation, formatting, and frequency conversion.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateOptimalAllocation,
  getDefaultProfile,
  validateProfile,
  estimateMonthlyExpenses,
  formatCurrency,
  formatPercent,
  calculateCompoundGrowth,
  calculateOpportunityCost,
  paycheckToMonthly,
  monthlyToPaycheck,
  updateLegacyIncomeFields,
  FREQUENCY_MULTIPLIERS
} from '@/lib/calculations/core'
import type { PaycheckProfile } from '@/lib/types'
import { measureCalculationPerformance } from '@/test/utils/financial-test-helpers'
import { createPaycheckProfile, createDebtData } from '@/test/factories/test-data-factory'

describe('Core Paycheck Optimization', () => {
  describe('FREQUENCY_MULTIPLIERS', () => {
    it('should have correct conversion multipliers', () => {
      expect(FREQUENCY_MULTIPLIERS.weekly).toBeCloseToCurrency(4.33, 2)
      expect(FREQUENCY_MULTIPLIERS['bi-weekly']).toBeCloseToCurrency(2.17, 2)
      expect(FREQUENCY_MULTIPLIERS['semi-monthly']).toBe(2)
      expect(FREQUENCY_MULTIPLIERS.monthly).toBe(1)
    })

    it('should sum to correct annual multipliers', () => {
      expect(FREQUENCY_MULTIPLIERS.weekly * 12).toBeCloseToCurrency(52, 1) // ~52 weeks/year
      expect(FREQUENCY_MULTIPLIERS['bi-weekly'] * 12).toBeCloseToCurrency(26, 1) // 26 bi-weekly periods/year
      expect(FREQUENCY_MULTIPLIERS['semi-monthly'] * 12).toBe(24) // 24 semi-monthly periods/year
      expect(FREQUENCY_MULTIPLIERS.monthly * 12).toBe(12) // 12 monthly periods/year
    })
  })

  describe('paycheckToMonthly', () => {
    it('should convert all frequencies correctly', () => {
      const paycheckAmount = 2000

      expect(paycheckToMonthly(paycheckAmount, 'weekly')).toBeCloseToCurrency(8666.67, 2)
      expect(paycheckToMonthly(paycheckAmount, 'bi-weekly')).toBeCloseToCurrency(4333.33, 2)
      expect(paycheckToMonthly(paycheckAmount, 'semi-monthly')).toBe(4000)
      expect(paycheckToMonthly(paycheckAmount, 'monthly')).toBe(2000)
    })

    it('should handle zero and negative amounts', () => {
      expect(paycheckToMonthly(0, 'bi-weekly')).toBe(0)
      expect(paycheckToMonthly(-1000, 'monthly')).toBe(-1000)
    })

    it('should meet performance requirements', () => {
      measureCalculationPerformance(
        'paycheck-to-monthly-batch',
        () => {
          for (let i = 0; i < 1000; i++) {
            paycheckToMonthly(2000 + i, 'bi-weekly')
          }
        },
        100 // Max 100ms for 1000 conversions — 10x headroom for shared CI runners
      )
    })
  })

  describe('monthlyToPaycheck', () => {
    it('should convert monthly amounts to paycheck amounts', () => {
      const monthlyAmount = 4000

      expect(monthlyToPaycheck(monthlyAmount, 'weekly')).toBeCloseToCurrency(923.08, 2)
      expect(monthlyToPaycheck(monthlyAmount, 'bi-weekly')).toBeCloseToCurrency(1846.15, 2)
      expect(monthlyToPaycheck(monthlyAmount, 'semi-monthly')).toBe(2000)
      expect(monthlyToPaycheck(monthlyAmount, 'monthly')).toBe(4000)
    })

    it('should be inverse of paycheckToMonthly', () => {
      const originalAmount = 1500
      const frequencies: (keyof typeof FREQUENCY_MULTIPLIERS)[] = ['weekly', 'bi-weekly', 'semi-monthly', 'monthly']

      frequencies.forEach(frequency => {
        const monthly = paycheckToMonthly(originalAmount, frequency)
        const backToPaycheck = monthlyToPaycheck(monthly, frequency)
        expect(backToPaycheck).toBeCloseToCurrency(originalAmount, 2)
      })
    })
  })

  describe('updateLegacyIncomeFields', () => {
    it('should calculate monthly values from paycheck inputs', () => {
      const income = {
        grossPaycheck: 2500,
        netPaycheck: 1900,
        frequency: 'bi-weekly' as const,
        regularBonus: false,
        bonusAmount: 0,
        bonusFrequency: 'annual' as const,
        monthlyGross: 0, // Will be calculated
        monthlyNet: 0,   // Will be calculated
        gross: 0,
        net: 0,
        bonusExpected: 0,
      }

      const updated = updateLegacyIncomeFields(income)

      expect(updated.monthlyGross).toBeCloseToCurrency(5416.67, 2) // 2500 * 2.17
      expect(updated.monthlyNet).toBeCloseToCurrency(4116.67, 2)   // 1900 * 2.17
      expect(updated.gross).toBe(updated.monthlyGross)
      expect(updated.net).toBe(updated.monthlyNet)
    })

    it('should calculate bonus amounts correctly', () => {
      const incomeWithBonus = {
        grossPaycheck: 2500,
        netPaycheck: 1900,
        frequency: 'bi-weekly' as const,
        regularBonus: true,
        bonusAmount: 12000,
        bonusFrequency: 'annual' as const,
        monthlyGross: 0,
        monthlyNet: 0,
        gross: 0,
        net: 0,
        bonusExpected: 0,
      }

      const updated = updateLegacyIncomeFields(incomeWithBonus)
      expect(updated.bonusExpected).toBe(1000) // 12000 / 12

      // Test quarterly bonus
      const quarterlyBonus = { ...incomeWithBonus, bonusFrequency: 'quarterly' as const, bonusAmount: 3000 }
      const updatedQuarterly = updateLegacyIncomeFields(quarterlyBonus)
      expect(updatedQuarterly.bonusExpected).toBe(1000) // 3000 / 3

      // Test irregular bonus (treated as annual average)
      const irregularBonus = { ...incomeWithBonus, bonusFrequency: 'irregular' as const, bonusAmount: 6000 }
      const updatedIrregular = updateLegacyIncomeFields(irregularBonus)
      expect(updatedIrregular.bonusExpected).toBe(500) // 6000 / 12
    })

    it('should handle no bonus scenario', () => {
      const income = {
        grossPaycheck: 2500,
        netPaycheck: 1900,
        frequency: 'monthly' as const,
        regularBonus: false,
        bonusAmount: 0,
        bonusFrequency: 'annual' as const,
        monthlyGross: 0,
        monthlyNet: 0,
        gross: 0,
        net: 0,
        bonusExpected: 0,
      }

      const updated = updateLegacyIncomeFields(income)
      expect(updated.bonusExpected).toBe(0)
      expect(updated.monthlyGross).toBe(2500)
      expect(updated.monthlyNet).toBe(1900)
    })
  })

  describe('getDefaultProfile', () => {
    it('should return complete default profile', () => {
      const profile = getDefaultProfile()

      // Validate structure completeness
      expect(profile.income).toBeDefined()
      expect(profile.taxes).toBeDefined()
      expect(profile.benefits).toBeDefined()
      expect(profile.debts).toBeDefined()
      expect(profile.preferences).toBeDefined()
      expect(profile.version).toBe('1.0')
      expect(profile.source).toBe('user_input')
      expect(typeof profile.lastUpdated).toBe('number')
    })

    it('should have consistent income calculations', () => {
      const profile = getDefaultProfile()

      expect(profile.income.monthlyGross).toBeCloseToCurrency(5417, 0)
      expect(profile.income.monthlyNet).toBeCloseToCurrency(4123, 0)
      expect(profile.income.gross).toBe(profile.income.monthlyGross)
      expect(profile.income.net).toBe(profile.income.monthlyNet)
    })

    it('should have reasonable default values', () => {
      const profile = getDefaultProfile()

      expect(profile.income.grossPaycheck).toBe(2500)
      expect(profile.income.netPaycheck).toBe(1900)
      expect(profile.income.frequency).toBe('bi-weekly')

      expect(profile.taxes.federalBracket).toBe(0.22) // 22% bracket
      expect(profile.taxes.state).toBe('CA')
      expect(profile.taxes.filingStatus).toBe('single')

      expect(profile.benefits.employer401k.matchPercent).toBe(0.50)
      expect(profile.benefits.employer401k.matchLimit).toBe(0.06)

      expect(profile.preferences.emergencyFundMonths).toBe(3) // default profile caps the emergency fund at 3 months
      expect(profile.preferences.funMoney.min).toBe(300)
      expect(profile.preferences.funMoney.max).toBe(600)
    })

    it('should validate against its own validation rules', () => {
      const profile = getDefaultProfile()
      const errors = validateProfile(profile)
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })

  describe('validateProfile', () => {
    let validProfile: PaycheckProfile

    beforeEach(() => {
      validProfile = getDefaultProfile()
    })

    it('should pass validation for default profile', () => {
      const errors = validateProfile(validProfile)
      expect(errors).toEqual({})
    })

    it('should validate income fields', () => {
      // Test gross income validation
      const invalidGross = { ...validProfile, income: { ...validProfile.income, gross: 0 } }
      expect(validateProfile(invalidGross).grossIncome).toBeDefined()

      const invalidNet = { ...validProfile, income: { ...validProfile.income, net: 0 } }
      expect(validateProfile(invalidNet).netIncome).toBeDefined()

      // Test net > gross scenario
      const netTooHigh = {
        ...validProfile,
        income: { ...validProfile.income, gross: 3000, net: 4000 }
      }
      expect(validateProfile(netTooHigh).netIncome).toBeDefined()
    })

    it('should validate tax bracket', () => {
      const invalidBracket = {
        ...validProfile,
        taxes: { ...validProfile.taxes, federalBracket: 0.15 }
      }
      expect(validateProfile(invalidBracket).federalBracket).toBeDefined()

      // Test valid brackets
      const validBrackets = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
      validBrackets.forEach(bracket => {
        const profile = {
          ...validProfile,
          taxes: { ...validProfile.taxes, federalBracket: bracket }
        }
        expect(validateProfile(profile).federalBracket).toBeUndefined()
      })
    })

    it('should validate employer 401k settings', () => {
      // Invalid match percentage
      const invalidMatch = {
        ...validProfile,
        benefits: {
          ...validProfile.benefits,
          employer401k: { ...validProfile.benefits.employer401k, matchPercent: 1.5 }
        }
      }
      expect(validateProfile(invalidMatch).employerMatch).toBeDefined()

      // Invalid contribution percentage
      const invalidContrib = {
        ...validProfile,
        benefits: {
          ...validProfile.benefits,
          employer401k: { ...validProfile.benefits.employer401k, currentContribution: -0.1 }
        }
      }
      expect(validateProfile(invalidContrib).currentContribution).toBeDefined()
    })

    it('should validate debt fields', () => {
      const profileWithDebts = createPaycheckProfile({
        debts: [
          createDebtData({
            name: 'Credit Card',
            balance: 0,           // Invalid: zero balance
            interestRate: 0.15,
            minimumPayment: 100
          }),
          createDebtData({
            name: 'Student Loan',
            balance: 10000,
            interestRate: 0.60,   // Invalid: 60% interest rate
            minimumPayment: 150
          }),
          createDebtData({
            name: 'Car Loan',
            balance: 15000,
            interestRate: 0.05,
            minimumPayment: 0     // Invalid: zero payment
          })
        ]
      })

      const errors = validateProfile(profileWithDebts)
      expect(errors.debt_0_balance).toBeDefined()
      expect(errors.debt_1_rate).toBeDefined()
      expect(errors.debt_2_payment).toBeDefined()
    })

    it('should validate preference ranges', () => {
      // Emergency fund months
      const invalidEmergency = {
        ...validProfile,
        preferences: { ...validProfile.preferences, emergencyFundMonths: 15 }
      }
      expect(validateProfile(invalidEmergency).emergencyFundMonths).toBeDefined()

      // Fun money validation
      const invalidFunMoney = {
        ...validProfile,
        preferences: {
          ...validProfile.preferences,
          funMoney: { min: -100, max: 200, current: 150 }
        }
      }
      expect(validateProfile(invalidFunMoney).funMoneyMin).toBeDefined()

      const funMoneyMaxTooLow = {
        ...validProfile,
        preferences: {
          ...validProfile.preferences,
          funMoney: { min: 500, max: 300, current: 400 }
        }
      }
      expect(validateProfile(funMoneyMaxTooLow).funMoneyMax).toBeDefined()
    })
  })

  describe('calculateOptimalAllocation', () => {
    let mockProfile: PaycheckProfile

    beforeEach(() => {
      mockProfile = createPaycheckProfile({
        income: {
          net: 4767,
          grossPaycheck: 3000,
          netPaycheck: 2200,
          frequency: 'bi-weekly',
          regularBonus: false,
          bonusAmount: 0,
          bonusFrequency: 'annual',
          monthlyGross: 6500,
          monthlyNet: 4767,
          gross: 6500,
          bonusExpected: 0,
        },
        preferences: {
          necessaryExpenses: 3000,
          funMoney: { min: 200, max: 500, current: 350 },
          emergencyFundMonths: 3,
          currentEmergencyFund: 1000,
          age: 28,
          isPeakEarnings: false,
          riskTolerance: 'moderate',
          optimizationGoal: 'wealth_maximization',
          emergencyFundAPY: 0.045,
          hasTaxableAccount: false,
          taxableAccountContribution: 0
        }
      })
    })

    it('should calculate optimal allocation with performance requirements', () => {
      const { result: allocation } = measureCalculationPerformance(
        'optimal-allocation-calculation',
        () => calculateOptimalAllocation(mockProfile),
        5000 // Max 5000ms for complex optimization — 10x headroom for shared CI runners
      )

      expect(allocation.allocations).toBeDefined()
      expect(Array.isArray(allocation.allocations)).toBe(true)
      expect(allocation.skippedItems).toBeDefined()
      expect(allocation.projections).toBeDefined()
      expect(allocation.optimizationScore).toBeDefined()
      expect(allocation.funMoneyAllocated).toBe(mockProfile.preferences.funMoney.min)
      expect(allocation.remainingAmount).toBeGreaterThanOrEqual(0)
    })

    it('should follow BufoIndex Financial Order of Operations', () => {
      const allocation = calculateOptimalAllocation(mockProfile)

      // Should prioritize in correct order:
      // 1. Emergency fund completion (if not at 3 months)
      // 2. Employer 401k match (if available)
      // 3. High-interest debt (if exists)
      // 4. HSA max (if eligible)
      // 5. Roth IRA (based on income/age)
      // 6. Additional 401k (if space available)
      // 7. Taxable investment (remaining funds)

      // Should not have impossible combinations
      expect(allocation.allocations.length).toBeGreaterThan(0)

      // Should optimize for maximum investment given constraints. Allocations
      // are computed per-paycheck (matching the user's mental model), so the
      // expected available pool also has to be expressed per-paycheck. The
      // engine derives monthly net from netPaycheck (not the rounded income.net
      // field), so reproduce that derivation here to avoid rounding drift.
      const totalAllocated = allocation.allocations.reduce((sum, a) => sum + a.amount, 0)
      const multiplier = FREQUENCY_MULTIPLIERS[mockProfile.income.frequency]
      const expectedAvailablePerPaycheck = mockProfile.income.netPaycheck
        - (mockProfile.preferences.necessaryExpenses / multiplier)
        - (mockProfile.preferences.funMoney.min / multiplier)

      expect(totalAllocated + allocation.remainingAmount).toBeCloseToCurrency(expectedAvailablePerPaycheck, 2)
    })

    it('should handle high-income scenarios correctly', () => {
      const highIncomeProfile = {
        ...mockProfile,
        income: {
          ...mockProfile.income,
          grossPaycheck: 10000,
          netPaycheck: 7000,
          monthlyGross: 21667,
          monthlyNet: 15167,
          gross: 21667,
          net: 15167
        },
        benefits: {
          ...mockProfile.benefits,
          employer401k: {
            available: true,
            matchPercent: 0.50,
            matchLimit: 0.06,
            currentContribution: 0,
            contributionType: 'traditional' as const,
            traditionalContribution: 0,
            rothContribution: 0,
            afterTaxAvailable: true, // Enable mega backdoor Roth
            currentYTD: 0,
          }
        }
      }

      const allocation = calculateOptimalAllocation(highIncomeProfile)

      expect(allocation.allocations.length).toBeGreaterThan(0)

      // High earners should see mega backdoor Roth recommendation if available
      const megaBackdoorAllocation = allocation.allocations.find(a =>
        a.category === 'tax_advantaged' && a.reasoning.includes('Mega Backdoor')
      )

      if (megaBackdoorAllocation) {
        expect(megaBackdoorAllocation.amount).toBeGreaterThan(0)
      }
    })

    it('should handle debt payoff scenarios', () => {
      // Give the profile a fully-funded 1-month emergency cushion so the
      // Financial Order of Operations advances past Step 1 and debt_payoff
      // (Step 3) becomes the binding priority.
      const profileWithDebt = createPaycheckProfile({
        ...mockProfile,
        preferences: {
          ...mockProfile.preferences,
          currentEmergencyFund: mockProfile.preferences.necessaryExpenses,
        },
        debts: [
          createDebtData({
            name: 'High Interest Credit Card',
            balance: 5000,
            interestRate: 0.18, // 18% - above 7% threshold
            minimumPayment: 150
          }),
          createDebtData({
            name: 'Student Loan',
            balance: 15000,
            interestRate: 0.04, // 4% - below 7% threshold
            minimumPayment: 200,
            extraPayment: 100, // user is paying extra, which the engine flags as suboptimal
          })
        ]
      })

      const allocation = calculateOptimalAllocation(profileWithDebt)

      // Should recommend paying off high-interest debt
      const debtPayoff = allocation.allocations.find(a => a.category === 'debt_payoff')
      expect(debtPayoff).toBeDefined()
      expect(debtPayoff!.amount).toBeGreaterThan(0)

      // Should skip low-interest debt in favor of investing
      const skippedLowInterestDebt = allocation.skippedItems.find(s =>
        s.reason.includes('4.0%') && s.reason.includes('invest')
      )
      expect(skippedLowInterestDebt).toBeDefined()
    })

    it('should calculate fun money range impact', () => {
      const allocation = calculateOptimalAllocation(mockProfile)

      expect(allocation.funMoneyRange.min).toBe(mockProfile.preferences.funMoney.min)
      expect(allocation.funMoneyRange.max).toBe(mockProfile.preferences.funMoney.max)
      expect(allocation.funMoneyRange.difference).toBe(
        mockProfile.preferences.funMoney.max - mockProfile.preferences.funMoney.min
      )

      // Should allocate minimum fun money to maximize investment opportunity
      expect(allocation.funMoneyAllocated).toBe(mockProfile.preferences.funMoney.min)
    })

    it('should handle edge case: no available money for allocation', () => {
      // Bi-weekly $1000 net = $2167/month. Monthly necessary $2000 + fun $167
      // = $2167 leaves $0 to allocate per paycheck. Set the per-paycheck
      // input fields directly because the engine works in per-paycheck scope.
      const noMoneyProfile = {
        ...mockProfile,
        income: {
          ...mockProfile.income,
          netPaycheck: 1000,
          monthlyNet: 1000 * FREQUENCY_MULTIPLIERS['bi-weekly'],
          net: 1000 * FREQUENCY_MULTIPLIERS['bi-weekly'],
        },
        preferences: {
          ...mockProfile.preferences,
          necessaryExpenses: 2000,
          funMoney: { min: 167, max: 200, current: 175 }
        }
      }

      const allocation = calculateOptimalAllocation(noMoneyProfile)

      expect(allocation.allocations).toHaveLength(0)
      expect(allocation.remainingAmount).toBe(0)
      expect(allocation.funMoneyAllocated).toBe(167)
    })

    it('should update legacy income fields automatically', () => {
      const profileWithOutdatedFields = {
        ...mockProfile,
        income: {
          grossPaycheck: 3000,
          netPaycheck: 2200,
          frequency: 'bi-weekly' as const,
          regularBonus: false,
          bonusAmount: 0,
          bonusFrequency: 'annual' as const,
          // Outdated monthly fields
          monthlyGross: 5000, // Will be recalculated
          monthlyNet: 3500,   // Will be recalculated
          gross: 5000,
          net: 3500,
          bonusExpected: 0,
        }
      }

      const allocation = calculateOptimalAllocation(profileWithOutdatedFields)

      // Should work with corrected monthly values, not the outdated ones
      expect(allocation.allocations.length).toBeGreaterThan(0)

      // Available amount is computed in per-paycheck scope, so compare in
      // the same scope. Engine uses netPaycheck (2200) directly.
      const multiplier = FREQUENCY_MULTIPLIERS['bi-weekly']
      const expectedAvailablePerPaycheck = 2200
        - (profileWithOutdatedFields.preferences.necessaryExpenses / multiplier)
        - (profileWithOutdatedFields.preferences.funMoney.min / multiplier)

      const totalAllocated = allocation.allocations.reduce((sum, a) => sum + a.amount, 0)
      expect(totalAllocated + allocation.remainingAmount).toBeCloseToCurrency(expectedAvailablePerPaycheck, 2)
    })
  })

  describe('utility functions', () => {
    describe('estimateMonthlyExpenses', () => {
      it('should estimate expenses based on income and debts', () => {
        const profile = createPaycheckProfile({
          ...getDefaultProfile(),
          income: { ...getDefaultProfile().income, net: 5000 },
          debts: [
            createDebtData({ name: 'Credit Card', balance: 3000, interestRate: 0.15, minimumPayment: 100 }),
            createDebtData({ name: 'Car Loan', balance: 15000, interestRate: 0.05, minimumPayment: 300 })
          ]
        })

        const estimate = estimateMonthlyExpenses(profile)

        // Should be 70% of net income + debt payments
        const expectedBase = 5000 * 0.7
        const expectedDebts = 100 + 300
        expect(estimate).toBe(expectedBase + expectedDebts)
      })

      it('should handle profiles with no debt', () => {
        const profile = { ...getDefaultProfile(), debts: [] }
        const estimate = estimateMonthlyExpenses(profile)

        expect(estimate).toBe(profile.income.net * 0.7)
      })
    })

    describe('formatCurrency', () => {
      it('should format currency with proper locale', () => {
        expect(formatCurrency(1234.56)).toBe('$1,235')
        expect(formatCurrency(0)).toBe('$0')
        expect(formatCurrency(-1234.56)).toBe('-$1,235')
      })

      it('should not show decimal places', () => {
        expect(formatCurrency(1234.99)).toBe('$1,235')
        expect(formatCurrency(1000.01)).toBe('$1,000')
      })
    })

    describe('formatPercent', () => {
      it('should format percentages correctly', () => {
        expect(formatPercent(0.1234)).toBe('12.3%')
        expect(formatPercent(0)).toBe('0%')
        expect(formatPercent(1)).toBe('100%')
        expect(formatPercent(0.005)).toBe('0.5%')
      })
    })

    describe('calculateCompoundGrowth', () => {
      it('should calculate compound growth correctly', () => {
        const result = calculateCompoundGrowth(10000, 0.07, 10)
        expect(result).toBeCloseToCurrency(19671.51, 2)
      })

      it('should handle edge cases', () => {
        expect(calculateCompoundGrowth(10000, 0, 10)).toBe(10000)
        expect(calculateCompoundGrowth(10000, 0.07, 0)).toBe(10000)
        expect(calculateCompoundGrowth(0, 0.07, 10)).toBe(0)
      })

      it('should meet performance requirements', () => {
        measureCalculationPerformance(
          'compound-growth-batch',
          () => {
            for (let i = 0; i < 1000; i++) {
              calculateCompoundGrowth(10000 + i, 0.07, 10 + i % 20)
            }
          },
          500 // Max 500ms for 1000 calculations — 10x headroom for shared CI runners
        )
      })
    })

    describe('calculateOpportunityCost', () => {
      it('should calculate opportunity cost correctly', () => {
        const opportunityCost = calculateOpportunityCost(10000, 10, 0.02, 0.07)

        const lowGrowth = 10000 * Math.pow(1.02, 10)
        const highGrowth = 10000 * Math.pow(1.07, 10)
        const expected = highGrowth - lowGrowth

        expect(opportunityCost).toBeCloseToCurrency(expected, 2)
        expect(opportunityCost).toBeGreaterThan(0) // Should always show missed gains
      })

      it('should use default yield rates', () => {
        const result = calculateOpportunityCost(10000, 10)
        expect(result).toBeGreaterThan(0)
      })

      it('should handle zero scenarios', () => {
        expect(calculateOpportunityCost(0, 10)).toBe(0)
        expect(calculateOpportunityCost(10000, 0)).toBe(0)
      })
    })
  })
})
