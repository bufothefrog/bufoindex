/**
 * Inflation Adjustment Test Suite
 *
 * Covers adjustForInflation / calculateInflatedIncome, the Fisher-equation
 * calculateRealReturn, calculatePurchasingPowerEquivalent,
 * calculateInflationProtectedSavings, calculateInflationAdjustedWithdrawals,
 * analyzeInflationImpact (values, breakeven, insight priorities), and the
 * calculateSequenceRiskWithInflation Monte Carlo (pinned via zero volatility,
 * which makes every simulated return exactly the mean).
 */

import { describe, expect, it } from 'vitest'
import {
  adjustForInflation,
  analyzeInflationImpact,
  calculateInflatedIncome,
  calculateInflationAdjustedWithdrawals,
  calculateInflationProtectedSavings,
  calculatePurchasingPowerEquivalent,
  calculateRealReturn,
  calculateSequenceRiskWithInflation,
} from '@/lib/calculations/inflationAdjustment'
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

describe('adjustForInflation', () => {
  it('compounds a dollar amount forward at the inflation rate', () => {
    // 1000 * 1.03^10 = 1000 * 1.3439164 = $1,343.92
    // purchasingPowerLoss = (1 - 1000/1343.9164) * 100 = 25.5906%
    const result = adjustForInflation(1000, 0.03, 10)

    expect(result.currentDollars).toBe(1000)
    expect(result.futureDollars).toBeCloseToCurrency(1343.92)
    expect(result.inflationRate).toBe(0.03)
    expect(result.yearsToInflation).toBe(10)
    expect(result.purchasingPowerLoss).toBeCloseTo(25.5906, 4)
  })

  it('returns the same value with zero purchasing power loss over zero years', () => {
    const result = adjustForInflation(5000, 0.03, 0)

    expect(result.futureDollars).toBe(5000)
    expect(result.purchasingPowerLoss).toBe(0)
  })

  it('returns the same value with zero purchasing power loss at zero inflation', () => {
    const result = adjustForInflation(5000, 0, 25)

    expect(result.futureDollars).toBe(5000)
    expect(result.purchasingPowerLoss).toBe(0)
  })

  it('handles deflation with a negative purchasing power loss (a gain)', () => {
    // 1000 * 0.98^5 = $903.92; loss = (1 - 1000/903.9208) * 100 = -10.6292%
    const result = adjustForInflation(1000, -0.02, 5)

    expect(result.futureDollars).toBeCloseToCurrency(903.92)
    expect(result.purchasingPowerLoss).toBeCloseTo(-10.6292, 4)
  })

  it('yields NaN purchasing power loss for a zero amount (0/0)', () => {
    // Documents current behavior: 0 future dollars makes the loss ratio 0/0
    const result = adjustForInflation(0, 0.03, 10)

    expect(result.futureDollars).toBe(0)
    expect(Number.isNaN(result.purchasingPowerLoss)).toBe(true)
  })
})

describe('calculateInflatedIncome', () => {
  it('delegates to adjustForInflation with identical results', () => {
    // 60000 * 1.03^30 = 60000 * 2.4272625 = $145,635.75
    const result = calculateInflatedIncome(60000, 0.03, 30)

    expect(result.futureDollars).toBeCloseToCurrency(145635.75)
    expect(result).toEqual(adjustForInflation(60000, 0.03, 30))
  })
})

describe('calculateRealReturn (Fisher equation)', () => {
  it('computes the exact Fisher real return, not the additive approximation', () => {
    // (1.07 / 1.03) - 1 = 0.0388350, not 0.07 - 0.03 = 0.04
    expect(calculateRealReturn(0.07, 0.03)).toBeCloseTo(0.038835, 6)
  })

  it('returns zero when nominal return equals inflation', () => {
    expect(calculateRealReturn(0.03, 0.03)).toBeCloseTo(0, 12)
  })

  it('returns a negative real return when inflation exceeds the nominal return', () => {
    // (1.05 / 1.08) - 1 = -0.0277778
    expect(calculateRealReturn(0.05, 0.08)).toBeCloseTo(-0.027778, 6)
  })

  it('returns the nominal return unchanged at zero inflation', () => {
    expect(calculateRealReturn(0.07, 0)).toBeCloseTo(0.07, 12)
  })
})

