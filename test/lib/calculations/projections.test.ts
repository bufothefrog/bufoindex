/**
 * Projections Module Test Suite
 *
 * Tests lib/calculations/projections.ts: progressive federal tax, the
 * ten-year value of yearly contribution streams (12 end-of-month deposits at
 * the effective monthly rate), the FI-age solve, and the current-vs-optimized
 * path projections built from per-paycheck AllocationItems.
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
  calculateFIAge,
  estimateCurrentNetWorth,
  debtStreamFutureValue,
} from '@/lib/calculations/projections'
import { monthlyRateOf, scheduleFutureValue } from '@/lib/calculations/contributionSchedule'
import { calculateOptimalAllocation, getDefaultProfile } from '@/lib/calculations/core'
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition'
import { engineInputsFor } from '@/lib/calculators/runtime'
import { applyProfileWrites, getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults'
import { ownerRaw } from '@/test/factories/accountsFixtures'
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
//   A yearly stream of S dollars is paid as 12 end-of-month deposits of S/12 at
//   the effective monthly rate i = (1 + r)^(1/12) - 1 (the one monthly-rate
//   convention), so its 10-year value is S x F(r), F(r) = ((1 + r)^10 - 1) / (12 i):
//   F(7%)   = 0.9671513573 / (12 x 0.0056541454) = 14.2543109380  (invested dollars)
//   F(4.5%) = 0.5529694217 / (12 x 0.0036748094) = 12.5396395086  (cash / emergency fund)
//   F(18%)  = 4.2338383552 / (12 x 0.0138884303) = 25.4038520288  (extra debt principal)
//   (One deposit at each year end gave 13.8164479613, 12.2882093718 and
//   23.5213086322 before PR 5.)
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

  // ------------------------------------------------------------------------
  // The stream and FI conventions (E8, E9)
  // ------------------------------------------------------------------------
  describe('yearly streams and the FI solve at the effective monthly rate', () => {
    it('E8: 12,000 a year for 10 years at 7% is 171,051.73 as 12 monthly deposits', () => {
      // i7 = 1.07^(1/12) - 1 = 0.005654145387405274
      // 1000 x (1.07^10 - 1) / i7 = 1000 x 0.9671513573 / i7 = 171,051.7313
      // (one deposit at each year end: 12000 x 0.9671513573 / 0.07 = 165,797.3755; ratio 1.031691)
      expect(monthlyRateOf(0.07)).toBeCloseTo(0.005654145387405274, 15)
      expect(scheduleFutureValue({ monthly: 1000, yearStart: 0 }, 0.07, 120)).toBeCloseTo(171051.7313, 3)
    })

    it('E8 through the projection: a 12,000-a-year current path stream adds 171,051.73', () => {
      // No net worth, no 401(k): discretionary (5,000 - 0 - 0) x 12 = 60,000, 10% saved = 6,000;
      // two profiles differing only by that stream differ by 6,000 x F(7%).
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 6000, monthlyGross: 6000, net: 5000, monthlyNet: 5000, frequency: 'monthly' }),
        preferences: createUserPreferences({
          necessaryExpenses: 0,
          currentEmergencyFund: 0,
          funMoney: { min: 0, max: 0, current: 0 },
        }),
        benefits: {
          employer401k: createEmployerBenefits({ available: false }),
          hsa: createHSABenefits({ eligible: false }),
          ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [],
      })
      // 6,000 x 14.2543109380 = 85,525.87 (half of E8's 171,051.73)
      expect(calculateProjections(profile, []).currentPath.tenYear).toBeCloseTo(171051.7313 / 2, 2)
    })

    it('E9: T - W = 500,000, A = 20,000 a year at 7% reaches FI in 14.6598 years', () => {
      // ln(500000 x 12 x i7 / 20000 + 1) / ln 1.07 = 14.6598
      // (one deposit at each year end: ln 2.75 / ln 1.07 = 14.9515)
      expect(calculateFIAge(20000, 500000, 0, 0)).toBeCloseTo(14.6598, 4)
      expect(calculateFIAge(20000, 600000, 100000, 30)).toBeCloseTo(44.6598, 4)
    })

    it('keeps the FI sentinels: already there, no saving, and the 99 cap', () => {
      expect(calculateFIAge(20000, 500000, 600000, 40)).toBe(40)
      expect(calculateFIAge(0, 500000, 0, 40)).toBe(99)
      expect(calculateFIAge(1, 1e9, 0, 40)).toBe(99)
    })
  })

  // ------------------------------------------------------------------------
  // The site default and the owner fixture through the paycheck binding:
  // net worth counts every invested account (investedBalance), and the
  // streams use the effective monthly rate.
  // ------------------------------------------------------------------------
  describe('site default and owner profiles (PR 5: invested net worth, monthly-rate streams)', () => {
    const withoutInvested = <T extends { preferences: { investedBalance?: number } }>(engine: T): T => {
      const preferences = { ...engine.preferences }
      delete preferences.investedBalance
      return { ...engine, preferences }
    }

    it('default: net worth 34,000 (9,000 fund + 25,000 invested), 9,000 without investedBalance', () => {
      const engine = engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile())
      expect(engine.preferences.investedBalance).toBe(25000)
      expect(estimateCurrentNetWorth(engine)).toBe(34000)
      expect(estimateCurrentNetWorth(withoutInvested(engine))).toBe(9000)
    })

    it('default: the 10-year paths and the FI gap', () => {
      // Before PR 5: current 227,023.55, recommended 559,032.79, improvement 332,009.24,
      // fiYearsEarlier 16.3275. The convention alone gives 233,657.17 / 576,188.26;
      // the invested 25,000 adds 25,000 x 1.07^10 = 49,178.78 to both paths.
      const { projections } = calculateOptimalAllocation(
        engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile())
      )
      expect(projections.currentPath.tenYear).toBeCloseTo(282835.9568587162, 6)
      expect(projections.optimizedPath.tenYear).toBeCloseTo(625367.0486991273, 6)
      expect(projections.improvement.tenYear).toBeCloseTo(342531.09184041107, 6)
      expect(projections.improvement.fiYearsEarlier).toBeCloseTo(16.247422225138287, 6)

      // The convention alone (no investedBalance: the IRA balances, 0 here)
      const alone = calculateOptimalAllocation(
        withoutInvested(engineInputsFor(PAYCHECK_CALCULATOR, getDefaultFinancialProfile()))
      ).projections
      expect(alone.currentPath.tenYear).toBeCloseTo(233657.17, 1)
      expect(alone.optimizedPath.tenYear).toBeCloseTo(576188.26, 1)
      expect(projections.currentPath.tenYear - alone.currentPath.tenYear).toBeCloseTo(25000 * 1.07 ** 10, 6)
    })

    it('owner: net worth 116,150 (10,350 fund + 105,800 invested), 20,400 without investedBalance', () => {
      const engine = engineInputsFor(PAYCHECK_CALCULATOR, normalizeProfile(ownerRaw()))
      expect(engine.preferences.investedBalance).toBeCloseTo(105800, 6)
      expect(estimateCurrentNetWorth(engine)).toBeCloseTo(116150, 6)
      expect(estimateCurrentNetWorth(withoutInvested(engine))).toBeCloseTo(20400, 6)
    })

    it('owner: the 10-year paths and the FI gap', () => {
      // Before PR 5: 378,771.03 / 711,911.84, improvement 333,140.81, fiYearsEarlier 12.2413.
      // The convention alone gives 389,503.05 / 733,201.57; the invested 95,750 beyond the
      // IRA adds 95,750 x 1.07^10 = 188,354.74 to both paths.
      const { projections } = calculateOptimalAllocation(
        engineInputsFor(PAYCHECK_CALCULATOR, normalizeProfile(ownerRaw()))
      )
      expect(projections.currentPath.tenYear).toBeCloseTo(577857.79, 1)
      expect(projections.optimizedPath.tenYear).toBeCloseTo(921556.31, 1)
      expect(projections.improvement.tenYear).toBeCloseTo(343698.52, 1)
      expect(projections.improvement.fiYearsEarlier).toBeCloseTo(12.2449, 3)

      const alone = calculateOptimalAllocation(
        withoutInvested(engineInputsFor(PAYCHECK_CALCULATOR, normalizeProfile(ownerRaw())))
      ).projections
      expect(alone.currentPath.tenYear).toBeCloseTo(389503.05, 1)
      expect(alone.optimizedPath.tenYear).toBeCloseTo(733201.57, 1)
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
      // tenYear = 30,000 x 1.07^10 + (80 x 12) x 14.2543109380
      //         = 59,014.54 + 13,684.14 = 72,698.68
      expect(result.currentPath.tenYear).toBeCloseTo(72698.68, 1)
      // taxesOwed: progressive single tax on $60k gross = 5,020 (not 60,000 × 0.22 = 13,200)
      expect(result.currentPath.taxesOwed).toBeCloseTo(5020, 2)
      // FI: expenses = 48,000 − 960 = 47,040 → target 47,040 / 0.04 = 1,176,000
      //   years = ln((1,176,000 - 30,000) x 12 x i7 / 960 + 1) / ln(1.07)
      //         = ln(81.9956) / ln(1.07) = 65.1309  (i7 = 0.0056541454)
      //   fiAge = 28 (profile age) + 65.1309 = 93.13
      expect(result.currentPath.fiAge).toBeCloseTo(93.13, 1)
      expect(result.currentPath.fiAge).toBeLessThanOrEqual(99)
    })

    it('optimized path annualizes per-paycheck allocations with the bi-weekly multiplier (×26, not ×12)', () => {
      const allocations = [makeAllocation({ amount: 100, taxImpact: 0 })]
      const biWeekly = calculateProjections(buildProfile(), allocations)
      // Bi-weekly: $100/paycheck × 26 = $2,600/yr
      // tenYear = 59,014.54 + 2,600 x 14.2543109380 = 59,014.54 + 37,061.21 = 96,075.75
      expect(biWeekly.optimizedPath.tenYear).toBeCloseTo(96075.75, 1)

      const monthlyProfile = buildProfile()
      monthlyProfile.income.frequency = 'monthly'
      const monthly = calculateProjections(monthlyProfile, allocations)
      // Monthly: $100/paycheck × 12 = $1,200/yr
      // tenYear = 59,014.54 + 1,200 x 14.2543109380 = 59,014.54 + 17,105.17 = 76,119.71
      expect(monthly.optimizedPath.tenYear).toBeCloseTo(76119.71, 1)
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
      //   -> 3,172 x 14.2543109380 = 45,214.67
      // Cash stream    = 50 × 26 = 1,300/yr at the profile's 4.5% APY
      //   -> 1,300 x 12.5396395086 = 16,301.53
      // tenYear = 59,014.54 + 45,214.67 + 16,301.53 = 120,530.75
      expect(result.optimizedPath.tenYear).toBeCloseTo(120530.75, 1)

      // Versus the same allocations without tax savings, the difference is exactly
      // the stream value of the reinvested savings: 572 x 14.2543109380 = 8,153.47
      const noSavings = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 0 }),
        makeAllocation({ id: 'ef', amount: 50, taxImpact: 0, category: 'emergency_fund' }),
      ])
      expect(result.optimizedPath.tenYear - noSavings.optimizedPath.tenYear).toBeCloseTo(8153.47, 1)
    })

    it('counts emergency-fund savings at the cash rate instead of dropping them', () => {
      // Regression: emergency_fund allocations used to contribute nothing to the
      // optimized projection, so a plan that routed the whole paycheck into cash
      // savings projected a *lower* balance than doing nothing.
      const withCash = calculateProjections(buildProfile(), [
        makeAllocation({ amount: 100, taxImpact: 0, category: 'tax_advantaged' }),
        makeAllocation({ id: 'ef', amount: 50, taxImpact: 0, category: 'emergency_fund' }),
      ])
      // 59,014.54 + 2,600 x 14.2543109380 + 1,300 x 12.5396395086
      //   = 59,014.54 + 37,061.21 + 16,301.53 = 112,377.28
      expect(withCash.optimizedPath.tenYear).toBeCloseTo(112377.28, 1)
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
      // current  = 49,178.78 + 960 x 14.2543109380 = 49,178.78 + 13,684.14 = 62,862.92
      // optimized: 2,600 a year = 216.67 a month clears the 5,000 in 5,000 / 216.67 = 23.0769 months.
      //   At 18% until then: 216.67 x (1.18^(23.0769/12) - 1) / 0.0138884 = 216.67 x 0.3747845 / 0.0138884 = 5,846.83,
      //   grown 96.9231 months at 7%: x 1.07^(96.9231/12) = x 1.7271518 = 10,098.37;
      //   then 216.67 a month at 7%: 216.67 x 0.7271518 / 0.00565415 = 27,864.43. Debt stream 37,962.80.
      //   optimized = 49,178.78 + 37,962.80 = 87,141.58
      // (2,600 a year at 18% for all ten years, 66,050.02, counted interest on a balance already paid off.)
      expect(result.currentPath.tenYear).toBeCloseTo(62862.92, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(87141.58, 1)
      // The shared net-worth term cancels: 37,962.80 - 13,684.14 = 24,278.66
      expect(result.improvement.tenYear).toBeCloseTo(24278.66, 1)
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
      //   tenYear = 59,014.54 + 2,760 x 14.2543109380 = 59,014.54 + 39,341.90 = 98,356.44
      //
      // Optimized path — the same deferral, plus a $100/paycheck top-up:
      //   extra deferral = 100 × 26 = 2,600/yr → total deferral 3,800/yr
      //   match earned   = min(3,800, 3,600) × 0.5 = 1,800/yr  (match limit reached)
      //   invested       = 1,200 + 1,800 + 2,600 = 5,600/yr
      //   tenYear = 59,014.54 + 5,600 x 14.2543109380 = 59,014.54 + 79,824.14 = 138,838.68
      const result = calculateProjections(buildMatchProfile(), [
        makeAllocation({
          id: 'employer-match',
          amount: 100,
          taxImpact: 0,
          category: 'employer_match',
        }),
      ])

      expect(result.currentPath.tenYear).toBeCloseTo(98356.44, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(138838.68, 1)
      // (5,600 - 2,760) x 14.2543109380 = 40,482.24
      expect(result.improvement.tenYear).toBeCloseTo(40482.24, 1)
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
      // tenYear = 59,014.54 + 5,400 x 14.2543109380 = 59,014.54 + 76,973.28 = 135,987.82
      expect(result.currentPath.tenYear).toBeCloseTo(135987.82, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(135987.82, 1)
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
      // current   = 59,014.54 + 960 x 14.2543109380 = 72,698.68
      // optimized = 59,014.54 + 260 x 14.2543109380 = 62,720.66
      expect(result.currentPath.tenYear).toBeCloseTo(72698.68, 1)
      expect(result.optimizedPath.tenYear).toBeCloseTo(62720.66, 1)
      // (260 - 960) x 14.2543109380 = -9,978.02
      expect(result.improvement.tenYear).toBeCloseTo(-9978.02, 1)
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
    //   years to FI    = ln((1,110,000 - 30,000) x 12 x i7 / 3,600 + 1) / ln(1.07)
    //                  = ln(21.3549) / ln(1.07) = 45.2460  (i7 = 0.0056541454;
    //                  one deposit at each year end gave ln(22) / ln(1.07) = 45.6858)
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
      // A 25-year-old reaches FI at 25 + 45.2460 = 70.25; the same numbers for a
      // 40-year-old land at 85.25. Both used to report 30 + the years to FI.
      expect(calculateProjections(buildAgeProfile(25), []).currentPath.fiAge)
        .toBeCloseTo(70.246, 2)
      expect(calculateProjections(buildAgeProfile(40), []).currentPath.fiAge)
        .toBeCloseTo(85.246, 2)
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
})

describe('debtStreamFutureValue: extra debt principal earns the debt rate only until the balance is paid', () => {
  it('pays off a 3,000 balance in 3 months at 1,000 a month, then invests at 7%', () => {
    // i_d = 1.24^(1/12) - 1 = 0.0180876; 3 months: 1,000 x (1.24^(1/4) - 1) / i_d = 1,000 x 0.0552501 / 0.0180876 = 3,054.59.
    // That grows 117 months at 7%: x 1.07^(117/12) = x 1.9341575 = 5,908.06.
    // The 1,000 a month after payoff, 117 months at i_m = 1.07^(1/12) - 1 = 0.00565415:
    // 1,000 x (1.9341575 - 1) / 0.00565415 = 165,216.39. Total 171,124.45.
    expect(debtStreamFutureValue(12000, 0.24, 3000)).toBeCloseTo(171124.45, 1)
  })

  it('keeps the whole stream at the debt rate when ten years of payments do not clear the balance', () => {
    // 120 months < 200,000 / 1,000: 1,000 x (1.24^10 - 1) / i_d = 1,000 x 7.5944 / 0.0180876 = 419,869.57.
    expect(debtStreamFutureValue(12000, 0.24, 200000)).toBeCloseTo(419869.57, 1)
    expect(debtStreamFutureValue(12000, 0.24, 200000)).toBe(
      scheduleFutureValue({ monthly: 1000, yearStart: 0 }, 0.24, 120)
    )
  })

  it('is 0 for an empty stream', () => {
    expect(debtStreamFutureValue(0, 0.24, 3000)).toBe(0)
    expect(debtStreamFutureValue(NaN, 0.24, 3000)).toBe(0)
  })

  it('zero cash plus a 24% card (8,000): the payoff no longer compounds at 24% for ten years', () => {
    // 934.62 per bi-weekly paycheck = 24,300 a year, 2,025 a month; 8,000 / 2,025 = 3.95 months
    // at 24%, then 7%. Uncapped it was 24,300 a year at 24% for 120 months = 850,235.88.
    const writes = [
      { path: 'cash.emergencyFundBalance', value: 0 },
      {
        path: 'debts',
        value: [{ id: 'card', name: 'Card', balance: 8000, interestRate: 0.24, minimumPayment: 200, extraPayment: 0, taxDeductible: false }],
      },
    ]
    const { profile, accepted } = applyProfileWrites(getDefaultFinancialProfile(), writes)
    const result = calculateOptimalAllocation(
      engineInputsFor(PAYCHECK_CALCULATOR, { ...profile, provided: [...profile.provided, ...accepted] })
    )
    expect(debtStreamFutureValue(24300, 0.24, 8000)).toBeCloseTo(346666.45, 1)
    expect(result.projections.currentPath.tenYear).toBeCloseTo(249394.38, 1)
    // Optimized 1,090,910.44 before the cap; 1,090,910.44 - 850,235.88 + 346,666.45 = 587,341.00.
    expect(result.projections.optimizedPath.tenYear).toBeCloseTo(587341.0, 1)
    expect(result.projections.improvement.tenYear).toBeCloseTo(337946.62, 1)
  })
})
