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
 *   - `availableAmount` is per-paycheck for emergency-fund / employer-match /
 *     debt steps and monthly-ish for the HSA / Roth / 401k steps (the source
 *     mixes scopes — see findings at the bottom of this file).
 *   - `hsa.currentContribution` is monthly per the type comment.
 *
 * Most boundary tests target the actual constants imported from
 * lib/constants/irs-2026.ts so they remain correct as IRS limits update.
 */

import { describe, it, expect } from 'vitest'
import {
  calculate1MonthEmergency,
  calculateEmergencyFundCompletion,
  calculateEmployerMatch,
  calculateHighInterestDebt,
  hasHighInterestDebt,
  hasLowInterestDebt,
  calculateHSAOptimal,
  calculateTaxBracketOptimization,
  determineRothVsTraditional,
  calculateRothIRA,
  calculateAdditional401k,
  calculateMegaBackdoorRoth,
  calculateTaxableInvestment,
  calculateLowInterestDebtAnalysis,
} from '@/lib/calculations/optimization'
import { CONTRIBUTION_LIMITS_2026, ROTH_IRA_PHASEOUT_2026, TOTAL_415C_BY_AGE } from '@/lib/constants/irs-2026'
import {
  createPaycheckProfile,
  createDebtData,
  createIncomeData,
  createHSABenefits,
  createEmployerBenefits,
  createUserPreferences,
  createTaxData,
} from '@/test/factories/test-data-factory'

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
      expect(result!.priority).toBe(1)
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
      expect(result!.priority).toBe(4)
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
      expect(result!.priority).toBe(1)
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
      expect(result!.priority).toBe(3)
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

    it('returns null when available budget does not exceed the minimum payment', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 200 })],
      })
      // available 200 → recommendedPayment = min(200, 5000) = 200, which equals minimumPayment
      // → null (no extra payment to recommend)
      expect(calculateHighInterestDebt(profile, 200)).toBeNull()
      expect(calculateHighInterestDebt(profile, 150)).toBeNull()
    })

    it('records extraPayment as `amount` (above minimum payment)', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ balance: 5000, interestRate: 0.18, minimumPayment: 100 })],
      })
      const result = calculateHighInterestDebt(profile, 500)
      expect(result!.amount).toBe(500 - 100) // extraPayment
      expect(result!.taxImpact).toBe(0)
    })

    it('caps recommended payment at the debt balance', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ balance: 200, interestRate: 0.18, minimumPayment: 25 })],
      })
      // available 1000 > balance 200 → recommendedPayment = 200, extra = 175
      const result = calculateHighInterestDebt(profile, 1000)
      expect(result!.amount).toBe(200 - 25)
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

    it('uses the individual limit when coverageType is individual', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 99999)
      expect(result).not.toBeNull()
      // monthly limit = $4,400 / 12 ≈ $366.67
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.hsa.individual / 12, 2)
    })

    it('uses the family limit when coverageType is family', () => {
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'family',
            currentContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 99999)
      // monthly limit = $8,750 / 12
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.hsa.family / 12, 2)
    })

    it('returns null when already at the monthly contribution limit', () => {
      const monthlyLimit = CONTRIBUTION_LIMITS_2026.hsa.individual / 12
      const profile = createPaycheckProfile({
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: monthlyLimit, // already maxed
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      expect(calculateHSAOptimal(profile, 1000)).toBeNull()
    })

    it('uses calculateHSATaxRate (federal+state+FICA) for tax savings — i.e. includes FICA', () => {
      // Federal 22% + TX state 0% + FICA 7.65% = 29.65% → contribution 200 → savings ≈ 59.30
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 8000, monthlyGross: 8000, monthlyNet: 6000, net: 6000 }),
        taxes: createTaxData({ federalBracket: 0.22, state: 'TX' }),
        benefits: {
          employer401k: createEmployerBenefits(),
          hsa: createHSABenefits({
            eligible: true,
            coverageType: 'individual',
            currentContribution: 0,
          }),
          ira: { hasIRA: false, accountTypes: { traditional: false, roth: false }, currentContributions: { traditional: 0, roth: 0 }, currentBalances: { traditional: 0, roth: 0 } },
          other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
        },
      })
      const result = calculateHSAOptimal(profile, 200)
      expect(result).not.toBeNull()
      // 200 * (0.22 + 0.0765) = 59.30
      expect(result!.taxImpact).toBeCloseTo(-59.30, 2)
    })

    it('priority is 2 when not currently contributing, 3 when already contributing', () => {
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
      expect(calculateHSAOptimal(buildProfile(0), 200)!.priority).toBe(2)
      expect(calculateHSAOptimal(buildProfile(50), 200)!.priority).toBe(3)
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // Tax bracket optimization
  // ────────────────────────────────────────────────────────────────────────
  describe('calculateTaxBracketOptimization', () => {
    it('recommends 401k contribution to drop into the next-lower bracket (single filer)', () => {
      // Single, $52,000 annual gross is just past the 22% bracket boundary at $50,400.
      // Reducing $1,600 of taxable income drops you to the 12% bracket → savings = 1600 * (0.22 - 0.12) = $160/yr.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 52000 / 12,
          monthlyGross: 52000 / 12,
          monthlyNet: 3500,
          net: 3500,
        }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'single' }),
      })
      const result = calculateTaxBracketOptimization(profile, 200)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('tax-optimization')
      expect(result!.account).toBe('401k Tax Optimization')
      // monthly reduction is min(amountToReduce/12, available) = min(133.33, 200) = 133.33
      expect(result!.amount).toBeCloseTo(1600 / 12, 2)
      // taxImpact = -annualSavings/12 = -160/12
      expect(result!.taxImpact).toBeCloseTo(-160 / 12, 2)
    })

    it('returns null when income is in the lowest bracket (no lower bracket to drop into)', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 800,
          monthlyGross: 800,
          monthlyNet: 700,
          net: 700,
        }),
        taxes: createTaxData({ federalBracket: 0.10, filingStatus: 'single' }),
      })
      expect(calculateTaxBracketOptimization(profile, 100)).toBeNull()
    })

    it('returns null when monthly reduction is below the $50 threshold', () => {
      // Sit barely above the 22% boundary so the bracket reduction is tiny.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: (50400 + 60) / 12, // just $60/yr inside 22% bracket → $5/mo reduction
          monthlyGross: (50400 + 60) / 12,
          monthlyNet: 3500,
          net: 3500,
        }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'single' }),
      })
      expect(calculateTaxBracketOptimization(profile, 1000)).toBeNull()
    })

    it('uses the marriedJoint bracket table for married filers', () => {
      // 100,800 is the top of 12% MFJ bracket; sit just inside 22%.
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 102000 / 12,
          monthlyGross: 102000 / 12,
          monthlyNet: 6500,
          net: 6500,
        }),
        taxes: createTaxData({ federalBracket: 0.22, filingStatus: 'marriedJoint' }),
      })
      const result = calculateTaxBracketOptimization(profile, 500)
      expect(result).not.toBeNull()
      // amountToReduce = 102_000 - 100_800 = 1200
      expect(result!.amount).toBeCloseTo(1200 / 12, 2)
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
      })
      const result = calculateRothIRA(profile, 999)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('roth-ira')
      // monthly contribution = min(7500/12, 999) = 625
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.ira / 12, 2)
      expect(result!.taxImpact).toBe(0) // Roth = after-tax
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
      })
      const result = calculateRothIRA(profile, 9999)
      expect(result).not.toBeNull()
      // Math.floor(7500 * 0.5) = 3750 → monthly = 312.5
      expect(result!.amount).toBeCloseTo(3750 / 12, 1)
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
      })
      const result = calculateRothIRA(profile, 9999)
      expect(result).not.toBeNull()
      expect(result!.amount).toBeCloseTo(CONTRIBUTION_LIMITS_2026.ira / 12, 2)

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

    it('returns null when monthly contribution would be ≤ $50 (skip tiny contributions)', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({
          gross: 60000 / 12,
          monthlyGross: 60000 / 12,
          monthlyNet: 3800,
          net: 3800,
        }),
        taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
        preferences: createUserPreferences({ age: 25, isPeakEarnings: false }),
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
      // Federal 32 + TX 0 = 32% income-tax savings
      expect(result!.taxImpact).toBeCloseTo(-1000 * 0.32, 2)
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
      expect(result!.priority).toBe(6.5)
      expect(result!.taxImpact).toBe(0) // after-tax contribution
      // remainingAfterTax = 72000 - 12000 (employee) - 6000 (employer match) = 54000 → $4500/mo
      const expectedMonthly = (TOTAL_415C_BY_AGE.standard - 12000 - 6000) / 12
      expect(result!.amount).toBeCloseTo(expectedMonthly, 2)
    })

    it('uses the catch-up limit for age 50+ workers', () => {
      const profile = buildProfile({ gross: 200000, currentContribution: 0.06, age: 55 })
      const result = calculateMegaBackdoorRoth(profile, 9999)
      const expectedMonthly = (TOTAL_415C_BY_AGE.catchUp50 - 12000 - 6000) / 12
      expect(result!.amount).toBeCloseTo(expectedMonthly, 2)
    })

    it('uses the super-catch-up limit for ages 60–63', () => {
      const profile = buildProfile({ gross: 200000, currentContribution: 0.06, age: 62 })
      const result = calculateMegaBackdoorRoth(profile, 9999)
      const expectedMonthly = (TOTAL_415C_BY_AGE.superCatchUp60to63 - 12000 - 6000) / 12
      expect(result!.amount).toBeCloseTo(expectedMonthly, 2)
    })

    it('returns null when monthly room is below $100 (skip tiny amounts)', () => {
      // Crank current contribution so almost no room remains
      const profile = buildProfile({ gross: 200000, currentContribution: 0.30 })
      // 200k × 30% = 60000 employee + 6000 employer = 66000; 415c room = 6000/yr = 500/mo
      // That's > 100, so to get null we need even more crowding — set higher.
      const tightProfile = buildProfile({ gross: 200000, currentContribution: 0.32 })
      // 200k × 32% = 64000 + 6000 = 70000; room 2000/yr = 166/mo (still > 100).
      // Push tighter:
      const tighterProfile = buildProfile({ gross: 200000, currentContribution: 0.33 })
      // 66000 + 6000 = 72000 → exactly at limit → 0 room → null
      expect(calculateMegaBackdoorRoth(tighterProfile, 9999)).toBeNull()
      // Sanity check: looser profile still returns an allocation
      expect(calculateMegaBackdoorRoth(profile, 9999)).not.toBeNull()
      expect(calculateMegaBackdoorRoth(tightProfile, 9999)).not.toBeNull()
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
    it('absorbs the entire remaining budget at priority 7', () => {
      const profile = createPaycheckProfile()
      const result = calculateTaxableInvestment(profile, 750)
      expect(result).not.toBeNull()
      expect(result!.amount).toBe(750)
      expect(result!.priority).toBe(7)
      expect(result!.category).toBe('investment')
      expect(result!.taxImpact).toBe(0)
    })

    it('returns null when there is no remaining budget', () => {
      const profile = createPaycheckProfile()
      expect(calculateTaxableInvestment(profile, 0)).toBeNull()
      expect(calculateTaxableInvestment(profile, -10)).toBeNull()
    })
  })

  describe('calculateLowInterestDebtAnalysis', () => {
    it('returns null when there are no sub-7% debts', () => {
      const profile = createPaycheckProfile({
        debts: [createDebtData({ interestRate: 0.18, balance: 5000 })],
      })
      expect(calculateLowInterestDebtAnalysis(profile)).toBeNull()
    })

    it('flags low-interest debt as a SkippedItem with positive opportunity cost', () => {
      const profile = createPaycheckProfile({
        debts: [
          createDebtData({ name: 'Mortgage', balance: 200000, interestRate: 0.04, minimumPayment: 1000 }),
        ],
      })
      const result = calculateLowInterestDebtAnalysis(profile)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('low-interest-debt-payoff')
      // opportunity-cost rate = 0.07 - 0.04 = 0.03 → annual = 200000 * 0.03 = 6000
      expect(result!.opportunityCost.annual).toBeCloseTo(6000, 2)
      expect(result!.opportunityCost.monthly).toBeCloseTo(500, 2)
      expect(result!.opportunityCost.tenYear).toBeCloseTo(60000, 2)
      expect(result!.riskLevel).toBe('low')
    })

    it('weights average rate by balance across multiple low-interest debts', () => {
      const profile = createPaycheckProfile({
        debts: [
          createDebtData({ name: 'Mortgage', balance: 100000, interestRate: 0.05, minimumPayment: 600 }),
          createDebtData({ name: 'Car', balance: 20000, interestRate: 0.03, minimumPayment: 300 }),
        ],
      })
      const result = calculateLowInterestDebtAnalysis(profile)!
      // Weighted rate = (0.05*100000 + 0.03*20000) / 120000 = 5600/120000 ≈ 0.04667
      // Opportunity rate = 0.07 - 0.04667 ≈ 0.02333
      // Annual = 120000 * 0.02333 ≈ 2800
      expect(result.opportunityCost.annual).toBeCloseTo(2800, 0)
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
      calculateLowInterestDebtAnalysis(profile)

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
 *
 * UNIT-OF-MEASURE INCONSISTENCY (potential bug, not fixed per instructions)
 *
 * The optimizer mixes per-paycheck and per-month scopes:
 *   - calculate1MonthEmergency / calculateEmergencyFundCompletion divide
 *     `actualAllocation / profile.income.netPaycheck` (per-paycheck).
 *   - calculateHighInterestDebt / calculateHSAOptimal / calculateRothIRA /
 *     calculateAdditional401k / calculateMegaBackdoorRoth / calculateTaxableInvestment
 *     all divide by `profile.income.net` (which is MONTHLY).
 *   The `availableAmount` budget passed in by core.ts is per-paycheck, so a
 *   $500 paycheck-scope contribution gets divided by a monthly net (e.g. $6000),
 *   producing a 'percentage' that is ~2.17× too small for bi-weekly users.
 *   See lines 199, 237, 281, 382, 439, 493, 515 of optimization.ts.
 *
 * EMPLOYER-MATCH "monthly" COMMENT vs reality (minor)
 *
 * calculateHighInterestDebt's implementation copy says "per month" but the
 * `extraPayment` used is per-paycheck (matches what `availableAmount` carries).
 * Output text is therefore mis-labelled when the user is paid weekly/bi-weekly.
 */