describe('calculatePurchasingPowerEquivalent', () => {
  it('discounts a future amount to today\'s dollars', () => {
    // 100000 / 1.03^10 = 100000 / 1.3439164 = $74,409.39
    expect(calculatePurchasingPowerEquivalent(100000, 0.03, 10)).toBeCloseToCurrency(74409.39)
  })

  it('is the exact inverse of adjustForInflation', () => {
    const inflated = adjustForInflation(12345, 0.04, 15).futureDollars
    expect(calculatePurchasingPowerEquivalent(inflated, 0.04, 15)).toBeCloseToCurrency(12345)
  })
})

describe('calculateInflationProtectedSavings', () => {
  it('computes the corpus for an inflated income under the 4% rule', () => {
    // nominal income at retirement = 60000 * 1.03^35 = 60000 * 2.8138625 = $168,831.75
    // corpus = 168831.75 / 0.04 = $4,220,793.68
    expect(calculateInflationProtectedSavings(60000, 30, 65, 0.03)).toBeCloseToCurrency(
      4220793.68
    )
  })

  it('reduces to targetIncome / 0.04 with zero years to retirement', () => {
    // 60000 / 0.04 = $1,500,000
    expect(calculateInflationProtectedSavings(60000, 65, 65, 0.03)).toBeCloseToCurrency(
      1500000
    )
  })
})

describe('calculateInflationAdjustedWithdrawals', () => {
  it('builds a year-indexed map of inflated withdrawals', () => {
    const withdrawals = calculateInflationAdjustedWithdrawals(40000, 0.03, 3)

    expect(Object.keys(withdrawals)).toEqual(['1', '2', '3'])
    // year 1: 40000 * 1.03 = $41,200 exactly
    expect(withdrawals[1].futureDollars).toBeCloseToCurrency(41200)
    // year 2: 40000 * 1.03^2 = $42,436 exactly
    expect(withdrawals[2].futureDollars).toBeCloseToCurrency(42436)
    // year 3: 40000 * 1.03^3 = $43,709.08
    expect(withdrawals[3].futureDollars).toBeCloseToCurrency(43709.08)
    // year 1 loss = (1 - 40000/41200) * 100 = 2.9126%
    expect(withdrawals[1].purchasingPowerLoss).toBeCloseTo(2.9126, 4)
  })

  it('returns an empty map for zero retirement years', () => {
    expect(calculateInflationAdjustedWithdrawals(40000, 0.03, 0)).toEqual({})
  })
})

