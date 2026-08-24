/**
 * Coast FIRE Test Suite
 *
 * Covers calculateCoastFireNumber (present value of the inflated 4%-rule
 * target), isCoastFireAchieved, calculateCoastFire (already-achieved,
 * achievable-later, and unachievable paths), calculateTimeToCoastFire, and
 * calculateCoastFireAnalysis scenarios/insights.
 *
 * The compounding chain under test:
 *   inflatedIncome = targetIncome * (1 + inflation)^years
 *   requiredBalance = inflatedIncome / withdrawalRate
 *   coastNumber = requiredBalance / (1 + return)^years
 */

import { describe, expect, it } from 'vitest'
import {
  calculateCoastFire,
  calculateCoastFireAnalysis,
  calculateCoastFireNumber,
  calculateTimeToCoastFire,
  isCoastFireAchieved,
} from '@/lib/calculations/coastFire'
import type { RetirementInputs } from '@/lib/calculations/retirement'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

/**
 * Helper: deterministic RetirementInputs matching the interface, with
 * per-test overrides. Mirrors the makeInputs helper in retirement.test.ts.
 */
function makeInputs(overrides: Partial<RetirementInputs> = {}): RetirementInputs {
  return {
    startingAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    targetIncome: 60000,
    startingBalance: 50000,
    currentIncome: 100000,
    incomeAmount: 100000,
    incomePeriod: 'yearly',
    monthlySavings: 1500,
    necessaryMonthlyExpenses: 4000,
    accumulationReturn: 0.07,
    retirementReturn: 0.05,
    inflationRate: 0.03,
    socialSecurityAge: 67,
    socialSecurityBenefit: 24000,
    healthcareCostMultiplier: 1,
    volatility: 0.15,
    filingStatus: 'single',
    state: 'CA',
    riskProfile: 'custom',
    effectiveTaxRate: null,
    estimatedAnnualHealthcareCost: null,
    ...overrides,
  }
}

describe('calculateCoastFireNumber', () => {
  it('discounts the 4%-rule balance with zero inflation (hand-computed)', () => {
    // $40,000 target, 20 years, 7% return, 0% inflation:
    //   required = 40000 / 0.04 = $1,000,000
    //   coast = 1000000 / 1.07^20 = 1000000 / 3.8696844625 = $258,419.00
    expect(calculateCoastFireNumber(40000, 40, 60, 0.07, 0.04, 0)).toBeCloseToCurrency(258419.0)
  })

  it('inflates the target income before discounting (default 3% inflation)', () => {
    // $60,000 target, 35 years, 7% return, defaults 4% withdrawal / 3% inflation:
    //   inflated = 60000 * 1.03^35 = 60000 * 2.8138625 = $168,831.75
    //   required = 168831.75 / 0.04 = $4,220,793.68
    //   coast = 4220793.68 / 1.07^35 = 4220793.68 / 10.6765815 = $395,331.94
    expect(calculateCoastFireNumber(60000, 30, 65, 0.07)).toBeCloseToCurrency(395331.94)
  })

  it('equals the full required balance when already at retirement age', () => {
    // 0 years: inflation and discounting factors are both (x)^0 = 1
    // coast = 60000 / 0.04 = $1,500,000
    expect(calculateCoastFireNumber(60000, 65, 65, 0.07)).toBeCloseToCurrency(1500000)
  })

  it('honors a custom withdrawal rate', () => {
    // 3% withdrawal: required = 40000 * 1.03^20 / 0.03 = 72244.4494 / 0.03 = $2,408,148.31
    //   coast = 2408148.31 / 1.07^20 = $622,311.29
    expect(calculateCoastFireNumber(40000, 40, 60, 0.07, 0.03, 0.03)).toBeCloseToCurrency(622311.29)
  })

  it('requires the full balance today at zero return', () => {
    // 0% return, 0% inflation: no growth to coast on
    // coast = required = 40000 / 0.04 = $1,000,000
    expect(calculateCoastFireNumber(40000, 40, 60, 0, 0.04, 0)).toBeCloseToCurrency(1000000)
  })

  it('compounds back to the required balance (round-trip identity)', () => {
    // coast * 1.07^20 must equal required = 40000 * 1.03^20 / 0.04 = $1,806,111.23
    const coast = calculateCoastFireNumber(40000, 40, 60, 0.07, 0.04, 0.03)
    expect(coast * Math.pow(1.07, 20)).toBeCloseToCurrency(1806111.23)
  })
})

describe('isCoastFireAchieved', () => {
  // Same parameters as the coast number they are compared against
  // (isCoastFireAchieved always uses the default 3% inflation)
  const coastNumber = calculateCoastFireNumber(40000, 40, 60, 0.07, 0.04)

  it('returns true when the balance exactly equals the coast number', () => {
    expect(isCoastFireAchieved(coastNumber, 40000, 40, 60, 0.07, 0.04)).toBe(true)
  })

  it('returns false one dollar below the coast number', () => {
    expect(isCoastFireAchieved(coastNumber - 1, 40000, 40, 60, 0.07, 0.04)).toBe(false)
  })

  it('returns true comfortably above the coast number', () => {
    expect(isCoastFireAchieved(coastNumber * 2, 40000, 40, 60, 0.07, 0.04)).toBe(true)
  })
})

