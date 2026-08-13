/**
 * Financial Step Status Tests
 *
 * calculateStepStatus is the pure mapping behind the paycheck allocator's
 * step-by-step breakdown: it takes the ordered financial steps, the computed
 * allocations, and the user's profile, and derives per-step completion,
 * urgency, dollar figures, and copy.
 *
 * Every expectation below is hand-computed from the thresholds the module
 * applies (98% of a contribution limit, the 7% high-interest debt cutoff,
 * months × necessary expenses) so a formula regression cannot hide behind a
 * re-derived expectation. The contribution limits themselves come from
 * lib/constants/irs-2026.ts — the module must never restate them — so the
 * limit-sensitive cases pair a literal hand-computed figure with the constant
 * it was derived from.
 */

import { describe, it, expect } from 'vitest'
import { calculateStepStatus } from '@/lib/utils/stepStatusUtils'
import { FINANCIAL_STEPS, type StepStatus } from '@/lib/constants/financialSteps'
import { CONTRIBUTION_LIMITS_2026, TOTAL_415C_BY_AGE } from '@/lib/constants/irs-2026'
import type {
  AllocationItem,
  DebtData,
  EmployerBenefits,
  HSABenefits,
  IncomeData,
  IRAData,
  PaycheckProfile,
  UserPreferences,
} from '@/lib/types'
import {
  createBenefitsData,
  createDebtData,
  createEmployerBenefits,
  createHSABenefits,
  createIncomeData,
  createIRAData,
  createPaycheckProfile,
  createUserPreferences,
} from '@/test/factories/test-data-factory'

interface ProfileOverrides {
  income?: Partial<IncomeData>
  preferences?: Partial<UserPreferences>
  employer401k?: Partial<EmployerBenefits>
  hsa?: Partial<HSABenefits>
  ira?: Partial<IRAData>
  debts?: DebtData[]
}

/**
 * Build a complete profile from the shared factories, defaulting to no debts
 * so the high-interest-debt step is only exercised where a test asks for it.
 */
function buildProfile({
  income,
  preferences,
  employer401k,
  hsa,
  ira,
  debts = [],
}: ProfileOverrides = {}): PaycheckProfile {
  return createPaycheckProfile({
    income: createIncomeData(income),
    preferences: createUserPreferences(preferences),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits(employer401k),
      hsa: createHSABenefits(hsa),
      ira: createIRAData(ira),
    }),
    debts,
  })
}

function createAllocation(overrides: Partial<AllocationItem> = {}): AllocationItem {
  return {
    id: 'allocation-1',
    account: 'Brokerage',
    amount: 250,
    percentage: 0.1,
    priority: 5,
    reasoning: 'Test allocation',
    taxImpact: 0,
    category: 'investment',
    implementation: 'Automatic transfer each payday',
    ...overrides,
  }
}

/** Run a single named step from FINANCIAL_STEPS through the derivation. */
function statusFor(
  stepId: string,
  profile: PaycheckProfile,
  allocations: AllocationItem[] = []
): StepStatus {
  const step = FINANCIAL_STEPS.find(s => s.id === stepId)
  if (!step) throw new Error(`Unknown financial step: ${stepId}`)
  return calculateStepStatus([step], allocations, profile)[0]
}

describe('calculateStepStatus — step mapping', () => {
  it('returns one status per step and preserves each step identity', () => {
    const statuses = calculateStepStatus(FINANCIAL_STEPS, [], buildProfile())

    expect(statuses).toHaveLength(FINANCIAL_STEPS.length)
    expect(statuses.map(s => s.id)).toEqual([
      'emergency-1month',
      'employer-match',
      'high-interest-debt',
      'emergency-full',
      'hsa-max',
      'roth-ira',
      'additional-401k',
      'mega-backdoor',
      'taxable-investment',
    ])
    expect(statuses[1].name).toBe('Employer 401k Match')
    expect(statuses[1].priority).toBe(2)
    expect(statuses[1].icon).toBe(FINANCIAL_STEPS[1].icon)
  })

  it('returns an empty array for an empty step list', () => {
    expect(calculateStepStatus([], [], buildProfile())).toEqual([])
  })

  it('treats isRecommendation as the residual state and never mixes complete with urgent', () => {
    const statuses = calculateStepStatus(FINANCIAL_STEPS, [], buildProfile({
      preferences: { currentEmergencyFund: 500, necessaryExpenses: 3000 },
      debts: [createDebtData({ balance: 4000, interestRate: 0.22 })],
    }))

    statuses.forEach(status => {
      expect(status.isRecommendation).toBe(
        !status.isComplete && !status.isUrgent && !status.isNotApplicable
      )
      expect(status.isComplete && status.isUrgent).toBe(false)
    })
  })
})