describe('analyzeInflationImpact', () => {
  it('computes inflated income, expenses, and total corpus impact (hand-computed)', () => {
    // 35 years at 3%: multiplier 1.03^35 = 2.8138625
    //   target income: 60000 -> $168,831.75
    //   annual expenses: 4000 * 12 = 48000 -> $135,065.40
    //   corpus impact = 168831.75/0.04 - 60000/0.04 = 4220793.68 - 1500000 = $2,720,793.68
    const analysis = analyzeInflationImpact(makeInputs())

    expect(analysis.targetIncomeInflated.currentDollars).toBe(60000)
    expect(analysis.targetIncomeInflated.futureDollars).toBeCloseToCurrency(168831.75)
    expect(analysis.monthlyExpensesInflated.futureDollars).toBeCloseToCurrency(135065.4)
    expect(analysis.totalInflationImpact).toBeCloseToCurrency(2720793.68)
  })

  it('computes breakeven return and additional savings rate', () => {
    // investmentReturnNeeded is the inflation rate itself (purchasing-power breakeven)
    // Additional corpus $2,720,793.68 funded over 420 months at the effective
    // monthly rate 1.07^(1/12) - 1 = 0.00565415:
    //   pmt = 2720793.68 * 0.00565415 / (1.07^35 - 1) = $1,589.79/month
    //   savingsRateAdjustment = 1589.79 * 12 / 100000 = 0.190775
    const analysis = analyzeInflationImpact(makeInputs())

    expect(analysis.breakeven.investmentReturnNeeded).toBe(0.03)
    expect(analysis.breakeven.savingsRateAdjustment).toBeCloseTo(0.190775, 5)
  })

  it('prioritizes the high-inflation insight above 4% inflation', () => {
    const analysis = analyzeInflationImpact(makeInputs({ inflationRate: 0.05 }))

    expect(analysis.insights).toHaveLength(1)
    expect(analysis.insights[0]).toContain('High inflation alert')
  })

  it('warns about a low real return below 3%', () => {
    // real = (1.06 / 1.04) - 1 = 1.923% < 3%, inflation 4% is not > 4%
    const analysis = analyzeInflationImpact(
      makeInputs({ inflationRate: 0.04, accumulationReturn: 0.06 })
    )

    expect(analysis.insights).toHaveLength(1)
    expect(analysis.insights[0]).toContain('Real return only')
  })

  it('emits the corpus-impact insight for a long horizon at moderate inflation', () => {
    // Default inputs: impact $2.72M > 2 * $60,000 target income
    const analysis = analyzeInflationImpact(makeInputs())

    expect(analysis.insights).toHaveLength(1)
    expect(analysis.insights[0]).toContain('Inflation adds')
  })

  it('returns no insights when the inflation impact is manageable', () => {
    // 3 years at 2%: impact = 1.5M * (1.02^3 - 1) = $91,806 < 2 * $60,000
    // real return = (1.08 / 1.02) - 1 = 5.88% > 3%; inflation 2% <= 4%
    const analysis = analyzeInflationImpact(
      makeInputs({ inflationRate: 0.02, accumulationReturn: 0.08, retirementAge: 33 })
    )

    expect(analysis.insights).toEqual([])
  })
})

describe('calculateSequenceRiskWithInflation', () => {
  it('matches the closed-form balance path at zero volatility (all sims identical)', () => {
    // With volatility 0 every yearly return is exactly 5%, so the balance follows
    //   b_N = b0 * 1.05^N - W * (1.05^N - 1.03^N) / (1.05 - 1.03)
    // For b0 = $1,000,000, W = $40,000, N = 30:
    //   = 1000000 * 4.3219424 - 40000 * (4.3219424 - 2.4272625) / 0.02
    //   = 4321942.4 - 3789359.8 = $532,582.57
    const result = calculateSequenceRiskWithInflation(1000000, 40000, 0.05, 0, 0.03, 30, 10)

    expect(result.successRate).toBe(1)
    expect(result.medianFinalBalance).toBeCloseToCurrency(532582.57)
    expect(result.worstCase10thPercentile).toBeCloseToCurrency(532582.57)
  })

  it('reports total failure when withdrawals deterministically exhaust the balance', () => {
    // b0 = $500,000: 500000 * 4.3219424 = $2,160,971 < $3,789,360 of withdrawals,
    // so every simulation hits zero before year 30.
    const result = calculateSequenceRiskWithInflation(500000, 40000, 0.05, 0, 0.03, 30, 10)

    expect(result.successRate).toBe(0)
    expect(result.medianFinalBalance).toBe(0)
    expect(result.worstCase10thPercentile).toBe(0)
  })

  it('keeps ordering invariants under random volatility', () => {
    // Non-deterministic path: only assert properties that hold for any draw
    const result = calculateSequenceRiskWithInflation(1000000, 40000, 0.07, 0.12, 0.03, 30, 200)

    expect(result.successRate).toBeGreaterThanOrEqual(0)
    expect(result.successRate).toBeLessThanOrEqual(1)
    expect(result.worstCase10thPercentile).toBeLessThanOrEqual(result.medianFinalBalance)
  })
})
