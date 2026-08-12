/**
 * Scenario Analysis Test Suite
 *
 * Covers the unified status thresholds (determineRetirementStatus) and the
 * analyzeRetirementScenarios projections with hand-computed values.
 */

import { describe, expect, it } from 'vitest'
import {
  analyzeRetirementScenarios,
  determineRetirementStatus,
} from '@/lib/calculations/scenarioAnalysis'
import {
  calculateProjectedBalance,
  type RetirementInputs,
} from '@/lib/calculations/retirement'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

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

describe('determineRetirementStatus', () => {
  it('returns "exceeding" at ratio >= 1.2 with success > 0.85', () => {
    expect(determineRetirementStatus(1.2, 0.86)).toBe('exceeding')
    expect(determineRetirementStatus(2.0, 0.99)).toBe('exceeding')
  })

  it('returns "exceeding" at ratio >= 1.2 when no success rate is supplied', () => {
    expect(determineRetirementStatus(1.5)).toBe('exceeding')
  })

  it('demotes a high ratio to "onTrack" when success <= 0.85', () => {
    // Ratio qualifies for exceeding, but the success-rate guard fails; the
    // onTrack tier (ratio >= 0.9, success >= 0.70) still accepts it.
    expect(determineRetirementStatus(1.5, 0.80)).toBe('onTrack')
  })

  it('returns "onTrack" between 0.9 and 1.2 with adequate success', () => {
    expect(determineRetirementStatus(0.9, 0.70)).toBe('onTrack')
    expect(determineRetirementStatus(1.1, 0.75)).toBe('onTrack')
  })

  it('returns "falling" below a 0.9 ratio regardless of success rate', () => {
    expect(determineRetirementStatus(0.89, 0.99)).toBe('falling')
    expect(determineRetirementStatus(0.2)).toBe('falling')
  })

  it('returns "falling" when the success rate is below 0.70', () => {
    expect(determineRetirementStatus(1.0, 0.69)).toBe('falling')
  })
})

describe('analyzeRetirementScenarios', () => {
  it('computes the current projected and required balances (hand-checked)', () => {
    const inputs = makeInputs()
    const analysis = analyzeRetirementScenarios(inputs)

    expect(analysis.current.projectedBalance).toBeCloseToCurrency(
      calculateProjectedBalance(inputs),
      2,
    )
    // Required = inflated target income / 4%: 60000 * 1.03^35 / 0.04.
    const expectedRequired = (60000 * Math.pow(1.03, 35)) / 0.04
    expect(analysis.current.requiredBalance).toBeCloseToCurrency(
      expectedRequired,
      2,
    )
  })

  it('adds the future value of an extra $500/month annuity to the projection', () => {
    const inputs = makeInputs()
    const analysis = analyzeRetirementScenarios(inputs)

    // Extra $500/month for 35 years at 7% (monthly compounding):
    // 500 * ((1+r_m)^420 - 1) / r_m, r_m = 1.07^(1/12) - 1.
    const monthlyRate = Math.pow(1.07, 1 / 12) - 1
    const extraAnnuity =
      500 * ((Math.pow(1 + monthlyRate, 420) - 1) / monthlyRate)
    expect(
      analysis.withExtra500.projectedBalance - analysis.current.projectedBalance,
    ).toBeCloseToCurrency(extraAnnuity, 2)

    // And $1000/month adds exactly twice that.
    expect(
      analysis.withExtra1000.projectedBalance - analysis.current.projectedBalance,
    ).toBeCloseToCurrency(2 * extraAnnuity, 2)
  })

  it('reports achievable income via the 4% rule when falling short', () => {
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 100,
      targetIncome: 200000,
    })
    const analysis = analyzeRetirementScenarios(inputs)
    expect(analysis.status).toBe('falling')
    expect(analysis.current.canRetireAtAge).toBeDefined()
    // incomeAtTargetAge = 4% of the projected balance (retirement-date dollars).
    expect(analysis.current.incomeAtTargetAge).toBeCloseToCurrency(
      calculateProjectedBalance(inputs) * 0.04,
      2,
    )
  })

  it('reports a surplus when exceeding the target', () => {
    const inputs = makeInputs({
      startingBalance: 5_000_000,
      monthlySavings: 10000,
      targetIncome: 30000,
    })
    const analysis = analyzeRetirementScenarios(inputs)
    expect(analysis.status).toBe('exceeding')
    expect(analysis.current.surplusAmount).toBeCloseToCurrency(
      analysis.current.projectedBalance - analysis.current.requiredBalance,
      2,
    )
  })

  it('returns at most one focused recommendation', () => {
    const analysis = analyzeRetirementScenarios(makeInputs())
    expect(Array.isArray(analysis.recommendations)).toBe(true)
    expect(analysis.recommendations.length).toBeLessThanOrEqual(1)
  })
})