describe('calculateStepStatus — allocation matching', () => {
  it('matches the employer match by category or by account name', () => {
    const profile = buildProfile()

    const byCategory = createAllocation({ category: 'employer_match', account: '401k' })
    expect(statusFor('employer-match', profile, [byCategory]).allocation).toBe(byCategory)

    const byAccountName = createAllocation({ category: 'tax_advantaged', account: '401k Match' })
    expect(statusFor('employer-match', profile, [byAccountName]).allocation).toBe(byAccountName)
  })

  it('keeps a 401k match allocation out of the additional-401k step', () => {
    const matchAllocation = createAllocation({ category: 'tax_advantaged', account: '401k Match' })

    expect(statusFor('additional-401k', buildProfile(), [matchAllocation]).allocation).toBeUndefined()
  })

  it('splits emergency-fund allocations by priority at the 2/3 boundary', () => {
    const profile = buildProfile()
    const priorityTwo = createAllocation({
      category: 'emergency_fund',
      account: 'Emergency Savings',
      priority: 2,
    })
    const priorityThree = createAllocation({
      category: 'emergency_fund',
      account: 'Emergency Savings',
      priority: 3,
    })

    expect(statusFor('emergency-1month', profile, [priorityTwo]).allocation).toBe(priorityTwo)
    expect(statusFor('emergency-full', profile, [priorityTwo]).allocation).toBeUndefined()

    expect(statusFor('emergency-full', profile, [priorityThree]).allocation).toBe(priorityThree)
    expect(statusFor('emergency-1month', profile, [priorityThree]).allocation).toBeUndefined()
  })

  it('matches high-interest debt by either debt category or account name', () => {
    const profile = buildProfile({ debts: [createDebtData({ interestRate: 0.22 })] })

    const highInterest = createAllocation({ category: 'high_interest_debt', account: 'Visa' })
    expect(statusFor('high-interest-debt', profile, [highInterest]).allocation).toBe(highInterest)

    const payoff = createAllocation({ category: 'debt_payoff', account: 'Visa' })
    expect(statusFor('high-interest-debt', profile, [payoff]).allocation).toBe(payoff)

    const byName = createAllocation({ category: 'investment', account: 'Credit Card Debt' })
    expect(statusFor('high-interest-debt', profile, [byName]).allocation).toBe(byName)
  })

  it('matches HSA and Roth IRA accounts case-insensitively', () => {
    const profile = buildProfile()

    const hsa = createAllocation({ category: 'tax_advantaged', account: 'HSA Contribution' })
    expect(statusFor('hsa-max', profile, [hsa]).allocation).toBe(hsa)

    const roth = createAllocation({ category: 'tax_advantaged', account: 'ROTH ira' })
    expect(statusFor('roth-ira', profile, [roth]).allocation).toBe(roth)
  })

  it('does not match a Roth 401k to the Roth IRA step', () => {
    const roth401k = createAllocation({ category: 'tax_advantaged', account: 'Roth 401k' })

    expect(statusFor('roth-ira', buildProfile(), [roth401k]).allocation).toBeUndefined()
  })

  it('matches the mega backdoor only inside the tax_optimization category', () => {
    const profile = buildProfile({ employer401k: { afterTaxAvailable: true } })

    const optimization = createAllocation({
      category: 'tax_optimization',
      account: 'Mega Backdoor Roth',
    })
    expect(statusFor('mega-backdoor', profile, [optimization]).allocation).toBe(optimization)

    const wrongCategory = createAllocation({
      category: 'tax_advantaged',
      account: 'Mega Backdoor Roth',
    })
    expect(statusFor('mega-backdoor', profile, [wrongCategory]).allocation).toBeUndefined()
  })

  it('excludes retirement-labelled accounts from the taxable investment step', () => {
    const profile = buildProfile()

    const taxable = createAllocation({ category: 'investment', account: 'Taxable Brokerage' })
    expect(statusFor('taxable-investment', profile, [taxable]).allocation).toBe(taxable)

    const retirement = createAllocation({ category: 'investment', account: 'Retirement Brokerage' })
    expect(statusFor('taxable-investment', profile, [retirement]).allocation).toBeUndefined()
  })

  it('leaves the allocation undefined when nothing matches', () => {
    const unrelated = createAllocation({ category: 'investment', account: 'Savings' })

    expect(statusFor('hsa-max', buildProfile(), [unrelated]).allocation).toBeUndefined()
    expect(statusFor('roth-ira', buildProfile(), []).allocation).toBeUndefined()
  })
})

describe('calculateStepStatus — applicability', () => {
  it('marks the HSA step not applicable without HSA eligibility', () => {
    const status = statusFor('hsa-max', buildProfile({ hsa: { eligible: false } }))

    expect(status.isNotApplicable).toBe(true)
    expect(status.isComplete).toBe(false)
    expect(status.isRecommendation).toBe(false)
    expect(status.urgencyLevel).toBe('none')
  })

  it('marks the employer match not applicable without a 401k', () => {
    const status = statusFor('employer-match', buildProfile({ employer401k: { available: false } }))

    expect(status.isNotApplicable).toBe(true)
    expect(status.isUrgent).toBe(false)
    expect(status.urgencyLevel).toBe('none')
  })

  it('marks the mega backdoor not applicable without after-tax contributions', () => {
    const status = statusFor('mega-backdoor', buildProfile({
      employer401k: { afterTaxAvailable: false },
    }))

    expect(status.isNotApplicable).toBe(true)
    expect(status.urgencyLevel).toBe('none')
  })

  it('marks high-interest debt not applicable with no debts at all', () => {
    const status = statusFor('high-interest-debt', buildProfile({ debts: [] }))

    expect(status.isNotApplicable).toBe(true)
    expect(status.isComplete).toBe(false)
  })

  it('treats a debt at exactly 7% as not high-interest', () => {
    const status = statusFor('high-interest-debt', buildProfile({
      debts: [createDebtData({ balance: 10000, interestRate: 0.07 })],
    }))

    expect(status.isNotApplicable).toBe(true)
    expect(status.isUrgent).toBe(false)
  })

  it('treats a debt just above 7% as high-interest', () => {
    const status = statusFor('high-interest-debt', buildProfile({
      debts: [createDebtData({ balance: 10000, interestRate: 0.071 })],
    }))

    expect(status.isNotApplicable).toBe(false)
    expect(status.isUrgent).toBe(true)
  })
})

