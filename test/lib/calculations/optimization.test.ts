/**
 * Optimization Module Test Suite
 *
 * Tests the per-allocation decision functions in lib/calculations/optimization.ts.
 * The optimizer chooses where each marginal dollar of paycheck income should go
 * (employer match, HSA, debt, Roth, taxable, etc.) based on the user's profile
 * and an `availableAmount` budget. Each function returns either an AllocationItem
 * (with reasoning, tax impact, implementation copy) or null when the step does
 * not apply.
 *
 * Notes on units (verified by reading the source):
 *   - `profile.income.gross` and `profile.income.net` are MONTHLY values
 *     (populated by updateLegacyIncomeFields). Annual income is `gross * 12`.
 *   - `availableAmount` and every AllocationItem.amount are PER-PAYCHECK.
 *     Annual IRS caps are converted with monthlyToPaycheck, so a bi-weekly
 *     earner's annual room divides by 26 pay periods (factor 12/26 per month).
 *   - `hsa.currentContribution` and `ira.currentContributions.*` are monthly.
 *
 * The factory default frequency is bi-weekly, so hand-computed expectations
 * below use annualAmount / 26 for per-paycheck values.
 *
 * Most boundary tests target the actual constants imported from
 * lib/constants/irs-2026.ts so they remain correct as IRS limits update.
 */

import { describe, it, expect } from 'vitest'
import {
  ALLOCATION_PRIORITY,
  calculate1MonthEmergency,
  calculateEmergencyFundCompletion,
  calculateEmployerMatch,
  calculateHighInterestDebt,
  hasHighInterestDebt,
  hasLowInterestDebt,
  calculateHSAOptimal,
  determineRothVsTraditional,
  calculateRothIRA,
  calculateAdditional401k,
  calculateMegaBackdoorRoth,
  calculateTaxableInvestment,
} from '@/lib/calculations/optimization'
import { CONTRIBUTION_LIMITS_2026, ROTH_IRA_PHASEOUT_2026, TOTAL_415C_BY_AGE } from '@/lib/constants/irs-2026'
import {
  createPaycheckProfile,
  createDebtData,
  createIncomeData,
  createHSABenefits,
  createEmployerBenefits,
  createIRAData,
  createUserPreferences,
  createTaxData,
} from '@/test/factories/test-data-factory'

// Factory default frequency is bi-weekly: 26 paychecks/year, 26/12 per month
const PAYCHECKS_PER_YEAR = 26

// IRA benefits with no existing contributions (the factory default contributes
// $500/month to a Roth, which consumes IRS room under the netting rules)
const emptyIRA = () =>
  createIRAData({
    hasIRA: false,
    accountTypes: { traditional: false, roth: false },
    currentContributions: { traditional: 0, roth: 0 },
    currentBalances: { traditional: 0, roth: 0 },
  })

