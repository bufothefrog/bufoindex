/**
 * Formula Registry Consistency Test Suite
 *
 * The methodology page (/tools/retirement-calculator/methodology) renders the
 * formulas registered in lib/formulas/retirement-formulas.ts and presents each
 * entry's worked example as the app's real math. This suite pins each
 * registered formula to its engine counterpart: evaluating the function named
 * by the entry on the registry's own example inputs must reproduce the
 * registry's published example output. If either side drifts — the engine
 * changes, the registry copy changes, or a new formula is registered without
 * an engine counterpart — this suite fails.
 *
 * Also covers the registry container itself (category/calculator indexes,
 * search, validation bookkeeping) via a fresh instance so the global
 * registry's auto-registered state is never mutated.
 */

import { describe, expect, it } from 'vitest'
import { createFormulaRegistry, formulaRegistry } from '@/lib/formulas/registry'
// Side-effect import: registers the retirement formulas with the global registry.
import '@/lib/formulas/retirement-formulas'
import {
  calculateHealthcareCosts,
  calculateRequiredBalance,
  calculateSocialSecurityBenefit,
  calculateTDFAllocation,
  calculateTDFReturnForAge,
  futureValue,
  futureValueOfAnnuity,
  presentValue,
  runMonteCarloSimulation,
  type RetirementInputs,
} from '@/lib/calculations/retirement'
import { boxMullerRandom, createSeededRng } from '@/lib/utils/random'
import { RetirementConstants } from '@/lib/constants/retirement'
import type { FormulaMetadata } from '@/lib/formulas/types'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

/**
 * Feed boxMullerRandom a fixed pair of uniform draws instead of the seeded
 * generator. The engine consumes u2 first and u1 second (lib/utils/random.ts),
 * which is the order the registry entry documents.
 */