describe('calculateStepStatus — completion thresholds', () => {
  it('completes the 1-month emergency fund at exactly one month of expenses', () => {
    const atThreshold = statusFor('emergency-1month', buildProfile({
      preferences: { currentEmergencyFund: 3000, necessaryExpenses: 3000 },
    }))
    expect(atThreshold.isComplete).toBe(true)
    expect(atThreshold.isUrgent).toBe(false)

    const oneDollarShort = statusFor('emergency-1month', buildProfile({
      preferences: { currentEmergencyFund: 2999, necessaryExpenses: 3000 },
    }))
    expect(oneDollarShort.isComplete).toBe(false)
    expect(oneDollarShort.isUrgent).toBe(true)
  })

  it('never completes an emergency fund whose target is $0', () => {
    // necessaryExpenses = 0 means the input is unanswered, not that a $0 target
    // has been met: `0 >= 0` must not read as a funded fund.
    for (const currentEmergencyFund of [0, 1500]) {
      const oneMonth = statusFor('emergency-1month', buildProfile({
        preferences: { currentEmergencyFund, necessaryExpenses: 0 },
      }))
      expect(oneMonth.isComplete).toBe(false)
      expect(oneMonth.isUrgent).toBe(false)
      expect(oneMonth.isRecommendation).toBe(true)
      expect(oneMonth.recommendation).not.toMatch(/complete/i)

      const full = statusFor('emergency-full', buildProfile({
        preferences: { currentEmergencyFund, necessaryExpenses: 0, emergencyFundMonths: 6 },
      }))
      expect(full.isComplete).toBe(false)
      expect(full.recommendation).not.toMatch(/complete/i)
    }
  })

  it('completes the full emergency fund at months × necessary expenses', () => {
    // 6 months × $3,000 = $18,000
    const funded = statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 18000, necessaryExpenses: 3000, emergencyFundMonths: 6 },
    }))
    expect(funded.isComplete).toBe(true)

    const short = statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 17999, necessaryExpenses: 3000, emergencyFundMonths: 6 },
    }))
    expect(short.isComplete).toBe(false)
    expect(short.urgencyLevel).toBe('important')
  })

  it('completes the employer match at the match limit', () => {
    const atLimit = statusFor('employer-match', buildProfile({
      employer401k: { available: true, currentContribution: 0.06, matchLimit: 0.06 },
    }))
    expect(atLimit.isComplete).toBe(true)
    expect(atLimit.isUrgent).toBe(false)

    const belowLimit = statusFor('employer-match', buildProfile({
      employer401k: { available: true, currentContribution: 0.03, matchLimit: 0.06 },
    }))
    expect(belowLimit.isComplete).toBe(false)
    expect(belowLimit.isUrgent).toBe(true)
  })

  it('completes high-interest debt once the qualifying balance reaches zero', () => {
    const status = statusFor('high-interest-debt', buildProfile({
      debts: [createDebtData({ balance: 0, interestRate: 0.24 })],
    }))

    expect(status.isNotApplicable).toBe(false)
    expect(status.isComplete).toBe(true)
    expect(status.isUrgent).toBe(false)
    expect(status.urgencyLevel).toBe('none')
  })

  it('completes the HSA within 2% of the individual limit', () => {
    // 2026 individual limit $4,400 × 98% = $4,312 annual.
    // $360/mo → $4,320 clears it; $359/mo → $4,308 does not.
    expect(CONTRIBUTION_LIMITS_2026.hsa.individual).toBe(4400)

    const clears = statusFor('hsa-max', buildProfile({
      hsa: { eligible: true, coverageType: 'individual', currentContribution: 360 },
      preferences: { age: 40 },
    }))
    expect(clears.isComplete).toBe(true)

    const short = statusFor('hsa-max', buildProfile({
      hsa: { eligible: true, coverageType: 'individual', currentContribution: 359 },
      preferences: { age: 40 },
    }))
    expect(short.isComplete).toBe(false)
    expect(short.urgencyLevel).toBe('important')
  })

  it('raises the HSA bar at age 55 for the catch-up limit', () => {
    // $440/mo = $5,280 annual. Under 55: 98% of $4,400 = $4,312 → complete.
    // At 55 the limit is $4,400 + $1,000 = $5,400, so 98% = $5,292 → short by $12.
    const hsa: Partial<HSABenefits> = {
      eligible: true,
      coverageType: 'individual',
      currentContribution: 440,
    }
    const catchUpLimit = CONTRIBUTION_LIMITS_2026.hsa.individual + CONTRIBUTION_LIMITS_2026.catchUp.hsa
    expect(catchUpLimit * 0.98).toBeCloseTo(5292, 6)

    expect(statusFor('hsa-max', buildProfile({ hsa, preferences: { age: 54 } })).isComplete).toBe(true)
    expect(statusFor('hsa-max', buildProfile({ hsa, preferences: { age: 55 } })).isComplete).toBe(false)
  })

  it('applies the family HSA limit for family coverage', () => {
    // $715/mo = $8,580 annual. 98% of the $8,750 family limit = $8,575.
    expect(CONTRIBUTION_LIMITS_2026.hsa.family).toBe(8750)

    const status = statusFor('hsa-max', buildProfile({
      hsa: { eligible: true, coverageType: 'family', currentContribution: 715 },
      preferences: { age: 40 },
    }))

    expect(status.isComplete).toBe(true)

    // $714/mo = $8,568, four dollars short of the 98% bar.
    const short = statusFor('hsa-max', buildProfile({
      hsa: { eligible: true, coverageType: 'family', currentContribution: 714 },
      preferences: { age: 40 },
    }))
    expect(short.isComplete).toBe(false)
  })

  it('completes the Roth IRA within 2% of the annual limit', () => {
    // 2026 IRA limit $7,500 × 98% = $7,350.
    // $613/mo → $7,356 clears; $612/mo → $7,344 does not.
    expect(CONTRIBUTION_LIMITS_2026.ira).toBe(7500)

    const clears = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 613 } },
      preferences: { age: 40 },
    }))
    expect(clears.isComplete).toBe(true)

    const short = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 612 } },
      preferences: { age: 40 },
    }))
    expect(short.isComplete).toBe(false)
  })

  it('raises the Roth IRA bar at age 50 for the catch-up limit', () => {
    // $613/mo = $7,356. At 50 the limit is $7,500 + $1,100 = $8,600, so 98% = $8,428.
    const catchUpLimit = CONTRIBUTION_LIMITS_2026.ira + CONTRIBUTION_LIMITS_2026.catchUp.ira
    expect(catchUpLimit).toBe(8600)

    const status = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 613 } },
      preferences: { age: 50 },
    }))

    expect(status.isComplete).toBe(false)

    // $703/mo = $8,436 clears the catch-up bar.
    const clears = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 703 } },
      preferences: { age: 50 },
    }))
    expect(clears.isComplete).toBe(true)
  })

  it('treats a missing Roth contribution as zero', () => {
    const status = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 400, roth: 0 } },
    }))

    expect(status.isComplete).toBe(false)
    expect(status.urgencyLevel).toBe('important')
  })

  it('completes the 401k step within 2% of the elective deferral limit', () => {
    // 2026 elective deferral limit $24,500 × 98% = $24,010.
    // $6,500 monthly gross × 32% × 12 = $24,960 clears it.
    expect(CONTRIBUTION_LIMITS_2026.traditional401k).toBe(24500)

    const maxed = statusFor('additional-401k', buildProfile({
      income: { gross: 6500 },
      employer401k: { available: true, currentContribution: 0.32 },
      preferences: { age: 40 },
    }))
    expect(maxed.isComplete).toBe(true)

    // The same 32% only reaches $24,960 against 98% of $32,500 = $31,850 at 50+.
    const catchUpShort = statusFor('additional-401k', buildProfile({
      income: { gross: 6500 },
      employer401k: { available: true, currentContribution: 0.32 },
      preferences: { age: 50 },
    }))
    expect(catchUpShort.isComplete).toBe(false)
  })

  it('applies the 60-63 super catch-up and drops it again at 64', () => {
    // $24,500 + $8,000 = $32,500 at 50+; + $11,250 = $35,750 for ages 60-63.
    // $6,500 × 42% × 12 = $32,760 clears 98% of $32,500 ($31,850) but not 98%
    // of $35,750 ($35,035).
    expect(CONTRIBUTION_LIMITS_2026.catchUp['401k']).toBe(8000)
    expect(CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k).toBe(11250)

    const employer401k = { available: true, currentContribution: 0.42 }
    const income = { gross: 6500 }

    expect(statusFor('additional-401k', buildProfile({ income, employer401k, preferences: { age: 59 } })).isComplete).toBe(true)
    expect(statusFor('additional-401k', buildProfile({ income, employer401k, preferences: { age: 60 } })).isComplete).toBe(false)
    expect(statusFor('additional-401k', buildProfile({ income, employer401k, preferences: { age: 63 } })).isComplete).toBe(false)
    expect(statusFor('additional-401k', buildProfile({ income, employer401k, preferences: { age: 64 } })).isComplete).toBe(true)
  })

  it('leaves the 401k step incomplete at a 6% contribution', () => {
    // $6,500 × 6% × 12 = $4,680 — well short of $24,010.
    const status = statusFor('additional-401k', buildProfile({
      income: { gross: 6500 },
      employer401k: { available: true, currentContribution: 0.06 },
      preferences: { age: 40 },
    }))

    expect(status.isComplete).toBe(false)
    expect(status.isRecommendation).toBe(true)
  })

  it('cannot complete the 401k step without a 401k', () => {
    const status = statusFor('additional-401k', buildProfile({
      employer401k: { available: false, currentContribution: 0.5 },
    }))

    expect(status.isComplete).toBe(false)
    expect(status.isNotApplicable).toBe(false)
    expect(status.recommendation).toBe('401k not available')
  })
})

