/**
 * Retirement Calculations Test Suite
 *
 * Covers TVM math, Social Security adjustments, healthcare cost inflation,
 * effective tax-rate calculation against IRS 2026 brackets, Monte Carlo
 * sustainability, and the full calculateRetirementAnalysis orchestrator.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  annualizeIncome,
  calculateEffectiveTaxRate,
  calculateHealthcareCosts,
  calculateProjectedBalance,
  calculateRequiredBalance,
  calculateRetirementAnalysis,
  calculateSafeWithdrawalRate,
  calculateSocialSecurityBenefit,
  futureValue,
  futureValueOfAnnuity,
  INCOME_PERIOD_MULTIPLIERS,
  presentValue,
  runMonteCarloSimulation,
  type IncomePeriod,
  type RetirementInputs,
} from '@/lib/calculations/retirement'
import { RetirementConstants } from '@/lib/constants/retirement'
import {
  STANDARD_DEDUCTIONS_2026,
  FEDERAL_TAX_BRACKETS_2026,
} from '@/lib/constants/irs-2026'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

/**
 * Helper: produce a deterministic, typical-case set of retirement inputs
 * matching the RetirementInputs interface. Use overrides per-test.
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

describe('annualizeIncome / INCOME_PERIOD_MULTIPLIERS', () => {
  it('uses 2080 hours/year for hourly income (40hrs * 52wks)', () => {
    expect(INCOME_PERIOD_MULTIPLIERS.hourly).toBe(2080)
    expect(annualizeIncome(50, 'hourly')).toBe(104000)
  })

  it('uses 26 pay periods for biweekly income', () => {
    expect(INCOME_PERIOD_MULTIPLIERS.biweekly).toBe(26)
    expect(annualizeIncome(2000, 'biweekly')).toBe(52000)
  })

  it('uses 24 pay periods for semimonthly income', () => {
    expect(INCOME_PERIOD_MULTIPLIERS.semimonthly).toBe(24)
    expect(annualizeIncome(2000, 'semimonthly')).toBe(48000)
  })

  it('uses 12 for monthly and 1 for yearly', () => {
    expect(annualizeIncome(5000, 'monthly')).toBe(60000)
    expect(annualizeIncome(60000, 'yearly')).toBe(60000)
  })

  it('returns 0 for zero income across every period', () => {
    const periods: IncomePeriod[] = [
      'hourly',
      'biweekly',
      'semimonthly',
      'monthly',
      'yearly',
    ]
    periods.forEach((period) => expect(annualizeIncome(0, period)).toBe(0))
  })

  it('preserves sign for negative inputs (no clamping at this layer)', () => {
    expect(annualizeIncome(-100, 'monthly')).toBe(-1200)
  })
})

describe('Time-Value-of-Money math', () => {
  describe('futureValue', () => {
    it('matches the canonical $10k @ 7% / 10y compound case', () => {
      // Same fixture used in core.test.ts for cross-module sanity.
      expect(futureValue(10000, 0.07, 10)).toBeCloseToCurrency(19671.51, 2)
    })

    it('returns the principal when periods = 0', () => {
      expect(futureValue(12345, 0.08, 0)).toBe(12345)
    })

    it('returns the principal when rate = 0', () => {
      expect(futureValue(12345, 0, 30)).toBe(12345)
    })

    it('returns 0 when principal is 0', () => {
      expect(futureValue(0, 0.07, 30)).toBe(0)
    })

    it('handles negative returns (market crash) without crashing', () => {
      // -50% over 2 years => 0.25 * principal.
      expect(futureValue(10000, -0.5, 2)).toBeCloseToCurrency(2500, 6)
    })

    it('is the inverse of presentValue', () => {
      const fv = futureValue(10000, 0.07, 25)
      expect(presentValue(fv, 0.07, 25)).toBeCloseToCurrency(10000, 2)
    })
  })

  describe('presentValue', () => {
    it('discounts $100k @ 7% / 10y to ~$50,834.93', () => {
      expect(presentValue(100000, 0.07, 10)).toBeCloseToCurrency(50834.93, 2)
    })

    it('returns the future value unchanged when rate = 0', () => {
      expect(presentValue(50000, 0, 15)).toBe(50000)
    })
  })

  describe('futureValueOfAnnuity', () => {
    it('returns payment * periods when rate = 0 (avoids divide-by-zero)', () => {
      // This is the explicit zero-rate branch in retirement.ts.
      expect(futureValueOfAnnuity(1000, 0, 120)).toBe(120000)
    })

    it('matches a hand-computed annuity at 1%/period', () => {
      // FV = P * ((1+r)^n - 1)/r ; P=$100, r=0.01, n=12 => 100*(1.01^12 - 1)/0.01
      const expected = 100 * ((Math.pow(1.01, 12) - 1) / 0.01)
      expect(futureValueOfAnnuity(100, 0.01, 12)).toBeCloseToCurrency(expected, 6)
    })

    it('returns 0 for zero payment', () => {
      expect(futureValueOfAnnuity(0, 0.07 / 12, 360)).toBe(0)
    })

    it('returns 0 when periods = 0 regardless of rate', () => {
      expect(futureValueOfAnnuity(500, 0.05, 0)).toBe(0)
      expect(futureValueOfAnnuity(500, 0, 0)).toBe(0)
    })
  })
})

describe('calculateRequiredBalance', () => {
  it('uses the 4% rule by default', () => {
    expect(calculateRequiredBalance(40000)).toBeCloseToCurrency(1000000, 2)
  })

  it('honours a custom withdrawal rate', () => {
    expect(calculateRequiredBalance(40000, 0.035)).toBeCloseToCurrency(
      40000 / 0.035,
      2,
    )
  })

  it('returns 0 when target income is 0', () => {
    expect(calculateRequiredBalance(0)).toBe(0)
  })

  it('exposes the configured WITHDRAWAL_RATE constant', () => {
    expect(RetirementConstants.WITHDRAWAL_RATE).toBe(0.04)
  })
})

describe('calculateProjectedBalance — custom risk profile', () => {
  it('grows starting balance + monthly contributions over the horizon', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 65,
      startingBalance: 50000,
      monthlySavings: 1500,
      accumulationReturn: 0.07,
      riskProfile: 'custom',
    })
    const years = 35
    const monthlyRate = Math.pow(1.07, 1 / 12) - 1
    const expectedFromBalance = 50000 * Math.pow(1.07, years)
    const expectedFromContributions =
      1500 * ((Math.pow(1 + monthlyRate, years * 12) - 1) / monthlyRate)
    const expected = expectedFromBalance + expectedFromContributions

    expect(calculateProjectedBalance(inputs)).toBeCloseToCurrency(expected, 2)
  })

  it('returns just the starting balance when retirementAge equals startingAge', () => {
    const inputs = makeInputs({
      startingAge: 50,
      retirementAge: 50,
      startingBalance: 250000,
      monthlySavings: 9999, // should not contribute when years=0
      riskProfile: 'custom',
    })
    expect(calculateProjectedBalance(inputs)).toBeCloseToCurrency(250000, 2)
  })

  it('handles a zero accumulation return (linear contributions)', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 40,
      startingBalance: 0,
      monthlySavings: 1000,
      accumulationReturn: 0,
      riskProfile: 'custom',
    })
    // 10 years * 12 months * $1000 = $120,000 (FV of annuity at r=0).
    expect(calculateProjectedBalance(inputs)).toBeCloseToCurrency(120000, 6)
  })

  it('produces a strictly larger balance with more years to retirement', () => {
    const base = makeInputs({ retirementAge: 60, riskProfile: 'custom' })
    const longer = makeInputs({ retirementAge: 65, riskProfile: 'custom' })
    expect(calculateProjectedBalance(longer)).toBeGreaterThan(
      calculateProjectedBalance(base),
    )
  })
})

describe('calculateProjectedBalance — TDF risk profile', () => {
  it('produces a positive balance for a typical young saver', () => {
    const inputs = makeInputs({ riskProfile: 'tdf' })
    expect(calculateProjectedBalance(inputs)).toBeGreaterThan(50000)
  })

  it('produces a different balance than the custom profile (different glide path)', () => {
    const tdf = makeInputs({ riskProfile: 'tdf', accumulationReturn: 0.07 })
    const custom = makeInputs({ riskProfile: 'custom', accumulationReturn: 0.07 })
    // TDF return is age-dependent; should not coincidentally match a flat 7%.
    expect(calculateProjectedBalance(tdf)).not.toBeCloseTo(
      calculateProjectedBalance(custom),
      -3, // within $1000 would be a coincidence; assert NOT within
    )
  })

  it('returns starting balance when starting age equals retirement age', () => {
    const inputs = makeInputs({
      startingAge: 60,
      retirementAge: 60,
      startingBalance: 500000,
      riskProfile: 'tdf',
    })
    expect(calculateProjectedBalance(inputs)).toBeCloseToCurrency(500000, 2)
  })
})

describe('calculateSafeWithdrawalRate', () => {
  it('returns 0 when projected balance is 0', () => {
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 0,
      retirementAge: 65,
      startingAge: 65, // zero years, zero contributions, zero balance
      accumulationReturn: 0.07,
    })
    expect(calculateSafeWithdrawalRate(inputs)).toBe(0)
  })

  it('reflects the inflation-adjusted target income at retirement', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 65,
      targetIncome: 60000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    const projected = calculateProjectedBalance(inputs)
    const inflated = 60000 * Math.pow(1.03, 35)
    const expected = inflated / projected
    expect(calculateSafeWithdrawalRate(inputs)).toBeCloseTo(expected, 6)
  })

  it('falls below the conservative 4% rule when severely under-saved', () => {
    const inputs = makeInputs({
      startingBalance: 10,
      monthlySavings: 1,
      targetIncome: 100000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    // Tiny savings vs $100k target => required SWR will exceed 4%.
    expect(calculateSafeWithdrawalRate(inputs)).toBeGreaterThan(0.04)
  })
})

describe('calculateSocialSecurityBenefit', () => {
  const fra = RetirementConstants.SS_FULL_RETIREMENT_AGE // 67

  it('returns base benefit when claiming exactly at FRA', () => {
    expect(calculateSocialSecurityBenefit(2000, fra)).toBe(2000)
  })

  it('returns 0 below the minimum claiming age (62)', () => {
    expect(calculateSocialSecurityBenefit(2000, 61)).toBe(0)
    expect(calculateSocialSecurityBenefit(2000, 50)).toBe(0)
  })

  it('caps benefit growth at the maximum claiming age (70)', () => {
    // Claiming at 71 should be treated identically to 70.
    const at70 = calculateSocialSecurityBenefit(2000, 70)
    const at75 = calculateSocialSecurityBenefit(2000, 75)
    expect(at75).toBe(at70)
  })

  it('applies the SSA two-tier early-claiming reduction at 62', () => {
    // 60 months early = 36 months @ 5/9% + 24 months @ 5/12% = 30%.
    const reduced = calculateSocialSecurityBenefit(2000, 62)
    const expected = 2000 * (1 - (36 * (5 / 9 / 100) + 24 * (5 / 12 / 100)))
    expect(reduced).toBeCloseToCurrency(expected, 4)
    // Sanity: at 62, the reduction is exactly 30% of base benefit.
    expect(reduced).toBeCloseToCurrency(2000 * 0.7, 4)
  })

  it('uses the single-tier reduction (5/9%) when claiming within 36 months of FRA', () => {
    // Claim at 64 => 36 months early => reductionPercent = 36 * 5/9% = 20%.
    const reduced = calculateSocialSecurityBenefit(2000, 64)
    expect(reduced).toBeCloseToCurrency(2000 * 0.8, 4)
  })

  it('applies delayed retirement credits for claiming after FRA', () => {
    // Claim at 70 = 3 years delayed * 8% = 24% boost.
    const boosted = calculateSocialSecurityBenefit(2000, 70)
    expect(boosted).toBeCloseToCurrency(2000 * 1.24, 4)
  })

  it('scales monotonically across early/FRA/delayed regions', () => {
    const at62 = calculateSocialSecurityBenefit(2000, 62)
    const atFra = calculateSocialSecurityBenefit(2000, fra)
    const at70 = calculateSocialSecurityBenefit(2000, 70)
    expect(at62).toBeLessThan(atFra)
    expect(atFra).toBeLessThan(at70)
  })
})

describe('calculateHealthcareCosts', () => {
  const baseCost = RetirementConstants.HEALTHCARE_BASE_COST // 7500
  const hcInflation = RetirementConstants.HEALTHCARE_INFLATION_RATE // 0.055

  it('returns the base cost at age <65 with no inflation horizon and no multiplier', () => {
    expect(calculateHealthcareCosts(40, 1, 0)).toBeCloseToCurrency(baseCost, 6)
  })

  it('scales with the multiplier', () => {
    expect(calculateHealthcareCosts(40, 2, 0)).toBeCloseToCurrency(baseCost * 2, 6)
  })

  it('compounds healthcare-specific inflation over time', () => {
    const expected = baseCost * Math.pow(1 + hcInflation, 10)
    expect(calculateHealthcareCosts(50, 1, 10)).toBeCloseToCurrency(expected, 4)
  })

  it('applies a 2%/year age multiplier above 65', () => {
    // At 75, ageMultiplier = 1 + (10 * 0.02) = 1.2.
    const expected = baseCost * Math.pow(1 + hcInflation, 5) * 1.2
    expect(calculateHealthcareCosts(75, 1, 5)).toBeCloseToCurrency(expected, 4)
  })

  it('does not apply the age multiplier exactly at 64', () => {
    // 64 is below 65 — multiplier branch should not activate.
    const at64 = calculateHealthcareCosts(64, 1, 0)
    expect(at64).toBeCloseToCurrency(baseCost, 6)
  })

  it('applies a unit (1.0) age multiplier at exactly 65', () => {
    // At 65, ageMultiplier = 1 + 0 = 1.
    expect(calculateHealthcareCosts(65, 1, 0)).toBeCloseToCurrency(baseCost, 6)
  })
})

describe('calculateEffectiveTaxRate', () => {
  it('returns 0 for zero income (avoids divide-by-zero)', () => {
    expect(calculateEffectiveTaxRate(0, 'single')).toBe(0)
  })

  it('returns 0 when income is fully absorbed by the standard deduction', () => {
    // Income < single standard deduction (16,100) => taxableIncome=0 => tax=0.
    expect(
      calculateEffectiveTaxRate(STANDARD_DEDUCTIONS_2026.single - 1, 'single'),
    ).toBe(0)
  })

  it('matches a hand-computed tax for a $75k single filer (2026 brackets)', () => {
    // taxable = 75000 - 16100 = 58900.
    // Bracket walk: 12,400 @10% + (50,400-12,400) @12% + (58,900-50,400) @22%.
    const taxable = 75000 - STANDARD_DEDUCTIONS_2026.single
    const tier1 = 12400 * 0.10
    const tier2 = (50400 - 12400) * 0.12
    const tier3 = (taxable - 50400) * 0.22
    const expectedTax = tier1 + tier2 + tier3
    const expectedRate = expectedTax / 75000
    expect(calculateEffectiveTaxRate(75000, 'single')).toBeCloseTo(expectedRate, 6)
  })

  it('uses the MFJ brackets when filing married-jointly', () => {
    // At $200k MFJ, taxable = 200000 - 32200 = 167800.
    // Bracket walk through MFJ tiers.
    const taxable = 200000 - STANDARD_DEDUCTIONS_2026.marriedFilingJointly
    let tax = 0
    for (const bracket of FEDERAL_TAX_BRACKETS_2026.marriedFilingJointly) {
      if (taxable <= bracket.min) break
      const slice = Math.min(taxable, bracket.max) - bracket.min
      tax += slice * bracket.rate
    }
    const expectedRate = tax / 200000
    expect(calculateEffectiveTaxRate(200000, 'marriedJoint')).toBeCloseTo(
      expectedRate,
      6,
    )
  })

  it('produces a higher effective rate for higher incomes (progressive)', () => {
    const low = calculateEffectiveTaxRate(50000, 'single')
    const mid = calculateEffectiveTaxRate(150000, 'single')
    const high = calculateEffectiveTaxRate(500000, 'single')
    expect(mid).toBeGreaterThan(low)
    expect(high).toBeGreaterThan(mid)
  })

  it('always returns a rate strictly less than the top marginal rate', () => {
    // Effective rate < 37% even at $1M.
    expect(calculateEffectiveTaxRate(1_000_000, 'single')).toBeLessThan(0.37)
  })
})

describe('runMonteCarloSimulation', () => {
  // Determinism: stub Math.random so we get consistent normal draws.
  let randSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // 0.5 maps to a stable, finite Box-Muller value (not log(0)).
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    randSpy.mockRestore()
  })

  it('returns 1.0 (always succeeds) for an over-funded scenario', () => {
    const inputs = makeInputs({
      startingBalance: 5_000_000,
      monthlySavings: 5000,
      targetIncome: 30000, // tiny withdrawals vs huge balance
      retirementReturn: 0.05,
      volatility: 0.0001, // near-zero variance => deterministic success
      lifeExpectancy: 85,
      retirementAge: 65,
    })
    const successRate = runMonteCarloSimulation(inputs, 50)
    expect(successRate).toBe(1)
  })

  it('returns 0.0 (always fails) for a wildly under-funded scenario', () => {
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 0,
      targetIncome: 100000,
      retirementReturn: 0.0,
      volatility: 0.0001,
      lifeExpectancy: 95,
      retirementAge: 65,
    })
    const successRate = runMonteCarloSimulation(inputs, 50)
    expect(successRate).toBe(0)
  })

  it('returns a value in [0, 1] across mixed scenarios', () => {
    const inputs = makeInputs({
      startingBalance: 200_000,
      monthlySavings: 1000,
      targetIncome: 60000,
      retirementReturn: 0.05,
      volatility: 0.15,
    })
    const rate = runMonteCarloSimulation(inputs, 50)
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThanOrEqual(1)
  })
})

describe('calculateRetirementAnalysis (orchestrator)', () => {
  // The orchestrator runs ~1000-iteration Monte Carlo across multiple scenarios.
  // Stub Math.random for both speed and determinism.
  let randSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    randSpy.mockRestore()
  })

  it('returns the documented top-level shape', () => {
    const result = calculateRetirementAnalysis(makeInputs())
    expect(Array.isArray(result.scenarios)).toBe(true)
    expect(result.scenarios.length).toBeGreaterThan(0)
    expect(typeof result.netWorthByAge).toBe('object')
    expect(typeof result.withdrawalsByAge).toBe('object')
    expect(Array.isArray(result.insights)).toBe(true)
    expect(typeof result.safeWithdrawalRate).toBe('number')
    expect(result.scenarioAnalysis).toBeDefined()
    expect(result.coastFireAnalysis).toBeDefined()
    expect(result.inflationAnalysis).toBeDefined()
  })

  it('limits insights to a maximum of 3 entries', () => {
    // The prioritizeInsights cap is 3 by design; verify the contract.
    const result = calculateRetirementAnalysis(makeInputs())
    expect(result.insights.length).toBeLessThanOrEqual(3)
  })

  it('emits a netWorthByAge entry for every age from start to lifeExpectancy', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    for (let age = inputs.startingAge; age <= inputs.lifeExpectancy; age++) {
      expect(
        result.netWorthByAge[age],
        `expected netWorthByAge[${age}] to exist`,
      ).toBeDefined()
    }
  })

  it('emits withdrawalsByAge only during the retirement years', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    // Pre-retirement years should NOT have a withdrawal entry.
    expect(result.withdrawalsByAge[30]).toBeUndefined()
    expect(result.withdrawalsByAge[64]).toBeUndefined()
    // Retirement years should have one.
    expect(result.withdrawalsByAge[65]).toBeGreaterThan(0)
    expect(result.withdrawalsByAge[85]).toBeGreaterThan(0)
  })

  it('inflation-adjusts the first retirement-year withdrawal to the target income at retirement', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      targetIncome: 60000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    const expectedFirstYear = 60000 * Math.pow(1.03, 35)
    expect(result.withdrawalsByAge[65]).toBeCloseToCurrency(expectedFirstYear, 0)
  })

  it('compounds withdrawal inflation year-over-year during retirement', () => {
    const inputs = makeInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      targetIncome: 60000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    const w65 = result.withdrawalsByAge[65]
    const w75 = result.withdrawalsByAge[75]
    // 10 years of 3% inflation between age 65 and 75.
    expect(w75 / w65).toBeCloseTo(Math.pow(1.03, 10), 4)
  })

  it('produces TDF-glide-path analysis when riskProfile is "tdf"', () => {
    const inputs = makeInputs({ riskProfile: 'tdf' })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.scenarios.length).toBeGreaterThan(0)
    expect(result.netWorthByAge[inputs.startingAge]).toBeCloseToCurrency(
      inputs.startingBalance,
      2,
    )
  })

  it('emits a "current plan" baseline scenario whose age matches the user input', () => {
    const inputs = makeInputs({ retirementAge: 62 })
    const result = calculateRetirementAnalysis(inputs)
    const baseline = result.scenarios.find((s) => s.id.startsWith('current-plan'))
    expect(baseline).toBeDefined()
    expect(baseline!.retirementAge).toBe(62)
  })

  it('drives a "falling-short" status when starting balance and savings are tiny vs target', () => {
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 100,
      targetIncome: 200000, // wildly out of reach
    })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.scenarioAnalysis?.status).toBe('falling')
    // Falling-short branch always emits the reality scenarios.
    expect(result.scenarios.some((s) => s.id === 'reality-age')).toBe(true)
    expect(result.scenarios.some((s) => s.id === 'reality-income')).toBe(true)
  })

  it('drives an "exceeding" status when massively over-saved', () => {
    const inputs = makeInputs({
      startingBalance: 5_000_000,
      monthlySavings: 10000,
      targetIncome: 30000,
    })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.scenarioAnalysis?.status).toBe('exceeding')
  })
})

describe('Edge cases and boundary conditions', () => {
  let randSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => {
    randSpy.mockRestore()
  })

  it('handles lifeExpectancy === retirementAge (zero retirement years)', () => {
    // No retirement years => Monte Carlo loop never executes => always succeeds.
    const inputs = makeInputs({ retirementAge: 65, lifeExpectancy: 65 })
    expect(runMonteCarloSimulation(inputs, 5)).toBe(1)
  })

  it('handles lifeExpectancy < retirementAge gracefully (no infinite loop)', () => {
    // negative `retirementYears` => for-loop never enters => success path.
    const inputs = makeInputs({ retirementAge: 70, lifeExpectancy: 65 })
    const rate = runMonteCarloSimulation(inputs, 3)
    expect(rate).toBe(1)
  })

  it('safe withdrawal rate is identical to nominal when inflation = 0', () => {
    // With 0% inflation, the inflation-adjusted income equals targetIncome,
    // so SWR = targetIncome / projectedBalance — the "real == nominal" case.
    const inputs = makeInputs({
      inflationRate: 0,
      targetIncome: 60000,
      riskProfile: 'custom',
    })
    const projected = calculateProjectedBalance(inputs)
    expect(calculateSafeWithdrawalRate(inputs)).toBeCloseTo(60000 / projected, 8)
  })

  it('projected balance grows monotonically with monthly savings', () => {
    const low = calculateProjectedBalance(makeInputs({ monthlySavings: 500 }))
    const mid = calculateProjectedBalance(makeInputs({ monthlySavings: 1500 }))
    const high = calculateProjectedBalance(makeInputs({ monthlySavings: 3000 }))
    expect(mid).toBeGreaterThan(low)
    expect(high).toBeGreaterThan(mid)
  })

  it('projected balance grows monotonically with accumulation return', () => {
    const low = calculateProjectedBalance(
      makeInputs({ accumulationReturn: 0.03, riskProfile: 'custom' }),
    )
    const high = calculateProjectedBalance(
      makeInputs({ accumulationReturn: 0.10, riskProfile: 'custom' }),
    )
    expect(high).toBeGreaterThan(low)
  })

  it('zero starting balance still produces a positive projection from contributions', () => {
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 500,
      riskProfile: 'custom',
    })
    expect(calculateProjectedBalance(inputs)).toBeGreaterThan(0)
  })

  it('zero monthly savings still grows starting balance via compounding', () => {
    const inputs = makeInputs({
      startingBalance: 100000,
      monthlySavings: 0,
      startingAge: 30,
      retirementAge: 60,
      accumulationReturn: 0.07,
      riskProfile: 'custom',
    })
    // 30 years at 7% on $100k => ~$761k
    expect(calculateProjectedBalance(inputs)).toBeCloseToCurrency(
      100000 * Math.pow(1.07, 30),
      2,
    )
  })
})
