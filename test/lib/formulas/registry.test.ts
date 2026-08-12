/**
 * Formula Registry Consistency Test Suite
 *
 * The methodology page (/tools/retirement-calculator/methodology) renders the
 * formulas registered in lib/formulas/retirement-formulas.ts and presents each
 * entry's worked example as the app's real math. This suite pins each
 * registered formula to its lib/calculations counterpart: evaluating the
 * engine function on the registry's own example inputs must reproduce the
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
  calculateRequiredBalance,
  futureValue,
  futureValueOfAnnuity,
  presentValue,
} from '@/lib/calculations/retirement'
import { RetirementConstants } from '@/lib/constants/retirement'
import type { FormulaMetadata } from '@/lib/formulas/types'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

/**
 * Pairing between a registered formula's `functionName` and the real engine
 * function in lib/calculations/retirement.ts, including how the registry's
 * example inputs map onto the function's positional arguments.
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
}

const retirementEntries = formulaRegistry.getFormulasByCalculator('retirement')

describe('formula registry <-> calculation engine consistency', () => {
  it('registers exactly the four retirement methodology formulas', () => {
    const ids = retirementEntries.map((f) => f.id).sort()
    expect(ids).toEqual([
      'retirement-future-value-of-investment',
      'retirement-future-value-of-ordinary-annuity',
      'retirement-present-value-calculation',
      'retirement-required-retirement-balance',
    ])
    // The calculator index and the global map agree.
    expect(formulaRegistry.getAllFormulas()).toHaveLength(4)
  })

  it('maps every registered formula to a real engine function (no unknownFunction fallback)', () => {
    // retirement-formulas.ts assigns functionName positionally and falls back
    // to 'unknownFunction' when the arrays get out of sync. This catches that.
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
      // Published outputs are rounded to cents, so compare at cent precision.
      expect(engineOutput).toBeCloseToCurrency(entry.example.output, 2)
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