describe('calculateStepStatus — urgency levels', () => {
  it('flags an underfunded emergency fund, an unmatched 401k, and live high-interest debt as critical', () => {
    const profile = buildProfile({
      preferences: { currentEmergencyFund: 500, necessaryExpenses: 3000 },
      employer401k: { available: true, currentContribution: 0.01, matchLimit: 0.06 },
      debts: [createDebtData({ balance: 6000, interestRate: 0.19 })],
    })

    expect(statusFor('emergency-1month', profile).urgencyLevel).toBe('critical')
    expect(statusFor('employer-match', profile).urgencyLevel).toBe('critical')
    expect(statusFor('high-interest-debt', profile).urgencyLevel).toBe('critical')
  })

  it('rates the accumulation steps as important when incomplete', () => {
    const profile = buildProfile({
      income: { gross: 6500 },
      preferences: { currentEmergencyFund: 3000, necessaryExpenses: 3000, emergencyFundMonths: 6, age: 40 },
      hsa: { eligible: true, currentContribution: 100 },
      ira: { currentContributions: { traditional: 0, roth: 100 } },
      employer401k: { available: true, currentContribution: 0.06 },
    })

    expect(statusFor('emergency-full', profile).urgencyLevel).toBe('important')
    expect(statusFor('hsa-max', profile).urgencyLevel).toBe('important')
    expect(statusFor('roth-ira', profile).urgencyLevel).toBe('important')
    expect(statusFor('additional-401k', profile).urgencyLevel).toBe('important')
  })

  it('rates the late-stage steps as optimization', () => {
    const profile = buildProfile({ employer401k: { afterTaxAvailable: true } })

    expect(statusFor('mega-backdoor', profile).urgencyLevel).toBe('optimization')
    expect(statusFor('taxable-investment', profile).urgencyLevel).toBe('optimization')
  })

  it('rates completed steps as none', () => {
    const profile = buildProfile({
      preferences: { currentEmergencyFund: 9000, necessaryExpenses: 3000, emergencyFundMonths: 3 },
    })

    expect(statusFor('emergency-1month', profile).urgencyLevel).toBe('none')
    expect(statusFor('emergency-full', profile).urgencyLevel).toBe('none')
  })
})

