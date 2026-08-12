/**
 * Projections Module Test Suite
 *
 * Tests lib/calculations/projections.ts: progressive federal tax, annuity
 * future value for contribution streams, and the current-vs-optimized path
 * projections built from per-paycheck AllocationItems.
 *
 * Units (verified by reading the source):
 *   - `profile.income.gross` / `.net` are MONTHLY; annual income = gross * 12.
 *   - AllocationItem.amount and .taxImpact are PER-PAYCHECK; projections
 *     annualize with the pay frequency (26 paychecks/year for bi-weekly).
 *
 * All expected values are hand-computed; the arithmetic is shown in comments.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateProjections,
  calculateAnnualFederalTax,
  calculateAnnuityFutureValue,
} from '@/lib/calculations/projections'
import { getBracketsForStatus, STANDARD_DEDUCTIONS_2026 } from '@/lib/constants/irs-2026'
import type { AllocationItem } from '@/lib/types'
import {
  createPaycheckProfile,
  createIncomeData,
  createTaxData,
  createUserPreferences,
  createEmployerBenefits,
  createHSABenefits,
  createIRAData,
} from '@/test/factories/test-data-factory'

// Hand-computation reference used in the comments below:
//   1.07^10 = 1.9671513573 (10-year growth factor)
//   annuity factor = (1.07^10 - 1) / 0.07 = 13.8164479613

const makeAllocation = (overrides: Partial<AllocationItem> = {}): AllocationItem => ({
  id: 'test-allocation',
  account: 'Test Account',
  amount: 100, // per paycheck
  percentage: 0.05,
  priority: 5,
  reasoning: 'test',
  taxImpact: 0,
  category: 'tax_advantaged',
  implementation: 'test',
  ...overrides,
})

describe('projections.ts — tax model and growth projections', () => {
  // ────────────────────────────────────────────────────────────────────────
  // Progressive federal tax (fix for marginal-rate-on-every-dollar model)
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateAnnualFederalTax', () => {
    it('computes progressive tax on taxable income for a single filer at $100k gross', () => {
      // Taxable = 100,000 - 16,100 (std deduction) = 83,900
      //   10% × 12,400              = 1,240
      //   12% × (50,400 - 12,400)   = 4,560
      //   22% × (83,900 - 50,400)   = 7,370
      //   total                     = 13,170
      expect(calculateAnnualFederalTax(100000, 'single')).toBeCloseTo(13170, 2)
      // The old model charged the 22% marginal rate on every dollar:
      // 100,000 × 0.22 = 22,000 — a ~67% overstatement of the real 13,170
      expect(calculateAnnualFederalTax(100000, 'single')).toBeLessThan(100000 * 0.22)
    })

    it('returns zero at or below the standard deduction', () => {
      expect(calculateAnnualFederalTax(0, 'single')).toBe(0)
      expect(calculateAnnualFederalTax(STANDARD_DEDUCTIONS_2026.single, 'single')).toBe(0)
      // one dollar over the deduction is taxed at 10%
      expect(calculateAnnualFederalTax(STANDARD_DEDUCTIONS_2026.single + 1, 'single')).toBeCloseTo(0.10, 6)
    })

    it('uses the MFJ table for married filers at $100k gross', () => {
      // Taxable = 100,000 - 32,200 = 67,800
      //   10% × 24,800              = 2,480
      //   12% × (67,800 - 24,800)   = 5,160
      //   total                     = 7,640
      expect(calculateAnnualFederalTax(100000, 'marriedJoint')).toBeCloseTo(7640, 2)
      expect(calculateAnnualFederalTax(100000, 'marriedFilingJointly')).toBeCloseTo(7640, 2)
    })

    it('head of household at $60k gross owes less than a single filer (wider low brackets)', () => {
      // HoH:    taxable = 60,000 - 24,150 = 35,850
      //         10% × 17,700 + 12% × (35,850 - 17,700) = 1,770 + 2,178 = 3,948
      // Single: taxable = 60,000 - 16,100 = 43,900
      //         10% × 12,400 + 12% × (43,900 - 12,400) = 1,240 + 3,780 = 5,020
      const hoh = calculateAnnualFederalTax(60000, 'headOfHousehold')
      const single = calculateAnnualFederalTax(60000, 'single')
      expect(hoh).toBeCloseTo(3948, 2)
      expect(single).toBeCloseTo(5020, 2)
      expect(hoh).toBeLessThan(single)
    })

    it('married filing separately hits the 37% rate at half the MFJ threshold', () => {
      // Both single and MFS: taxable = 500,000 - 16,100 = 483,900
      // Shared cumulative tax through the 32% ceiling at 256,225:
      //   1,240 + 4,560 + 12,166 + 23,058 + 17,424 = 58,448
      // Single: 35% × (483,900 - 256,225) = 79,686.25 → total 138,134.25
      // MFS:    35% × (384,350 - 256,225) = 44,843.75
      //         37% × (483,900 - 384,350) = 36,833.50 → total 140,125.25
      expect(calculateAnnualFederalTax(500000, 'single')).toBeCloseTo(138134.25, 2)
      expect(calculateAnnualFederalTax(500000, 'marriedSeparate')).toBeCloseTo(140125.25, 2)
    })
  })

  describe('getBracketsForStatus', () => {
    it('places $60k of taxable income in the 12% bracket for HoH but 22% for single', () => {
      const bracketFor = (status: Parameters<typeof getBracketsForStatus>[0], income: number) =>
        getBracketsForStatus(status).find(b => income > b.min && income <= b.max)!
      expect(bracketFor('headOfHousehold', 60000).rate).toBe(0.12)
      expect(bracketFor('single', 60000).rate).toBe(0.22)
    })

    it('maps profile filing statuses to the right tables (MFS = half of MFJ thresholds)', () => {
      expect(getBracketsForStatus('marriedJoint')).toBe(getBracketsForStatus('marriedFilingJointly'))
      const mfj = getBracketsForStatus('marriedFilingJointly')
      const mfs = getBracketsForStatus('marriedSeparate')
      mfs.forEach((bracket, i) => {
        if (bracket.max !== Infinity) {
          expect(bracket.max).toBeCloseTo(mfj[i].max / 2, 6)
        }
        expect(bracket.rate).toBe(mfj[i].rate)
      })
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Annuity future value (fix for FV-of-single-year contribution stream)
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateAnnuityFutureValue', () => {
    it('grows a $10,000/yr stream at 7% for 10 years to $138,164.48', () => {
      // FV = 10,000 × ((1.07^10 − 1) / 0.07) = 10,000 × 13.8164479613 = 138,164.48
      expect(calculateAnnuityFutureValue(10000, 0.07, 10)).toBeCloseTo(138164.48, 1)
    })

    it('reduces to contribution × years at 0% return', () => {
      expect(calculateAnnuityFutureValue(10000, 0, 10)).toBe(100000)
    })

    it('returns 0 for zero or negative contributions', () => {
      expect(calculateAnnuityFutureValue(0, 0.07, 10)).toBe(0)
      expect(calculateAnnuityFutureValue(-500, 0.07, 10)).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // calculateProjections — end-to-end with hand-computed numbers
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateProjections', () => {
    // Bi-weekly earner, $5,000/mo gross ($60k/yr), $4,000/mo net, no 401k plan.
    // estimateCurrentNetWorth = 10,000 emergency fund + 60,000 × 0.5 = 40,000 (no debts)
    // calculateCurrentMonthlyInvestment = 10% × (4,000 − 3,000 − 200) = 80/mo
    const buildProfile = () =>
      createPaycheckProfile({
        income: createIncomeData({
          gross: 5000,
          monthlyGross: 5000,
          net: 4000,
          monthlyNet: 4000,
          frequency: 'bi-weekly',
        }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'single' }),
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          currentEmergencyFund: 10000,
          funMoney: { min: 200, max: 500, current: 350 },
        }),
        benefits: {
          employer401k: createEmployerBenefits({ available: false }),
          hsa: createHSABenefits({ eligible: false }),
          ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [],
      })

    it('current path: annuity-FV of the contribution stream plus compounded net worth', () => {
      const result = calculateProjections(buildProfile(), [])
      // tenYear = 40,000 × 1.07^10 + (80 × 12) × 13.8164479613
      //         = 78,686.05 + 13,263.79 = 91,949.84
      expect(result.currentPath.tenYear).toBeCloseTo(91949.84, 1)
      // taxesOwed: progressive single tax on $60k gross = 5,020 (not 60,000 × 0.22 = 13,200)
      expect(result.currentPath.taxesOwed).toBeCloseTo(5020, 2)
      expect(result.currentPath.fiAge).toBeGreaterThan(30)
      expect(result.currentPath.fiAge).toBeLessThanOrEqual(99)
    })

    it('optimized path annualizes per-paycheck allocations with the bi-weekly multiplier (×26, not ×12)', () => {
      const allocations = [makeAllocation({ amount: 100, taxImpact: 0 })]
      const biWeekly = calculateProjections(buildProfile(), allocations)
      // Bi-weekly: $100/paycheck × 26 = $2,600/yr
      // tenYear = 78,686.05 + 2,600 × 13.8164479613 = 78,686.05 + 35,922.76 = 114,608.82
      expect(biWeekly.optimizedPath.tenYear).toBeCloseTo(114608.82, 1)

      const monthlyProfile = buildProfile()
      monthlyProfile.income.frequency = 'monthly'
      const monthly = calculateProjections(monthlyProfile, allocations)
      // Monthly: $100/paycheck × 12 = $1,200/yr
      // tenYear = 78,686.05 + 1,200 × 13.8164479613 = 78,686.05 + 16,579.74 = 95,265.79
      expect(monthly.optimizedPath.tenYear).toBeCloseTo(95265.79, 1)
    })

    it('models tax savings as additional invested principal, not a return boost', () => {
      // One tax-advantaged allocation: $100/paycheck with $22/paycheck tax savings,
      // plus an emergency-fund allocation that must NOT count as investment.
      const allocations = [
        makeAllocation({ amount: 100, taxImpact: -22, category: 'tax_advantaged' }),
        makeAllocation({ id: 'ef', amount: 50, taxImpact: 0, category: 'emergency_fund' }),
      ]
      const result = calculateProjections(buildProfile(), allocations)
      // Invested stream = 100 × 26 + 22 × 26 = 2,600 + 572 = 3,172/yr at a plain 7%
      // tenYear = 78,686.05 + 3,172 × 13.8164479613 = 78,686.05 + 43,825.77 = 122,511.83
      expect(result.optimizedPath.tenYear).toBeCloseTo(122511.83, 1)

      // Versus the same allocation without tax savings, the difference is exactly
      // the annuity FV of the reinvested savings: 572 × 13.8164479613 = 7,903.01
      const noSavings = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 0 }),
      ])
      expect(result.optimizedPath.tenYear - noSavings.optimizedPath.tenYear).toBeCloseTo(7903.01, 1)
    })

    it('optimized taxes = progressive tax minus annualized tax savings', () => {
      const allocations = [makeAllocation({ amount: 100, taxImpact: -22 })]
      const result = calculateProjections(buildProfile(), allocations)
      // 5,020 − 22 × 26 = 5,020 − 572 = 4,448
      expect(result.optimizedPath.taxesOwed).toBeCloseTo(4448, 2)
      expect(result.improvement.annualTaxSavings).toBeCloseTo(572, 2)
    })

    it('never reports negative taxes owed', () => {
      // Absurdly large per-paycheck tax savings should clamp at zero
      const allocations = [makeAllocation({ amount: 100, taxImpact: -1000 })]
      const result = calculateProjections(buildProfile(), allocations)
      expect(result.optimizedPath.taxesOwed).toBe(0)
    })
  })
})
