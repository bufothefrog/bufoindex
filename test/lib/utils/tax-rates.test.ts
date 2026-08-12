/**
 * Tax Rate Utility Tests
 *
 * Regression tests for two fixes:
 * 1. State tax table moved to lib/constants/states-2026.ts with rates
 *    updated to 2026 top-marginal / flat values (was 2022-23 vintage
 *    data mislabeled as 2025).
 * 2. getFICARate now takes filing status: the Additional Medicare Tax
 *    (0.9% surtax) liability threshold is $250k MFJ / $125k MFS /
 *    $200k single + head of household per IRC 3101(b)(2), not $200k
 *    for everyone.
 */

import { describe, it, expect } from 'vitest'
import { getFICARate, getStateTaxRate, calculateHSATaxRate } from '@/lib/utils'
import { STATE_TAX_RATES_2026 } from '@/lib/constants/states-2026'

describe('getStateTaxRate (2026 state table)', () => {
  it('returns the flat rate for flat-tax states', () => {
    // Illinois: 4.95% flat
    expect(getStateTaxRate('IL')).toBe(0.0495)
    // Iowa: 3.8% flat since 2025 (SF 2442) — was stale at 6.48%
    expect(getStateTaxRate('IA')).toBe(0.038)
    // Kentucky: 3.5% flat for 2026 (2025 HB 1) — was stale at 4.5%
    expect(getStateTaxRate('KY')).toBe(0.035)
    // Louisiana: 3.0% flat since 2025 — was stale at 4.25%
    expect(getStateTaxRate('LA')).toBe(0.03)
  })

  it('returns 0 for no-income-tax states', () => {
    expect(getStateTaxRate('TX')).toBe(0)
    expect(getStateTaxRate('WA')).toBe(0)
    expect(getStateTaxRate('NH')).toBe(0)
    expect(STATE_TAX_RATES_2026.TX.hasStateTax).toBe(false)
  })

  it('returns 0 for empty or unknown state codes', () => {
    expect(getStateTaxRate('')).toBe(0)
    expect(getStateTaxRate('ZZ')).toBe(0)
  })

  it('covers all 50 states plus DC', () => {
    expect(Object.keys(STATE_TAX_RATES_2026)).toHaveLength(51)
  })
})

describe('getFICARate — Additional Medicare thresholds by filing status', () => {
  // 2026 constants: SS wage base $184,500; FICA 7.65%; Medicare-only 1.45%;
  // Medicare + 0.9% surtax = 2.35%.

  describe('single ($200,000 threshold)', () => {
    it('returns 7.65% at and below the SS wage base', () => {
      expect(getFICARate(184500, 'single')).toBe(0.0765)
    })

    it('returns 1.45% between the wage base and $200k', () => {
      expect(getFICARate(200000, 'single')).toBe(0.0145)
    })

    it('returns 2.35% above $200k', () => {
      expect(getFICARate(200001, 'single')).toBe(0.0235)
    })

    it('defaults to single when no filing status is given', () => {
      expect(getFICARate(200000)).toBe(0.0145)
      expect(getFICARate(200001)).toBe(0.0235)
    })
  })

  describe('head of household ($200,000 threshold)', () => {
    it('applies the surtax only above $200k', () => {
      expect(getFICARate(200000, 'headOfHousehold')).toBe(0.0145)
      expect(getFICARate(200001, 'headOfHousehold')).toBe(0.0235)
    })
  })

  describe('married filing jointly ($250,000 threshold)', () => {
    it('does NOT apply the surtax between $200k and $250k (the fixed bug)', () => {
      // Old code used the $200k single threshold for everyone, so a
      // $225k MFJ household was wrongly charged 2.35% instead of 1.45%.
      expect(getFICARate(225000, 'marriedJoint')).toBe(0.0145)
      expect(getFICARate(250000, 'marriedJoint')).toBe(0.0145)
    })

    it('applies the surtax above $250k', () => {
      expect(getFICARate(250001, 'marriedJoint')).toBe(0.0235)
    })

    it('accepts both filing-status spellings', () => {
      expect(getFICARate(225000, 'marriedFilingJointly')).toBe(0.0145)
      expect(getFICARate(250001, 'marriedFilingJointly')).toBe(0.0235)
    })
  })

  describe('married filing separately ($125,000 threshold)', () => {
    it('returns full FICA at or below $125k', () => {
      expect(getFICARate(125000, 'marriedSeparate')).toBe(0.0765)
    })

    it('stacks the 0.9% surtax on full FICA between $125k and the wage base', () => {
      // 6.2% SS + 1.45% Medicare + 0.9% surtax = 8.55%
      expect(getFICARate(125001, 'marriedSeparate')).toBeCloseTo(0.0855, 6)
      expect(getFICARate(184500, 'marriedSeparate')).toBeCloseTo(0.0855, 6)
    })

    it('returns 2.35% above the wage base', () => {
      expect(getFICARate(184501, 'marriedSeparate')).toBe(0.0235)
      expect(getFICARate(184501, 'marriedFilingSeparately')).toBe(0.0235)
    })
  })
})

describe('calculateHSATaxRate threads filing status through to FICA', () => {
  it('uses the MFJ threshold when filing jointly', () => {
    // $225k MFJ in TX: 22% federal + 0% state + 1.45% Medicare = 23.45%
    expect(calculateHSATaxRate(0.22, 'TX', 225000, 'marriedJoint')).toBeCloseTo(0.2345, 4)
  })

  it('defaults to the single threshold', () => {
    // $225k single in TX: 22% federal + 0% state + 2.35% = 24.35%
    expect(calculateHSATaxRate(0.22, 'TX', 225000)).toBeCloseTo(0.2435, 4)
  })
})