describe('calculateStepStatus — potential savings', () => {
  it('values the missed employer match at the un-matched contribution gap', () => {
    // $6,500 gross: full match 6% × 50% = $195/mo; current 2% × 50% = $65/mo.
    const status = statusFor('employer-match', buildProfile({
      income: { gross: 6500 },
      employer401k: {
        available: true,
        matchLimit: 0.06,
        matchPercent: 0.5,
        currentContribution: 0.02,
      },
    }))

    expect(status.potentialSavings.monthly).toBeCloseTo(130, 6)
    expect(status.potentialSavings.annual).toBeCloseTo(1560, 6)
  })

  it('reports no missed match once the contribution exceeds the match limit', () => {
    const status = statusFor('employer-match', buildProfile({
      income: { gross: 6500 },
      employer401k: {
        available: true,
        matchLimit: 0.06,
        matchPercent: 0.5,
        currentContribution: 0.1,
      },
    }))

    expect(status.potentialSavings).toEqual({ monthly: 0, annual: 0 })
  })

  it('reports no missed match when no 401k is offered', () => {
    const status = statusFor('employer-match', buildProfile({
      employer401k: { available: false },
    }))

    expect(status.potentialSavings).toEqual({ monthly: 0, annual: 0 })
  })

  it('values high-interest debt at the monthly interest of the qualifying debt', () => {
    // $12,000 × 18% = $2,160/yr → $180/mo. The 4% loan listed first is skipped.
    const status = statusFor('high-interest-debt', buildProfile({
      debts: [
        createDebtData({ name: 'Student Loan', balance: 20000, interestRate: 0.04 }),
        createDebtData({ name: 'Credit Card', balance: 12000, interestRate: 0.18 }),
      ],
    }))

    expect(status.potentialSavings.monthly).toBeCloseTo(180, 6)
    expect(status.potentialSavings.annual).toBeCloseTo(2160, 6)
  })

  it('values the highest-rate qualifying debt, not the first one listed', () => {
    // The allocator pays the 29% card; the step has to price the same debt.
    // $3,000 × 29% = $870/yr → $72.50/mo (the 8% card would price at $133.33/mo).
    const status = statusFor('high-interest-debt', buildProfile({
      debts: [
        createDebtData({ name: 'Low Card', balance: 20000, interestRate: 0.08 }),
        createDebtData({ name: 'High Card', balance: 3000, interestRate: 0.29 }),
      ],
    }))

    expect(status.potentialSavings.monthly).toBeCloseTo(72.5, 6)
    expect(status.potentialSavings.annual).toBeCloseTo(870, 6)
  })

  it('prices the savings on the recommended payment stream when one exists', () => {
    // $200/mo extra at 29% with the allocator's 0.5 average-balance correction
    // = 200 × 12 × 0.29 × 0.5 = $348/yr, under the $870 full-year ceiling.
    const status = statusFor(
      'high-interest-debt',
      buildProfile({
        debts: [createDebtData({ name: 'High Card', balance: 3000, interestRate: 0.29 })],
      }),
      [createAllocation({ category: 'high_interest_debt', account: 'High Card', monthlyEquivalent: 200 })]
    )

    expect(status.potentialSavings.annual).toBeCloseTo(348, 6)
    expect(status.potentialSavings.monthly).toBeCloseTo(29, 6)
  })

  it('caps payment-stream savings at a full year of interest on the balance', () => {
    // $2,000/mo × 12 × 0.29 × 0.5 = $3,480 would overstate a $3,000 debt whose
    // full-year interest is $870 — the ceiling applies.
    const status = statusFor(
      'high-interest-debt',
      buildProfile({
        debts: [createDebtData({ name: 'High Card', balance: 3000, interestRate: 0.29 })],
      }),
      [createAllocation({ category: 'high_interest_debt', account: 'High Card', monthlyEquivalent: 2000 })]
    )

    expect(status.potentialSavings.annual).toBeCloseTo(870, 6)
  })

  it('values unused HSA room at the profile federal bracket', () => {
    // $200/mo = $2,400; room to the $4,400 limit is $2,000; × the 12% bracket
    // the factory sets = $240/yr.
    const status = statusFor('hsa-max', buildProfile({
      hsa: { eligible: true, coverageType: 'individual', currentContribution: 200 },
      preferences: { age: 40 },
    }))

    expect(status.potentialSavings.annual).toBeCloseTo(240, 6)
    expect(status.potentialSavings.monthly).toBeCloseTo(20, 6)
  })

  it('rescales the HSA saving with the bracket the profile reports', () => {
    // Same $2,000 of room at a 24% bracket = $480/yr.
    const profile = buildProfile({
      hsa: { eligible: true, coverageType: 'individual', currentContribution: 200 },
      preferences: { age: 40 },
    })
    const status = statusFor('hsa-max', {
      ...profile,
      taxes: { ...profile.taxes, federalBracket: 0.24 },
    })

    expect(status.potentialSavings.annual).toBeCloseTo(480, 6)
  })

  it('reports no HSA saving when the limit is met or the user is ineligible', () => {
    const overLimit = statusFor('hsa-max', buildProfile({
      hsa: { eligible: true, coverageType: 'individual', currentContribution: 500 },
    }))
    expect(overLimit.potentialSavings).toEqual({ monthly: 0, annual: 0 })

    const ineligible = statusFor('hsa-max', buildProfile({ hsa: { eligible: false } }))
    expect(ineligible.potentialSavings).toEqual({ monthly: 0, annual: 0 })
  })

  it('values unused Roth IRA room at a 7% growth assumption', () => {
    // $500/mo = $6,000; room to the $7,500 limit is $1,500; × 7% = $105/yr.
    const status = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 500 } },
      preferences: { age: 40 },
    }))

    expect(status.potentialSavings.annual).toBeCloseTo(105, 6)
    expect(status.potentialSavings.monthly).toBeCloseTo(8.75, 6)
  })

  it('widens the Roth IRA room by the 50+ catch-up', () => {
    // Room to $8,600 from $6,000 is $2,600; × 7% = $182/yr.
    const status = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 500 } },
      preferences: { age: 50 },
    }))

    expect(status.potentialSavings.annual).toBeCloseTo(182, 6)
  })

  it('reports zero for steps without a savings model', () => {
    const profile = buildProfile({ employer401k: { afterTaxAvailable: true } })

    expect(statusFor('emergency-1month', profile).potentialSavings).toEqual({ monthly: 0, annual: 0 })
    expect(statusFor('emergency-full', profile).potentialSavings).toEqual({ monthly: 0, annual: 0 })
    expect(statusFor('additional-401k', profile).potentialSavings).toEqual({ monthly: 0, annual: 0 })
    expect(statusFor('mega-backdoor', profile).potentialSavings).toEqual({ monthly: 0, annual: 0 })
    expect(statusFor('taxable-investment', profile).potentialSavings).toEqual({ monthly: 0, annual: 0 })
  })
})

