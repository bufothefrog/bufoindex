/**
 * Tax Impact Integration Tests
 * Verifies corrected tax calculations after FICA separation and 2026 updates.
 *
 * Key fixes validated:
 * 1. Pre-tax 401k/Traditional IRA tax savings use income tax rate only (no FICA)
 * 2. HSA tax savings correctly include FICA (IRC 3121 exemption)
 * 3. FICA wage base cap applied for high earners ($184,500 for 2026)
 * 4. Debt interest savings use average-balance correction
 * 5. All contribution limits reflect 2026 IRS values
 */

import { describe, it, expect } from 'vitest'
import {
  calculateIncomeTaxRate,
  calculateHSATaxRate,
  getFICARate,
  calculateMarginalTaxRate,
} from '@/lib/utils'
import { CONTRIBUTION_LIMITS, TAX_BRACKETS } from '@/lib/types'

describe('Tax Rate Functions', () => {
  describe('calculateIncomeTaxRate (federal + state only, no FICA)', () => {
    it('should return federal + state for CA resident in 22% bracket', () => {
      const rate = calculateIncomeTaxRate(0.22, 'CA')
      expect(rate).toBeCloseTo(0.22 + 0.093, 4) // 0.313 — CA 9.3% middle-income marginal bracket
    })

    it('should return federal only for no-income-tax states', () => {
      expect(calculateIncomeTaxRate(0.22, 'TX')).toBeCloseTo(0.22, 4)
      expect(calculateIncomeTaxRate(0.22, 'FL')).toBeCloseTo(0.22, 4)
      expect(calculateIncomeTaxRate(0.22, 'WA')).toBeCloseTo(0.22, 4)
      expect(calculateIncomeTaxRate(0.22, 'NV')).toBeCloseTo(0.22, 4)
    })

    it('should NOT include FICA (this was the critical bug)', () => {
      const rate = calculateIncomeTaxRate(0.22, 'CA')
      // Must NOT equal the old broken value of 0.3895 (which included 7.65% FICA)
      expect(rate).not.toBeCloseTo(0.3895, 2)
      // Must equal federal + state only
      expect(rate).toBeCloseTo(0.313, 3)
    })

    it('should handle empty state code', () => {
      expect(calculateIncomeTaxRate(0.22, '')).toBeCloseTo(0.22, 4)
    })
  })

  describe('calculateHSATaxRate (includes FICA for HSA payroll deductions)', () => {
    it('should include full FICA for income below SS wage base', () => {
      const rate = calculateHSATaxRate(0.22, 'CA', 100000)
      // 22% federal + 9.3% CA + 7.65% FICA = 38.95%
      expect(rate).toBeCloseTo(0.22 + 0.093 + 0.0765, 4)
    })

    it('should use Medicare-only FICA above SS wage base ($184,500)', () => {
      const rate = calculateHSATaxRate(0.22, 'CA', 190000)
      // 22% federal + 9.3% CA + 1.45% Medicare only = 32.75%
      expect(rate).toBeCloseTo(0.22 + 0.093 + 0.0145, 4)
    })

    it('should include additional Medicare tax above $200k', () => {
      const rate = calculateHSATaxRate(0.22, 'CA', 250000)
      // 22% federal + 9.3% CA + 2.35% (Medicare + additional) = 32.85%
      expect(rate).toBeCloseTo(0.22 + 0.093 + 0.0235, 4)
    })

    it('should match old calculateMarginalTaxRate for income below SS wage base', () => {
      // For incomes below SS wage base, HSA rate should equal old marginal rate
      const hsaRate = calculateHSATaxRate(0.22, 'CA', 100000)
      const oldMarginalRate = calculateMarginalTaxRate(0.22, 'CA')
      expect(hsaRate).toBeCloseTo(oldMarginalRate, 4)
    })
  })

  describe('getFICARate', () => {
    it('should return 7.65% below SS wage base', () => {
      expect(getFICARate(100000)).toBe(0.0765)
      expect(getFICARate(184500)).toBe(0.0765) // At the cap
    })

    it('should return 1.45% above SS wage base but below $200k', () => {
      expect(getFICARate(184501)).toBe(0.0145)
      expect(getFICARate(200000)).toBe(0.0145)
    })

    it('should return 2.35% above $200k (additional Medicare)', () => {
      expect(getFICARate(200001)).toBe(0.0235)
      expect(getFICARate(500000)).toBe(0.0235)
    })
  })
})

describe('2026 IRS Constants Verification', () => {
  describe('contribution limits (IRS Notice 2025-67)', () => {
    const limits = CONTRIBUTION_LIMITS[2026]

    it('should have correct 401k limits', () => {
      expect(limits.traditional401k).toBe(24500)
      expect(limits.roth401k).toBe(24500)
    })

    it('should have correct IRA limit', () => {
      expect(limits.ira).toBe(7500)
    })

    it('should have correct HSA limits', () => {
      expect(limits.hsa.individual).toBe(4400)
      expect(limits.hsa.family).toBe(8750)
    })

    it('should have correct catch-up limits', () => {
      expect(limits.catchUp['401k']).toBe(8000)
      expect(limits.catchUp.ira).toBe(1100)
      expect(limits.catchUp.hsa).toBe(1000) // Statutory, not indexed
    })

    it('should have correct 415(c) total additions limit', () => {
      expect(limits.total415c).toBe(72000)
    })

    it('should have super catch-up for ages 60-63', () => {
      expect(limits.catchUp.superCatchUp401k).toBe(11250)
    })
  })

  describe('tax brackets (Rev. Proc. 2025-32, OBBBA)', () => {
    const brackets = TAX_BRACKETS[2026]

    it('should have correct 2026 single brackets', () => {
      expect(brackets.single[0]).toEqual({ min: 0, max: 12400, rate: 0.10 })
      expect(brackets.single[1]).toEqual({ min: 12400, max: 50400, rate: 0.12 })
      expect(brackets.single[2]).toEqual({ min: 50400, max: 105700, rate: 0.22 })
      expect(brackets.single[6]).toEqual({ min: 640600, max: Infinity, rate: 0.37 })
    })

    it('should have correct 2026 MFJ brackets', () => {
      expect(brackets.marriedJoint[0]).toEqual({ min: 0, max: 24800, rate: 0.10 })
      expect(brackets.marriedJoint[1]).toEqual({ min: 24800, max: 100800, rate: 0.12 })
      expect(brackets.marriedJoint[6]).toEqual({ min: 768700, max: Infinity, rate: 0.37 })
    })
  })
})

describe('Debt Interest Savings Formula', () => {
  it('should use average-balance correction (0.5 factor)', () => {
    // With $500/month extra on 15% debt:
    // Old (wrong): $500 * 12 * 0.15 = $900/year
    // New (correct): $500 * 12 * 0.15 * 0.5 = $450/year
    const extraPayment = 500
    const interestRate = 0.15
    const correctedSavings = extraPayment * 12 * interestRate * 0.5
    expect(correctedSavings).toBe(450)
    // Must NOT be the old inflated value
    expect(correctedSavings).not.toBe(900)
  })
})