describe('calculateCoastFire', () => {
  // Already-achieved scenario: 45 -> 65, $40,000 target, 3% inflation, 7% return
  //   inflated = 40000 * 1.03^20 = $72,244.45
  //   requiredBalance = 72244.45 / 0.04 = $1,806,111.23
  //   currentBalanceNeeded = 1806111.23 / 1.07^20 = $466,733.46
  //   startingBalance $500,000 >= needed -> achieved immediately
  const achievedInputs = makeInputs({
    startingAge: 45,
    retirementAge: 65,
    targetIncome: 40000,
    startingBalance: 500000,
  })

  // Achievable-later scenario: 30 -> 65, $60,000 target, $50,000 balance, $4,000/mo
  //   requiredBalance = 60000 * 1.03^35 / 0.04 = $4,220,793.68
  //   currentBalanceNeeded = 4220793.68 / 1.07^35 = $395,331.94
  //   Coast age: first age where (50000 * 1.07^t + 4000 * annuityFV(t)) * 1.07^(35-t)
  //   >= 4,220,793.68 with monthly rate 1.07^(1/12) - 1 = 0.00565415:
  //     t = 9:  $3,978,543 (short)
  //     t = 10: $4,247,316 (achieved) -> age 40
  const laterInputs = makeInputs({ monthlySavings: 4000 })

  it('reports immediate achievement when the balance already covers the coast number', () => {
    const result = calculateCoastFire(achievedInputs)

    expect(result.isAchievable).toBe(true)
    expect(result.ageAchievable).toBe(45)
    expect(result.currentAge).toBe(45)
    expect(result.targetAge).toBe(65)
    expect(result.requiredBalance).toBeCloseToCurrency(1806111.23)
    expect(result.currentBalanceNeeded).toBeCloseToCurrency(466733.46)
    expect(result.yearsToCoast).toBe(0)
    expect(result.monthlyContributionsUntilCoast).toBe(0)
    expect(result.totalContributionsNeeded).toBe(0)
  })

  it('finds the coast age and required contributions for a future achiever', () => {
    const result = calculateCoastFire(laterInputs)

    expect(result.isAchievable).toBe(true)
    expect(result.ageAchievable).toBe(40)
    expect(result.yearsToCoast).toBe(10)
    expect(result.requiredBalance).toBeCloseToCurrency(4220793.68)
    expect(result.currentBalanceNeeded).toBeCloseToCurrency(395331.94)
    // PMT for the shortfall over 10 years at the effective monthly rate:
    //   shortfall = 395331.94 - 50000 = $345,331.94
    //   pmt = 345331.94 * 0.00565415 / (1.00565415^120 - 1)
    //       = 345331.94 * 0.00565415 / (1.07^10 - 1) = $2,018.87
    expect(result.monthlyContributionsUntilCoast).toBeCloseToCurrency(2018.87)
    // total = pmt * 120 = $242,264.91
    expect(result.totalContributionsNeeded).toBeCloseToCurrency(242264.91)
  })

  it('reports unachievable when savings never reach the coast number', () => {
    // $10,000 with no contributions coasts to 10000 * 1.07^35 = $106,766,
    // far below the $4.22M required balance at every age in the search window.
    const result = calculateCoastFire(makeInputs({ startingBalance: 10000, monthlySavings: 0 }))

    expect(result.isAchievable).toBe(false)
    expect(result.ageAchievable).toBeUndefined()
    expect(result.yearsToCoast).toBeUndefined()
    expect(result.monthlyContributionsUntilCoast).toBeUndefined()
    expect(result.totalContributionsNeeded).toBeUndefined()
    // The coast number itself is still reported
    expect(result.currentBalanceNeeded).toBeCloseToCurrency(395331.94)
  })

  it('calculateTimeToCoastFire splits the coast horizon into years and months', () => {
    expect(calculateTimeToCoastFire(laterInputs)).toEqual({
      years: 10,
      months: 0,
      totalMonths: 120,
    })
  })

  it('calculateTimeToCoastFire returns null when already achieved (yearsToCoast 0)', () => {
    expect(calculateTimeToCoastFire(achievedInputs)).toBeNull()
  })

  it('calculateTimeToCoastFire returns null when unachievable', () => {
    expect(calculateTimeToCoastFire(makeInputs({ startingBalance: 10000, monthlySavings: 0 }))).toBeNull()
  })

  describe('calculateCoastFireAnalysis', () => {
    it('orders scenario coast numbers by return rate', () => {
      const analysis = calculateCoastFireAnalysis(laterInputs)
      const { conservative, moderate, aggressive } = analysis.scenarios

      // Higher assumed return -> smaller balance needed today
      expect(conservative.currentBalanceNeeded!).toBeGreaterThan(moderate.currentBalanceNeeded!)
      expect(moderate.currentBalanceNeeded!).toBeGreaterThan(aggressive.currentBalanceNeeded!)
      // Moderate scenario (7%) matches the base inputs (also 7%)
      expect(moderate.currentBalanceNeeded).toBeCloseToCurrency(395331.94)
      expect(analysis.current.currentBalanceNeeded).toBeCloseToCurrency(395331.94)
    })

    it('emits an achieved insight when coasting is already possible', () => {
      const analysis = calculateCoastFireAnalysis(achievedInputs)

      expect(analysis.insights).toHaveLength(1)
      expect(analysis.insights[0]).toContain('Coast FIRE achieved')
    })

    it('emits a coast-age insight when achievable within ten years', () => {
      const analysis = calculateCoastFireAnalysis(laterInputs)

      expect(analysis.insights).toHaveLength(1)
      expect(analysis.insights[0]).toContain('Coast FIRE at age 40')
    })

    it('emits an additional-savings insight when a modest top-up would enable coasting', () => {
      // Base makeInputs ($1,500/mo, $50k) never reaches the coast number:
      //   shortfall = 395331.94 - 50000 = $345,331.94 over 420 months
      //   additional = round(345331.94 / 420) = $822/month, below 20% of income
      const analysis = calculateCoastFireAnalysis(makeInputs())

      expect(analysis.current.isAchievable).toBe(false)
      expect(analysis.insights).toHaveLength(1)
      expect(analysis.insights[0]).toContain('Add $822/month')
    })
  })
})