describe('calculateStepStatus — recommendation copy', () => {
  it('reports the emergency fund balance when funded and the target when not', () => {
    const funded = statusFor('emergency-1month', buildProfile({
      preferences: { currentEmergencyFund: 9000, necessaryExpenses: 3000 },
    }))
    expect(funded.recommendation).toBe('Emergency fund complete ($9,000)')

    const underfunded = statusFor('emergency-1month', buildProfile({
      preferences: { currentEmergencyFund: 500, necessaryExpenses: 3000 },
    }))
    expect(underfunded.recommendation).toBe('Need $3,000 emergency fund')
  })

  it('names the match percentage the user is leaving on the table', () => {
    const short = statusFor('employer-match', buildProfile({
      employer401k: { available: true, currentContribution: 0.02, matchLimit: 0.06 },
    }))
    expect(short.recommendation).toBe('Below match limit - increasing 401k to 6% captures the full match')

    const maxed = statusFor('employer-match', buildProfile({
      employer401k: { available: true, currentContribution: 0.06, matchLimit: 0.06 },
    }))
    expect(maxed.recommendation).toBe('Employer match maximized')
  })

  it('quotes the rate on the debt it is prioritizing', () => {
    const carrying = statusFor('high-interest-debt', buildProfile({
      debts: [createDebtData({ balance: 5000, interestRate: 0.18 })],
    }))
    expect(carrying.recommendation).toBe('18% interest debt - payoff returns that rate risk-free')

    const paidOff = statusFor('high-interest-debt', buildProfile({
      debts: [createDebtData({ balance: 0, interestRate: 0.18 })],
    }))
    expect(paidOff.recommendation).toBe('All high-interest debt paid off')
  })

  it('names the highest-rate debt, matching the debt the allocator pays', () => {
    const status = statusFor('high-interest-debt', buildProfile({
      debts: [
        createDebtData({ name: 'Low Card', balance: 20000, interestRate: 0.08, minimumPayment: 200 }),
        createDebtData({ name: 'High Card', balance: 3000, interestRate: 0.29, minimumPayment: 90 }),
      ],
    }))

    expect(status.recommendation).toBe('29% interest debt - payoff returns that rate risk-free')
  })

  it('states the emergency fund target in months', () => {
    const incomplete = statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 3000, necessaryExpenses: 3000, emergencyFundMonths: 6 },
    }))
    expect(incomplete.recommendation).toBe('Complete 6-month emergency fund')

    const complete = statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 18000, necessaryExpenses: 3000, emergencyFundMonths: 6 },
    }))
    expect(complete.recommendation).toBe('Full emergency fund complete (6 months)')
  })

  it('switches to present-tense copy once an allocation exists', () => {
    const profile = buildProfile({
      preferences: { currentEmergencyFund: 3000, necessaryExpenses: 3000, emergencyFundMonths: 6 },
      employer401k: { afterTaxAvailable: true },
    })
    const emergency = createAllocation({
      category: 'emergency_fund',
      account: 'Emergency Savings',
      priority: 3,
    })
    const hsa = createAllocation({ category: 'tax_advantaged', account: 'HSA' })
    const roth = createAllocation({ category: 'tax_advantaged', account: 'Roth IRA' })
    const mega = createAllocation({ category: 'tax_optimization', account: 'Mega Backdoor Roth' })
    const taxable = createAllocation({ category: 'investment', account: 'Taxable Brokerage' })

    expect(statusFor('emergency-full', profile, [emergency]).recommendation)
      .toBe('Building full emergency fund')
    expect(statusFor('hsa-max', profile, [hsa]).recommendation)
      .toBe('Maximizing HSA contributions')
    expect(statusFor('roth-ira', profile, [roth]).recommendation)
      .toBe('Contributing to Roth IRA')
    expect(statusFor('mega-backdoor', profile, [mega]).recommendation)
      .toBe('Mega backdoor Roth strategy')
    expect(statusFor('taxable-investment', profile, [taxable]).recommendation)
      .toBe('Investing in taxable account')
  })

  it('explains why a step does not apply', () => {
    expect(statusFor('hsa-max', buildProfile({ hsa: { eligible: false } })).recommendation)
      .toBe('Not HSA eligible')
    expect(
      statusFor('mega-backdoor', buildProfile({ employer401k: { afterTaxAvailable: false } }))
        .recommendation
    ).toBe('Mega backdoor not available')
  })

  it('quantifies the gap to the 401k limit', () => {
    // $24,500 − ($6,500 × 6% × 12 = $4,680) = $19,820 → $1,652/mo, 25.4% of $78,000.
    const status = statusFor('additional-401k', buildProfile({
      income: { gross: 6500 },
      employer401k: { available: true, currentContribution: 0.06 },
      preferences: { age: 40 },
    }))

    expect(status.recommendation).toBe('Additional $1,652/month (25.4% of salary) contributions needed for max')
  })

  it('reports the contribution rate once the 401k is maxed', () => {
    const status = statusFor('additional-401k', buildProfile({
      income: { gross: 6500 },
      employer401k: { available: true, currentContribution: 0.32 },
      preferences: { age: 40 },
    }))

    expect(status.recommendation).toBe('401k maximized at 32%')
  })

  it('drops the percent-of-salary figure when there is no gross pay on file', () => {
    // Gross 0 makes "percent of salary" undefined; the dollar figure still
    // stands ($24,500 / 12 = $2,042/month).
    const status = statusFor('additional-401k', buildProfile({
      income: { gross: 0 },
      employer401k: { available: true, currentContribution: 0.06 },
      preferences: { age: 40 },
    }))

    expect(status.recommendation).toBe('Additional $2,042/month contributions needed for max')
    expect(status.recommendation).not.toMatch(/∞|Infinity|NaN/)
    expect(status.implementationSteps[1]).toBe('Increase contributions by $2,042/month')
  })

  it('states the Roth IRA monthly figure from the age-adjusted limit', () => {
    // $7,500 / 12 = $625; at 50+ ($7,500 + $1,100) / 12 = $717.
    const underFifty = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 0 } },
      preferences: { age: 40 },
    }))
    expect(underFifty.recommendation).toBe(
      `Contribute $${CONTRIBUTION_LIMITS_2026.ira / 12}/month to Roth IRA`
    )
    expect(underFifty.recommendation).toBe('Contribute $625/month to Roth IRA')

    const fifty = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 0 } },
      preferences: { age: 50 },
    }))
    expect(fifty.recommendation).toBe('Contribute $717/month to Roth IRA')
  })

  it('stops telling the user to contribute once the Roth IRA is complete', () => {
    // $700/mo = $8,400, past 98% of the $7,500 limit ($7,350).
    const status = statusFor('roth-ira', buildProfile({
      ira: { currentContributions: { traditional: 0, roth: 700 } },
      preferences: { age: 40 },
    }))

    expect(status.isComplete).toBe(true)
    expect(status.recommendation).toBe('Roth IRA maximized')
    expect(status.recommendation).not.toMatch(/contribute/i)
  })

  it('says the emergency-fund target is unknown when necessary expenses are $0', () => {
    const expected = 'Necessary monthly expenses not set - emergency fund target unknown'

    expect(statusFor('emergency-1month', buildProfile({
      preferences: { currentEmergencyFund: 1500, necessaryExpenses: 0 },
    })).recommendation).toBe(expected)

    expect(statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 1500, necessaryExpenses: 0, emergencyFundMonths: 6 },
    })).recommendation).toBe(expected)
  })
})

