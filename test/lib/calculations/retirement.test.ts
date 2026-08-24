/**
 * Retirement Calculations Test Suite
 *
 * Covers TVM math, Social Security adjustments, healthcare cost inflation,
 * effective tax-rate calculation against IRS 2026 brackets, the seeded Monte
 * Carlo simulation (including Social Security / healthcare wiring), input
 * validation, the TDF glide path, and the full calculateRetirementAnalysis
 * orchestrator.
 *
 * Monte Carlo results are deterministic: the engine seeds its own PRNG with a
 * fixed default seed, so no Math.random stubbing is needed.
 */

import { describe, expect, it } from 'vitest'
import {
  annualizeIncome,
  calculateEffectiveTaxRate,
  calculateHealthcareCosts,
  calculateInitialWithdrawalRate,
  calculateProjectedBalance,
  calculateRequiredBalance,
  calculateRetirementAnalysis,
  calculateSocialSecurityBenefit,
  calculateTDFAllocation,
  calculateTDFReturnForAge,
  calculateTDFVolatilityForAge,
  futureValue,
  futureValueOfAnnuity,
  INCOME_PERIOD_MULTIPLIERS,
  presentValue,
  RetirementInputValidationError,
  runMonteCarloSimulation,
  validateRetirementInputs,
  type IncomePeriod,
  type RetirementInputs,
} from '@/lib/calculations/retirement'
import { RetirementConstants } from '@/lib/constants/retirement'
import { displayRealDollars } from '@/lib/utils/displayDollars'
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

/**
 * Helper: inputs with Social Security and healthcare zeroed out, so tests can
 * isolate the pure inflated-target-income withdrawal stream.
 */
