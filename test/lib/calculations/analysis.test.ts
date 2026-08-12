/**
 * Analysis Test Suite
 *
 * Covers identifySkippedOptimizations (emergency-fund sizing/APY checks,
 * Roth-vs-Traditional strategy, debt-payment strategy, low-interest debt
 * prepayment, missed employer match) and analyzeInvestmentFees.
 *
 * All opportunity-cost expectations are hand-computed from the module's
 * stated assumptions: 7% expected market return, compound opportunity cost
 * = amount * ((1 + better)^n - (1 + current)^n).
 */

import { describe, expect, it } from 'vitest'
import { identifySkippedOptimizations, analyzeInvestmentFees } from '@/lib/calculations/analysis'
import type { PaycheckProfile, SkippedItem } from '@/lib/types'
import {
  createPaycheckProfile,
  createUserPreferences,
  createTaxData,
  createIncomeData,
  createBenefitsData,
  createEmployerBenefits,
  createDebtData,
} from '@/test/factories/test-data-factory'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

/** Find a skipped item by id, or undefined. */
function findItem(items: SkippedItem[], id: string): SkippedItem | undefined {
  return items.find((item) => item.id === id)
}

describe('identifySkippedOptimizations', () => {
  describe('emergency fund analysis', () => {
    it('flags an excessive emergency fund with compound opportunity cost', () => {
      // Target = $3,000/mo * 3 months = $9,000; current $21,000 > $9,500 (target + $500 buffer)
      // Excess = $12,000 at 4.5% APY vs 7% market:
      //   monthly = 12000 * (0.07 - 0.045) / 12 = $25
      //   annual  = 12000 * 0.025 = $300
      //   tenYear = 12000 * (1.07^10 - 1.045^10)
      //           = 12000 * (1.9671514 - 1.5529694) = $4,970.18
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({ currentEmergencyFund: 21000 }),
      })

      const item = findItem(identifySkippedOptimizations(profile), 'excessive-emergency-fund')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(25)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(300)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(4970.18)
      expect(item!.riskLevel).toBe('low') // targetMonths 3 >= 3
    })

    it('does not flag a fund exactly at the $500 buffer above target', () => {
      // Target $9,000; current $9,500 is not strictly greater than target + 500
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({ currentEmergencyFund: 9500 }),
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'excessive-emergency-fund')).toBeUndefined()
    })

    it('flags an emergency fund target above the 3-month maximum', () => {
      // 6-month target, $3,000/mo expenses: excess = 3 months = $9,000 at 4.5% APY
      //   monthly = 9000 * 0.025 / 12 = $18.75
      //   annual  = 9000 * 0.025 = $225
      //   tenYear = 9000 * (1.07^10 - 1.045^10) = $3,727.64
      // Current fund $17,000 stays below target + $500 = $18,500 so Case 1 does not fire.
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          emergencyFundMonths: 6,
          currentEmergencyFund: 17000,
        }),
      })

      const item = findItem(identifySkippedOptimizations(profile), 'large-emergency-fund-target')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(18.75)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(225)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(3727.64)
      expect(item!.riskLevel).toBe('low')
    })

    it('flags a low emergency fund APY with simple (non-compounded) ten-year cost', () => {
      // $9,000 fund at 1.0% APY vs 4.0% HYSA benchmark:
      //   additionalEarnings = 9000 * (0.04 - 0.01) = $270/yr
      //   monthly = 270 / 12 = $22.50; tenYear = 270 * 10 = $2,700 (no compounding)
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          currentEmergencyFund: 9000,
          emergencyFundAPY: 0.01,
        }),
      })

      const item = findItem(identifySkippedOptimizations(profile), 'low-emergency-fund-apy')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(22.5)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(270)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(2700)
      expect(item!.riskLevel).toBe('low')
    })

    it('does not flag APY at exactly the 4% threshold', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          currentEmergencyFund: 9000,
          emergencyFundAPY: 0.04, // condition is strictly < 0.04
        }),
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'low-emergency-fund-apy')).toBeUndefined()
    })

    it('flags a missing emergency fund as high risk with zero opportunity cost', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({ currentEmergencyFund: 0 }),
      })

      const item = findItem(identifySkippedOptimizations(profile), 'no-emergency-fund')
      expect(item).toBeDefined()
      expect(item!.riskLevel).toBe('high')
      expect(item!.opportunityCost.monthly).toBe(0)
      expect(item!.opportunityCost.annual).toBe(0)
      expect(item!.opportunityCost.tenYear).toBeUndefined()
    })

    it('does not flag a missing emergency fund for the optimizer risk tolerance', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          currentEmergencyFund: 0,
          riskTolerance: 'optimizer',
        }),
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'no-emergency-fund')).toBeUndefined()
    })
  })

  describe('Roth vs Traditional strategy', () => {
    it('recommends Roth for a young, low-bracket, non-peak earner', () => {
      // Factory defaults: age 28 (< 30), isPeakEarnings false, 12% bracket (<= 0.12)
      const profile = createPaycheckProfile()

      const item = findItem(identifySkippedOptimizations(profile), 'traditional-vs-roth')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBe(0)
      expect(item!.opportunityCost.annual).toBe(0)
      expect(item!.opportunityCost.tenYear).toBe(15000) // module's fixed estimate
      expect(item!.riskLevel).toBe('low')
    })

    it('does not recommend Roth at exactly age 30 (strict < 30 boundary)', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({ age: 30 }),
        debts: [],
      })

      expect(identifySkippedOptimizations(profile)).toEqual([])
    })

    it('does not flag Traditional for a peak earner at the top 37% bracket', () => {
      // Case 1 requires investedTaxSavings > 0.8 * rothBenefit:
      //   investedTaxSavings = 7000 * bracket * 1.07^10 = 7000 * bracket * 1.9671514
      //   0.8 * rothBenefit  = 0.8 * 7000 * (1.07^10 - 1) = 5416.05
      // At 37%: 7000 * 0.37 * 1.9671514 = 5094.92 < 5416.05, so no item —
      // the buffer condition needs bracket > ~39.3%.
      const profile = createPaycheckProfile({
        taxes: createTaxData({ federalBracket: 0.37 }),
        preferences: createUserPreferences({
          age: 45,
          isPeakEarnings: true,
          expectedRetirementBracket: 0.24,
        }),
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'roth-vs-traditional')).toBeUndefined()
      expect(findItem(items, 'traditional-vs-roth')).toBeUndefined()
    })

    it('flags Traditional for a hypothetical bracket above the buffer threshold', () => {
      // bracket 45% clears the buffer: investedTaxSavings = 3150 * 1.9671514 = 6196.53
      //   > 0.8 * rothBenefit = 5416.05
      // currentTaxSavings = 7000 * 0.45 = $3,150
      //   monthly = 3150 * 0.07 / 12 = $18.375
      //   annual  = 3150 * 0.07 = $220.50
      //   tenYear = investedTaxSavings - rothBenefit = 6196.53 - 6770.06 = -$573.53
      //   (negative: the formula compares tax savings growth against full Roth growth)
      const profile = createPaycheckProfile({
        taxes: createTaxData({ federalBracket: 0.45 }),
        preferences: createUserPreferences({
          age: 45,
          isPeakEarnings: true,
          expectedRetirementBracket: 0.24,
        }),
      })

      const item = findItem(identifySkippedOptimizations(profile), 'roth-vs-traditional')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(18.38)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(220.5)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(-573.53)
      expect(item!.riskLevel).toBe('low')
    })
  })

  describe('debt payment strategy', () => {
    it('flags extra payments on debt below the 5% risk-adjusted threshold', () => {
      // 3% debt, $100/mo extra, not deductible: effective rate 3% < 5% threshold
      //   monthly = 100 * (0.07 - 0.03) / 12 = $0.3333; annual = $4.00
      //   twentyYear = FV of $100/mo annuity at (0.04/12) for 240 months, minus principal:
      //     100 * ((1 + 0.04/12)^240 - 1) / (0.04/12) - 24000 = 36677.46 - 24000 = $12,677.46
      const profile = createPaycheckProfile({
        debts: [createDebtData({ id: 'car', name: 'Car Loan', interestRate: 0.03, extraPayment: 100 })],
      })

      const item = findItem(identifySkippedOptimizations(profile), 'debt-strategy-car')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(0.33)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(4)
      expect(item!.opportunityCost.twentyYear).toBeCloseToCurrency(12677.46)
      expect(item!.riskLevel).toBe('low') // 0.03 < 0.04
    })

    it('applies the tax deduction to the effective rate for deductible debt', () => {
      // 6.5% mortgage, deductible, 24% federal bracket in no-income-tax TX:
      //   effective = 0.065 * (1 - 0.24) = 4.94% < 5% threshold
      //   monthly = 200 * (0.07 - 0.0494) / 12 = $0.3433; annual = $4.12
      //   twentyYear = 200 * ((1 + 0.0206/12)^240 - 1) / (0.0206/12) - 48000 = $11,336.06
      const profile = createPaycheckProfile({
        taxes: createTaxData({ federalBracket: 0.24, state: 'TX' }),
        debts: [
          createDebtData({
            id: 'mortgage',
            name: 'Mortgage',
            interestRate: 0.065,
            extraPayment: 200,
            taxDeductible: true,
          }),
        ],
      })

      const item = findItem(identifySkippedOptimizations(profile), 'debt-strategy-mortgage')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(0.34)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(4.12)
      expect(item!.opportunityCost.twentyYear).toBeCloseToCurrency(11336.06)
      expect(item!.riskLevel).toBe('medium') // 0.0494 >= 0.04
    })

    it('does not flag the same 6.5% debt when it is not deductible', () => {
      // Non-deductible 6.5% >= 5% threshold: no debt-strategy item.
      // It is still <= 7%, so the low-interest prepayment item fires instead:
      //   tenYear = 2400 * (1.07^10 - 1.065^10) = 2400 * (1.9671514 - 1.8771375) = $216.03
      const profile = createPaycheckProfile({
        debts: [createDebtData({ id: 'loan', interestRate: 0.065, extraPayment: 200 })],
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'debt-strategy-loan')).toBeUndefined()
      const prepay = findItem(items, 'low-interest-debt-prepayment')
      expect(prepay).toBeDefined()
      expect(prepay!.opportunityCost.tenYear).toBeCloseToCurrency(216.03)
    })

    it('does not flag extra payments on high-interest debt', () => {
      // 18% factory default is above both the 5% and 7% thresholds
      const profile = createPaycheckProfile({
        debts: [createDebtData({ id: 'cc', extraPayment: 200 })],
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'debt-strategy-cc')).toBeUndefined()
      expect(findItem(items, 'low-interest-debt-prepayment')).toBeUndefined()
    })
  })

  describe('low-interest debt prepayment', () => {
    it('flags prepayment of 4% debt with compound ten-year opportunity cost', () => {
      // $250/mo extra on 4% debt; arbitrage = 7% - 4% = 3%
      //   monthly = 250 * 0.03 / 12 = $0.625; annual = 250 * 12 * 0.03 = $90
      //   tenYear = 3000 * (1.07^10 - 1.04^10) = 3000 * (1.9671514 - 1.4802443) = $1,460.72
      const profile = createPaycheckProfile({
        debts: [createDebtData({ id: 'auto', interestRate: 0.04, extraPayment: 250 })],
      })

      const items = identifySkippedOptimizations(profile)
      const item = findItem(items, 'low-interest-debt-prepayment')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(0.63)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(90)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(1460.72)
      expect(item!.riskLevel).toBe('medium')
      // 4% effective rate is exactly at the debt-strategy low/medium risk boundary
      expect(findItem(items, 'debt-strategy-auto')?.riskLevel).toBe('medium')
    })

    it('yields zero arbitrage at exactly the 7% threshold', () => {
      // interestRate 0.07 <= 0.07 still qualifies; arbitrage = 0.07 - 0.07 = 0
      // tenYear = 1200 * (1.07^10 - 1.07^10) = 0
      const profile = createPaycheckProfile({
        debts: [createDebtData({ id: 'edge', interestRate: 0.07, extraPayment: 100 })],
      })

      const item = findItem(identifySkippedOptimizations(profile), 'low-interest-debt-prepayment')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBe(0)
      expect(item!.opportunityCost.annual).toBe(0)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(0)
    })

    it('reports only the first low-interest debt when several qualify', () => {
      const profile = createPaycheckProfile({
        debts: [
          createDebtData({ id: 'a', interestRate: 0.03, extraPayment: 100 }),
          createDebtData({ id: 'b', interestRate: 0.04, extraPayment: 100 }),
        ],
      })

      const items = identifySkippedOptimizations(profile).filter(
        (item) => item.id === 'low-interest-debt-prepayment'
      )
      expect(items).toHaveLength(1)
      expect(items[0].reason).toContain('3.0%') // first debt's rate
    })
  })

  describe('missed employer match', () => {
    it('flags contributions below the match limit with lost match + growth', () => {
      // gross $8,000/mo -> annual salary 8000 * 12 = $96,000
      // matchLimit 6%, matchPercent 50%, contributing 3%:
      //   missedMatch = (96000*0.06 - 96000*0.03) * 0.5 = $1,440
      //   monthly = 1440 / 12 = $120
      //   tenYear = calculateOpportunityCost(1440, 10, 0, 0.07) + 1440 * 10
      //           = 1440 * (1.07^10 - 1) + 14400 = 1440 * 0.9671514 + 14400 = $15,792.70
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000 }),
        benefits: createBenefitsData({
          employer401k: createEmployerBenefits({ currentContribution: 0.03 }),
        }),
      })

      const item = findItem(identifySkippedOptimizations(profile), 'missed-employer-match')
      expect(item).toBeDefined()
      expect(item!.opportunityCost.monthly).toBeCloseToCurrency(120)
      expect(item!.opportunityCost.annual).toBeCloseToCurrency(1440)
      expect(item!.opportunityCost.tenYear).toBeCloseToCurrency(15792.7)
      expect(item!.riskLevel).toBe('low')
    })

    it('ignores a missed match of $100 or less', () => {
      // Contributing 5.8% of 6%: missedMatch = 96000 * 0.002 * 0.5 = $96 <= $100
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000 }),
        benefits: createBenefitsData({
          employer401k: createEmployerBenefits({ currentContribution: 0.058 }),
        }),
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'missed-employer-match')).toBeUndefined()
    })

    it('ignores the match entirely when no employer 401k is available', () => {
      const profile = createPaycheckProfile({
        benefits: createBenefitsData({
          employer401k: createEmployerBenefits({ available: false, currentContribution: 0 }),
        }),
      })

      const items = identifySkippedOptimizations(profile)
      expect(findItem(items, 'missed-employer-match')).toBeUndefined()
    })
  })

  it('returns an empty list for an already-optimized profile', () => {
    // Age 35 (no Roth case), full match, 3-month fund at 4.5% APY, no debts
    const profile: PaycheckProfile = createPaycheckProfile({
      preferences: createUserPreferences({ age: 35 }),
      debts: [],
    })

    expect(identifySkippedOptimizations(profile)).toEqual([])
  })
})

describe('analyzeInvestmentFees', () => {
  it('flags fees more than 0.2% above the 0.03% optimal ratio', () => {
    // $100,000 at 1.00% vs optimal 0.03%: excess = 0.97% -> $970/yr
    //   monthly = 970 / 12 = $80.8333
    //   twentyYear = 970 * (1.07^20 - 1.02^20) = 970 * (3.8696845 - 1.4859474) = $2,312.22
    const item = analyzeInvestmentFees(100000, 0.01)

    expect(item).not.toBeNull()
    expect(item!.id).toBe('high-investment-fees')
    expect(item!.opportunityCost.monthly).toBeCloseToCurrency(80.83)
    expect(item!.opportunityCost.annual).toBeCloseToCurrency(970)
    expect(item!.opportunityCost.twentyYear).toBeCloseToCurrency(2312.22)
    expect(item!.riskLevel).toBe('low')
  })

  it('returns null for low-cost funds and at exactly the 0.2% excess boundary', () => {
    expect(analyzeInvestmentFees(100000, 0.0005)).toBeNull()
    // excess = 0.0023 - 0.0003 = 0.002 exactly, condition is strictly > 0.002
    expect(analyzeInvestmentFees(100000, 0.0023)).toBeNull()
  })
})
