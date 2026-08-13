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
  calculateOptimizationScore,
  calculateAnnualFederalTax,
  calculateAnnuityFutureValue,
} from '@/lib/calculations/projections'
import { calculateOptimalAllocation, getDefaultProfile } from '@/lib/calculations/core'
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
  createDebtData,
} from '@/test/factories/test-data-factory'

// Hand-computation reference used in the comments below:
//   1.07^10 = 1.9671513573 (10-year growth factor)
//   annuity factor  @7%   = (1.07^10  - 1) / 0.07  = 13.8164479613  (invested dollars)
//   annuity factor  @4.5% = (1.045^10 - 1) / 0.045 = 12.2882093718  (cash / emergency fund)
//   annuity factor  @18%  = (1.18^10  - 1) / 0.18  = 23.5213086322  (extra debt principal)
//
// Both projected paths are built from the same universe of dollars: today's net
// worth, the payroll deferral (and the employer match it earns) already in
// place, and then whatever each path does with leftover take-home pay. The
// shared terms cancel out of `improvement`.
//
// Starting net worth comes only from balances the profile collects:
// `preferences.currentEmergencyFund` + `benefits.ira.currentBalances`
// (traditional + roth) - debt balances. The test factory's IRA defaults are
// 12,000 traditional + 8,000 roth = 20,000, so the profiles below start at
// 10,000 + 20,000 = 30,000 unless they carry debt.

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
  describe('calculateProjections — already financially independent (regression: NaN fiAge)', () => {
    it('produces finite improvement numbers when net worth already exceeds the FI target', () => {
      // Emergency fund large enough that estimated net worth far exceeds
      // 25x annual expenses, which previously drove Math.log of a negative
      // argument inside the FI-age solver and NaN through the results.
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 5000, monthlyGross: 5000, net: 4000, monthlyNet: 4000, frequency: 'monthly' }),
        preferences: createUserPreferences({
          necessaryExpenses: 1000,
          currentEmergencyFund: 2000000, // dwarfs the 25x * 12 * 1000 = $300k FI target
          funMoney: { min: 200, max: 500, current: 350 },
        }),
      })
      const projections = calculateProjections(profile, [])
      expect(Number.isFinite(projections.improvement.fiYearsEarlier)).toBe(true)
      expect(Number.isFinite(projections.currentPath.fiAge)).toBe(true)
      expect(Number.isFinite(projections.optimizedPath.fiAge)).toBe(true)
    })
  })

  describe('calculateProjections', () => {
    // Bi-weekly earner, $5,000/mo gross ($60k/yr), $4,000/mo net, no 401k plan.
    // estimateCurrentNetWorth = 10,000 emergency fund + 20,000 IRA balances = 30,000 (no debts)
    // baseline discretionary saving = 10% × (4,000 − 3,000 − 200) = 80/mo
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
      // tenYear = 30,000 × 1.07^10 + (80 × 12) × 13.8164479613
      //         = 59,014.54 + 13,263.79 = 72,278.33
      expect(result.currentPath.tenYear).toBeCloseTo(72278.33, 1)
      // taxesOwed: progressive single tax on $60k gross = 5,020 (not 60,000 × 0.22 = 13,200)
      expect(result.currentPath.taxesOwed).toBeCloseTo(5020, 2)
      // FI: expenses = 48,000 − 960 = 47,040 → target 47,040 / 0.04 = 1,176,000
      //   years = ln((1,176,000 − 30,000) × 0.07 / 960 + 1) / ln(1.07)
      //         = ln(84.5625) / ln(1.07) = 4.4375658 / 0.0676586 = 65.5865
      //   fiAge = 28 (profile age) + 65.5865 = 93.59
      expect(result.currentPath.fiAge).toBeCloseTo(93.59, 1)
      expect(result.currentPath.fiAge).toBeLessThanOrEqual(99)
    })

    it('optimized path annualizes per-paycheck allocations with the bi-weekly multiplier (×26, not ×12)', () => {
      const allocations = [makeAllocation({ amount: 100, taxImpact: 0 })]
      const biWeekly = calculateProjections(buildProfile(), allocations)
      // Bi-weekly: $100/paycheck × 26 = $2,600/yr
      // tenYear = 59,014.54 + 2,600 × 13.8164479613 = 59,014.54 + 35,922.76 = 94,937.31
      expect(biWeekly.optimizedPath.tenYear).toBeCloseTo(94937.31, 1)

      const monthlyProfile = buildProfile()
      monthlyProfile.income.frequency = 'monthly'
      const monthly = calculateProjections(monthlyProfile, allocations)
      // Monthly: $100/paycheck × 12 = $1,200/yr
      // tenYear = 59,014.54 + 1,200 × 13.8164479613 = 59,014.54 + 16,579.74 = 75,594.28
      expect(monthly.optimizedPath.tenYear).toBeCloseTo(75594.28, 1)
    })

    it('models tax savings as additional invested principal, not a return boost', () => {
      // One tax-advantaged allocation: $100/paycheck with $22/paycheck tax savings,
      // plus an emergency-fund allocation, which is saved at the cash rate rather
      // than invested at 7% — but is still counted (it is money the user keeps).
      const allocations = [
        makeAllocation({ amount: 100, taxImpact: -22, category: 'tax_advantaged' }),
        makeAllocation({ id: 'ef', amount: 50, taxImpact: 0, category: 'emergency_fund' }),
      ]
      const result = calculateProjections(buildProfile(), allocations)
      // Invested stream = 100 × 26 + 22 × 26 = 2,600 + 572 = 3,172/yr at a plain 7%
      //   → 3,172 × 13.8164479613 = 43,825.77
      // Cash stream    = 50 × 26 = 1,300/yr at the profile's 4.5% APY
      //   → 1,300 × 12.2882093718 = 15,974.67
      // tenYear = 59,014.54 + 43,825.77 + 15,974.67 = 118,814.99
      expect(result.optimizedPath.tenYear).toBeCloseTo(118814.99, 1)

      // Versus the same allocations without tax savings, the difference is exactly
      // the annuity FV of the reinvested savings: 572 × 13.8164479613 = 7,903.01
      const noSavings = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 0 }),
        makeAllocation({ id: 'ef', amount: 50, taxImpact: 0, category: 'emergency_fund' }),
      ])
      expect(result.optimizedPath.tenYear - noSavings.optimizedPath.tenYear).toBeCloseTo(7903.01, 1)
    })

    it('counts emergency-fund savings at the cash rate instead of dropping them', () => {
      // Regression: emergency_fund allocations used to contribute nothing to the
      // optimized projection, so a plan that routed the whole paycheck into cash
      // savings projected a *lower* balance than doing nothing.
      const withCash = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 0, category: 'tax_advantaged' }),
        makeAllocation({ id: 'ef', amount: 50, taxImpact: 0, category: 'emergency_fund' }),
      ])
      // 59,014.54 + 2,600 × 13.8164479613 + 1,300 × 12.2882093718
      //   = 59,014.54 + 35,922.76 + 15,974.67 = 110,911.98
      expect(withCash.optimizedPath.tenYear).toBeCloseTo(110911.98, 1)
      expect(withCash.improvement.tenYear).toBeGreaterThan(0)
    })

    it('counts extra debt principal at the debt rate instead of dropping it', () => {
      // $5,000 card at 18%: net worth = 10,000 EF + 20,000 IRA balances − 5,000
      //   = 25,000 → 25,000 × 1.9671513573 = 49,178.78
      const profile = buildProfile()
      profile.debts = [
        createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 150 }),
      ]
      const result = calculateProjections(profile, [
        makeAllocation({ id: 'debt', amount: 100, taxImpact: 0, category: 'debt_payoff' }),
      ])
      // current  = 49,178.78 + 960 × 13.8164479613 = 49,178.78 + 13,263.79 = 62,442.57
      // optimized= 49,178.78 + 2,600 × 23.5213086322 = 49,178.78 + 61,155.40 = 110,334.19
      expect(result.currentPath.tenYear).toBeCloseTo(62442.57, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(110334.19, 1)
      // The shared net-worth term cancels, so the improvement is unchanged
      expect(result.improvement.tenYear).toBeCloseTo(47891.61, 1)
    })

    it('treats a positive taxImpact as a cost, never as a saving', () => {
      // Math.abs() used to turn a tax *cost* into extra invested principal.
      const cost = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 22 }),
      ])
      const neutral = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 0 }),
      ])
      expect(cost.optimizedPath.tenYear).toBeCloseTo(neutral.optimizedPath.tenYear, 6)
      expect(cost.improvement.annualTaxSavings).toBe(0)
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

  // ────────────────────────────────────────────────────────────────────────
  // Long-Term Impact card: the two paths must measure the same dollars
  //
  // Reported defect: a bi-weekly profile showed Current Path $83,863 and
  // Optimized Path $47,572 — the "optimized" number was smaller because the
  // current path counted the existing payroll deferral plus an assumed
  // discretionary saving rate, while the optimized path counted only
  // tax_advantaged/investment allocations and silently dropped employer-match,
  // emergency-fund and debt-payoff dollars.
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateProjections — current vs optimized cover the same universe', () => {
    // $60k/yr gross ($5,000/mo), $4,000/mo net, bi-weekly, no debts.
    // Net worth = 10,000 emergency fund + 20,000 IRA balances = 30,000
    //   → 30,000 × 1.9671513573 = 59,014.54
    // Discretionary = (4,000 − 3,000 − 200) × 12 = 9,600/yr; baseline saves 10% = 960/yr
    const buildMatchProfile = (
      employer401k: Partial<ReturnType<typeof createEmployerBenefits>> = {}
    ) =>
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
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0.5,
            matchLimit: 0.06,
            currentContribution: 0.02, // leaving 4% of salary of match unclaimed
            ...employer401k,
          }),
          hsa: createHSABenefits({ eligible: false }),
          ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [],
      })

    it('projects a gain when the plan claims an unclaimed employer match', () => {
      // Current path — the 2% deferral and the match it already earns continue:
      //   deferral      = 60,000 × 0.02 = 1,200/yr
      //   match earned  = min(1,200, 60,000 × 0.06) × 0.5 = 600/yr
      //   discretionary = 960/yr
      //   invested      = 1,200 + 600 + 960 = 2,760/yr
      //   tenYear = 59,014.54 + 2,760 × 13.8164479613 = 59,014.54 + 38,133.40 = 97,147.94
      //
      // Optimized path — the same deferral, plus a $100/paycheck top-up:
      //   extra deferral = 100 × 26 = 2,600/yr → total deferral 3,800/yr
      //   match earned   = min(3,800, 3,600) × 0.5 = 1,800/yr  (match limit reached)
      //   invested       = 1,200 + 1,800 + 2,600 = 5,600/yr
      //   tenYear = 59,014.54 + 5,600 × 13.8164479613 = 59,014.54 + 77,372.11 = 136,386.65
      const result = calculateProjections(buildMatchProfile(), [
        makeAllocation({
          id: 'employer-match',
          amount: 100,
          taxImpact: 0,
          category: 'employer_match',
        }),
      ])

      expect(result.currentPath.tenYear).toBeCloseTo(97147.94, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(136386.65, 1)
      // (5,600 − 2,760) × 13.8164479613 = 39,238.71
      expect(result.improvement.tenYear).toBeCloseTo(39238.71, 1)
      expect(result.improvement.tenYear).toBeGreaterThan(0)
      expect(result.optimizedPath.tenYear).toBeGreaterThan(result.currentPath.tenYear)
    })

    it('is exactly flat when nothing is reallocated and there is no leftover pay', () => {
      // Take-home leaves nothing discretionary (net 3,200 − 3,000 − 200 = 0), so
      // both paths reduce to the identical shared terms: net worth plus the
      // existing 6% deferral and its full match. The improvement must be zero —
      // not a positive or negative artefact of one side counting more dollars.
      const profile = buildMatchProfile({ currentContribution: 0.06 })
      profile.income.net = 3200
      profile.income.monthlyNet = 3200

      const result = calculateProjections(profile, [])
      // deferral 3,600 + match 1,800 = 5,400/yr
      // tenYear = 59,014.54 + 5,400 × 13.8164479613 = 59,014.54 + 74,608.82 = 133,623.36
      expect(result.currentPath.tenYear).toBeCloseTo(133623.36, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(133623.36, 1)
      expect(result.improvement.tenYear).toBeCloseTo(0, 6)
    })

    it('reports a shortfall honestly when the plan directs less than the baseline', () => {
      // Genuinely under/over-allocated case: the plan puts only $10/paycheck
      // ($260/yr) to work against an assumed baseline of $960/yr, so the
      // ten-year balance really is lower. The number is reported as-is rather
      // than clamped to zero, so the UI can label it a shortfall.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 5000,
          monthlyGross: 5000,
          net: 4000,
          monthlyNet: 4000,
          frequency: 'bi-weekly',
        }),
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

      const result = calculateProjections(profile, [
        makeAllocation({ amount: 10, taxImpact: 0, category: 'investment' }),
      ])
      // current   = 59,014.54 + 960 × 13.8164479613 = 72,278.33
      // optimized = 59,014.54 + 260 × 13.8164479613 = 62,606.82
      expect(result.currentPath.tenYear).toBeCloseTo(72278.33, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(62606.82, 1)
      // (260 − 960) × 13.8164479613 = −9,671.51
      expect(result.improvement.tenYear).toBeCloseTo(-9671.51, 1)
      expect(result.improvement.tenYear).toBeLessThan(0)
    })

    it('keeps improvement an exact difference so a single deflator stays consistent', () => {
      // The card deflates all three rows to today's dollars independently. That
      // is only sound while improvement === optimized − current exactly, since
      // dividing by (1 + i)^10 is linear.
      const result = calculateProjections(buildMatchProfile(), [
        makeAllocation({ id: 'employer-match', amount: 100, category: 'employer_match' }),
        makeAllocation({ id: 'ef', amount: 40, category: 'emergency_fund' }),
      ])
      expect(result.improvement.tenYear).toBe(
        result.optimizedPath.tenYear - result.currentPath.tenYear
      )

      const deflator = Math.pow(1.03, 10)
      expect(result.optimizedPath.tenYear / deflator - result.currentPath.tenYear / deflator)
        .toBeCloseTo(result.improvement.tenYear / deflator, 6)
    })

    it('reproduces the reported bi-weekly profile as a gain, not a $36k shortfall (unchanged by the net-worth fix)', () => {
      // The screenshot profile: the whole $607.69/paycheck surplus was routed to
      // the emergency fund, a category the optimized path used to ignore, so the
      // card read Current $83,863 vs Optimized $47,572 (today's dollars).
      const profile = getDefaultProfile()
      const { projections } = calculateOptimalAllocation(profile)

      expect(projections.optimizedPath.tenYear).toBeGreaterThan(projections.currentPath.tenYear)
      expect(projections.improvement.tenYear).toBeGreaterThan(0)
      // Deflating to today's dollars cannot flip the sign.
      expect(projections.improvement.tenYear / Math.pow(1.03, 10)).toBeGreaterThan(0)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Starting net worth is built from reported balances only
  //
  // `estimateCurrentNetWorth` used to add `income.gross * 12 * 0.5` as
  // "estimated existing retirement savings", so every profile started with six
  // months of gross pay it never reported. There is no 401k-balance input, so
  // nothing stands in for one now.
  // ────────────────────────────────────────────────────────────────────────
  describe('estimateCurrentNetWorth (via calculateProjections)', () => {
    // $20,000/mo gross, $12,000/mo net, monthly pay, expenses equal to net pay
    // and no fun-money floor: nothing is discretionary, no 401k, so every
    // savings stream is zero and the ten-year figure IS the starting balance
    // grown at 7%.
    const buildBalanceProfile = (
      preferences: Parameters<typeof createUserPreferences>[0],
      overrides: Partial<Parameters<typeof createPaycheckProfile>[0]> = {}
    ) =>
      createPaycheckProfile({
        income: createIncomeData({
          gross: 20000,
          monthlyGross: 20000,
          net: 12000,
          monthlyNet: 12000,
          frequency: 'monthly',
        }),
        preferences: createUserPreferences({
          necessaryExpenses: 12000,
          funMoney: { min: 0, max: 0, current: 0 },
          ...preferences,
        }),
        benefits: {
          employer401k: createEmployerBenefits({ available: false, currentContribution: 0 }),
          hsa: createHSABenefits({ eligible: false }),
          ira: createIRAData({
            currentContributions: { traditional: 0, roth: 0 },
            currentBalances: { traditional: 0, roth: 0 },
          }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [],
        ...overrides,
      })

    it('starts at zero when the profile reports no emergency fund and no IRA balances', () => {
      // $240k/yr gross used to be credited with 240,000 × 0.5 = $120,000 of
      // invented retirement savings — $236,058 of the ten-year figure once
      // grown at 7% (120,000 × 1.9671513573), before a single contribution.
      const result = calculateProjections(
        buildBalanceProfile({ currentEmergencyFund: 0 }),
        []
      )
      expect(result.currentPath.tenYear).toBe(0)
      expect(result.optimizedPath.tenYear).toBe(0)
    })

    it('sums the emergency fund and IRA balances and subtracts debt balances', () => {
      // 10,000 emergency fund + (12,000 traditional + 8,000 roth) − 5,000 debt
      //   = 25,000 → 25,000 × 1.9671513573 = 49,178.78
      const profile = buildBalanceProfile(
        { currentEmergencyFund: 10000 },
        {
          debts: [
            createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 150 }),
          ],
        }
      )
      profile.benefits.ira.currentBalances = { traditional: 12000, roth: 8000 }

      const result = calculateProjections(profile, [])
      expect(result.currentPath.tenYear).toBeCloseTo(49178.78, 2)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // FI age anchors to the profile's age (was a hardcoded 30)
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateProjections — FI age', () => {
    // $5,000/mo gross, $4,000/mo net bi-weekly, $1,000/mo expenses, no
    // fun-money floor, no 401k. Net worth = 10,000 EF + 20,000 IRA = 30,000.
    //   discretionary  = (4,000 − 1,000) × 12 = 36,000/yr, baseline saves 3,600
    //   expenses       = 48,000 − 3,600 = 44,400 → FI target 44,400 / 0.04 = 1,110,000
    //   years to FI    = ln((1,110,000 − 30,000) × 0.07 / 3,600 + 1) / ln(1.07)
    //                  = ln(22) / ln(1.07) = 3.0910425 / 0.0676586 = 45.6858
    const buildAgeProfile = (age: number, currentEmergencyFund = 10000) =>
      createPaycheckProfile({
        income: createIncomeData({
          gross: 5000,
          monthlyGross: 5000,
          net: 4000,
          monthlyNet: 4000,
          frequency: 'bi-weekly',
        }),
        preferences: createUserPreferences({
          age,
          necessaryExpenses: 1000,
          currentEmergencyFund,
          funMoney: { min: 0, max: 0, current: 0 },
        }),
        benefits: {
          employer401k: createEmployerBenefits({ available: false, currentContribution: 0 }),
          hsa: createHSABenefits({ eligible: false }),
          ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [],
      })

    it('adds the years-to-FI to the profile age instead of to 30', () => {
      // A 25-year-old reaches FI at 25 + 45.6858 = 70.69; the same numbers for a
      // 40-year-old land at 85.69. Both used to report 75.69 (30 + 45.6858).
      expect(calculateProjections(buildAgeProfile(25), []).currentPath.fiAge)
        .toBeCloseTo(70.69, 2)
      expect(calculateProjections(buildAgeProfile(40), []).currentPath.fiAge)
        .toBeCloseTo(85.69, 2)
      // The gap between the two is exactly the age difference
      const younger = calculateProjections(buildAgeProfile(25), []).currentPath.fiAge
      const older = calculateProjections(buildAgeProfile(40), []).currentPath.fiAge
      expect(older - younger).toBeCloseTo(15, 6)
    })

    it('reports the profile age, not 30, when net worth already clears the FI target', () => {
      // $2,000,000 emergency fund dwarfs the 1,110,000 target: FI is today, and
      // "today" for a 55-year-old is 55 — the old branch returned a bare 30, an
      // FI date 25 years in the past.
      const result = calculateProjections(buildAgeProfile(55, 2000000), [])
      expect(result.currentPath.fiAge).toBe(55)
      expect(result.optimizedPath.fiAge).toBe(55)
      expect(result.improvement.fiYearsEarlier).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Optimization score: both sides graded on one rubric
  //
  // `comparison` used to come from a separate formula (40-point base, +20/+10/+10,
  // capped at 75) that graded the profile, while `overall` graded the recommended
  // allocations — so the tool's own recommendation could score 61 against a 75
  // "typical advice" baseline while doing strictly more.
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateOptimizationScore — one rubric for both sides', () => {
    // $5,000/mo gross bi-weekly ($60k/yr), 22% bracket, 50% match up to 6% of
    // salary, contributing nothing today, no HSA, no IRA contributions, no debt,
    // 3-month emergency fund already funded.
    const buildScoreProfile = () =>
      createPaycheckProfile({
        income: createIncomeData({
          gross: 5000,
          monthlyGross: 5000,
          net: 4000,
          monthlyNet: 4000,
          netPaycheck: 1850,
          frequency: 'bi-weekly',
        }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 35, currentEmergencyFund: 9000 }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0.5,
            matchLimit: 0.06,
            currentContribution: 0,
            traditionalContribution: 0,
          }),
          hsa: createHSABenefits({ eligible: false }),
          ira: createIRAData({
            currentContributions: { traditional: 0, roth: 0 },
            currentBalances: { traditional: 0, roth: 0 },
          }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [],
      })

    // 6% of $60,000 = $3,600/yr ÷ 26 paychecks = $138.46, deducted at 22%
    const matchAllocation = makeAllocation({
      id: 'employer-match',
      account: '401k Employer Match',
      amount: 3600 / 26,
      taxImpact: -(3600 / 26) * 0.22,
      category: 'employer_match',
      priority: 2,
    })

    it('grades the status quo with the same five weighted components', () => {
      // Current behaviour is empty (0% deferral, no HSA, no IRA, no debt):
      //   taxEfficiency        30  (no pre-tax dollars)
      //   employerBenefits     30  (match not captured +0, HSA not eligible +30)
      //   debtStrategy        100  (no debts)
      //   emergencyFundSize    90  (no emergency-fund skipped items)
      //   accountPrioritization 70 (base, nothing to order)
      //   → 0.25(30) + 0.25(30) + 0.20(100) + 0.15(90) + 0.15(70)
      //     = 7.5 + 7.5 + 20 + 13.5 + 10.5 = 59
      //
      // Recommended = the same list plus the match allocation:
      //   taxEfficiency        30  (30.46 / 5,000 = 0.6% of income)
      //   employerBenefits    100  (match captured +70, HSA n/a +30)
      //   accountPrioritization 85 (match ahead of every discretionary destination)
      //   → 7.5 + 25 + 20 + 13.5 + 12.75 = 78.75 → 79
      const score = calculateOptimizationScore(buildScoreProfile(), [matchAllocation], [])

      expect(score.comparison).toBe(59)
      expect(score.overall).toBe(79)
      expect(score.breakdown).toEqual({
        taxEfficiency: 30,
        employerBenefits: 100,
        debtStrategy: 100,
        emergencyFundSize: 90,
        accountPrioritization: 85,
      })
    })

    it('scores an empty plan exactly as it scores the status quo it changes nothing about', () => {
      // Same rubric, same inputs: recommending nothing to a profile that does
      // nothing has to land on the same number on both sides.
      const score = calculateOptimizationScore(buildScoreProfile(), [], [])
      expect(score.overall).toBe(score.comparison)
      expect(score.overall).toBe(59)
    })

    it('does not score the recommended plan below the status quo for a heavy existing deferrer', () => {
      // The reported profile: bi-weekly $3,000/$2,250 paycheck with
      // currentContribution 1.5 (150% of salary — the input is not clamped).
      // It used to score overall 61 against comparison 75.
      //
      // Current behaviour now grades as:
      //   existing 401k deferral  78,000 × 1.5 / 26 = $4,500/paycheck, 12% bracket
      //                           → tax saving $540/paycheck, captures the match
      //   existing HSA            $200/mo → $92.31/paycheck (pre-tax)
      //   existing Roth IRA       $500/mo → $230.77/paycheck (no deduction)
      //   taxEfficiency         70  ((540 + 11.08) / 6,500 = 8.5% of income)
      //   employerBenefits     100  (match captured, HSA funded)
      //   debtStrategy          30  (60 base − 30 for the 18% card)
      //   emergencyFundSize     90  (no emergency-fund skipped items)
      //   accountPrioritization 90  (match first, tax-advantaged before taxable)
      //   → 17.5 + 25 + 6 + 13.5 + 13.5 = 75.5 → 76
      const profile = createPaycheckProfile({
        income: createIncomeData({
          grossPaycheck: 3000,
          netPaycheck: 2250,
          frequency: 'bi-weekly',
        }),
        benefits: {
          employer401k: createEmployerBenefits({
            currentContribution: 1.5,
            traditionalContribution: 1.5,
          }),
          hsa: createHSABenefits(),
          ira: createIRAData(),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 25 },
        },
      })

      const { optimizationScore } = calculateOptimalAllocation(profile)
      expect(optimizationScore.comparison).toBe(76)
      expect(optimizationScore.overall).toBeGreaterThanOrEqual(optimizationScore.comparison)
    })
  })
})