function makeBareInputs(overrides: Partial<RetirementInputs> = {}): RetirementInputs {
  return makeInputs({
    socialSecurityBenefit: 0,
    healthcareCostMultiplier: 0,
    ...overrides,
  })
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

describe('TDF glide path (engine is the single source of truth)', () => {
  it('holds 90% stocks through age 35', () => {
    expect(calculateTDFAllocation(25).stocks).toBeCloseTo(0.9, 10)
    expect(calculateTDFAllocation(35).stocks).toBeCloseTo(0.9, 10)
  })

  it('allocates 76.7% stocks at age 45 (linear 90% → 70% between 35 and 50)', () => {
    // 0.90 - (10/15) * 0.20 = 0.766666...
    const allocation = calculateTDFAllocation(45)
    expect(allocation.stocks).toBeCloseTo(0.9 - (10 / 15) * 0.2, 10)
    expect(allocation.stocks + allocation.bonds).toBeCloseTo(1, 10)
  })

  it('reaches 40% stocks at 65 and bottoms out at 30% by 85', () => {
    expect(calculateTDFAllocation(65).stocks).toBeCloseTo(0.4, 10)
    expect(calculateTDFAllocation(85).stocks).toBeCloseTo(0.3, 10)
    // Clamped: past 85 the floor holds.
    expect(calculateTDFAllocation(100).stocks).toBeCloseTo(0.3, 10)
  })

  it('derives the blended return from the allocation (stocks 10%, bonds 4%)', () => {
    // At 45: 0.766667 * 0.10 + 0.233333 * 0.04 = 0.086.
    const stocks = 0.9 - (10 / 15) * 0.2
    const expected = stocks * 0.1 + (1 - stocks) * 0.04
    expect(calculateTDFReturnForAge(45)).toBeCloseTo(expected, 10)
    expect(calculateTDFReturnForAge(45)).toBeCloseTo(0.086, 6)
  })

  it('derives the blended volatility from the allocation (stocks 18%, bonds 6%)', () => {
    const stocks = 0.9 - (10 / 15) * 0.2
    const expected = Math.sqrt(
      Math.pow(stocks * 0.18, 2) + Math.pow((1 - stocks) * 0.06, 2),
    )
    expect(calculateTDFVolatilityForAge(45)).toBeCloseTo(expected, 10)
  })

  it('return and volatility both decline as the glide path de-risks', () => {
    expect(calculateTDFReturnForAge(65)).toBeLessThan(calculateTDFReturnForAge(35))
    expect(calculateTDFVolatilityForAge(65)).toBeLessThan(
      calculateTDFVolatilityForAge(35),
    )
  })
})

describe('validateRetirementInputs', () => {
  it('returns an empty map for valid inputs', () => {
    expect(validateRetirementInputs(makeInputs())).toEqual({})
  })

  it('rejects retirementAge <= startingAge', () => {
    const errors = validateRetirementInputs(
      makeInputs({ startingAge: 50, retirementAge: 45 }),
    )
    expect(errors.retirementAge).toBeDefined()
  })

  it('rejects lifeExpectancy < retirementAge', () => {
    const errors = validateRetirementInputs(
      makeInputs({ retirementAge: 70, lifeExpectancy: 65 }),
    )
    expect(errors.lifeExpectancy).toBeDefined()
  })

  it('allows lifeExpectancy === retirementAge (zero retirement years)', () => {
    const errors = validateRetirementInputs(
      makeInputs({ retirementAge: 65, lifeExpectancy: 65 }),
    )
    expect(errors.lifeExpectancy).toBeUndefined()
  })

  it('rejects negative money fields', () => {
    const errors = validateRetirementInputs(
      makeInputs({
        targetIncome: -1,
        startingBalance: -50,
        monthlySavings: -10,
        socialSecurityBenefit: -100,
      }),
    )
    expect(errors.targetIncome).toBeDefined()
    expect(errors.startingBalance).toBeDefined()
    expect(errors.monthlySavings).toBeDefined()
    expect(errors.socialSecurityBenefit).toBeDefined()
  })

  it('rejects a negative estimatedAnnualHealthcareCost but allows null', () => {
    expect(
      validateRetirementInputs(makeInputs({ estimatedAnnualHealthcareCost: -1 }))
        .estimatedAnnualHealthcareCost,
    ).toBeDefined()
    expect(
      validateRetirementInputs(makeInputs({ estimatedAnnualHealthcareCost: null })),
    ).toEqual({})
  })
})

describe('calculateInitialWithdrawalRate', () => {
  it('returns 0 when projected balance is 0', () => {
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 0,
      retirementAge: 65,
      startingAge: 65, // zero years, zero contributions, zero balance
      accumulationReturn: 0.07,
    })
    expect(calculateInitialWithdrawalRate(inputs)).toBe(0)
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
    expect(calculateInitialWithdrawalRate(inputs)).toBeCloseTo(expected, 6)
  })

  it('exceeds the 4% guideline when severely under-saved', () => {
    const inputs = makeInputs({
      startingBalance: 10,
      monthlySavings: 1,
      targetIncome: 100000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    // Tiny savings vs $100k target => implied withdrawal rate exceeds 4%.
    expect(calculateInitialWithdrawalRate(inputs)).toBeGreaterThan(0.04)
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

  it('accepts a user-estimated base annual cost override', () => {
    expect(calculateHealthcareCosts(40, 1, 0, 10000)).toBeCloseToCurrency(10000, 6)
    expect(calculateHealthcareCosts(40, 2, 0, 10000)).toBeCloseToCurrency(20000, 6)
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

  it('is deterministic: same inputs and seed give the same success rate', () => {
    const inputs = makeInputs({ startingBalance: 200_000, volatility: 0.15 })
    // Explicit seed.
    expect(runMonteCarloSimulation(inputs, 200, 42)).toBe(
      runMonteCarloSimulation(inputs, 200, 42),
    )
    // Default seed is fixed too, so bare calls are also reproducible.
    expect(runMonteCarloSimulation(inputs, 200)).toBe(
      runMonteCarloSimulation(inputs, 200),
    )
  })

  // Marginal plan used for the Social Security / healthcare wiring tests:
  // ~$1.57M at 65 against a $40k (today) income need. With SS the net
  // withdrawal drops to ~2.5% of the balance from age 67; without SS it stays
  // above 5.5% and climbs with healthcare inflation, so a meaningful share of
  // paths must fail.
  const marginalPlan = makeInputs({
    startingAge: 50,
    retirementAge: 65,
    lifeExpectancy: 95,
    startingBalance: 400_000,
    monthlySavings: 1500,
    targetIncome: 40000,
    accumulationReturn: 0.07,
    retirementReturn: 0.05,
    inflationRate: 0.03,
    volatility: 0.15,
    socialSecurityAge: 67,
    socialSecurityBenefit: 30000,
    healthcareCostMultiplier: 1,
    riskProfile: 'custom',
  })

  it('zeroing a $30k Social Security benefit reduces the success probability', () => {
    // Without SS every retirement year's net withdrawal is >= the with-SS
    // withdrawal (SS only ever offsets spending), so failures can only
    // increase. The plan is marginal by construction, so the effect is large.
    const withSS = runMonteCarloSimulation(marginalPlan, 1000)
    const withoutSS = runMonteCarloSimulation(
      { ...marginalPlan, socialSecurityBenefit: 0 },
      1000,
    )
    expect(withoutSS).toBeLessThan(withSS)
    // The gap should be substantial, not seed noise.
    expect(withSS - withoutSS).toBeGreaterThan(0.05)
  })

  it('raising the healthcare cost multiplier reduces the success probability', () => {
    // Multiplier 3 adds 2 * $7,500 (today) of healthcare-inflated annual cost
    // to every retirement year, strictly increasing net withdrawals.
    const baseline = runMonteCarloSimulation(marginalPlan, 1000)
    const expensive = runMonteCarloSimulation(
      { ...marginalPlan, healthcareCostMultiplier: 3 },
      1000,
    )
    expect(expensive).toBeLessThan(baseline)
    expect(baseline - expensive).toBeGreaterThan(0.05)
  })

  it('custom plans respond to the user-supplied retirement return', () => {
    // Sanity check for the contrast with the TDF case below: on a marginal
    // plan, cutting the mean retirement return must reduce success.
    const base = runMonteCarloSimulation(marginalPlan, 1000)
    const worse = runMonteCarloSimulation(
      { ...marginalPlan, retirementReturn: 0.0 },
      1000,
    )
    expect(worse).toBeLessThan(base)
  })

  it('TDF plans derive return/volatility from the glide path, ignoring UI-pushed values', () => {
    // Regression for the default-state bug: with riskProfile 'tdf', the
    // simulator must NOT trust inputs.retirementReturn/volatility (which the
    // UI may or may not have synced) — success is identical however those
    // fields are set.
    const tdfPlan = makeInputs({ ...marginalPlan, riskProfile: 'tdf' })
    const a = runMonteCarloSimulation(tdfPlan, 500)
    const b = runMonteCarloSimulation(
      { ...tdfPlan, retirementReturn: 0.0, volatility: 0.30 },
      500,
    )
    expect(a).toBe(b)
  })
})

describe('calculateRetirementAnalysis (orchestrator)', () => {
  it('returns the documented top-level shape', () => {
    const result = calculateRetirementAnalysis(makeInputs())
    expect(Array.isArray(result.scenarios)).toBe(true)
    expect(result.scenarios.length).toBeGreaterThan(0)
    expect(typeof result.netWorthByAge).toBe('object')
    expect(typeof result.withdrawalsByAge).toBe('object')
    expect(Array.isArray(result.insights)).toBe(true)
    expect(typeof result.initialWithdrawalRate).toBe('number')
    expect(result.scenarioAnalysis).toBeDefined()
    expect(result.coastFireAnalysis).toBeDefined()
    expect(result.inflationAnalysis).toBeDefined()
  })

  it('is deterministic across repeated runs (seeded Monte Carlo)', () => {
    const a = calculateRetirementAnalysis(makeInputs())
    const b = calculateRetirementAnalysis(makeInputs())
    expect(a.scenarios.map((s) => s.successProbability)).toEqual(
      b.scenarios.map((s) => s.successProbability),
    )
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

  it('records the pre-withdrawal balance at retirement age (custom profile)', () => {
    // Regression for the boundary off-by-one: netWorthByAge[retirementAge]
    // must equal the projected balance at retirement, before any withdrawal
    // or double-counted year of returns.
    const inputs = makeInputs({ lifeExpectancy: 85, riskProfile: 'custom' })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.netWorthByAge[65]).toBeCloseToCurrency(
      calculateProjectedBalance(inputs),
      2,
    )
  })

  it('records the pre-withdrawal balance at retirement age (TDF profile)', () => {
    const inputs = makeInputs({ lifeExpectancy: 85, riskProfile: 'tdf' })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.netWorthByAge[65]).toBeCloseToCurrency(
      calculateProjectedBalance(inputs),
      2,
    )
  })

  it('applies exactly one year of growth and one withdrawal per retirement year', () => {
    // With SS and healthcare zeroed, the first retirement year is:
    // balance(66) = balance(65) * (1 + retirementReturn) - target * (1+i)^35.
    const inputs = makeBareInputs({ lifeExpectancy: 85, riskProfile: 'custom' })
    const result = calculateRetirementAnalysis(inputs)
    const firstWithdrawal = 60000 * Math.pow(1.03, 35)
    expect(result.withdrawalsByAge[66]).toBeCloseToCurrency(firstWithdrawal, 2)
    expect(result.netWorthByAge[66]).toBeCloseToCurrency(
      result.netWorthByAge[65] * 1.05 - firstWithdrawal,
      2,
    )
  })

  it('emits withdrawalsByAge only after the retirement snapshot', () => {
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
    // retirementAge itself is the pre-withdrawal snapshot.
    expect(result.withdrawalsByAge[65]).toBeUndefined()
    // Withdrawal years run from retirementAge + 1 through lifeExpectancy.
    expect(result.withdrawalsByAge[66]).toBeGreaterThan(0)
    expect(result.withdrawalsByAge[85]).toBeGreaterThan(0)
  })

  it('inflation-adjusts the first retirement-year withdrawal to the target income at retirement', () => {
    const inputs = makeBareInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      targetIncome: 60000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    // First withdrawal (recorded at age 66, covering the year the retiree is
    // 65) is the target income inflated over the 35 accumulation years.
    const expectedFirstYear = 60000 * Math.pow(1.03, 35)
    expect(result.withdrawalsByAge[66]).toBeCloseToCurrency(expectedFirstYear, 0)
  })

  it('compounds withdrawal inflation year-over-year during retirement', () => {
    const inputs = makeBareInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 85,
      targetIncome: 60000,
      inflationRate: 0.03,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    const w66 = result.withdrawalsByAge[66]
    const w76 = result.withdrawalsByAge[76]
    // 10 years of 3% inflation between the first and eleventh withdrawals.
    expect(w76 / w66).toBeCloseTo(Math.pow(1.03, 10), 4)
  })

  it('offsets withdrawals by the Social Security benefit from the claiming age', () => {
    // SS claimed at FRA (67) => no claiming adjustment. The withdrawal
    // covering the year the retiree is 66 (recorded at 67) has no SS; the one
    // covering age 67 (recorded at 68) is reduced by 24000 * (1+i)^37.
    const withSS = makeInputs({
      lifeExpectancy: 85,
      healthcareCostMultiplier: 0,
      socialSecurityBenefit: 24000,
      socialSecurityAge: 67,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(withSS)
    expect(result.withdrawalsByAge[67]).toBeCloseToCurrency(
      60000 * Math.pow(1.03, 36), // age 66 that year: SS not yet claimed
      0,
    )
    expect(result.withdrawalsByAge[68]).toBeCloseToCurrency(
      (60000 - 24000) * Math.pow(1.03, 37), // both inflate at the same rate
      0,
    )
  })

  it('applies the SSA early-claiming reduction to the wired benefit', () => {
    // Claiming at 62 => 30% reduction => $24,000 becomes $16,800 (today's
    // dollars). Retiring at 65 (>= 62), SS offsets from the very first year:
    // withdrawal = (60000 - 16800) * (1+i)^35.
    const inputs = makeInputs({
      lifeExpectancy: 85,
      healthcareCostMultiplier: 0,
      socialSecurityBenefit: 24000,
      socialSecurityAge: 62,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.withdrawalsByAge[66]).toBeCloseToCurrency(
      (60000 - 24000 * 0.7) * Math.pow(1.03, 35),
      0,
    )
  })

  it('adds healthcare costs (healthcare inflation) on top of the income need', () => {
    // With SS zeroed and multiplier 1, the first withdrawal adds the $7,500
    // base cost inflated at 5.5% over the 35 years from today (age 65 during
    // that year => unit age multiplier).
    const inputs = makeInputs({
      lifeExpectancy: 85,
      socialSecurityBenefit: 0,
      healthcareCostMultiplier: 1,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    const expected =
      60000 * Math.pow(1.03, 35) + 7500 * Math.pow(1.055, 35)
    expect(result.withdrawalsByAge[66]).toBeCloseToCurrency(expected, 0)
    // Ten years later (age 75 during the year recorded at 76): healthcare has
    // inflated 45 years and carries the 1.2 over-65 age multiplier.
    const expected76 =
      60000 * Math.pow(1.03, 45) + 7500 * Math.pow(1.055, 45) * 1.2
    expect(result.withdrawalsByAge[76]).toBeCloseToCurrency(expected76, 0)
  })

  it('lets estimatedAnnualHealthcareCost replace the default base cost', () => {
    const inputs = makeInputs({
      lifeExpectancy: 85,
      socialSecurityBenefit: 0,
      healthcareCostMultiplier: 1,
      estimatedAnnualHealthcareCost: 10000,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    const expected =
      60000 * Math.pow(1.03, 35) + 10000 * Math.pow(1.055, 35)
    expect(result.withdrawalsByAge[66]).toBeCloseToCurrency(expected, 0)
  })

  it('floors the net withdrawal at zero when Social Security exceeds spending', () => {
    // $10k income need vs $50k SS benefit from 67, no healthcare: from the
    // year the retiree is 67 (recorded at 68), the portfolio withdrawal is 0.
    const inputs = makeInputs({
      lifeExpectancy: 85,
      targetIncome: 10000,
      socialSecurityBenefit: 50000,
      socialSecurityAge: 67,
      healthcareCostMultiplier: 0,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.withdrawalsByAge[68]).toBe(0)
    expect(result.withdrawalsByAge[85]).toBe(0)
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

  it('gives the "live on affordable income" scenario a high success probability (4% rule, no double inflation)', () => {
    // Regression for the double-inflation bug: affordableIncome (4% of the
    // retirement-date balance) is a retirement-date figure and must be
    // deflated to today's dollars before being fed back as targetIncome. Done
    // right, the scenario starts at exactly a 4% withdrawal rate; with a 6%
    // mean return / 8% volatility over a 23-year retirement that plan is
    // comfortably above 80% success. The old code re-inflated the figure by
    // (1.03)^35 ≈ 2.81x, an ~11% withdrawal rate that almost always failed.
    const inputs = makeBareInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 88,
      startingBalance: 10000,
      monthlySavings: 300,
      targetIncome: 150000, // far out of reach => falling-short branch
      retirementReturn: 0.06,
      volatility: 0.08,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    expect(result.scenarioAnalysis?.status).toBe('falling')

    const reality = result.scenarios.find((s) => s.id === 'reality-income')
    expect(reality).toBeDefined()
    // 4% consistency: required balance for the affordable income IS the
    // projected balance (income = 4% of balance, required = income / 4%).
    expect(reality!.requiredBalance).toBeCloseToCurrency(
      calculateProjectedBalance(inputs),
      2,
    )
    expect(reality!.successProbability).toBeGreaterThan(0.8)
  })

  it('labels the affordable-income scenario in today\'s dollars', () => {
    const inputs = makeBareInputs({
      startingAge: 30,
      retirementAge: 65,
      lifeExpectancy: 88,
      startingBalance: 10000,
      monthlySavings: 300,
      targetIncome: 150000,
      retirementReturn: 0.06,
      volatility: 0.08,
      riskProfile: 'custom',
    })
    const result = calculateRetirementAnalysis(inputs)
    const reality = result.scenarios.find((s) => s.id === 'reality-income')!

    const projected = calculateProjectedBalance(inputs)
    const affordableToday = (projected * 0.04) / Math.pow(1.03, 35)
    const roundedMonthly = Math.round(affordableToday / 12 / 100) * 100
    expect(reality.name).toContain(`$${roundedMonthly.toLocaleString('en-US')}`)
    expect(reality.name).toContain("today's dollars")
  })
})

describe('scenario dollar bases (what the results cards convert)', () => {
  it("reports monthlyWithdrawal in today's dollars, after tax", () => {
    // The scenario cards inflate this figure to the retirement year when the
    // reader picks future dollars, so it must arrive un-inflated.
    const inputs = makeInputs({ targetIncome: 60000, effectiveTaxRate: 0.2 })
    const result = calculateRetirementAnalysis(inputs)
    const baseline = result.scenarios.find((s) => s.id.startsWith('current-plan'))!
    expect(baseline.monthlyWithdrawal).toBeCloseToCurrency((60000 / 12) * 0.8, 2)
  })

  it('moves the displayed monthly withdrawal only in future-dollar mode', () => {
    const inputs = makeInputs({ targetIncome: 60000, effectiveTaxRate: 0.2 })
    const result = calculateRetirementAnalysis(inputs)
    const baseline = result.scenarios.find((s) => s.id.startsWith('current-plan'))!
    const years = baseline.retirementAge - inputs.startingAge // 65 - 30

    expect(
      displayRealDollars(baseline.monthlyWithdrawal, 'today', 0.03, years),
    ).toBe(baseline.monthlyWithdrawal)
    expect(
      displayRealDollars(baseline.monthlyWithdrawal, 'nominal', 0.03, years),
    ).toBeCloseToCurrency(4000 * Math.pow(1.03, 35), 2)
  })

  it("dates each scenario's required balance to that scenario's own retirement age", () => {
    // Regression: scenarios that retire at an age other than the plan's used
    // to reuse the plan-dated required balance, so the results card deflated
    // it over a horizon it was never inflated over.
    const inputs = makeInputs({
      startingBalance: 0,
      monthlySavings: 100,
      targetIncome: 200000, // wildly out of reach => falling-short branch
    })
    const result = calculateRetirementAnalysis(inputs)
    const todaysRequired = calculateRequiredBalance(inputs.targetIncome)

    // Every falling-short scenario that plans on the full target income.
    for (const id of ['current-plan-falling-short', 'reality-age', 'modest-fix']) {
      const scenario = result.scenarios.find((s) => s.id === id)
      expect(scenario, `${id} scenario missing`).toBeDefined()
      const years = scenario!.retirementAge - inputs.startingAge
      // Deflating over the card's own horizon recovers today's dollars.
      expect(
        scenario!.requiredBalance / Math.pow(1.03, years),
      ).toBeCloseToCurrency(todaysRequired, 2)
    }

    // The regression only bites when the horizons differ, so assert they do.
    const realityAge = result.scenarios.find((s) => s.id === 'reality-age')!
    expect(realityAge.retirementAge).not.toBe(inputs.retirementAge)
  })

  it("dates the early-retirement scenario's required balance to the earlier age", () => {
    const inputs = makeInputs({
      startingBalance: 5_000_000,
      monthlySavings: 10000,
      targetIncome: 30000,
    })
    const result = calculateRetirementAnalysis(inputs)
    const early = result.scenarios.find((s) => s.id === 'early-retirement')
    expect(early).toBeDefined()
    expect(early!.retirementAge).toBe(60) // max(startingAge + 10, retirementAge - 5)
    expect(early!.requiredBalance).toBeCloseToCurrency(
      calculateRequiredBalance(30000 * Math.pow(1.03, 30)),
      2,
    )
  })
})

describe('input validation at the orchestrator boundary', () => {
  it('rejects lifeExpectancy < retirementAge instead of reporting certain success', () => {
    // Regression: a plan that "succeeds" only because the retirement loop
    // never runs must be a validation error, not a 100% success probability.
    const inputs = makeInputs({ retirementAge: 70, lifeExpectancy: 65 })
    expect(() => calculateRetirementAnalysis(inputs)).toThrow(
      RetirementInputValidationError,
    )
    try {
      calculateRetirementAnalysis(inputs)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(RetirementInputValidationError)
      expect(
        (error as RetirementInputValidationError).fieldErrors.lifeExpectancy,
      ).toBeDefined()
    }
  })

  it('rejects retirementAge <= startingAge', () => {
    const inputs = makeInputs({ startingAge: 50, retirementAge: 45, lifeExpectancy: 90 })
    try {
      calculateRetirementAnalysis(inputs)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(RetirementInputValidationError)
      expect(
        (error as RetirementInputValidationError).fieldErrors.retirementAge,
      ).toBeDefined()
    }
  })

  it('rejects negative money fields', () => {
    const inputs = makeInputs({ targetIncome: -60000 })
    try {
      calculateRetirementAnalysis(inputs)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(RetirementInputValidationError)
      expect(
        (error as RetirementInputValidationError).fieldErrors.targetIncome,
      ).toBeDefined()
    }
  })
})

describe('Edge cases and boundary conditions', () => {
  it('handles lifeExpectancy === retirementAge (zero retirement years)', () => {
    // No retirement years => Monte Carlo loop never executes => always succeeds.
    // (Equality is legal; only lifeExpectancy < retirementAge is rejected.)
    const inputs = makeInputs({ retirementAge: 65, lifeExpectancy: 65 })
    expect(runMonteCarloSimulation(inputs, 5)).toBe(1)
  })

  it('initial withdrawal rate is identical to nominal when inflation = 0', () => {
    // With 0% inflation, the inflation-adjusted income equals targetIncome,
    // so the rate = targetIncome / projectedBalance — the "real == nominal" case.
    const inputs = makeInputs({
      inflationRate: 0,
      targetIncome: 60000,
      riskProfile: 'custom',
    })
    const projected = calculateProjectedBalance(inputs)
    expect(calculateInitialWithdrawalRate(inputs)).toBeCloseTo(60000 / projected, 8)
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