describe('optimization.ts — paycheck allocation decisions', () => {
  // ────────────────────────────────────────────────────────────────────────
  // Emergency fund (FOO Step 1 + Step 4)
  // ────────────────────────────────────────────────────────────────────────
  describe('calculate1MonthEmergency', () => {
    it('returns an allocation when current emergency fund is below 1 month of expenses', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          currentEmergencyFund: 500,
        }),
      })

      const result = calculate1MonthEmergency(profile, 1000)

      expect(result).not.toBeNull()
      expect(result!.id).toBe('1-month-emergency')
      expect(result!.category).toBe('emergency_fund')
      expect(result!.priority).toBe(ALLOCATION_PRIORITY.oneMonthEmergency)
      // amountNeeded = 3000 - 500 = 2500, available = 1000 → use 1000
      expect(result!.amount).toBe(1000)
      expect(result!.taxImpact).toBe(0)
    })

    it('caps allocation at the remaining gap when available exceeds the gap', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          currentEmergencyFund: 2500, // gap is $500
        }),
      })

      const result = calculate1MonthEmergency(profile, 5000)

      expect(result!.amount).toBe(500)
      expect(result!.implementation).toContain('complete 1-month emergency fund')
    })

    it('returns null when the user already has 1+ months saved', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          currentEmergencyFund: 3000, // exactly 1 month
        }),
      })
      expect(calculate1MonthEmergency(profile, 1000)).toBeNull()

      const profileOver = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          currentEmergencyFund: 9999,
        }),
      })
      expect(calculate1MonthEmergency(profileOver, 1000)).toBeNull()
    })

    it('returns null when no money is available to allocate', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          currentEmergencyFund: 0,
        }),
      })
      expect(calculate1MonthEmergency(profile, 0)).toBeNull()
      expect(calculate1MonthEmergency(profile, -100)).toBeNull()
    })

    it('returns null when the target is $0 (necessary expenses not entered yet)', () => {
      // A $0 target must not read as "already funded" via `0 >= 0` — with no
      // monthly expenses on file there is nothing to size the fund against.
      const emptyFund = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 0,
          currentEmergencyFund: 0,
        }),
      })
      expect(calculate1MonthEmergency(emptyFund, 1000)).toBeNull()

      const partialFund = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 0,
          currentEmergencyFund: 1500,
        }),
      })
      expect(calculate1MonthEmergency(partialFund, 1000)).toBeNull()

      // Negative expenses are equally meaningless
      const negativeExpenses = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: -500,
          currentEmergencyFund: 0,
        }),
      })
      expect(calculate1MonthEmergency(negativeExpenses, 1000)).toBeNull()
    })
  })

  describe('calculateEmergencyFundCompletion', () => {
    it('returns null when 1-month base has not been built yet (Step 1 should run first)', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          emergencyFundMonths: 3,
          currentEmergencyFund: 1000, // < 1 month
        }),
      })

      expect(calculateEmergencyFundCompletion(profile, 500)).toBeNull()
    })

    it('returns an allocation when at 1 month but below target', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          emergencyFundMonths: 3,
          currentEmergencyFund: 3000, // exactly 1 month
        }),
      })

      const result = calculateEmergencyFundCompletion(profile, 500)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('emergency-fund-completion')
      expect(result!.priority).toBe(ALLOCATION_PRIORITY.emergencyFundCompletion)
      expect(result!.amount).toBe(500)
    })

    it('returns null when already at target months', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          necessaryExpenses: 3000,
          emergencyFundMonths: 3,
          currentEmergencyFund: 9000, // 3 months
        }),
      })
      expect(calculateEmergencyFundCompletion(profile, 1000)).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Employer match — the "free money" cliff
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateEmployerMatch', () => {
    it('recommends contributing up to the match cap when not already there', () => {
      // gross monthly = 8000, annual = 96k, match limit = 6% → 5760/yr.
      // Currently contributing 0% → need 5760/yr ≈ 480/mo ≈ 221.54/paycheck
      // (bi-weekly, 26/12 multiplier).
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 8000,
          monthlyGross: 8000,
          monthlyNet: 6000,
          net: 6000,
          netPaycheck: 2769.23,
        }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0.5,
            matchLimit: 0.06,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })

      const result = calculateEmployerMatch(profile, 1000)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('employer-match')
      expect(result!.priority).toBe(ALLOCATION_PRIORITY.employerMatch)
      // Annual additional needed = 5760, monthly = 480, paycheck (bi-weekly) ≈ 221.54
      expect(result!.amount).toBeCloseTo(221.54, 1)
    })

    it('returns null when not enrolled / employer match unavailable', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits({ available: false }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateEmployerMatch(profile, 1000)).toBeNull()
    })

    it('returns null when already contributing at or above the match limit', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 8000,
          monthlyGross: 8000,
          monthlyNet: 6000,
          net: 6000,
        }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchLimit: 0.06,
            currentContribution: 0.06, // already maxing the match
          }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateEmployerMatch(profile, 1000)).toBeNull()
    })

    it('caps at the available amount when budget is below the additional contribution needed', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 10000,
          monthlyGross: 10000,
          monthlyNet: 7500,
          net: 7500,
        }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchLimit: 0.06,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      // Additional needed >> $50 budget → allocation is capped at $50
      const result = calculateEmployerMatch(profile, 50)
      expect(result!.amount).toBe(50)
      expect(result!.implementation).toContain('still needed for full match')
    })

    it('records a negative tax impact (i.e. tax savings) using federal+state rate', () => {
      // Texas has 0% state, federal 22% → income tax rate = 22%
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 8000,
          monthlyGross: 8000,
          monthlyNet: 6000,
          net: 6000,
        }),
        taxes: createTaxData({ federalBracket: 0.22, state: 'TX' }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchLimit: 0.06,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateEmployerMatch(profile, 1000)
      expect(result).not.toBeNull()
      // taxImpact should be -amount * 0.22 (negative = savings)
      expect(result!.taxImpact).toBeCloseTo(-result!.amount * 0.22, 4)
      expect(result!.taxImpact).toBeLessThan(0)
    })

    it('returns null when the match rate is 0% — there is no match to capture', () => {
      // $13,000/month gross, matchLimit 6%, matchPercent 0. The old behaviour
      // allocated $180/paycheck (weekly) to "401k Employer Match" at the top
      // of the order while the employer contributed $0 against it.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 13000,
          monthlyGross: 13000,
          monthlyNet: 9750,
          net: 9750,
          netPaycheck: 2250,
          frequency: 'weekly',
        }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0,
            matchLimit: 0.06,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: emptyIRA(),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateEmployerMatch(profile, 1000)).toBeNull()
    })

    it('returns null when the matched-salary limit is 0%', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000, monthlyGross: 8000, monthlyNet: 6000, net: 6000 }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0.5,
            matchLimit: 0,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: emptyIRA(),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateEmployerMatch(profile, 1000)).toBeNull()
    })

    it('claims no current-year tax saving for a Roth deferral, and pro-rates a split election', () => {
      const buildProfile = (employer401k: Partial<ReturnType<typeof createEmployerBenefits>>) =>
        createPaycheckProfile({
          income: createIncomeData({ gross: 8000, monthlyGross: 8000, monthlyNet: 6000, net: 6000 }),
          taxes: createTaxData({ federalBracket: 0.22, state: 'TX' }),
          benefits: {
            employer401k: createEmployerBenefits({
              available: true,
              matchPercent: 0.5,
              matchLimit: 0.06,
              currentContribution: 0,
              ...employer401k,
            }),
            hsa: createHSABenefits(),
            ira: emptyIRA(),
            other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
          },
        })

      const roth = calculateEmployerMatch(
        buildProfile({ contributionType: 'roth', traditionalContribution: 0, rothContribution: 0.06 }),
        1000
      )!
      // Roth deferrals are after-tax: no deduction this year, and no -0 either
      expect(roth.taxImpact).toBe(0)
      expect(Object.is(roth.taxImpact, -0)).toBe(false)

      // 3% traditional + 1% Roth = 75% of the deferral is pre-tax
      const split = calculateEmployerMatch(
        buildProfile({ contributionType: 'split', traditionalContribution: 0.03, rothContribution: 0.01 }),
        1000
      )!
      expect(split.taxImpact).toBeCloseTo(-split.amount * 0.75 * 0.22, 4)

      const traditional = calculateEmployerMatch(buildProfile({ contributionType: 'traditional' }), 1000)!
      expect(traditional.taxImpact).toBeCloseTo(-traditional.amount * 0.22, 4)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // High-interest debt (7% threshold)
  // ────────────────────────────────────────────────────────────────────────
  describe('hasHighInterestDebt / hasLowInterestDebt', () => {
    it('classifies debt above 7% as high-interest', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ interestRate: 0.071, balance: 1000 })],
      })
      expect(hasHighInterestDebt(profile)).toBe(true)
    })

    it('classifies debt at exactly 7% as low-interest (strict > check)', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ interestRate: 0.07, balance: 1000 })],
      })
      expect(hasHighInterestDebt(profile)).toBe(false)
      expect(hasLowInterestDebt(profile)).toBe(true)
    })

    it('classifies sub-7% debt with balance>0 as low-interest', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ interestRate: 0.04, balance: 15000 })],
      })
      expect(hasHighInterestDebt(profile)).toBe(false)
      expect(hasLowInterestDebt(profile)).toBe(true)
    })

    it('returns false on empty debt list', () => {
      const profile = createPaycheckProfile({ debts: [] })
      expect(hasHighInterestDebt(profile)).toBe(false)
      expect(hasLowInterestDebt(profile)).toBe(false)
    })
  })

  describe('calculateHighInterestDebt', () => {
    it('selects the highest-rate debt when multiple high-interest debts exist', () => {
      const profile = createPaycheckProfile({
        debts: [
          createDebtData({ name: 'CC-A', balance: 5000, interestRate: 0.18, minimumPayment: 100 }),
          createDebtData({ name: 'CC-B', balance: 3000, interestRate: 0.24, minimumPayment: 80 }),
          createDebtData({ name: 'CC-C', balance: 2000, interestRate: 0.20, minimumPayment: 60 }),
        ],
      })
      const result = calculateHighInterestDebt(profile, 1000)
      expect(result).not.toBeNull()
      expect(result!.account).toContain('CC-B') // 24% wins
      expect(result!.category).toBe('debt_payoff')
      expect(result!.priority).toBe(ALLOCATION_PRIORITY.highInterestDebt)
    })

    it('returns null when no debt exceeds 7%', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ interestRate: 0.04, balance: 15000, minimumPayment: 200 })],
      })
      expect(calculateHighInterestDebt(profile, 1000)).toBeNull()
    })

    it('returns null when the profile has no debts at all', () => {
      const profile = createPaycheckProfile({ debts: [] })
      expect(calculateHighInterestDebt(profile, 1000)).toBeNull()
    })

    it('returns null when available budget does not exceed the per-paycheck minimum payment', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 200 })],
      })
      // Monthly minimum $200 → per paycheck (bi-weekly) 200 * 12/26 ≈ $92.31.
      // available 92 ≤ 92.31 → null (no extra payment to recommend)
      expect(calculateHighInterestDebt(profile, 92)).toBeNull()
      expect(calculateHighInterestDebt(profile, 50)).toBeNull()
    })

    it('records extraPayment as `amount` (above the per-paycheck minimum payment)', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 100 })],
      })
      const result = calculateHighInterestDebt(profile, 500)
      // Monthly minimum $100 → per paycheck 100 * 12/26 ≈ 46.15 → extra = 500 - 46.15 = 453.85
      expect(result!.amount).toBeCloseTo(453.85, 2)
      expect(result!.taxImpact).toBe(0)
    })

    it('caps recommended payment at the debt balance', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ balance: 200, interestRate: 0.18, minimumPayment: 25 })],
      })
      // available 1000 > balance 200 → recommendedPayment = 200,
      // extra = 200 - (25 * 12/26 = 11.54) = 188.46
      const result = calculateHighInterestDebt(profile, 1000)
      expect(result!.amount).toBeCloseTo(188.46, 2)
    })

    it('never claims annual interest savings above balance x rate', () => {
      // $6,000/month net, one $3,000 balance at 29% (minimum $90/month), with
      // $2,800 of the paycheck allocatable. The recommended extra payment is
      // $2,710/month = $32,520/year; the payment-stream formula would claim
      // $32,520 x 0.29 x 0.5 = $4,715/year of interest "saved" on a $3,000
      // debt whose full-year interest is only $3,000 x 0.29 = $870.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 8000,
          monthlyGross: 8000,
          monthlyNet: 6000,
          net: 6000,
          netPaycheck: 6000,
          frequency: 'monthly',
        }),
        debts: [
          createDebtData({ name: 'High Card', balance: 3000, interestRate: 0.29, minimumPayment: 90 }),
        ],
      })

      const result = calculateHighInterestDebt(profile, 2800)!
      expect(result.amount).toBeCloseTo(2710, 2) // 2800 - 90 minimum

      const fullYearInterest = 3000 * 0.29 // $870
      expect(result.implementation).toContain('saves $870/year')
      expect(result.implementation).not.toContain('$4,715')
      // The reasoning quotes the same capped figure the implementation does
      expect(result.reasoning).toContain('$870')

      // Sanity: the claim is below both a year of interest and the balance
      expect(fullYearInterest).toBeCloseTo(870, 2)
      expect(fullYearInterest).toBeLessThan(3000)
    })

    it('keeps the 0.5 average-balance correction when it lands under the cap', () => {
      // $20,000 balance at 18%: full-year interest is $3,600, while the
      // payment stream is 500/month x 12 x 0.18 x 0.5 = $540 — under the cap,
      // so the average-balance figure is reported unchanged.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 8000,
          monthlyGross: 8000,
          monthlyNet: 6000,
          net: 6000,
          netPaycheck: 6000,
          frequency: 'monthly',
        }),
        debts: [
          createDebtData({ name: 'Card', balance: 20000, interestRate: 0.18, minimumPayment: 100 }),
        ],
      })

      const result = calculateHighInterestDebt(profile, 600)!
      expect(result.amount).toBeCloseTo(500, 2) // 600 - 100 minimum
      // 500 * 12 * 0.18 * 0.5 = 540, well below 20,000 * 0.18 = 3,600
      expect(result.implementation).toContain('saves $540/year')
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // HSA — triple tax advantage, FICA-exempt
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateHSAOptimal', () => {
    it('returns null when not HSA-eligible (HDHP not enrolled)', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({ eligible: false }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateHSAOptimal(profile, 500)).toBeNull()
    })

    it('uses the individual limit when coverageType is individual (per-paycheck amount)', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: 0,
            employerContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 99999)
      expect(result).not.toBeNull()
      // per-paycheck cap = $4,400 / 26 paychecks ≈ $169.23
      expect(result!.amount).toBeCloseTo(169.23, 2)
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.hsa.individual / PAYCHECKS_PER_YEAR, 2)
    })

    it('uses the family limit when coverageType is family', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'family',
            currentContribution: 0,
            employerContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 99999)
      // per-paycheck cap = $8,750 / 26 ≈ $336.54
      expect(result!.amount).toBeCloseTo(336.54, 2)
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.hsa.family / PAYCHECKS_PER_YEAR, 2)
    })

    it('annualizes with the actual paycheck frequency: annualEquivalent = amount * 26 for bi-weekly', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: 0,
            employerContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 99999)!
      // Regression (unit-mixing fix): a bi-weekly earner has 26 paychecks/year,
      // so the annual equivalent is amount * 26, NOT amount * 12
      expect(result.annualEquivalent).toBeCloseTo(result.amount * 26, 6)
      // and a full-room recommendation annualizes back to the $4,400 IRS cap
      expect(result.annualEquivalent).toBeCloseTo(4400, 2)
    })

    it('subtracts the annual employer seed from IRS room (combined cap, IRC 223)', () => {
      const buildProfile = (employerContribution: number) =>
        createPaycheckProfile({
          benefits: {
            employer401k: createEmployerBenefits(),
            hsa: createHSABenefits({
              eligible: true,
              coverageType: 'individual',
              currentContribution: 0,
              employerContribution,
            }),
            ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
            other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
          },
        })
      const withSeed = calculateHSAOptimal(buildProfile(1000), 99999)!
      const withoutSeed = calculateHSAOptimal(buildProfile(0), 99999)!
      // $1,000 employer seed reduces annual room by exactly $1,000: 4,400 → 3,400
      expect(withSeed.annualEquivalent).toBeCloseTo(3400, 2)
      expect(withoutSeed.annualEquivalent! - withSeed.annualEquivalent!).toBeCloseTo(1000, 2)
      // per paycheck: 3,400 / 26 ≈ 130.77
      expect(withSeed.amount).toBeCloseTo(130.77, 2)
    })

    it('returns null when personal + employer contributions already fill the annual limit', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: (CONTRIBUTION_LIMITS_2026.hsa.individual - 1200) / 12, // monthly
            employerContribution: 1200, // annual employer seed tops it off
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateHSAOptimal(profile, 1000)).toBeNull()
    })

    it('uses calculateHSATaxRate (federal+state+FICA) for tax savings — i.e. includes FICA', () => {
      // Federal 22% + TX state 0% + FICA 7.65% = 29.65% → contribution 100 → savings ≈ 29.65
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000, monthlyGross: 8000, monthlyNet: 6000, net: 6000 }),
        taxes: createTaxData({ federalBracket: 0.22, state: 'TX' }),
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: 0,
            employerContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 100)
      expect(result).not.toBeNull()
      // amount = min(4400/26 ≈ 169.23, 100) = 100 → 100 * (0.22 + 0.0765) = 29.65
      expect(result!.amount).toBe(100)
      expect(result!.taxImpact).toBeCloseTo(-29.65, 2)
    })

    it('carries the HSA position in the Financial Order of Operations, whatever the current contribution', () => {
      const buildProfile = (currentContribution: number) =>
        createPaycheckProfile({
          benefits: {
            employer401k: createEmployerBenefits(),
            hsa: createHSABenefits({
              eligible: true,
              coverageType: 'individual',
              currentContribution,
            }),
            ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
            other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
          },
        })
      // Previously 2 vs 3, which sorted HSA ahead of high-interest debt and
      // straddled the emergency-fund step boundary in stepStatusUtils.
      expect(calculateHSAOptimal(buildProfile(0), 200)!.priority).toBe(ALLOCATION_PRIORITY.hsa)
      expect(calculateHSAOptimal(buildProfile(50), 200)!.priority).toBe(ALLOCATION_PRIORITY.hsa)
    })

    it('adds the $1,000 age-55 catch-up (IRC 223(b)(3)) at 55 but not at 54', () => {
      const buildProfile = (age: number, coverageType: 'individual' | 'family') =>
        createPaycheckProfile({
          preferences: createUserPreferences({ age }),
          benefits: {
            employer401k: createEmployerBenefits(),
            hsa: createHSABenefits({
              eligible: true,
              coverageType,
              currentContribution: 0,
              employerContribution: 0,
            }),
            ira: emptyIRA(),
            other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
          },
        })

      const catchUp = CONTRIBUTION_LIMITS_2026.catchUp.hsa // $1,000
      const family = CONTRIBUTION_LIMITS_2026.hsa.family // $8,750
      const individual = CONTRIBUTION_LIMITS_2026.hsa.individual // $4,400

      // Age 64, family coverage: $8,750 + $1,000 = $9,750/yr → 9,750/26 = $375
      const age64Family = calculateHSAOptimal(buildProfile(64, 'family'), 99999)!
      expect(age64Family.annualEquivalent).toBeCloseTo(family + catchUp, 2)
      expect(age64Family.annualEquivalent).toBeCloseTo(9750, 2)
      expect(age64Family.amount).toBeCloseTo(375, 2)
      expect(age64Family.implementation).toContain('$9,750 limit')

      // Age 55 individual: $4,400 + $1,000 = $5,400/yr
      const age55Individual = calculateHSAOptimal(buildProfile(55, 'individual'), 99999)!
      expect(age55Individual.annualEquivalent).toBeCloseTo(individual + catchUp, 2)
      expect(age55Individual.annualEquivalent).toBeCloseTo(5400, 2)

      // Age 54 gets the plain coverage-tier limits
      expect(calculateHSAOptimal(buildProfile(54, 'family'), 99999)!.annualEquivalent).toBeCloseTo(family, 2)
      expect(calculateHSAOptimal(buildProfile(54, 'individual'), 99999)!.annualEquivalent).toBeCloseTo(individual, 2)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Roth vs Traditional decision
  // ────────────────────────────────────────────────────────────────────────
  describe('determineRothVsTraditional', () => {
    it('returns roth for young + not peak earnings', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          age: 25,
          isPeakEarnings: false,
        }),
        taxes: createTaxData({ federalBracket: 0.22 }),
      })
      expect(determineRothVsTraditional(profile)).toBe('roth')
    })

    it('returns traditional for peak earnings + higher current bracket than expected retirement', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          age: 45,
          isPeakEarnings: true,
          expectedRetirementBracket: 0.12,
        }),
        taxes: createTaxData({ federalBracket: 0.32 }),
      })
      expect(determineRothVsTraditional(profile)).toBe('traditional')
    })

    it('returns mixed for age 50+ (tax diversification)', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          age: 55,
          isPeakEarnings: false,
        }),
        taxes: createTaxData({ federalBracket: 0.22 }),
      })
      expect(determineRothVsTraditional(profile)).toBe('mixed')
    })

    it('returns roth at low brackets (≤12%) when no other rule fires', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          age: 35,
          isPeakEarnings: false,
        }),
        taxes: createTaxData({ federalBracket: 0.12 }),
      })
      expect(determineRothVsTraditional(profile)).toBe('roth')
    })

    it('returns traditional at high brackets (≥24%) when current > expected retirement', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          age: 35,
          isPeakEarnings: false,
          expectedRetirementBracket: 0.12,
        }),
        taxes: createTaxData({ federalBracket: 0.24 }),
      })
      expect(determineRothVsTraditional(profile)).toBe('traditional')
    })

    it('returns mixed for middle brackets without strong signal', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({
          age: 35,
          isPeakEarnings: false,
          expectedRetirementBracket: 0.22,
        }),
        taxes: createTaxData({ federalBracket: 0.22 }),
      })
      expect(determineRothVsTraditional(profile)).toBe('mixed')
    })

    it('is deterministic — same input produces same output', () => {
      const profile = createPaycheckProfile({
        preferences: createUserPreferences({ age: 28, isPeakEarnings: false }),
        taxes: createTaxData({ federalBracket: 0.22 }),
      })
      const a = determineRothVsTraditional(profile)
      const b = determineRothVsTraditional(profile)
      const c = determineRothVsTraditional(profile)
      expect(a).toBe(b)
      expect(b).toBe(c)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Roth IRA — phaseout & smart-recommendation logic
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateRothIRA', () => {
    const roth = ROTH_IRA_PHASEOUT_2026

    const emptyIRABenefits = () => ({
      employer401k: createEmployerBenefits(),
      hsa: createHSABenefits(),
      ira: emptyIRA(),
      other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
    })

    it('returns null when income is above the single phaseout end (ineligible)', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: (roth.single.end + 5000) / 12,
          monthlyGross: (roth.single.end + 5000) / 12,
          monthlyNet: 8000,
          net: 8000,
        }),
        taxes: createTaxData({ federalBracket: 0.24, filingStatus: 'single' }),
      })
      expect(calculateRothIRA(profile, 999)).toBeNull()
    })

    it('returns null when filing status is traditional-preferred (peak earnings, high bracket)', () => {
      // Force determineRothVsTraditional → 'traditional'
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 100000 / 12,
          monthlyGross: 100000 / 12,
          monthlyNet: 6500,
          net: 6500,
        }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'single' }),
        preferences: createUserPreferences({
          age: 45,
          isPeakEarnings: true,
          expectedRetirementBracket: 0.12,
        }),
      })
      expect(calculateRothIRA(profile, 999)).toBeNull()
    })

    it('returns a Roth allocation when below phaseout and recommendation is roth', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 60000 / 12,
          monthlyGross: 60000 / 12,
          monthlyNet: 3800,
          net: 3800,
        }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
        benefits: emptyIRABenefits(),
      })
      const result = calculateRothIRA(profile, 999)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('roth-ira')
      // per-paycheck contribution = min(7500/26 ≈ 288.46, 999) = 288.46
      expect(result!.amount).toBeCloseTo(288.46, 2)
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.ira / PAYCHECKS_PER_YEAR, 2)
      expect(result!.taxImpact).toBe(0) // Roth = after-tax
      // Bi-weekly regression: annual equivalent = amount * 26, recovering the $7,500 cap
      expect(result!.annualEquivalent).toBeCloseTo(result!.amount * 26, 6)
      expect(result!.annualEquivalent).toBeCloseTo(7500, 2)
    })

    it('nets out existing IRA contributions: user already at the $7,500 limit gets $0 recommended', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 60000 / 12,
          monthlyGross: 60000 / 12,
          monthlyNet: 3800,
          net: 3800,
        }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits(),
          // $400/mo Roth + $225/mo Traditional = $625/mo = $7,500/yr — the combined IRS limit
          ira: createIRAData({ currentContributions: { traditional: 225, roth: 400 } }),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateRothIRA(profile, 999)).toBeNull()
    })

    it('reduces recommended room by annualized existing contributions', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 60000 / 12,
          monthlyGross: 60000 / 12,
          monthlyNet: 3800,
          net: 3800,
        }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits(),
          ira: createIRAData({ currentContributions: { traditional: 0, roth: 250 } }), // $3,000/yr
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateRothIRA(profile, 999)!
      // Remaining room = 7,500 - 3,000 = 4,500/yr → 4,500/26 ≈ 173.08 per paycheck
      expect(result.amount).toBeCloseTo(173.08, 2)
      expect(result.annualEquivalent).toBeCloseTo(4500, 2)
    })

    it('applies the $1,100 IRA catch-up at age 50 but not at 49', () => {
      const buildProfile = (age: number) =>
        createPaycheckProfile({
          income: createIncomeData({
            gross: 60000 / 12,
            monthlyGross: 60000 / 12,
            monthlyNet: 3800,
            net: 3800,
          }),
          taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
          preferences: createUserPreferences({ age, isPeakEarnings: false }),
          benefits: emptyIRABenefits(),
        })
      // Age 49: 7,500/26 ≈ 288.46. Age 50: (7,500 + 1,100)/26 = 8,600/26 ≈ 330.77
      expect(calculateRothIRA(buildProfile(49), 9999)!.amount).toBeCloseTo(288.46, 2)
      expect(calculateRothIRA(buildProfile(50), 9999)!.amount).toBeCloseTo(330.77, 2)
      expect(calculateRothIRA(buildProfile(50), 9999)!.annualEquivalent).toBeCloseTo(8600, 2)
    })

    it('phases out the maximum contribution proportionally inside the phaseout band', () => {
      // Single phaseout: 153_000 → 168_000. Halfway = 160_500 → 50% reduction → max ~$3,750/yr.
      const phaseoutMid = (roth.single.start + roth.single.end) / 2
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: phaseoutMid / 12,
          monthlyGross: phaseoutMid / 12,
          monthlyNet: 9000,
          net: 9000,
        }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 28, isPeakEarnings: false }),
        benefits: emptyIRABenefits(),
      })
      const result = calculateRothIRA(profile, 9999)
      expect(result).not.toBeNull()
      // Math.floor(7500 * 0.5) = 3750/yr → per paycheck 3750/26 ≈ 144.23
      expect(result!.amount).toBeCloseTo(144.23, 2)
    })

    it('respects the marriedJoint phaseout band', () => {
      // MFJ: 242_000 → 252_000. Below 242k → full $7,500.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 200000 / 12,
          monthlyGross: 200000 / 12,
          monthlyNet: 13000,
          net: 13000,
        }),
        taxes: createTaxData({ federalBracket: 0.24, filingStatus: 'marriedJoint' }),
        preferences: createUserPreferences({ age: 28, isPeakEarnings: false }),
        benefits: emptyIRABenefits(),
      })
      const result = calculateRothIRA(profile, 9999)
      expect(result).not.toBeNull()
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.ira / PAYCHECKS_PER_YEAR, 2)

      // Above MFJ phaseout end → null
      const profileAbove = createPaycheckProfile({
        income: createIncomeData({
          gross: (roth.marriedFilingJointly.end + 1000) / 12,
          monthlyGross: (roth.marriedFilingJointly.end + 1000) / 12,
          monthlyNet: 16000,
          net: 16000,
        }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'marriedJoint' }),
      })
      expect(calculateRothIRA(profileAbove, 9999)).toBeNull()
    })

    it('uses the $0-$10,000 married-filing-separately band, not the single band', () => {
      // MFS filers who lived with their spouse phase out from $0 to $10,000
      // (IRC 408A(c)(3)(B)(ii)(III)); mapping them to the single band told a
      // $60k earner to fund a Roth IRA they are not eligible for.
      expect(roth.marriedFilingSeparately).toEqual({ start: 0, end: 10000 })

      const buildProfile = (annualGross: number, filingStatus: 'marriedSeparate' | 'single') =>
        createPaycheckProfile({
          income: createIncomeData({
            gross: annualGross / 12,
            monthlyGross: annualGross / 12,
            monthlyNet: (annualGross * 0.75) / 12,
            net: (annualGross * 0.75) / 12,
          }),
          taxes: createTaxData({ federalBracket: 0.12, filingStatus }),
          preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
          benefits: emptyIRABenefits(),
        })

      // $60,000 MFS is far above the $10,000 phase-out end → ineligible
      expect(calculateRothIRA(buildProfile(60000, 'marriedSeparate'), 9999)).toBeNull()
      // The same income filing single is fully eligible
      expect(calculateRothIRA(buildProfile(60000, 'single'), 9999)!.amount).toBeCloseTo(
        CONTRIBUTION_LIMITS_2026.ira / PAYCHECKS_PER_YEAR,
        2
      )

      // Inside the MFS band: $5,000 income is halfway → floor(7,500 * 0.5) = $3,750/yr
      const insideBand = calculateRothIRA(buildProfile(5000, 'marriedSeparate'), 9999)!
      expect(insideBand.annualEquivalent).toBeCloseTo(3750, 2)
    })

    it('keeps head-of-household on the single band', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 100000 / 12,
          monthlyGross: 100000 / 12,
          monthlyNet: 6000,
          net: 6000,
        }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'headOfHousehold' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
        benefits: emptyIRABenefits(),
      })
      // $100k is below the $153,000 single phase-out start → full contribution
      const result = calculateRothIRA(profile, 9999)!
      expect(result.annualEquivalent).toBeCloseTo(CONTRIBUTION_LIMITS_2026.ira, 2)
    })

    it('returns null when the per-paycheck contribution would be ≤ $50 (skip tiny contributions)', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 60000 / 12,
          monthlyGross: 60000 / 12,
          monthlyNet: 3800,
          net: 3800,
        }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
        benefits: emptyIRABenefits(),
      })
      expect(calculateRothIRA(profile, 30)).toBeNull()
      expect(calculateRothIRA(profile, 50)).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Additional 401k beyond match — Roth/Traditional/Mixed branching
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateAdditional401k', () => {
    const baseHighBracketProfile = () =>
      createPaycheckProfile({
        income: createIncomeData({
          gross: 100000 / 12,
          monthlyGross: 100000 / 12,
          monthlyNet: 6500,
          net: 6500,
        }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'single', state: 'TX' }),
        preferences: createUserPreferences({
          age: 45,
          isPeakEarnings: true,
          expectedRetirementBracket: 0.12,
        }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            currentContribution: 0.06, // contributing to match
          }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })

    it('returns null when 401k is unavailable', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits({ available: false }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateAdditional401k(profile, 1000)).toBeNull()
    })

    it('recommends Traditional with negative tax impact (savings) for traditional-preferred profiles', () => {
      const profile = baseHighBracketProfile()
      const result = calculateAdditional401k(profile, 1000)
      expect(result).not.toBeNull()
      expect(result!.account).toBe('Traditional 401k')
      // Room = 24,500 - (100k × 6% = 6,000) = 18,500/yr → 18,500/26 ≈ 711.54 per paycheck,
      // which is below the $1,000 budget → amount = 711.54
      expect(result!.amount).toBeCloseTo(711.54, 2)
      // Federal 32 + TX 0 = 32% income-tax savings on the per-paycheck amount
      expect(result!.taxImpact).toBeCloseTo(-711.54 * 0.32, 1)
    })

    it('applies 401k catch-up tiers by age: none at 49, +$8,000 at 50, +$11,250 at 60-63, back to +$8,000 at 64', () => {
      const buildProfile = (age: number) =>
        createPaycheckProfile({
          income: createIncomeData({ gross: 200000 / 12, monthlyGross: 200000 / 12, monthlyNet: 12000, net: 12000 }),
          taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'single', state: 'TX' }),
          preferences: createUserPreferences({ age, isPeakEarnings: false }),
          benefits: {
            // 200k × 10% = $20,000/yr already contributed
            employer401k: createEmployerBenefits({ available: true, currentContribution: 0.10 }),
            hsa: createHSABenefits(),
            ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
            other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
          },
        })
      // Age 49: room = 24,500 - 20,000 = 4,500/yr → 4,500/26 ≈ 173.08
      expect(calculateAdditional401k(buildProfile(49), 9999)!.amount).toBeCloseTo(173.08, 2)
      // Age 50: limit 24,500 + 8,000 = 32,500 → room 12,500/yr → 480.77
      expect(calculateAdditional401k(buildProfile(50), 9999)!.amount).toBeCloseTo(480.77, 2)
      // Age 60: super catch-up → limit 24,500 + 11,250 = 35,750 → room 15,750/yr → 605.77
      expect(calculateAdditional401k(buildProfile(60), 9999)!.amount).toBeCloseTo(605.77, 2)
      // Age 64: super catch-up window closed → regular catch-up again → 480.77
      expect(calculateAdditional401k(buildProfile(64), 9999)!.amount).toBeCloseTo(480.77, 2)
    })

    it('recommends Roth 401k with zero tax impact for roth-preferred profiles', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 60000 / 12, monthlyGross: 60000 / 12, monthlyNet: 3800, net: 3800 }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits({ available: true, currentContribution: 0.06 }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateAdditional401k(profile, 500)
      expect(result).not.toBeNull()
      expect(result!.account).toBe('Roth 401k')
      expect(result!.taxImpact).toBe(0)
    })

    it('recommends mixed with half-rate tax savings for mixed-preferred profiles (age 50+)', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 90000 / 12, monthlyGross: 90000 / 12, monthlyNet: 5500, net: 5500 }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'single', state: 'TX' }),
        preferences: createUserPreferences({ age: 55, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits({ available: true, currentContribution: 0.06 }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateAdditional401k(profile, 500)
      expect(result).not.toBeNull()
      expect(result!.account).toBe('401k (Roth + Traditional)')
      // Half of 22% applied to $500 = -$55
      expect(result!.taxImpact).toBeCloseTo(-500 * 0.5 * 0.22, 2)
    })

    it('returns null when already at or above the IRS contribution limit', () => {
      // Annual salary 200k, contributing 13% = $26k → exceeds $24,500 limit
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 200000 / 12, monthlyGross: 200000 / 12, monthlyNet: 12000, net: 12000 }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'single' }),
        benefits: {
          employer401k: createEmployerBenefits({ available: true, currentContribution: 0.13 }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateAdditional401k(profile, 1000)).toBeNull()
    })

    it('nets out the employee deferral the match step already recommended (IRC 402(g))', () => {
      // Weekly pay, $13,000/month gross = $156,000/yr, age 60 (super catch-up
      // → $24,500 + $11,250 = $35,750 elective-deferral limit), contributing
      // 0% today with a 50% match up to 6% of salary.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 13000,
          monthlyGross: 13000,
          monthlyNet: 9750,
          net: 9750,
          netPaycheck: 2250,
          frequency: 'weekly',
        }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'single', state: 'TX' }),
        preferences: createUserPreferences({ age: 60, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0.5,
            matchLimit: 0.06,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: emptyIRA(),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })

      const limit =
        CONTRIBUTION_LIMITS_2026.traditional401k + CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k
      expect(limit).toBe(35750)

      // Match step: 156,000 * 6% = $9,360/yr → 9,360 / 52 = $180/paycheck
      const match = calculateEmployerMatch(profile, 9999)!
      expect(match.amount).toBeCloseTo(180, 2)
      expect(match.annualEquivalent).toBeCloseTo(9360, 2)

      // Blind to the match, the top-up used to claim the entire $35,750 limit
      // ($687.50/paycheck), for $45,110/yr of deferral in one plan.
      const blind = calculateAdditional401k(profile, 9999)!
      expect(blind.annualEquivalent).toBeCloseTo(35750, 2)

      // Aware of it, the top-up claims only the remaining $26,390/yr
      const aware = calculateAdditional401k(profile, 9999, [match])!
      expect(aware.annualEquivalent).toBeCloseTo(limit - 9360, 2)
      expect(aware.annualEquivalent).toBeCloseTo(26390, 2)
      expect(aware.amount).toBeCloseTo(26390 / 52, 2) // ≈ $507.50/paycheck

      // The pair now lands exactly on the 402(g) limit
      expect(match.annualEquivalent! + aware.annualEquivalent!).toBeCloseTo(limit, 2)
    })

    it('returns null when the match step has already claimed the whole 402(g) limit', () => {
      // $500,000/yr salary with a 6% match limit means the match step alone
      // recommends $30,000 of deferral, above the $24,500 age-45 limit.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 500000 / 12,
          monthlyGross: 500000 / 12,
          monthlyNet: 25000,
          net: 25000,
        }),
        taxes: createTaxData({ federalBracket: 0.35, filingStatus: 'single', state: 'TX' }),
        preferences: createUserPreferences({ age: 45, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            matchPercent: 0.5,
            matchLimit: 0.06,
            currentContribution: 0,
          }),
          hsa: createHSABenefits(),
          ira: emptyIRA(),
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })

      const match = calculateEmployerMatch(profile, 99999)!
      expect(match.annualEquivalent).toBeCloseTo(30000, 2)
      expect(calculateAdditional401k(profile, 99999, [match])).toBeNull()
    })

    it('returns null when remaining room is below the $50 monthly threshold', () => {
      // 200k × 12.2% = $24,400 contributed → only $100/yr room ≈ $8.33/mo (< $50)
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 200000 / 12, monthlyGross: 200000 / 12, monthlyNet: 12000, net: 12000 }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: 'single' }),
        benefits: {
          employer401k: createEmployerBenefits({ available: true, currentContribution: 0.122 }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateAdditional401k(profile, 1000)).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Mega Backdoor Roth — high earners only
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateMegaBackdoorRoth', () => {
    const buildProfile = (overrides: Partial<{
      gross: number
      filingStatus: 'single' | 'marriedJoint'
      afterTaxAvailable: boolean
      currentContribution: number
      age: number
    }> = {}) => {
      const gross = overrides.gross ?? 200000
      const monthlyGross = gross / 12
      return createPaycheckProfile({
        income: createIncomeData({
          gross: monthlyGross,
          monthlyGross,
          monthlyNet: monthlyGross * 0.7,
          net: monthlyGross * 0.7,
        }),
        taxes: createTaxData({ federalBracket: 0.32, filingStatus: overrides.filingStatus ?? 'single' }),
        preferences: createUserPreferences({ age: overrides.age ?? 35, isPeakEarnings: false }),
        benefits: {
          employer401k: createEmployerBenefits({
            available: true,
            afterTaxAvailable: overrides.afterTaxAvailable ?? true,
            currentContribution: overrides.currentContribution ?? 0.06,
            matchPercent: 0.5,
            matchLimit: 0.06,
          }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
    }

    it('returns null when employer plan does not offer after-tax 401k', () => {
      const profile = buildProfile({ afterTaxAvailable: false })
      expect(calculateMegaBackdoorRoth(profile, 1000)).toBeNull()
    })

    it('returns null when 401k itself is unavailable', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits({ available: false, afterTaxAvailable: true }),
          hsa: createHSABenefits(),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateMegaBackdoorRoth(profile, 1000)).toBeNull()
    })

    it('returns null when income is below the regular Roth IRA phaseout end (regular Roth wins)', () => {
      const profile = buildProfile({ gross: 100000 }) // well below 168k single end
      expect(calculateMegaBackdoorRoth(profile, 1000)).toBeNull()
    })

    it('returns an allocation for high earners above the phaseout (default 415c limit)', () => {
      const profile = buildProfile({ gross: 200000, currentContribution: 0.06, age: 35 })
      const result = calculateMegaBackdoorRoth(profile, 9999)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('mega-backdoor-roth')
      expect(result!.priority).toBe(ALLOCATION_PRIORITY.megaBackdoorRoth)
      // The mega-backdoor step in lib/constants/financialSteps.ts is catalogued
      // as 'tax_optimization', and lib/utils/stepStatusUtils.ts matches on that
      // category — tagging the allocation 'tax_advantaged' left an $800/paycheck
      // recommendation rendering as an unrealized opportunity.
      expect(result!.category).toBe('tax_optimization')
      expect(result!.taxImpact).toBe(0) // after-tax contribution
      // remainingAfterTax = 72000 - 12000 (employee) - 6000 (employer match)
      // = 54000/yr → 54000/26 ≈ 2076.92 per paycheck (bi-weekly)
      expect(result!.amount).toBeCloseTo(2076.92, 2)
      expect(result!.amount).toBeCloseTo((TOTAL_415C_BY_AGE.standard - 12000 - 6000) / PAYCHECKS_PER_YEAR, 2)
      // Bi-weekly annualization regression: annualEquivalent = amount * 26
      expect(result!.annualEquivalent).toBeCloseTo(result!.amount * 26, 6)
      expect(result!.annualEquivalent).toBeCloseTo(54000, 2)
    })

    it('uses the catch-up limit for age 50+ workers', () => {
      const profile = buildProfile({ gross: 200000, currentContribution: 0.06, age: 55 })
      const result = calculateMegaBackdoorRoth(profile, 9999)
      // (80,000 - 18,000) / 26 ≈ 2384.62 per paycheck
      expect(result!.amount).toBeCloseTo(2384.62, 2)
      expect(result!.amount).toBeCloseTo((TOTAL_415C_BY_AGE.catchUp50 - 12000 - 6000) / PAYCHECKS_PER_YEAR, 2)
    })

    it('uses the super-catch-up limit for ages 60–63', () => {
      const profile = buildProfile({ gross: 200000, currentContribution: 0.06, age: 62 })
      const result = calculateMegaBackdoorRoth(profile, 9999)
      // (83,250 - 18,000) / 26 ≈ 2509.62 per paycheck
      expect(result!.amount).toBeCloseTo(2509.62, 2)
      expect(result!.amount).toBeCloseTo((TOTAL_415C_BY_AGE.superCatchUp60to63 - 12000 - 6000) / PAYCHECKS_PER_YEAR, 2)
    })

    it('returns null when per-paycheck room is at or below $100 (skip tiny amounts)', () => {
      // 200k × 30% = 60,000 employee + 6,000 employer = 66,000 → room 6,000/yr
      // → 6,000/26 ≈ 230.77 per paycheck (> 100 → allocation)
      const profile = buildProfile({ gross: 200000, currentContribution: 0.30 })
      expect(calculateMegaBackdoorRoth(profile, 9999)).not.toBeNull()
      // 200k × 32% = 64,000 + 6,000 = 70,000 → room 2,000/yr → 76.92 per paycheck (≤ 100 → null)
      const tightProfile = buildProfile({ gross: 200000, currentContribution: 0.32 })
      expect(calculateMegaBackdoorRoth(tightProfile, 9999)).toBeNull()
      // 200k × 33% = 66,000 + 6,000 = 72,000 → exactly at the 415c limit → 0 room → null
      const tighterProfile = buildProfile({ gross: 200000, currentContribution: 0.33 })
      expect(calculateMegaBackdoorRoth(tighterProfile, 9999)).toBeNull()
    })

    it('respects the available-amount cap', () => {
      const profile = buildProfile({ gross: 200000, currentContribution: 0.06 })
      const result = calculateMegaBackdoorRoth(profile, 200)
      expect(result!.amount).toBe(200)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Taxable & low-interest debt analysis
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateTaxableInvestment', () => {
    it('absorbs the entire remaining budget last in the order', () => {
      const profile = createPaycheckProfile()
      const result = calculateTaxableInvestment(profile, 750)
      expect(result).not.toBeNull()
      expect(result!.amount).toBe(750)
      expect(result!.priority).toBe(ALLOCATION_PRIORITY.taxableInvestment)
      expect(result!.category).toBe('investment')
      expect(result!.taxImpact).toBe(0)
    })

    it('returns null when there is no remaining budget', () => {
      const profile = createPaycheckProfile()
      expect(calculateTaxableInvestment(profile, 0)).toBeNull()
      expect(calculateTaxableInvestment(profile, -10)).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Priority ladder
  // ────────────────────────────────────────────────────────────────────────
  describe('ALLOCATION_PRIORITY', () => {
    it('assigns a distinct, strictly increasing priority to each step', () => {
      const values = Object.values(ALLOCATION_PRIORITY)
      expect(new Set(values).size).toBe(values.length)
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1])
      }
    })

    it('matches the Financial Order of Operations execution order in core.ts', () => {
      expect(Object.keys(ALLOCATION_PRIORITY)).toEqual([
        'oneMonthEmergency',
        'employerMatch',
        'highInterestDebt',
        'emergencyFundCompletion',
        'hsa',
        'rothIRA',
        'additional401k',
        'megaBackdoorRoth',
        'taxableInvestment',
      ])
    })

    it('keeps the two emergency steps on opposite sides of stepStatusUtils 2/3 boundary', () => {
      // lib/utils/stepStatusUtils.ts matches 'emergency-1month' on priority <= 2
      // and 'emergency-full' on priority >= 3. Breaking this makes the two step
      // cards claim each other's allocation.
      expect(ALLOCATION_PRIORITY.oneMonthEmergency).toBeLessThanOrEqual(2)
      expect(ALLOCATION_PRIORITY.emergencyFundCompletion).toBeGreaterThanOrEqual(3)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Determinism — pure functions, no hidden state
  // ────────────────────────────────────────────────────────────────────────
  describe('determinism', () => {
    it('repeated calls with identical inputs return identical AllocationItem outputs', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000, monthlyGross: 8000, monthlyNet: 6000, net: 6000 }),
        benefits: {
          employer401k: createEmployerBenefits({ available: true, matchLimit: 0.06, currentContribution: 0 }),
          hsa: createHSABenefits({ eligible: true, coverageType: 'individual', currentContribution: 0 }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
        debts: [createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 100 })],
      })

      // Strip lastUpdated (which is a Date.now() artifact) before deep-comparing.
      const stripVolatile = <T extends { id?: string } | null>(item: T) => {
        if (!item) return item
        // AllocationItems are produced fresh; they should be value-equal across calls.
        return item
      }

      expect(stripVolatile(calculateEmployerMatch(profile, 1000))).toEqual(
        stripVolatile(calculateEmployerMatch(profile, 1000))
      )
      expect(stripVolatile(calculateHSAOptimal(profile, 500))).toEqual(
        stripVolatile(calculateHSAOptimal(profile, 500))
      )
      expect(stripVolatile(calculateHighInterestDebt(profile, 500))).toEqual(
        stripVolatile(calculateHighInterestDebt(profile, 500))
      )
    })

    it('does not mutate the input profile', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000, monthlyGross: 8000, monthlyNet: 6000, net: 6000 }),
        debts: [createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 100 })],
      })
      const snapshotDebts = JSON.stringify(profile.debts)
      const snapshotIncome = JSON.stringify(profile.income)
      const snapshotPrefs = JSON.stringify(profile.preferences)

      calculate1MonthEmergency(profile, 500)
      calculateEmployerMatch(profile, 500)
      calculateHighInterestDebt(profile, 500)
      calculateHSAOptimal(profile, 500)
      calculateRothIRA(profile, 500)
      calculateAdditional401k(profile, 500)
      calculateMegaBackdoorRoth(profile, 500)
      calculateTaxableInvestment(profile, 500)

      expect(JSON.stringify(profile.debts)).toBe(snapshotDebts)
      expect(JSON.stringify(profile.income)).toBe(snapshotIncome)
      expect(JSON.stringify(profile.preferences)).toBe(snapshotPrefs)
    })
  })
})

/**
 * BEHAVIORS NOT EASILY TESTED IN THIS FILE
 *
 * - Full Financial-Order-of-Operations sequencing — that orchestration lives in
 *   lib/calculations/core.ts (calculateOptimalAllocation), already covered by
 *   test/lib/calculations/core.test.ts. Testing it here would duplicate.
 *
 * - The exact relative ordering "401k match → HSA → high-interest debt → Roth"
 *   is also enforced by the orchestrator, not these per-step functions.
 */