function stubRng(values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

/**
 * The Monte Carlo entry publishes its worked example in the symbols of its own
 * LaTeX (B_0, mu, sigma, W, T, N), so the pairing maps those onto a real
 * RetirementInputs plan configured exactly as that entry's assumptions state:
 * the accumulation phase is a no-op (0% return, no monthly savings, so the
 * balance at retirement is B_0) and the withdrawal is exactly W (0% inflation,
 * no healthcare, no Social Security).
 */
function monteCarloPlanFromExample(inputs: Record<string, number>): RetirementInputs {
  const retirementAge = 65
  return {
    startingAge: 30,
    retirementAge,
    lifeExpectancy: retirementAge + inputs.T,
    targetIncome: inputs.W,
    startingBalance: inputs.B0,
    currentIncome: 100000,
    incomeAmount: 100000,
    incomePeriod: 'yearly',
    monthlySavings: 0,
    necessaryMonthlyExpenses: 0,
    accumulationReturn: 0,
    retirementReturn: inputs.mu,
    inflationRate: 0,
    socialSecurityAge: 67,
    socialSecurityBenefit: 0,
    healthcareCostMultiplier: 0,
    volatility: inputs.sigma,
    filingStatus: 'single',
    state: 'CA',
    riskProfile: 'custom',
    effectiveTaxRate: null,
    estimatedAnnualHealthcareCost: null,
  }
}

/**
 * Pairing between a registered formula's `functionName` and the real engine
 * function it documents, including how the registry's example inputs map onto
 * that function's arguments.
 */
const ENGINE_BY_FUNCTION_NAME: Record<
  string,
  (inputs: Record<string, number>) => number
> = {
  futureValue: (i) => futureValue(i.PV, i.r, i.t),
  presentValue: (i) => presentValue(i.FV, i.r, i.t),
  futureValueOfAnnuity: (i) => futureValueOfAnnuity(i.PMT, i.r, i.t),
  calculateRequiredBalance: (i) =>
    calculateRequiredBalance(i.targetIncome, i.withdrawalRate),
  calculateSocialSecurityBenefit: (i) =>
    calculateSocialSecurityBenefit(i.baseBenefit, i.claimingAge),
  calculateHealthcareCosts: (i) =>
    calculateHealthcareCosts(i.age, i.multiplier, i.yearsOfInflation, i.baseAnnualCost),
  boxMullerRandom: (i) => boxMullerRandom(i.mean, i.stdDev, stubRng([i.u2, i.u1])),
  runMonteCarloSimulation: (i) =>
    runMonteCarloSimulation(monteCarloPlanFromExample(i), i.N),
  calculateTDFReturnForAge: (i) => calculateTDFReturnForAge(i.age),
}

/**
 * Digits of agreement demanded of a published example. Dollar figures are
 * published rounded to cents; rates and probabilities are published to more
 * places, so they are held to a tighter tolerance.
 */
const EXAMPLE_DIGITS_BY_FUNCTION_NAME: Record<string, number> = {
  boxMullerRandom: 6,
  runMonteCarloSimulation: 6,
  calculateTDFReturnForAge: 6,
}

const retirementEntries = formulaRegistry.getFormulasByCalculator('retirement')

describe('formula registry <-> calculation engine consistency', () => {
  it('registers exactly the retirement methodology formulas', () => {
    const ids = retirementEntries.map((f) => f.id).sort()
    expect(ids).toEqual([
      'retirement-annual-healthcare-cost-in-retirement',
      'retirement-future-value-of-investment',
      'retirement-future-value-of-ordinary-annuity',
      'retirement-monte-carlo-success-probability',
      'retirement-present-value-calculation',
      'retirement-required-retirement-balance',
      'retirement-simulated-annual-return-draw',
      'retirement-social-security-benefit-at-claiming-age',
      'retirement-target-date-glide-path-return',
    ])
    // The calculator index and the global map agree.
    expect(formulaRegistry.getAllFormulas()).toHaveLength(ids.length)
  })

  it('documents the engine paths that produce the headline success probability', () => {
    // The Monte Carlo genuinely models Social Security and healthcare, so the
    // page has to carry an entry for each of them and for the simulation
    // itself — this is the guard against the page describing a simpler model
    // than the one that runs.
    const documented = retirementEntries.map((f) => f.functionName)
    for (const engineFunction of [
      'runMonteCarloSimulation',
      'boxMullerRandom',
      'calculateSocialSecurityBenefit',
      'calculateHealthcareCosts',
    ]) {
      expect(documented).toContain(engineFunction)
    }
  })

  it('maps every registered formula to a real engine function', () => {
    for (const entry of retirementEntries) {
      expect(
        ENGINE_BY_FUNCTION_NAME[entry.functionName],
        `formula "${entry.id}" names engine function "${entry.functionName}" which has no pairing`,
      ).toBeTypeOf('function')
    }
  })

  // The high-signal drift guard: the worked example the methodology page
  // displays must be reproducible by the engine function it claims to show.
  for (const entry of retirementEntries) {
    it(`worked example for "${entry.id}" reproduces the engine output`, () => {
      const evaluate = ENGINE_BY_FUNCTION_NAME[entry.functionName]
      expect(evaluate).toBeTypeOf('function')
      const engineOutput = evaluate(entry.example.inputs)
      const digits = EXAMPLE_DIGITS_BY_FUNCTION_NAME[entry.functionName] ?? 2
      expect(engineOutput).toBeCloseTo(entry.example.output, digits)
    })

    it(`documents every example input of "${entry.id}" as a variable`, () => {
      const variableKeys = Object.keys(entry.variables)
      for (const inputKey of Object.keys(entry.example.inputs)) {
        expect(variableKeys).toContain(inputKey)
      }
    })
  }
})

describe('engine functions match the published LaTeX on hand-computed fixtures', () => {
  it('futureValue implements FV = PV * (1 + r)^t', () => {
    // 1.07^30 = 7.61225504..., so FV = 10,000 * 7.61225504 = 76,122.5504
    expect(futureValue(10000, 0.07, 30)).toBeCloseToCurrency(76122.55, 2)
    // 1.07^10 = 1.96715136..., so FV = 10,000 * 1.96715136 = 19,671.5136
    expect(futureValue(10000, 0.07, 10)).toBeCloseToCurrency(19671.51, 2)
    // Zero periods: (1 + r)^0 = 1, principal unchanged.
    expect(futureValue(10000, 0.07, 0)).toBe(10000)
  })

  it('presentValue implements PV = FV / (1 + r)^t and inverts futureValue', () => {
    // 100,000 / 1.07^10 = 100,000 / 1.96715136 = 50,834.9293
    expect(presentValue(100000, 0.07, 10)).toBeCloseToCurrency(50834.93, 2)
    // Exact round trip: discounting a compounded value recovers the principal.
    expect(presentValue(futureValue(10000, 0.07, 30), 0.07, 30)).toBeCloseTo(
      10000,
      8,
    )
  })

  it('futureValueOfAnnuity implements FVA = PMT * ((1 + r)^t - 1) / r', () => {
    // 1.06^20 = 3.2071354722; (3.2071354722 - 1) / 0.06 = 36.785591203
    // FVA = 1,000 * 36.785591203 = 36,785.5912
    expect(futureValueOfAnnuity(1000, 0.06, 20)).toBeCloseToCurrency(
      36785.59,
      2,
    )
  })

  it('futureValueOfAnnuity degrades to PMT * t at zero rate', () => {
    // The closed form divides by r, so r = 0 takes the linear branch:
    // 24 payments of $500 with no growth = $12,000 exactly.
    expect(futureValueOfAnnuity(500, 0, 24)).toBe(12000)
  })

  it('calculateRequiredBalance implements Income / SWR', () => {
    // $50,000 / 0.04 = $1,250,000 (the registry example, exact)
    expect(calculateRequiredBalance(50000, 0.04)).toBe(1250000)
    // Default rate comes from the sourced constants (4% rule):
    // $40,000 / 0.04 = $1,000,000
    expect(RetirementConstants.WITHDRAWAL_RATE).toBe(0.04)
    expect(calculateRequiredBalance(40000)).toBe(1000000)
  })

  it('calculateSocialSecurityBenefit implements the published piecewise adjustment', () => {
    // Claiming at 62 is 60 months early: 36 months at 5/9 of 1% (20%) plus
    // 24 months at 5/12 of 1% (10%) = a 30% cut on $30,000.
    expect(calculateSocialSecurityBenefit(30000, 62)).toBeCloseToCurrency(21000, 2)
    // Full retirement age is 67 in this model: no reduction, no credit.
    expect(RetirementConstants.SS_FULL_RETIREMENT_AGE).toBe(67)
    expect(calculateSocialSecurityBenefit(30000, 67)).toBe(30000)
    // Claiming at 70 is three years delayed: 3 * 8% = a 24% credit.
    expect(calculateSocialSecurityBenefit(30000, 70)).toBeCloseToCurrency(37200, 2)
    // Below 62 the benefit is zero, as the first branch of the LaTeX states.
    expect(calculateSocialSecurityBenefit(30000, 61)).toBe(0)
  })

  it('calculateHealthcareCosts compounds 5.5% and adds the 2%/year uplift from 65', () => {
    expect(RetirementConstants.HEALTHCARE_INFLATION_RATE).toBe(0.055)
    // 1.055^5 = 1.30696001, so 7,500 * 1.30696001 = 9,802.20 before any uplift.
    expect(calculateHealthcareCosts(60, 1, 5, 7500)).toBeCloseToCurrency(9802.2, 2)
    // At 75 the uplift is 1 + 0.02 * 10 = 1.2: 9,802.20 * 1.2 = 11,762.64.
    expect(calculateHealthcareCosts(75, 1, 5, 7500)).toBeCloseToCurrency(11762.64, 2)
  })

  it('createSeededRng implements the published LCG recurrence', () => {
    // s1 = (1664525 * 1 + 1013904223) mod 2^32 = 1,015,568,748,
    // divided by 2^32 - 1.
    expect(createSeededRng(1)()).toBeCloseTo(1015568748 / 0xffffffff, 12)
    // Same seed, same stream — this is what makes the simulation reproducible.
    const first = createSeededRng(7)
    const second = createSeededRng(7)
    expect([first(), first(), first()]).toEqual([second(), second(), second()])
  })

  it('boxMullerRandom implements r = mu + sigma * sqrt(-2 ln u1) * sin(2 pi u2)', () => {
    // sqrt(-2 ln 0.5) = 1.1774100225 and sin(pi/2) = 1, so
    // r = 0.06 + 0.15 * 1.1774100225 = 0.2366115034.
    expect(boxMullerRandom(0.06, 0.15, stubRng([0.25, 0.5]))).toBeCloseTo(
      0.2366115034,
      9,
    )
    // The engine draws u2 before u1; swapping them changes the answer, which
    // is what pins the documented order.
    expect(boxMullerRandom(0.06, 0.15, stubRng([0.5, 0.25]))).not.toBeCloseTo(
      0.2366115034,
      9,
    )
    // Zero volatility collapses every draw onto the mean.
    expect(boxMullerRandom(0.05, 0, stubRng([0.25, 0.5]))).toBe(0.05)
  })

  it('calculateTDFReturnForAge blends the glide-path allocation', () => {
    // At 45: w = 0.90 - ((45 - 35) / 15) * 0.20 = 0.7666667 stocks.
    expect(calculateTDFAllocation(45).stocks).toBeCloseTo(0.7666667, 6)
    // E[r] = 0.7666667 * 0.10 + 0.2333333 * 0.04 = 0.086
    expect(calculateTDFReturnForAge(45)).toBeCloseTo(0.086, 9)
    // The path is flat until 35 and keeps stepping down afterwards.
    expect(calculateTDFAllocation(30).stocks).toBe(0.9)
    expect(calculateTDFAllocation(60).stocks).toBeLessThan(
      calculateTDFAllocation(45).stocks,
    )
  })

  it('runMonteCarloSimulation reduces to one deterministic path at zero volatility', () => {
    // The registry's worked example: 5% on $1,000,000 is $50,000 against a
    // $40,000 withdrawal, so the balance rises every year and all paths live.
    const surviving = monteCarloPlanFromExample({
      B0: 1000000,
      mu: 0.05,
      sigma: 0,
      W: 40000,
      T: 25,
      N: 100,
    })
    expect(runMonteCarloSimulation(surviving, 100)).toBe(1)

    // Raise the withdrawal above the growth and the same deterministic path
    // drains: 1,000,000 -> 850,000 -> ... -> below zero in year 6.
    const draining = monteCarloPlanFromExample({
      B0: 1000000,
      mu: 0.05,
      sigma: 0,
      W: 200000,
      T: 25,
      N: 100,
    })
    expect(runMonteCarloSimulation(draining, 100)).toBe(0)
  })
})

describe('FormulaRegistryImpl bookkeeping (fresh instance)', () => {
  function makeMetadata(overrides: Partial<FormulaMetadata> = {}): FormulaMetadata {
    return {
      name: 'Test Formula',
      category: 'core',
      latex: 'y = x',
      variables: { x: { symbol: 'x', description: 'input value' } },
      description: 'Identity formula used for registry tests',
      purpose: 'Exercise registry indexing',
      example: { inputs: { x: 1 }, output: 1, explanation: 'identity' },
      sources: [],
      assumptions: [],
      limitations: [],
      ...overrides,
    }
  }

  it('indexes registered formulas by id, category, and calculator', () => {
    const registry = createFormulaRegistry()
    registry.registerFormula('f1', 'fnOne', makeMetadata(), 'retirement')
    registry.registerFormula(
      'f2',
      'fnTwo',
      makeMetadata({ name: 'Second Formula', category: 'intermediate' }),
      'paycheck',
    )

    expect(registry.getFormula('f1')?.functionName).toBe('fnOne')
    expect(registry.getFormula('missing')).toBeUndefined()
    expect(registry.getFormulasByCategory('core').map((f) => f.id)).toEqual([
      'f1',
    ])
    expect(
      registry.getFormulasByCategory('intermediate').map((f) => f.id),
    ).toEqual(['f2'])
    expect(registry.getFormulasByCalculator('retirement').map((f) => f.id)).toEqual(
      ['f1'],
    )
    expect(registry.getFormulasByCalculator('nope')).toEqual([])
  })

  it('re-registering the same id does not duplicate index entries', () => {
    const registry = createFormulaRegistry()
    registry.registerFormula('f1', 'fnOne', makeMetadata(), 'retirement')
    registry.registerFormula('f1', 'fnOneUpdated', makeMetadata(), 'retirement')

    expect(registry.getAllFormulas()).toHaveLength(1)
    expect(registry.categories.core).toEqual(['f1'])
    expect(registry.byCalculator['retirement']).toEqual(['f1'])
    // The later registration wins in the map.
    expect(registry.getFormula('f1')?.functionName).toBe('fnOneUpdated')
  })

  it('searchFormulas matches name, description, and purpose case-insensitively', () => {
    const registry = createFormulaRegistry()
    registry.registerFormula(
      'f1',
      'fnOne',
      makeMetadata({ name: 'Compound Growth', description: 'grows money' }),
    )
    registry.registerFormula(
      'f2',
      'fnTwo',
      makeMetadata({ name: 'Drawdown', purpose: 'Model spending in retirement' }),
    )

    expect(registry.searchFormulas('COMPOUND').map((f) => f.id)).toEqual(['f1'])
    expect(registry.searchFormulas('spending').map((f) => f.id)).toEqual(['f2'])
    expect(registry.searchFormulas('nonexistent')).toEqual([])
  })

  it('markValidated updates getValidationSummary counts', () => {
    const registry = createFormulaRegistry()
    registry.registerFormula('f1', 'fnOne', makeMetadata())
    registry.registerFormula(
      'f2',
      'fnTwo',
      makeMetadata({ name: 'Second', category: 'advanced' }),
    )

    expect(registry.getValidationSummary()).toMatchObject({
      total: 2,
      validated: 0,
      pending: 2,
    })

    registry.markValidated('f1', true)
    const summary = registry.getValidationSummary()
    expect(summary.validated).toBe(1)
    expect(summary.pending).toBe(1)
    expect(summary.byCategory.core).toEqual({ total: 1, validated: 1 })
    expect(summary.byCategory.advanced).toEqual({ total: 1, validated: 0 })

    // Revoking validation is symmetric.
    registry.markValidated('f1', false)
    expect(registry.getValidationSummary().validated).toBe(0)
  })

  it('clear() empties formulas and all indexes', () => {
    const registry = createFormulaRegistry()
    registry.registerFormula('f1', 'fnOne', makeMetadata(), 'retirement')
    registry.clear()

    expect(registry.getAllFormulas()).toEqual([])
    expect(registry.categories.core).toEqual([])
    expect(registry.getFormulasByCalculator('retirement')).toEqual([])
  })
})