describe('calculateStepStatus — implementation guidance', () => {
  it('gives an implementation time estimate for every step', () => {
    const statuses = calculateStepStatus(FINANCIAL_STEPS, [], buildProfile())
    const times = Object.fromEntries(statuses.map(s => [s.id, s.implementationTime] as const))

    expect(times).toEqual({
      'emergency-1month': '3-6 months',
      'employer-match': '5 minutes',
      'high-interest-debt': '6-24 months',
      'emergency-full': '3-6 months',
      'hsa-max': '5 minutes',
      'roth-ira': '30 minutes setup',
      'additional-401k': '15 minutes',
      'mega-backdoor': '15 minutes',
      'taxable-investment': '15 minutes',
    })
  })

  it('quotes the match limit in the employer-match instructions', () => {
    const status = statusFor('employer-match', buildProfile({
      employer401k: { available: true, currentContribution: 0.02, matchLimit: 0.05 },
    }))

    expect(status.implementationSteps).toHaveLength(3)
    expect(status.implementationSteps[1]).toBe('Increase contribution to 5%')
  })

  it('sizes the emergency fund transfer over twelve months', () => {
    // 6 × $3,000 = $18,000 target; ($18,000 − $6,000) / 12 = $1,000/mo.
    const status = statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 6000, necessaryExpenses: 3000, emergencyFundMonths: 6 },
    }))

    expect(status.implementationSteps[0]).toBe('Calculate total needed: $18,000')
    expect(status.implementationSteps[1]).toBe('Set automatic transfer for $1,000/month')
  })

  it('floors the emergency fund transfer at zero when already overfunded', () => {
    const status = statusFor('emergency-full', buildProfile({
      preferences: { currentEmergencyFund: 30000, necessaryExpenses: 3000, emergencyFundMonths: 6 },
    }))

    expect(status.implementationSteps[1]).toBe('Set automatic transfer for $0/month')
  })

  it('states the additional 401k percentage needed', () => {
    // ($24,500 − $4,680) / $78,000 = 25.4%.
    const status = statusFor('additional-401k', buildProfile({
      income: { gross: 6500 },
      employer401k: { available: true, currentContribution: 0.06 },
      preferences: { age: 40 },
    }))

    expect(status.implementationSteps[1]).toBe('Raise your contribution rate by 25.4% of salary (from 6% to about 31.4%)')
  })

  it('sizes the Roth IRA transfer from the age-adjusted IRA limit', () => {
    const underFifty = statusFor('roth-ira', buildProfile({ preferences: { age: 40 } }))
    expect(underFifty.implementationSteps[1]).toBe(
      `Set up automatic $${CONTRIBUTION_LIMITS_2026.ira / 12}/month transfer`
    )
    expect(underFifty.implementationSteps[1]).toBe('Set up automatic $625/month transfer')

    // ($7,500 + $1,100) / 12 = $716.67 → $717.
    const fifty = statusFor('roth-ira', buildProfile({ preferences: { age: 50 } }))
    expect(fifty.implementationSteps[1]).toBe('Set up automatic $717/month transfer')
  })

  it('quotes the age-banded 415(c) limit in the mega-backdoor steps', () => {
    const profileAt = (age: number) =>
      buildProfile({ employer401k: { afterTaxAvailable: true }, preferences: { age } })

    expect(statusFor('mega-backdoor', profileAt(40)).implementationSteps[2])
      .toBe(`Contribute up to annual limit ($${TOTAL_415C_BY_AGE.standard.toLocaleString('en-US')} total)`)
    expect(statusFor('mega-backdoor', profileAt(40)).implementationSteps[2])
      .toBe('Contribute up to annual limit ($72,000 total)')
    expect(statusFor('mega-backdoor', profileAt(50)).implementationSteps[2])
      .toBe('Contribute up to annual limit ($80,000 total)')
    expect(statusFor('mega-backdoor', profileAt(61)).implementationSteps[2])
      .toBe('Contribute up to annual limit ($83,250 total)')
  })

  it('explains why each step matters with step-specific copy', () => {
    const profile = buildProfile({ employer401k: { afterTaxAvailable: true } })

    expect(statusFor('hsa-max', profile).whyItMatters).toContain('triple tax-advantaged')
    expect(statusFor('additional-401k', profile).whyItMatters)
      .toContain('traditional deferrals reduce taxable income now')
    expect(statusFor('taxable-investment', profile).whyItMatters)
      .toContain('no contribution limits or withdrawal restrictions')
    expect(statusFor('mega-backdoor', profile).whyItMatters)
      .toContain('above the elective deferral limit')
  })
})

describe('calculateStepStatus — zero-value inputs', () => {
  /** Every user-visible string a status carries. */
  function stringsOf(status: StepStatus): string[] {
    return [
      status.recommendation,
      status.whyItMatters,
      status.implementationTime,
      ...status.implementationSteps,
    ]
  }

  /** Zeroed money, zeroed limits, zeroed targets, across the age bands. */
  function zeroInputProfiles(): PaycheckProfile[] {
    const profiles: PaycheckProfile[] = []
    const debtSets = [
      [],
      [createDebtData({ balance: 0, interestRate: 0, minimumPayment: 0 })],
      [createDebtData({ balance: 0, interestRate: 0.29, minimumPayment: 0 })],
    ]

    for (const available of [true, false]) {
      for (const afterTaxAvailable of [true, false]) {
        for (const eligible of [true, false]) {
          for (const age of [25, 50, 55, 60, 64]) {
            for (const debts of debtSets) {
              profiles.push(buildProfile({
                income: { gross: 0, monthlyGross: 0, grossPaycheck: 0, netPaycheck: 0, net: 0, monthlyNet: 0 },
                preferences: {
                  age,
                  necessaryExpenses: 0,
                  currentEmergencyFund: 0,
                  emergencyFundMonths: 0,
                  funMoney: { min: 0, max: 0, current: 0 },
                },
                employer401k: {
                  available,
                  afterTaxAvailable,
                  matchLimit: 0,
                  matchPercent: 0,
                  currentContribution: 0,
                },
                hsa: { eligible, coverageType: 'individual', currentContribution: 0, employerContribution: 0 },
                ira: { currentContributions: { traditional: 0, roth: 0 } },
                debts,
              }))
            }
          }
        }
      }
    }

    return profiles
  }

  /** One allocation per step, so the allocation-matched copy paths run too. */
  const allocationsForEveryStep: AllocationItem[] = [
    createAllocation({ id: 'a-em1', category: 'emergency_fund', account: 'Emergency Savings', priority: 2, amount: 0 }),
    createAllocation({ id: 'a-emf', category: 'emergency_fund', account: 'Emergency Savings', priority: 3, amount: 0 }),
    createAllocation({ id: 'a-match', category: 'employer_match', account: '401k Employer Match', amount: 0 }),
    createAllocation({ id: 'a-debt', category: 'debt_payoff', account: 'Credit Card Debt', amount: 0 }),
    createAllocation({ id: 'a-hsa', category: 'tax_advantaged', account: 'HSA Contribution', amount: 0 }),
    createAllocation({ id: 'a-roth', category: 'tax_advantaged', account: 'Roth IRA', amount: 0 }),
    createAllocation({ id: 'a-401k', category: 'tax_advantaged', account: 'Traditional 401k', amount: 0 }),
    createAllocation({ id: 'a-mega', category: 'tax_optimization', account: 'Mega Backdoor Roth', amount: 0 }),
    createAllocation({ id: 'a-taxable', category: 'investment', account: 'Taxable Investment', amount: 0 }),
  ]

  it('never emits NaN, Infinity, or an infinity glyph from any step', () => {
    const bad: string[] = []

    for (const profile of zeroInputProfiles()) {
      for (const allocations of [[], allocationsForEveryStep]) {
        for (const status of calculateStepStatus(FINANCIAL_STEPS, allocations, profile)) {
          for (const text of stringsOf(status)) {
            if (/NaN|Infinity|∞/.test(text)) {
              bad.push(`${status.id} (age ${profile.preferences.age}): "${text}"`)
            }
            if (!text.trim()) bad.push(`${status.id}: empty string`)
          }
        }
      }
    }

    expect(bad).toEqual([])
  })

  it('keeps every derived figure finite for zeroed inputs', () => {
    const bad: string[] = []

    for (const profile of zeroInputProfiles()) {
      for (const status of calculateStepStatus(FINANCIAL_STEPS, [], profile)) {
        const { monthly, annual } = status.potentialSavings
        if (!Number.isFinite(monthly) || !Number.isFinite(annual)) {
          bad.push(`${status.id}: ${monthly} / ${annual}`)
        }
        if (monthly < 0 || annual < 0) bad.push(`${status.id}: negative savings`)
      }
    }

    expect(bad).toEqual([])
  })
})

describe('calculateStepStatus — unrecognized steps', () => {
  it('falls back to generic guidance for a step id it does not model', () => {
    const customStep = { ...FINANCIAL_STEPS[0], id: 'sabbatical-fund', name: 'Sabbatical Fund' }
    const allocation = createAllocation({ category: 'investment', account: 'Sabbatical Savings' })

    const [status] = calculateStepStatus([customStep], [allocation], buildProfile())

    expect(status.allocation).toBeUndefined()
    expect(status.isComplete).toBe(false)
    expect(status.isUrgent).toBe(false)
    expect(status.isNotApplicable).toBe(false)
    expect(status.isRecommendation).toBe(true)
    expect(status.urgencyLevel).toBe('important')
    expect(status.recommendation).toBe('Available')
    expect(status.potentialSavings).toEqual({ monthly: 0, annual: 0 })
    expect(status.implementationTime).toBe('Varies')
    expect(status.implementationSteps).toEqual(['Contact your financial advisor for guidance'])
    expect(status.whyItMatters).toBe('Adds to long-term savings capacity.')
  })
})
