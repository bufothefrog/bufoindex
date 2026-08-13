/**
 * Paycheck Allocator — Pipeline Invariant Sweep
 *
 * A grid sweep across the whole paycheck-allocator calculation pipeline
 * (core -> optimization -> analysis -> projections -> step status), asserting
 * invariants that must hold for EVERY profile rather than hand-checked numbers
 * for a handful of profiles.
 *
 * The grid varies: pay frequency, paycheck size (including 0, tiny, huge and
 * net > gross), bonus on/off across every bonus frequency, employer 401k
 * (unavailable / 0% match / partial / full / above 100% / after-tax), HSA
 * eligibility and coverage tier, IRA presence, debts (none / low-rate /
 * exactly 7% / 22% / zero balance / negative amounts / extra payments),
 * emergency fund (0 / partial / exactly at target / above the 3-month cash cap
 * / far above), age across the catch-up boundaries (25/49/50/55/60/64), and
 * preference edge cases (necessaryExpenses 0 and above net income, funMoney
 * min > max, taxable account toggle, >3-month target, cash APY above the
 * assumed market return).
 *
 * Every invariant below holds for every profile in the grid. Several are
 * regression guards for defects the sweep originally found in the calculation
 * layer; those keep the profile that first triggered them, because a profile
 * that once broke an invariant is the cheapest fixture for noticing it break
 * again.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateOptimalAllocation,
  updateLegacyIncomeFields,
  paycheckToMonthly,
  calculateCompoundGrowth,
  formatCurrency,
  formatPercent,
} from '@/lib/calculations/core'
import { ALLOCATION_PRIORITY } from '@/lib/calculations/optimization'
import { calculateStepStatus } from '@/lib/utils/stepStatusUtils'
import { FINANCIAL_STEPS, StepStatus } from '@/lib/constants/financialSteps'
import { CONTRIBUTION_LIMITS_2026, TOTAL_415C_BY_AGE } from '@/lib/constants/irs-2026'
import type { AllocationResult, PaycheckProfile, DebtData } from '@/lib/types'
import {
  createPaycheckProfile,
  createIncomeData,
  createTaxData,
  createBenefitsData,
  createEmployerBenefits,
  createHSABenefits,
  createIRAData,
  createUserPreferences,
  createDebtData,
} from '@/test/factories/test-data-factory'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const EPS = 1e-6

/** Deep-walk every number in a result tree, skipping React icon components. */
function walkNumbers(
  node: unknown,
  path: string,
  visit: (path: string, value: number) => void
): void {
  if (typeof node === 'number') {
    visit(path, node)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkNumbers(child, `${path}[${i}]`, visit))
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (key === 'icon') continue // lucide component, not data
      walkNumbers(child, `${path}.${key}`, visit)
    }
  }
}

/** Deep-walk every string in a result tree, skipping React icon components. */
function walkStrings(
  node: unknown,
  path: string,
  visit: (path: string, value: string) => void
): void {
  if (typeof node === 'string') {
    visit(path, node)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkStrings(child, `${path}[${i}]`, visit))
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (key === 'icon') continue
      walkStrings(child, `${path}.${key}`, visit)
    }
  }
}

/** Substrings that should never reach a user-visible string. */
const BAD_STRING_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'NaN', re: /NaN/ },
  { label: 'undefined', re: /undefined/ },
  { label: 'Infinity', re: /Infinity/ },
  { label: 'Intl infinity glyph', re: /∞/ },
  { label: 'negative-zero currency', re: /-\$0(?!\d)/ },
  { label: 'double sign +-', re: /\+-/ },
  { label: 'double sign -$-', re: /-\$-/ },
]

// ─────────────────────────────────────────────────────────────────────────────
// IRS limits, recomputed here from lib/constants/irs-2026 so a stale hardcoded
// figure re-appearing anywhere in the pipeline shows up as a failure.
// ─────────────────────────────────────────────────────────────────────────────

const iraLimitFor = (age: number): number =>
  CONTRIBUTION_LIMITS_2026.ira + (age >= 50 ? CONTRIBUTION_LIMITS_2026.catchUp.ira : 0)

const hsaLimitFor = (coverageType: 'individual' | 'family', age: number): number =>
  (coverageType === 'family'
    ? CONTRIBUTION_LIMITS_2026.hsa.family
    : CONTRIBUTION_LIMITS_2026.hsa.individual) +
  (age >= 55 ? CONTRIBUTION_LIMITS_2026.catchUp.hsa : 0)

/** IRC 402(g) elective-deferral limit: 50+ catch-up, SECURE 2.0 super catch-up at 60-63 only. */
const elective401kLimitFor = (age: number): number =>
  CONTRIBUTION_LIMITS_2026.traditional401k +
  (age >= 60 && age <= 63
    ? CONTRIBUTION_LIMITS_2026.catchUp.superCatchUp401k
    : age >= 50
      ? CONTRIBUTION_LIMITS_2026.catchUp['401k']
      : 0)

/** IRC 415(c) total annual-additions limit for the age band. */
const total415cFor = (age: number): number => {
  if (age >= 60 && age <= 63) return TOTAL_415C_BY_AGE.superCatchUp60to63
  if (age >= 50) return TOTAL_415C_BY_AGE.catchUp50
  return TOTAL_415C_BY_AGE.standard
}

/**
 * Priority each allocation must carry, from the single table in
 * lib/calculations/optimization.ts. Sorting a plan by `priority` has to
 * reproduce the order core.ts applied the steps in.
 */
const EXPECTED_PRIORITY: Record<string, number> = {
  '1-month-emergency': ALLOCATION_PRIORITY.oneMonthEmergency,
  'employer-match': ALLOCATION_PRIORITY.employerMatch,
  'high-interest-debt': ALLOCATION_PRIORITY.highInterestDebt,
  'emergency-fund-completion': ALLOCATION_PRIORITY.emergencyFundCompletion,
  'hsa-contribution': ALLOCATION_PRIORITY.hsa,
  'roth-ira': ALLOCATION_PRIORITY.rothIRA,
  'additional-401k': ALLOCATION_PRIORITY.additional401k,
  'mega-backdoor-roth': ALLOCATION_PRIORITY.megaBackdoorRoth,
  'taxable-investment': ALLOCATION_PRIORITY.taxableInvestment,
}

/** Step catalogue id -> the allocation id that step is meant to pick up. */
const STEP_ALLOCATION_PAIRS: Array<[string, string]> = [
  ['employer-match', 'employer-match'],
  ['emergency-1month', '1-month-emergency'],
  ['emergency-full', 'emergency-fund-completion'],
  ['high-interest-debt', 'high-interest-debt'],
  ['hsa-max', 'hsa-contribution'],
  ['roth-ira', 'roth-ira'],
  ['additional-401k', 'additional-401k'],
  ['mega-backdoor', 'mega-backdoor-roth'],
  ['taxable-investment', 'taxable-investment'],
]

/** Long-run return the analysis and projection layers assume for invested dollars. */
const ASSUMED_MARKET_RETURN = 0.07

/** Months of expenses the analysis layer treats as the top of the cash range. */
const CASH_MONTHS_CAP = 3

// ─────────────────────────────────────────────────────────────────────────────
// Grid dimensions
// ─────────────────────────────────────────────────────────────────────────────

type Frequency = PaycheckProfile['income']['frequency']

const FREQUENCIES: Frequency[] = ['weekly', 'bi-weekly', 'semi-monthly', 'monthly']

const PAYCHECKS = [
  { label: 'zero-paycheck', grossPaycheck: 0, netPaycheck: 0 },
  { label: 'tiny-paycheck', grossPaycheck: 60, netPaycheck: 45 },
  { label: 'typical-paycheck', grossPaycheck: 3000, netPaycheck: 2250 },
  { label: 'huge-paycheck', grossPaycheck: 40000, netPaycheck: 26000 },
  { label: 'net-above-gross', grossPaycheck: 2000, netPaycheck: 3000 },
]

const BONUSES = [
  { label: 'no-bonus', regularBonus: false, bonusAmount: 0, bonusFrequency: 'annual' as const },
  { label: 'bonus-quarterly', regularBonus: true, bonusAmount: 4000, bonusFrequency: 'quarterly' as const },
  { label: 'bonus-annual', regularBonus: true, bonusAmount: 15000, bonusFrequency: 'annual' as const },
  { label: 'bonus-irregular', regularBonus: true, bonusAmount: 9000, bonusFrequency: 'irregular' as const },
]

const EMPLOYERS = [
  {
    label: '401k-unavailable',
    build: () =>
      createEmployerBenefits({
        available: false,
        matchPercent: 0,
        matchLimit: 0,
        currentContribution: 0,
        traditionalContribution: 0,
        currentYTD: 0,
      }),
  },
  {
    label: '401k-zero-percent-match',
    build: () =>
      createEmployerBenefits({ matchPercent: 0, matchLimit: 0.06, currentContribution: 0, traditionalContribution: 0 }),
  },
  {
    label: '401k-partial-match-captured',
    build: () =>
      createEmployerBenefits({ matchPercent: 0.5, matchLimit: 0.06, currentContribution: 0.03, traditionalContribution: 0.03 }),
  },
  {
    label: '401k-no-match-captured',
    build: () =>
      createEmployerBenefits({ matchPercent: 1.0, matchLimit: 0.06, currentContribution: 0, traditionalContribution: 0 }),
  },
  {
    label: '401k-full-match-captured',
    build: () =>
      createEmployerBenefits({ matchPercent: 0.5, matchLimit: 0.06, currentContribution: 0.06, traditionalContribution: 0.06 }),
  },
  {
    label: '401k-contribution-above-100pct',
    build: () =>
      createEmployerBenefits({ matchPercent: 0.5, matchLimit: 0.06, currentContribution: 1.5, traditionalContribution: 1.5 }),
  },
  {
    label: '401k-after-tax-mega-backdoor',
    build: () =>
      createEmployerBenefits({ afterTaxAvailable: true, currentContribution: 0.1, traditionalContribution: 0.1 }),
  },
]

const HSAS = [
  {
    label: 'hsa-ineligible',
    build: () => createHSABenefits({ eligible: false, employerContribution: 0, currentContribution: 0, currentYTD: 0 }),
  },
  { label: 'hsa-individual', build: () => createHSABenefits({ eligible: true, coverageType: 'individual' as const }) },
  { label: 'hsa-family', build: () => createHSABenefits({ eligible: true, coverageType: 'family' as const }) },
]

const IRAS = [
  {
    label: 'ira-absent',
    build: () =>
      createIRAData({
        hasIRA: false,
        accountTypes: { traditional: false, roth: false },
        currentContributions: { traditional: 0, roth: 0 },
        currentBalances: { traditional: 0, roth: 0 },
      }),
  },
  { label: 'ira-present', build: () => createIRAData() },
]

const DEBT_SETS: Array<{ label: string; build: () => DebtData[] }> = [
  { label: 'debt-none', build: () => [] },
  {
    label: 'debt-low-interest',
    build: () => [createDebtData({ id: 'd-low', name: 'Car Loan', balance: 12000, interestRate: 0.04, minimumPayment: 300 })],
  },
  {
    label: 'debt-exactly-7pct',
    build: () => [createDebtData({ id: 'd-7', name: 'Student Loan', balance: 20000, interestRate: 0.07, minimumPayment: 250 })],
  },
  {
    label: 'debt-22pct',
    build: () => [createDebtData({ id: 'd-22', name: 'Credit Card', balance: 9000, interestRate: 0.22, minimumPayment: 200 })],
  },
  {
    label: 'debt-zero-balance-with-rate',
    build: () => [createDebtData({ id: 'd-zb', name: 'Paid Card', balance: 0, interestRate: 0.22, minimumPayment: 0 })],
  },
  {
    label: 'debt-negative-amounts',
    build: () => [
      createDebtData({ id: 'd-neg', name: 'Bad Entry', balance: -5000, interestRate: -0.05, minimumPayment: -100, extraPayment: -50 }),
    ],
  },
  {
    label: 'debt-low-interest-with-extra',
    build: () => [
      createDebtData({
        id: 'd-extra',
        name: 'Mortgage',
        balance: 300000,
        interestRate: 0.045,
        minimumPayment: 1800,
        extraPayment: 400,
        taxDeductible: true,
      }),
    ],
  },
]

const EMERGENCY_FUNDS = [
  { label: 'ef-zero', currentEmergencyFund: 0 },
  { label: 'ef-partial', currentEmergencyFund: 1500 },
  { label: 'ef-exactly-target', currentEmergencyFund: 9000 }, // 3 x 3000 necessary expenses
  // Between the 3-month cash cap (9000) and a 6-month target (18000), so the
  // "large emergency-fund target" analysis has cash genuinely held above the cap
  // to price.
  { label: 'ef-above-cap-below-target', currentEmergencyFund: 15000 },
  { label: 'ef-far-above-target', currentEmergencyFund: 60000 },
]

const AGES = [25, 49, 50, 55, 60, 64]

/** APY the emergency fund earns; 7%+ meets the assumed market return. */
const DEFAULT_APY = 0.045

const PREF_VARIANTS = [
  { label: 'prefs-default', necessaryExpenses: 3000, funMoney: { min: 200, max: 500, current: 350 }, hasTaxableAccount: false, emergencyFundMonths: 3, emergencyFundAPY: DEFAULT_APY },
  { label: 'prefs-zero-necessary-expenses', necessaryExpenses: 0, funMoney: { min: 200, max: 500, current: 350 }, hasTaxableAccount: false, emergencyFundMonths: 3, emergencyFundAPY: DEFAULT_APY },
  { label: 'prefs-necessary-above-net-income', necessaryExpenses: 20000, funMoney: { min: 200, max: 500, current: 350 }, hasTaxableAccount: false, emergencyFundMonths: 3, emergencyFundAPY: DEFAULT_APY },
  { label: 'prefs-funmoney-min-above-max', necessaryExpenses: 3000, funMoney: { min: 800, max: 200, current: 400 }, hasTaxableAccount: false, emergencyFundMonths: 3, emergencyFundAPY: DEFAULT_APY },
  { label: 'prefs-taxable-account-on', necessaryExpenses: 3000, funMoney: { min: 200, max: 500, current: 350 }, hasTaxableAccount: true, emergencyFundMonths: 3, emergencyFundAPY: DEFAULT_APY },
  { label: 'prefs-six-month-target', necessaryExpenses: 3000, funMoney: { min: 200, max: 500, current: 350 }, hasTaxableAccount: false, emergencyFundMonths: 6, emergencyFundAPY: DEFAULT_APY },
  // Cash yielding above the 7% the analysis assumes for invested dollars. The
  // APY input accepts up to 10% and does not clamp, so this is reachable.
  { label: 'prefs-apy-above-market', necessaryExpenses: 3000, funMoney: { min: 200, max: 500, current: 350 }, hasTaxableAccount: false, emergencyFundMonths: 3, emergencyFundAPY: 0.09 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Grid construction
// ─────────────────────────────────────────────────────────────────────────────

interface Selection {
  frequency: Frequency
  paycheck: (typeof PAYCHECKS)[number]
  bonus: (typeof BONUSES)[number]
  employer: (typeof EMPLOYERS)[number]
  hsa: (typeof HSAS)[number]
  ira: (typeof IRAS)[number]
  debts: (typeof DEBT_SETS)[number]
  emergencyFund: (typeof EMERGENCY_FUNDS)[number]
  age: number
  prefs: (typeof PREF_VARIANTS)[number]
}

interface Case {
  label: string
  selection: Selection
  profile: PaycheckProfile
  result: AllocationResult
  steps: StepStatus[]
  /** Profile as the UI store holds it (legacy monthly fields refreshed). */
  normalized: PaycheckProfile
}

function buildProfile(s: Selection): PaycheckProfile {
  return createPaycheckProfile({
    income: createIncomeData({
      grossPaycheck: s.paycheck.grossPaycheck,
      netPaycheck: s.paycheck.netPaycheck,
      frequency: s.frequency,
      regularBonus: s.bonus.regularBonus,
      bonusAmount: s.bonus.bonusAmount,
      bonusFrequency: s.bonus.bonusFrequency,
    }),
    taxes: createTaxData(),
    benefits: createBenefitsData({
      employer401k: s.employer.build(),
      hsa: s.hsa.build(),
      ira: s.ira.build(),
      other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 25 },
    }),
    debts: s.debts.build(),
    preferences: createUserPreferences({
      age: s.age,
      currentEmergencyFund: s.emergencyFund.currentEmergencyFund,
      emergencyFundMonths: s.prefs.emergencyFundMonths,
      emergencyFundAPY: s.prefs.emergencyFundAPY,
      necessaryExpenses: s.prefs.necessaryExpenses,
      funMoney: { ...s.prefs.funMoney },
      hasTaxableAccount: s.prefs.hasTaxableAccount,
    }),
  })
}

function labelOf(s: Selection): string {
  return [
    s.frequency,
    s.paycheck.label,
    s.bonus.label,
    s.employer.label,
    s.hsa.label,
    s.ira.label,
    s.debts.label,
    s.emergencyFund.label,
    `age-${s.age}`,
    s.prefs.label,
  ].join(' | ')
}

function runCase(s: Selection): Case {
  const profile = buildProfile(s)
  const result = calculateOptimalAllocation(profile)
  // The store keeps the profile's legacy monthly fields refreshed, so step
  // status derivation in the UI sees the normalized profile.
  const normalized = { ...profile, income: updateLegacyIncomeFields(profile.income) }
  const steps = calculateStepStatus(FINANCIAL_STEPS, result.allocations, normalized)
  return { label: labelOf(s), selection: s, profile, result, steps, normalized }
}

/**
 * Two complementary sweeps. Sweep A pivots on money / employer / debt shape
 * while cycling the remaining dimensions; sweep B pivots on age / benefits /
 * emergency fund / preferences while cycling the money shape. Together every
 * listed variant of every dimension is exercised against many contexts.
 */
function buildGrid(): Case[] {
  const cases: Case[] = []

  let n = 0
  for (const frequency of FREQUENCIES) {
    for (const paycheck of PAYCHECKS) {
      for (const employer of EMPLOYERS) {
        for (const debts of DEBT_SETS) {
          cases.push(
            runCase({
              frequency,
              paycheck,
              bonus: BONUSES[n % BONUSES.length],
              employer,
              hsa: HSAS[n % HSAS.length],
              ira: IRAS[n % IRAS.length],
              debts,
              emergencyFund: EMERGENCY_FUNDS[n % EMERGENCY_FUNDS.length],
              age: AGES[n % AGES.length],
              prefs: PREF_VARIANTS[n % PREF_VARIANTS.length],
            })
          )
          n++
        }
      }
    }
  }

  let m = 0
  for (const age of AGES) {
    for (const hsa of HSAS) {
      for (const ira of IRAS) {
        for (const emergencyFund of EMERGENCY_FUNDS) {
          for (const prefs of PREF_VARIANTS) {
            cases.push(
              runCase({
                frequency: FREQUENCIES[m % FREQUENCIES.length],
                paycheck: PAYCHECKS[m % PAYCHECKS.length],
                bonus: BONUSES[m % BONUSES.length],
                employer: EMPLOYERS[m % EMPLOYERS.length],
                hsa,
                ira,
                debts: DEBT_SETS[m % DEBT_SETS.length],
                emergencyFund,
                age,
                prefs,
              })
            )
            m++
          }
        }
      }
    }
  }

  return cases
}

const GRID = buildGrid()

/** Collect violation descriptions, capped so failure output stays readable. */
function collect(fn: (c: Case, report: (msg: string) => void) => void, limit = 6): string[] {
  const out: string[] = []
  for (const c of GRID) {
    fn(c, (msg) => {
      if (out.length < limit) out.push(`${c.label} :: ${msg}`)
    })
    if (out.length >= limit) break
  }
  return out
}

/** Annualize a per-paycheck figure at the case's own pay frequency. */
function annualize(c: Case, perPaycheck: number): number {
  return paycheckToMonthly(perPaycheck, c.profile.income.frequency) * 12
}

/** Annualized amount of one allocation, or 0 when the plan has no such entry. */
function allocatedAnnual(c: Case, id: string): number {
  const allocation = c.result.allocations.find((a) => a.id === id)
  return allocation ? annualize(c, allocation.amount) : 0
}

/** Every string a skipped-item card can put in front of the reader. */
function skippedItemCopy(item: { reason: string; alternative: string; education?: string }): string {
  return [item.reason, item.alternative, item.education ?? ''].join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('grid coverage', () => {
  it('sweeps a large, diverse set of profiles', () => {
    expect(GRID.length).toBeGreaterThan(1000)
  })

  it('exercises every variant of every dimension', () => {
    const seen = (pick: (c: Case) => string) => new Set(GRID.map(pick)).size
    expect(seen((c) => c.selection.frequency)).toBe(FREQUENCIES.length)
    expect(seen((c) => c.selection.paycheck.label)).toBe(PAYCHECKS.length)
    expect(seen((c) => c.selection.bonus.label)).toBe(BONUSES.length)
    expect(seen((c) => c.selection.employer.label)).toBe(EMPLOYERS.length)
    expect(seen((c) => c.selection.hsa.label)).toBe(HSAS.length)
    expect(seen((c) => c.selection.ira.label)).toBe(IRAS.length)
    expect(seen((c) => c.selection.debts.label)).toBe(DEBT_SETS.length)
    expect(seen((c) => c.selection.emergencyFund.label)).toBe(EMERGENCY_FUNDS.length)
    expect(seen((c) => String(c.selection.age))).toBe(AGES.length)
    expect(seen((c) => c.selection.prefs.label)).toBe(PREF_VARIANTS.length)
  })

  it('produces allocations for a substantial share of profiles', () => {
    expect(GRID.filter((c) => c.result.allocations.length > 0).length).toBeGreaterThan(500)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Numeric hygiene
// ─────────────────────────────────────────────────────────────────────────────

describe('numeric hygiene across the result tree', () => {
  it('contains no NaN or Infinity anywhere in the allocation result', () => {
    const bad = collect((c, report) => {
      walkNumbers(c.result, 'result', (path, value) => {
        if (!Number.isFinite(value)) report(`${path} = ${value}`)
      })
    })
    expect(bad).toEqual([])
  })

  it('contains no negative zero anywhere in the allocation result', () => {
    const bad = collect((c, report) => {
      walkNumbers(c.result, 'result', (path, value) => {
        if (Object.is(value, -0)) report(`${path} = -0`)
      })
    })
    expect(bad).toEqual([])
  })

  it('contains no NaN or Infinity anywhere in derived step statuses', () => {
    const bad = collect((c, report) => {
      walkNumbers(c.steps, 'steps', (path, value) => {
        if (!Number.isFinite(value)) report(`${path} = ${value}`)
      })
    })
    expect(bad).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Allocation accounting
// ─────────────────────────────────────────────────────────────────────────────

describe('allocation accounting', () => {
  it('never allocates a negative or zero amount', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (!(a.amount > 0)) report(`allocation ${a.id} amount = ${a.amount}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never allocates more than the net paycheck in total', () => {
    const bad = collect((c, report) => {
      const total = c.result.allocations.reduce((s, a) => s + a.amount, 0)
      const net = c.profile.income.netPaycheck
      if (total > net + EPS) report(`sum(allocations) = ${total} > netPaycheck ${net}`)
    })
    expect(bad).toEqual([])
  })

  it('never lets a single allocation exceed the net paycheck', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (a.amount > c.profile.income.netPaycheck + EPS) {
          report(`allocation ${a.id} = ${a.amount} > netPaycheck ${c.profile.income.netPaycheck}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps remainingAmount non-negative', () => {
    const bad = collect((c, report) => {
      if (c.result.remainingAmount < -EPS) report(`remainingAmount = ${c.result.remainingAmount}`)
    })
    expect(bad).toEqual([])
  })

  /**
   * The pool being divided is `max(0, net - necessaryExpenses - funMoneyMin)`
   * per paycheck (core.ts:109), not the whole net paycheck. Allocations plus
   * the remainder must reconstruct that pool exactly.
   */
  it('satisfies allocations + remainder === available pool', () => {
    const bad = collect((c, report) => {
      const ctx = c.result.paycheckContext
      if (!ctx) {
        report('paycheckContext missing')
        return
      }
      const pool = Math.max(0, ctx.netPaycheck - ctx.necessaryExpensesPerPaycheck - ctx.funMoneyPerPaycheck)
      const total = c.result.allocations.reduce((s, a) => s + a.amount, 0)
      if (Math.abs(pool - (total + c.result.remainingAmount)) > 1e-6) {
        report(`pool ${pool} !== sum ${total} + remaining ${c.result.remainingAmount}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('reports paycheckContext.availablePerPaycheck equal to remainingAmount', () => {
    const bad = collect((c, report) => {
      const ctx = c.result.paycheckContext
      if (ctx && Math.abs(ctx.availablePerPaycheck - c.result.remainingAmount) > EPS) {
        report(`availablePerPaycheck ${ctx.availablePerPaycheck} !== remainingAmount ${c.result.remainingAmount}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps every allocation percentage within [0, 1]', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (!(a.percentage >= 0 && a.percentage <= 1 + EPS)) report(`allocation ${a.id} percentage = ${a.percentage}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps every allocation percentage consistent with amount / netPaycheck', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        const expected = a.amount / c.profile.income.netPaycheck
        if (Math.abs(expected - a.percentage) > 1e-9) {
          report(`allocation ${a.id} percentage ${a.percentage} !== ${expected}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps monthlyEquivalent and annualEquivalent consistent with the per-paycheck amount', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        const expectedMonthly = paycheckToMonthly(a.amount, c.profile.income.frequency)
        if (Math.abs((a.monthlyEquivalent ?? 0) - expectedMonthly) > 1e-9) {
          report(`allocation ${a.id} monthlyEquivalent ${a.monthlyEquivalent} !== ${expectedMonthly}`)
        }
        if (Math.abs((a.annualEquivalent ?? 0) - (a.monthlyEquivalent ?? 0) * 12) > 1e-6) {
          report(`allocation ${a.id} annualEquivalent ${a.annualEquivalent} !== 12x monthlyEquivalent`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('never emits duplicate allocation ids', () => {
    const bad = collect((c, report) => {
      const ids = c.result.allocations.map((a) => a.id)
      if (new Set(ids).size !== ids.length) report(`duplicate allocation ids: ${ids.join(', ')}`)
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: `priority` has to reproduce the order the steps were
   * actually applied in, and every value has to be distinct — consumers that
   * sort by priority (`calculateAccountPrioritizationScore` in projections.ts)
   * resolve ties by array position, so a tie silently grades a different plan
   * than the one rendered.
   *
   * Trigger profile: `bi-weekly | huge-paycheck | 401k-zero-percent-match |
   * hsa-family | debt-low-interest | ef-exactly-target | age-25 |
   * prefs-six-month-target`, which once emitted `1 -> 4 -> 3 -> 6 -> 7` because
   * emergency-fund completion claimed 4 while the HSA step, which core.ts runs
   * after it, claimed 2 or 3; the 1-month emergency fund and the employer match
   * both claimed 1.
   */
  it('emits allocations in strictly increasing, distinct priority order', () => {
    const bad = collect((c, report) => {
      let previous = Number.NEGATIVE_INFINITY
      for (const a of c.result.allocations) {
        if (a.priority !== EXPECTED_PRIORITY[a.id]) {
          report(`allocation ${a.id} priority ${a.priority} !== ${EXPECTED_PRIORITY[a.id]}`)
        }
        if (!(a.priority > previous)) {
          report(`allocation ${a.id} priority ${a.priority} does not follow ${previous}`)
        }
        previous = a.priority
      }
    })
    expect(bad).toEqual([])
  })

  it('assigns a distinct priority to every allocation kind', () => {
    const priorities = Object.values(ALLOCATION_PRIORITY)
    expect(new Set(priorities).size).toBe(priorities.length)
    // Sorting a plan by priority must reproduce the emitted order for every profile.
    const bad = collect((c, report) => {
      const emitted = c.result.allocations.map((a) => a.id)
      const sorted = [...c.result.allocations].sort((a, b) => a.priority - b.priority).map((a) => a.id)
      if (emitted.join() !== sorted.join()) report(`emitted ${emitted.join(' -> ')} but priority order ${sorted.join(' -> ')}`)
    })
    expect(bad).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// User-visible strings
// ─────────────────────────────────────────────────────────────────────────────

describe('user-visible strings', () => {
  it('never renders NaN / undefined / Infinity / double signs', () => {
    const bad = collect((c, report) => {
      walkStrings(c.result, 'result', (path, value) => {
        for (const pattern of BAD_STRING_PATTERNS) {
          if (pattern.re.test(value)) report(`${path} contains ${pattern.label}: "${value}"`)
        }
      })
    })
    expect(bad).toEqual([])
  })

  it('never renders NaN / undefined / Infinity / double signs in a step status', () => {
    const bad = collect((c, report) => {
      walkStrings(c.steps, 'steps', (path, value) => {
        for (const pattern of BAD_STRING_PATTERNS) {
          if (pattern.re.test(value)) report(`${path} contains ${pattern.label}: "${value}"`)
        }
      })
    })
    expect(bad).toEqual([])
  })

  it('never emits an empty reasoning or implementation string', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (!a.reasoning.trim()) report(`allocation ${a.id} has empty reasoning`)
        if (!a.implementation.trim()) report(`allocation ${a.id} has empty implementation`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never emits an empty skipped-item reason, alternative, or education string', () => {
    const bad = collect((c, report) => {
      for (const s of c.result.skippedItems) {
        if (!s.item.trim()) report(`skipped ${s.id} has empty item`)
        if (!s.reason.trim()) report(`skipped ${s.id} has empty reason`)
        if (!s.alternative.trim()) report(`skipped ${s.id} has empty alternative`)
        if (s.education !== undefined && !s.education.trim()) report(`skipped ${s.id} has empty education`)
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: a months-of-coverage ratio quoted to the reader has to
   * be a real number. With no expense base there is no ratio at all, and the
   * copy has to say so instead of dividing by zero.
   *
   * Trigger profile: any profile with `necessaryExpenses = 0` and a non-zero
   * emergency fund, e.g. `weekly | zero-paycheck | 401k-unavailable | ef-partial
   * | prefs-zero-necessary-expenses`, which rendered
   * "You have $1,500 (Infinity months) but target 3 months".
   */
  it('never renders "Infinity months" when necessaryExpenses is 0', () => {
    const zeroExpense = GRID.filter((c) => c.profile.preferences.necessaryExpenses === 0)
    expect(zeroExpense.length).toBeGreaterThan(0)
    // The emergency-fund analysis is the code path that quotes the ratio.
    expect(
      zeroExpense.filter((c) => c.result.skippedItems.some((s) => s.id === 'excessive-emergency-fund')).length
    ).toBeGreaterThan(0)

    const bad: string[] = []
    for (const c of zeroExpense) {
      walkStrings(c.result, 'result', (path, value) => {
        for (const match of value.matchAll(/(\S+)\s+months\b/g)) {
          const token = match[1].replace(/[$,()]/g, '')
          // Only tokens meant to be a quantity: "3 months" is fine, "so months
          // of coverage cannot be computed" is prose, "Infinity months" is not.
          const isQuantity = /^-?[\d.]/.test(token) || /^(?:-?Infinity|NaN|∞)$/.test(token)
          if (isQuantity && !Number.isFinite(Number(token)) && bad.length < 6) {
            bad.push(`${c.label} :: ${path} quotes "${match[0]}"`)
          }
        }
      })
    }
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: a percent-of-salary figure needs a salary. With gross
   * pay still 0 — the state of the store before the first income edit — the copy
   * has to fall back to dollars.
   *
   * Trigger profile: any profile with `grossPaycheck = 0` and a 401k marked
   * available, e.g. `weekly | zero-paycheck | 401k-zero-percent-match |
   * ira-present | ef-far-above-target | age-49`, whose `additional-401k` step
   * read "Additional $1,917 (∞%) contributions needed for max" and "Increase
   * contribution by ∞% more".
   */
  it('never renders an infinity glyph in the additional-401k step when gross pay is 0', () => {
    const zeroGross = GRID.filter(
      (c) => c.normalized.income.gross === 0 && c.profile.benefits.employer401k.available
    )
    expect(zeroGross.length).toBeGreaterThan(0)

    const bad: string[] = []
    for (const c of zeroGross) {
      const step = c.steps.find((s) => s.id === 'additional-401k')
      if (!step) continue
      for (const copy of [step.recommendation, ...step.implementationSteps]) {
        // No salary means no percentage to quote — and no divide-by-zero glyph.
        if (/%/.test(copy) && bad.length < 6) bad.push(`${c.label} :: "${copy}" quotes a percentage`)
        for (const pattern of BAD_STRING_PATTERNS) {
          if (pattern.re.test(copy) && bad.length < 6) bad.push(`${c.label} :: "${copy}" contains ${pattern.label}`)
        }
      }
    }
    expect(bad).toEqual([])

    // The dollar figure still stands on its own: the full elective-deferral
    // limit is outstanding when nothing has been deferred.
    const sample = zeroGross[0]
    const sampleStep = sample.steps.find((s) => s.id === 'additional-401k')!
    const monthlyToLimit = elective401kLimitFor(sample.profile.preferences.age) / 12
    expect(sampleStep.recommendation).toContain(formatCurrency(monthlyToLimit))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Employer match
// ─────────────────────────────────────────────────────────────────────────────

describe('employer match', () => {
  it('never allocates an employer-match contribution when no 401k is available', () => {
    const bad = collect((c, report) => {
      if (c.profile.benefits.employer401k.available) return
      const match = c.result.allocations.find((a) => a.category === 'employer_match')
      if (match) report(`employer_match allocation ${match.amount} with no 401k available`)
    })
    expect(bad).toEqual([])
  })

  /**
   * Annualized (existing + recommended) employee deferral must not exceed the
   * salary percentage the match actually covers, or the "capture the match"
   * claim would be recommending contributions the match never touches.
   */
  it('never recommends more employee deferral than the match limit covers', () => {
    const bad = collect((c, report) => {
      const match = c.result.allocations.find((a) => a.id === 'employer-match')
      if (!match) return
      const b = c.normalized.benefits.employer401k
      const annualSalary = c.normalized.income.gross * 12
      const recommendedPerYear = paycheckToMonthly(match.amount, c.profile.income.frequency) * 12
      const totalDeferral = annualSalary * b.currentContribution + recommendedPerYear
      const cap = annualSalary * b.matchLimit
      if (totalDeferral > cap + 1e-6) report(`deferral ${totalDeferral} exceeds match-covered cap ${cap}`)
    })
    expect(bad).toEqual([])
  })

  it('keeps the missed-employer-match item non-negative, 1/12-consistent, and equal to matchPercent x uncaptured deferral', () => {
    const bad = collect((c, report) => {
      const missed = c.result.skippedItems.find((s) => s.id === 'missed-employer-match')
      if (!missed) return
      if (missed.opportunityCost.annual < 0) report(`missed match annual = ${missed.opportunityCost.annual}`)
      if (Math.abs(missed.opportunityCost.monthly * 12 - missed.opportunityCost.annual) > 1e-6) {
        report('missed match monthly*12 !== annual')
      }
      const b = c.normalized.benefits.employer401k
      const annualSalary = c.normalized.income.gross * 12
      const expected = (annualSalary * b.matchLimit - annualSalary * b.currentContribution) * b.matchPercent
      if (Math.abs(expected - missed.opportunityCost.annual) > 1e-6) {
        report(`missed match ${missed.opportunityCost.annual} !== ${expected}`)
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: with a 0% match rate there is no match to capture, so
   * the step must recommend nothing rather than a deferral the employer pays
   * nothing against. `analyzeMissedBenefits` has always treated a 0% rate as "no
   * missed match"; the allocator has to agree.
   *
   * Trigger profile: `weekly | typical-paycheck | 401k-zero-percent-match |
   * hsa-individual | ef-exactly-target | age-60 | prefs-taxable-account-on`
   * (matchPercent 0, matchLimit 6%), which allocated $180.00 per paycheck to
   * "401k Employer Match", reasoning "Employer matches 0% of contributions up to
   * 6% of salary" — ranked ahead of 22% credit-card debt in the same run.
   */
  it('does not allocate to "401k Employer Match" when the match rate is 0%', () => {
    const zeroMatch = GRID.filter((c) => {
      const b = c.profile.benefits.employer401k
      return b.available && (b.matchPercent <= 0 || b.matchLimit <= 0)
    })
    expect(zeroMatch.length).toBeGreaterThan(0)

    const bad: string[] = []
    for (const c of zeroMatch) {
      for (const a of c.result.allocations) {
        if ((a.category === 'employer_match' || a.id === 'employer-match') && bad.length < 6) {
          bad.push(`${c.label} :: allocates ${a.amount} to ${a.account} at a ${formatPercent(c.profile.benefits.employer401k.matchPercent)} match rate`)
        }
      }
      // The allocator and the skipped-item analysis have to tell the same story.
      if (c.result.skippedItems.some((s) => s.id === 'missed-employer-match') && bad.length < 6) {
        bad.push(`${c.label} :: reports a missed match at a 0% match rate`)
      }
    }
    expect(bad).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Skipped items / opportunity costs
// ─────────────────────────────────────────────────────────────────────────────

describe('skipped items', () => {
  it('never emits duplicate skipped-item ids', () => {
    const bad = collect((c, report) => {
      const ids = c.result.skippedItems.map((s) => s.id)
      if (new Set(ids).size !== ids.length) report(`duplicate skipped ids: ${ids.join(', ')}`)
    })
    expect(bad).toEqual([])
  })

  it('keeps every opportunity-cost figure finite', () => {
    const bad = collect((c, report) => {
      walkNumbers(c.result.skippedItems, 'skippedItems', (path, value) => {
        if (!Number.isFinite(value)) report(`${path} = ${value}`)
      })
    })
    expect(bad).toEqual([])
  })

  it('keeps every opportunity-cost figure non-negative', () => {
    const bad = collect((c, report) => {
      for (const s of c.result.skippedItems) {
        for (const [k, v] of Object.entries(s.opportunityCost)) {
          if (typeof v === 'number' && v < 0) report(`skipped ${s.id} ${k} = ${v}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps opportunityCost.monthly x 12 equal to opportunityCost.annual', () => {
    const bad = collect((c, report) => {
      for (const s of c.result.skippedItems) {
        const oc = s.opportunityCost
        if (Math.abs(oc.monthly * 12 - oc.annual) > 1e-6) {
          report(`skipped ${s.id} monthly ${oc.monthly} x 12 !== annual ${oc.annual}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: `extraPayment` is a monthly figure, so the annual
   * stream is 12x it and the monthly cost is exactly one twelfth of the annual
   * one.
   *
   * Trigger profile: any profile carrying a low-rate debt with an extra payment
   * — `debt-low-interest-with-extra` (Mortgage, 4.5%, extraPayment $400/month) —
   * which reported `{ monthly: 0.8333, annual: 120.00 }`, a ratio of 144, and
   * rendered as "$0.83/mo — $120/yr".
   */
  it('keeps low-interest-debt-prepayment monthly x 12 equal to its annual figure', () => {
    const withItem = GRID.filter((c) =>
      c.result.skippedItems.some((s) => s.id === 'low-interest-debt-prepayment')
    )
    expect(withItem.length).toBeGreaterThan(0)

    const bad: string[] = []
    for (const c of withItem) {
      const item = c.result.skippedItems.find((s) => s.id === 'low-interest-debt-prepayment')!
      const debt = c.profile.debts.find((d) => d.interestRate <= 0.07 && d.extraPayment > 0)!
      // $400/month of extra principal at a 4.5% rate against a 7% assumption:
      // 400 * 12 * 0.025 = $120/yr, $10/mo.
      const expectedAnnual = debt.extraPayment * 12 * (ASSUMED_MARKET_RETURN - debt.interestRate)
      if (Math.abs(item.opportunityCost.annual - expectedAnnual) > 1e-6 && bad.length < 6) {
        bad.push(`${c.label} :: annual ${item.opportunityCost.annual} !== ${expectedAnnual}`)
      }
      if (Math.abs(item.opportunityCost.monthly - expectedAnnual / 12) > 1e-6 && bad.length < 6) {
        bad.push(`${c.label} :: monthly ${item.opportunityCost.monthly} !== ${expectedAnnual / 12}`)
      }
    }
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: an item with no dollar cost must not be dressed as a
   * priced trade-off. Zero-cost items still exist — the no-emergency-fund risk
   * note, the Roth-vs-Traditional comparison whose answer depends on a bracket
   * decades out, and cash already yielding at or above the market assumption —
   * but their copy has to say why no figure is modeled instead of quoting one.
   *
   * Trigger profiles: `no-emergency-fund` (< 1 month saved, risk tolerance not
   * 'optimizer'); `traditional-vs-roth` (age < 30, not peak earnings, bracket
   * <= 12%), which paired `{ monthly: 0, annual: 0 }` with a flat
   * `tenYear: 15000`; and the excessive-emergency-fund card at
   * `emergencyFundAPY >= 0.07`, which read "Emergency funds at 7.0% APY vs 7%
   * expected market returns = $0 opportunity cost over 10 years".
   */
  it('never renders a skipped-item card whose monthly and annual cost are both $0', () => {
    /** Ways a card can attach a dollar figure to a cost claim. */
    const DOLLAR_COST_CLAIMS: Array<{ label: string; re: RegExp }> = [
      { label: 'priced opportunity cost', re: /-?\$[\d,]+(?:\.\d+)?\s*(?:of\s+)?opportunity cost/i },
      { label: 'opportunity cost of $', re: /opportunity cost\s*(?:of|=|:)\s*-?\$/i },
      { label: '$0 cost claim', re: /\$0(?:\.00)?\s+(?:cost|savings|benefit|difference|gain|loss)/i },
      { label: 'equals a dollar figure', re: /=\s*-?\$[\d,]/ },
    ]

    const zeroCostIds = new Set<string>()
    const bad: string[] = []
    for (const c of GRID) {
      for (const s of c.result.skippedItems) {
        const oc = s.opportunityCost
        if (oc.monthly !== 0 || oc.annual !== 0) continue
        zeroCostIds.add(s.id)

        const copy = skippedItemCopy(s)
        for (const claim of DOLLAR_COST_CLAIMS) {
          if (claim.re.test(copy) && bad.length < 6) {
            bad.push(`${c.label} :: skipped ${s.id} makes a ${claim.label}: "${copy}"`)
          }
        }
        // A card with no monthly or annual cost must not smuggle one into the
        // longer horizons either.
        if (oc.tenYear !== undefined && oc.tenYear !== 0 && bad.length < 6) {
          bad.push(`${c.label} :: skipped ${s.id} costs $0/mo and $0/yr but claims tenYear ${oc.tenYear}`)
        }
        if (oc.twentyYear !== undefined && oc.twentyYear !== 0 && bad.length < 6) {
          bad.push(`${c.label} :: skipped ${s.id} costs $0/mo and $0/yr but claims twentyYear ${oc.twentyYear}`)
        }
      }
    }
    expect(bad).toEqual([])
    // The three documented zero-cost items are all still reachable, so the
    // assertion above is exercised rather than vacuous.
    expect([...zeroCostIds].sort()).toEqual([
      'excessive-emergency-fund',
      'no-emergency-fund',
      'traditional-vs-roth',
    ])
  })

  /**
   * Regression guard for: cash yielding at or above the assumed market return
   * carries no opportunity cost, so the figures floor at 0 rather than reporting
   * the negative spread as a cost.
   *
   * Trigger profile: `prefs-apy-above-market` (emergencyFundAPY 0.09 — the APY
   * input accepts up to 10% and does not clamp) with `ef-far-above-target`,
   * where `excessive-emergency-fund` reported
   * `{ monthly: -68.33, annual: -820.00, tenYear: -16408.71 }` and education
   * "Emergency funds at 9.0% APY vs 7% expected market returns = -$16,409
   * opportunity cost over 10 years".
   */
  it('never reports a negative opportunity cost when the cash APY beats the market assumption', () => {
    const aboveMarket = GRID.filter(
      (c) => c.profile.preferences.emergencyFundAPY > ASSUMED_MARKET_RETURN
    )
    expect(aboveMarket.length).toBeGreaterThan(0)

    const cashItems = ['excessive-emergency-fund', 'large-emergency-fund-target']
    let priced = 0
    const bad: string[] = []
    for (const c of aboveMarket) {
      for (const s of c.result.skippedItems) {
        for (const [key, value] of Object.entries(s.opportunityCost)) {
          if (typeof value === 'number' && value < 0 && bad.length < 6) {
            bad.push(`${c.label} :: skipped ${s.id} ${key} = ${value}`)
          }
        }
        if (cashItems.includes(s.id)) {
          priced++
          const oc = s.opportunityCost
          if ((oc.monthly !== 0 || oc.annual !== 0 || (oc.tenYear ?? 0) !== 0) && bad.length < 6) {
            bad.push(`${c.label} :: skipped ${s.id} prices cash at ${JSON.stringify(oc)} despite a ${formatPercent(c.profile.preferences.emergencyFundAPY)} APY`)
          }
          if (!/no opportunity cost is modeled/i.test(s.education ?? '') && bad.length < 6) {
            bad.push(`${c.label} :: skipped ${s.id} education does not explain the missing figure: "${s.education}"`)
          }
        }
      }
    }
    expect(bad).toEqual([])
    expect(priced).toBeGreaterThan(0)
  })

  /**
   * Regression guard for: the large-target card prices only cash the profile
   * actually holds above the 3-month cap. A target nobody has funded yet costs
   * nothing — and used to pre-empt the far more relevant zero-fund case, so a
   * user with nothing saved was told their emergency fund was too big.
   *
   * Trigger profile: `bi-weekly | zero-paycheck | ... | ef-zero |
   * prefs-six-month-target` (currentEmergencyFund 0, necessaryExpenses 3000,
   * 6-month target), which reported
   * `{ monthly: 18.75, annual: 225.00, tenYear: 3727.64 }` against a $9,000
   * "excess" that existed only in the target.
   */
  it('never charges an opportunity cost against an unfunded emergency-fund target', () => {
    let pricedCases = 0
    const bad = collect((c, report) => {
      const item = c.result.skippedItems.find((s) => s.id === 'large-emergency-fund-target')
      const prefs = c.profile.preferences
      const target = prefs.necessaryExpenses * prefs.emergencyFundMonths
      const cashCap = prefs.necessaryExpenses * CASH_MONTHS_CAP
      // Only cash on hand, and only the part of it beyond the cash cap.
      const excessHeld = Math.max(0, Math.min(prefs.currentEmergencyFund, target) - cashCap)

      if (!item) {
        return
      }
      pricedCases++
      if (!(excessHeld > 0)) {
        report(`large-emergency-fund-target priced ${JSON.stringify(item.opportunityCost)} on $${excessHeld} of cash held above ${CASH_MONTHS_CAP} months`)
        return
      }
      const expectedAnnual = excessHeld * Math.max(0, ASSUMED_MARKET_RETURN - prefs.emergencyFundAPY)
      if (Math.abs(item.opportunityCost.annual - expectedAnnual) > 1e-6) {
        report(`large-emergency-fund-target annual ${item.opportunityCost.annual} !== ${expectedAnnual} (excess held ${excessHeld})`)
      }
      if (!item.reason.includes(formatCurrency(excessHeld))) {
        report(`large-emergency-fund-target reason does not name the ${formatCurrency(excessHeld)} actually held: "${item.reason}"`)
      }
    })
    expect(bad).toEqual([])
    // $15,000 saved against an $18,000 target prices $6,000 of cash above the
    // $9,000 cap — 6000 * (0.07 - 0.045) = $150/yr.
    expect(pricedCases).toBeGreaterThan(0)
  })

  it('never surfaces the large-target card ahead of an unfunded emergency fund', () => {
    const bad = collect((c, report) => {
      const prefs = c.profile.preferences
      if (!(prefs.necessaryExpenses > 0) || prefs.currentEmergencyFund >= prefs.necessaryExpenses) return
      if (c.result.skippedItems.some((s) => s.id === 'large-emergency-fund-target')) {
        report('reports an over-large emergency fund for a profile with under a month saved')
      }
    })
    expect(bad).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Projections
// ─────────────────────────────────────────────────────────────────────────────

describe('projections', () => {
  it('keeps both projection paths finite and non-negative', () => {
    const bad = collect((c, report) => {
      const { currentPath, optimizedPath } = c.result.projections
      for (const [name, path] of [
        ['currentPath', currentPath],
        ['optimizedPath', optimizedPath],
      ] as const) {
        if (!Number.isFinite(path.tenYear) || path.tenYear < 0) report(`${name}.tenYear = ${path.tenYear}`)
        if (!Number.isFinite(path.taxesOwed) || path.taxesOwed < 0) report(`${name}.taxesOwed = ${path.taxesOwed}`)
        if (!Number.isFinite(path.fiAge) || path.fiAge < 0) report(`${name}.fiAge = ${path.fiAge}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('reports improvement.tenYear as the exact difference between the two paths', () => {
    const bad = collect((c, report) => {
      const p = c.result.projections
      const expected = p.optimizedPath.tenYear - p.currentPath.tenYear
      if (Math.abs(expected - p.improvement.tenYear) > 1e-6) {
        report(`improvement.tenYear ${p.improvement.tenYear} !== ${expected}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never reports negative fiYearsEarlier', () => {
    const bad = collect((c, report) => {
      if (c.result.projections.improvement.fiYearsEarlier < 0) {
        report(`fiYearsEarlier = ${c.result.projections.improvement.fiYearsEarlier}`)
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * The headline "Optimized Path" number must never sit below the current path,
   * because the UI presents the delta as an improvement.
   *
   * This now holds for every profile in the grid, once the two paths were put on
   * the same footing (both carry the existing payroll deferral, and every
   * net-worth-building allocation category counts). Before that change the
   * optimized path counted only `tax_advantaged` and `investment` allocations
   * while the current path counted the existing 401k deferral, so e.g.
   * `bi-weekly | typical-paycheck | 401k-contribution-above-100pct |
   * ef-exactly-target` produced optimized $551,145 vs current $1,917,729
   * (improvement -$1,366,585) rendered as a green gain.
   */
  it('never projects the optimized path below the current path', () => {
    const bad = collect((c, report) => {
      const p = c.result.projections
      if (p.optimizedPath.tenYear < p.currentPath.tenYear - 1e-6) {
        report(`optimized ${p.optimizedPath.tenYear} < current ${p.currentPath.tenYear}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never projects the optimized path below the current path for an unclaimed employer match', () => {
    const bad = collect((c, report) => {
      const b = c.normalized.benefits.employer401k
      if (!b.available || b.currentContribution >= b.matchLimit) return
      const p = c.result.projections
      if (p.optimizedPath.tenYear < p.currentPath.tenYear - 1e-6) {
        report(`optimized ${p.optimizedPath.tenYear} < current ${p.currentPath.tenYear}`)
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: the FI age is anchored to the age the UI collects, so
   * it is never in the past and `fiYearsEarlier` is measured from the right
   * starting point. 99 is the sentinel for "not reached in this model".
   *
   * Trigger profile: any profile whose age is not 30, e.g. `weekly |
   * zero-paycheck | 401k-unavailable | ef-far-above-target | age-55 |
   * prefs-funmoney-min-above-max`, which reported `optimizedPath.fiAge = 30.0`
   * for a 55-year-old — an FI date 25 years in the past — because
   * `calculateFIAge` hardcoded `const currentAge = 30`.
   */
  it('anchors FI age to the profile age rather than a hardcoded 30', () => {
    let alreadyFI = 0
    const bad = collect((c, report) => {
      const age = c.profile.preferences.age
      for (const [name, path] of [
        ['currentPath', c.result.projections.currentPath],
        ['optimizedPath', c.result.projections.optimizedPath],
      ] as const) {
        if (path.fiAge < age - 1e-9) report(`${name}.fiAge ${path.fiAge} is before the profile age ${age}`)
        if (path.fiAge > 99 + 1e-9) report(`${name}.fiAge ${path.fiAge} exceeds the 99 sentinel`)
      }
      // A profile already past its FI target reaches it today, at its own age.
      if (c.result.projections.optimizedPath.fiAge === age) alreadyFI++
    })
    expect(bad).toEqual([])
    // Exercised by profiles whose net worth already clears the 4% target.
    expect(alreadyFI).toBeGreaterThan(0)
    expect(GRID.some((c) => c.profile.preferences.age !== 30 && c.result.projections.optimizedPath.fiAge === c.profile.preferences.age)).toBe(true)
  })

  /**
   * Regression guard for: the starting net worth is built only from balances the
   * profile actually collects — emergency fund plus IRA balances, less debt
   * balances. There is no 401k-balance input, so no term stands in for one.
   *
   * Trigger profile: every profile. `estimateCurrentNetWorth` added
   * `max(0, income.gross * 12 * 0.5)` as "estimated existing retirement
   * savings", crediting a $300k earner with $150,000 already saved — $295,073 of
   * the ten-year figure once compounded, before a single contribution. The term
   * was identical on both paths, so `improvement.tenYear` never showed it; the
   * two headline balances did.
   *
   * With necessary expenses above take-home pay and no 401k, every savings
   * stream is zero, so each path's ten-year figure is exactly the reported
   * starting net worth compounded at 7%.
   */
  it('does not fabricate half a year of gross income as existing retirement savings', () => {
    const noSavingsCapacity = (overrides: Partial<Selection>): Selection => ({
      frequency: 'bi-weekly',
      paycheck: PAYCHECKS[2], // gross $3,000 / net $2,250 per paycheck
      bonus: BONUSES[0],
      employer: EMPLOYERS[0], // 401k unavailable, so no payroll deferral
      hsa: HSAS[0],
      ira: IRAS[0],
      debts: DEBT_SETS[0],
      emergencyFund: EMERGENCY_FUNDS[0],
      age: 40,
      prefs: PREF_VARIANTS[2], // necessary expenses above net income
      ...overrides,
    })

    const reportsNothing = runCase(noSavingsCapacity({}))
    expect(reportsNothing.result.allocations).toEqual([])
    // Nothing reported, nothing invented: a $0 balance stays $0 for ten years,
    // where the fabricated term would have started it at $39,000 x 0.5 x 12.
    expect(reportsNothing.result.projections.currentPath.tenYear).toBe(0)
    expect(reportsNothing.result.projections.optimizedPath.tenYear).toBe(0)

    // $60,000 of emergency fund plus $12,000 + $8,000 of IRA balances.
    const withBalances = runCase(
      noSavingsCapacity({ emergencyFund: EMERGENCY_FUNDS[4], ira: IRAS[1] })
    )
    const expectedNetWorth = 60000 + 12000 + 8000
    expect(withBalances.result.projections.currentPath.tenYear).toBeCloseTo(
      calculateCompoundGrowth(expectedNetWorth, 0.07, 10),
      6
    )

    // Debt balances net against those assets: $80,000 - $20,000 of student loan.
    const withDebt = runCase(
      noSavingsCapacity({ emergencyFund: EMERGENCY_FUNDS[4], ira: IRAS[1], debts: DEBT_SETS[2] })
    )
    expect(withDebt.result.projections.currentPath.tenYear).toBeCloseTo(
      calculateCompoundGrowth(expectedNetWorth - 20000, 0.07, 10),
      6
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Optimization score
// ─────────────────────────────────────────────────────────────────────────────

describe('optimization score', () => {
  it('keeps the overall score and every breakdown component within [0, 100]', () => {
    const bad = collect((c, report) => {
      const s = c.result.optimizationScore
      if (!(s.overall >= 0 && s.overall <= 100)) report(`overall = ${s.overall}`)
      for (const [k, v] of Object.entries(s.breakdown)) {
        if (!(v >= 0 && v <= 100)) report(`breakdown.${k} = ${v}`)
      }
      if (!(s.comparison >= 0 && s.comparison <= 100)) report(`comparison = ${s.comparison}`)
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: the recommendation is an increment on what the profile
   * already does, so grading both on one rubric can never put the plan below the
   * status quo it contains.
   *
   * Trigger profiles: `weekly | zero-paycheck | 401k-zero-percent-match |
   * hsa-family | debt-low-interest | ef-zero | age-50 |
   * prefs-necessary-above-net-income` scored overall 44 against comparison 50,
   * and `bi-weekly | typical-paycheck | 401k-contribution-above-100pct` scored
   * 61 against 75, because `comparison` came from a separate formula that graded
   * the profile on a 40-point base capped at 75 while `overall` graded only the
   * allocations.
   */
  it('never scores the recommended plan below the typical-advice comparison', () => {
    const bad = collect((c, report) => {
      const s = c.result.optimizationScore
      if (s.overall < s.comparison) report(`overall ${s.overall} < comparison ${s.comparison}`)
    })
    expect(bad).toEqual([])
    // Both numbers move across the grid, so the comparison is a real one.
    expect(new Set(GRID.map((c) => c.result.optimizationScore.comparison)).size).toBeGreaterThan(1)
    expect(GRID.some((c) => c.result.optimizationScore.overall > c.result.optimizationScore.comparison)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Step statuses
// ─────────────────────────────────────────────────────────────────────────────

describe('step statuses', () => {
  it('never marks a step both complete and urgent', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if (s.isComplete && s.isUrgent) report(`step ${s.id} is complete AND urgent`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never marks a step both not-applicable and complete/urgent', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if (s.isNotApplicable && (s.isComplete || s.isUrgent)) {
          report(`step ${s.id} not-applicable AND complete=${s.isComplete} urgent=${s.isUrgent}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps isRecommendation consistent with the other status flags', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        const expected = !s.isComplete && !s.isUrgent && !s.isNotApplicable
        if (s.isRecommendation !== expected) {
          report(`step ${s.id} isRecommendation=${s.isRecommendation}, expected ${expected}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps urgencyLevel consistent with the status flags', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if ((s.isNotApplicable || s.isComplete) && s.urgencyLevel !== 'none') {
          report(`step ${s.id} inactive but urgencyLevel=${s.urgencyLevel}`)
        }
        if (s.isUrgent && s.urgencyLevel !== 'critical') {
          report(`step ${s.id} urgent but urgencyLevel=${s.urgencyLevel}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps potentialSavings non-negative and 1/12-consistent', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if (s.potentialSavings.monthly < 0 || s.potentialSavings.annual < 0) {
          report(`step ${s.id} negative potentialSavings ${JSON.stringify(s.potentialSavings)}`)
        }
        if (Math.abs(s.potentialSavings.monthly * 12 - s.potentialSavings.annual) > 1e-6) {
          report(`step ${s.id} monthly*12 !== annual (${JSON.stringify(s.potentialSavings)})`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('never reports potential savings for a not-applicable step', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if (s.isNotApplicable && s.potentialSavings.annual > 0) {
          report(`step ${s.id} not-applicable but claims ${s.potentialSavings.annual}/yr`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('never emits an empty recommendation, whyItMatters, or implementation step', () => {
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if (!s.recommendation.trim()) report(`step ${s.id} empty recommendation`)
        if (!s.whyItMatters.trim()) report(`step ${s.id} empty whyItMatters`)
        if (s.implementationSteps.some((t) => !t.trim())) report(`step ${s.id} empty implementation step`)
      }
    })
    expect(bad).toEqual([])
  })

  it('links each allocated step to its allocation', () => {
    const bad = collect((c, report) => {
      for (const [stepId, allocationId] of STEP_ALLOCATION_PAIRS) {
        const allocated = c.result.allocations.some((a) => a.id === allocationId)
        const step = c.steps.find((s) => s.id === stepId)
        if (allocated && step && !step.allocation) {
          report(`step ${stepId} has no allocation although ${allocationId} was allocated`)
        }
        if (allocated && step?.allocation && step.allocation.id !== allocationId) {
          report(`step ${stepId} linked ${step.allocation.id} instead of ${allocationId}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: the mega-backdoor allocation and the mega-backdoor
   * step have to agree on one taxonomy, or an allocated step renders as an
   * unrealized opportunity.
   *
   * Trigger profile: `monthly | huge-paycheck | 401k-after-tax-mega-backdoor |
   * hsa-ineligible | debt-none | ef-zero | age-25 | prefs-default`, which
   * produced an $800.00/paycheck `mega-backdoor-roth` allocation while the step
   * reported `allocation = undefined` and "High earner mega backdoor Roth
   * opportunity" — the allocation was tagged `tax_advantaged`, but the step (and
   * lib/constants/financialSteps.ts) matches `tax_optimization`.
   */
  it('links the mega-backdoor step to its allocation', () => {
    const withMega = GRID.filter((c) => c.result.allocations.some((a) => a.id === 'mega-backdoor-roth'))
    expect(withMega.length).toBeGreaterThan(0)

    const bad: string[] = []
    for (const c of withMega) {
      const allocation = c.result.allocations.find((a) => a.id === 'mega-backdoor-roth')!
      const step = c.steps.find((s) => s.id === 'mega-backdoor')!
      if (allocation.category !== 'tax_optimization' && bad.length < 6) {
        bad.push(`${c.label} :: mega-backdoor allocation tagged ${allocation.category}`)
      }
      if (step.allocation?.id !== 'mega-backdoor-roth' && bad.length < 6) {
        bad.push(`${c.label} :: mega-backdoor step linked ${step.allocation?.id}`)
      }
      // An allocated step reads as a plan, not as an opportunity going begging.
      if (step.recommendation !== 'Mega backdoor Roth strategy' && bad.length < 6) {
        bad.push(`${c.label} :: mega-backdoor recommendation "${step.recommendation}"`)
      }
    }
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: the step card has to name the debt the allocator
   * actually targets — the highest rate that qualifies, not the first one typed
   * in — and size its savings from the recommended payment rather than assuming
   * the whole balance is retired at once.
   *
   * Trigger profile: two debts, Low Card ($20,000 @ 8%, min $200) and High Card
   * ($3,000 @ 29%, min $90), on $6,000/month net. The allocation targeted "High
   * Card (29%)" while the step said "8% interest debt - payoff returns that rate
   * risk-free" and claimed `{ monthly: 133.33, annual: 1600 }` — a full year of
   * interest on the *other* debt.
   */
  it('names the same debt in the high-interest-debt step as in the allocation', () => {
    const twoCards = runCase({
      frequency: 'monthly',
      paycheck: { label: 'monthly-6000-net', grossPaycheck: 8000, netPaycheck: 6000 },
      bonus: BONUSES[0],
      employer: EMPLOYERS[0],
      hsa: HSAS[0],
      ira: IRAS[0],
      debts: {
        label: 'debt-two-cards-low-listed-first',
        build: () => [
          createDebtData({ id: 'd-low', name: 'Low Card', balance: 20000, interestRate: 0.08, minimumPayment: 200 }),
          createDebtData({ id: 'd-high', name: 'High Card', balance: 3000, interestRate: 0.29, minimumPayment: 90 }),
        ],
      },
      emergencyFund: EMERGENCY_FUNDS[2],
      age: 40,
      prefs: PREF_VARIANTS[0],
    })

    const allocation = twoCards.result.allocations.find((a) => a.id === 'high-interest-debt')
    expect(allocation?.account).toBe('High Card (29%)')
    // $6,000 net - $3,000 necessary - $200 fun-money floor = $2,800 available,
    // capped at the $3,000 balance, less the $90 monthly minimum.
    expect(allocation?.amount).toBeCloseTo(2710, 6)

    const step = twoCards.steps.find((s) => s.id === 'high-interest-debt')!
    expect(step.recommendation).toContain('29%')
    expect(step.recommendation).not.toContain('8%')
    // Interest avoided is capped by a full year on the balance: $3,000 x 29%.
    expect(step.potentialSavings.annual).toBeCloseTo(870, 6)
    expect(step.potentialSavings.monthly).toBeCloseTo(72.5, 6)

    // And across the grid: whenever the step is urgent it quotes the highest
    // qualifying rate, and prices the savings the same way the allocator does.
    const bad = collect((c, report) => {
      const step = c.steps.find((s) => s.id === 'high-interest-debt')!
      const qualifying = c.profile.debts.filter((d) => d.interestRate > 0.07)
      if (qualifying.length === 0) return
      const highest = qualifying.reduce((a, b) => (b.interestRate > a.interestRate ? b : a))

      if (step.isUrgent && !step.recommendation.includes(formatPercent(highest.interestRate))) {
        report(`step quotes "${step.recommendation}" for a ${formatPercent(highest.interestRate)} debt`)
      }
      const fullYearInterest = Math.max(0, highest.balance) * highest.interestRate
      const stream = step.allocation?.monthlyEquivalent
      const expected = stream != null ? Math.min(stream * 12 * highest.interestRate * 0.5, fullYearInterest) : fullYearInterest
      if (Math.abs(step.potentialSavings.annual - expected) > 1e-6) {
        report(`potentialSavings.annual ${step.potentialSavings.annual} !== ${expected}`)
      }
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: every limit and monthly suggestion a step quotes comes
   * from lib/constants/irs-2026 (the "update only the constants file" rule in
   * CLAUDE.md), including the catch-ups — 50+, the SECURE 2.0 super catch-up at
   * 60-63 only, and the age-55 HSA catch-up.
   *
   * Trigger profile: a $180k-salary profile against the stale figures
   * stepStatusUtils used to hardcode — `23000 / 30500` for the elective deferral
   * (2026: 24,500 + 8,000 / 11,250), `7000 / 8000` for the IRA (2026: 7,500 +
   * 1,100), `4150 / 8300` and `5150 / 9300` for the HSA (2026: 4,400 / 8,750
   * plus a $1,000 age-55 catch-up), "$69,000 total" for 415(c) (2026: 72,000 /
   * 80,000 / 83,250) and "$583/month" for the IRA transfer (2026: $625, $717 at
   * 50+). The HSA savings figure also applied a flat 0.22 tax rate regardless of
   * the profile's bracket.
   */
  it('derives every step limit from lib/constants/irs-2026 instead of hardcoded 2024 figures', () => {
    const bad = collect((c, report) => {
      const age = c.profile.preferences.age
      const step = (id: string) => c.steps.find((s) => s.id === id)!

      // IRA: $7,500 / $8,600 a year, quoted monthly as $625 / $717.
      const iraMonthly = formatCurrency(iraLimitFor(age) / 12)
      const roth = step('roth-ira')
      if (!roth.implementationSteps.some((t) => t.includes(iraMonthly))) {
        report(`roth-ira implementation steps do not quote ${iraMonthly}: ${JSON.stringify(roth.implementationSteps)}`)
      }
      if (!roth.isComplete && !roth.allocation && !roth.recommendation.includes(iraMonthly)) {
        report(`roth-ira recommendation "${roth.recommendation}" does not quote ${iraMonthly}`)
      }
      const rothAnnual = (c.profile.benefits.ira.currentContributions.roth || 0) * 12
      if (roth.isComplete !== rothAnnual >= iraLimitFor(age) * 0.98) {
        report(`roth-ira isComplete=${roth.isComplete} at ${rothAnnual}/yr against a ${iraLimitFor(age)} limit`)
      }

      // 415(c) total annual additions: 72,000 / 80,000 / 83,250 by age band.
      const total415c = formatCurrency(total415cFor(age))
      if (!step('mega-backdoor').implementationSteps.some((t) => t.includes(total415c))) {
        report(`mega-backdoor steps do not quote ${total415c}: ${JSON.stringify(step('mega-backdoor').implementationSteps)}`)
      }

      // HSA: coverage tier plus the age-55 catch-up, deducted at the profile's
      // own federal bracket.
      const hsa = step('hsa-max')
      if (c.profile.benefits.hsa.eligible) {
        const limit = hsaLimitFor(c.profile.benefits.hsa.coverageType, age)
        const current = c.profile.benefits.hsa.currentContribution * 12
        const expectedSavings = Math.max(0, limit - current) * c.profile.taxes.federalBracket
        if (Math.abs(hsa.potentialSavings.annual - expectedSavings) > 1e-6) {
          report(`hsa-max potentialSavings.annual ${hsa.potentialSavings.annual} !== ${expectedSavings} (limit ${limit}, bracket ${c.profile.taxes.federalBracket})`)
        }
        if (hsa.isComplete !== current >= limit * 0.98) {
          report(`hsa-max isComplete=${hsa.isComplete} at ${current}/yr against a ${limit} limit`)
        }
      }

      // 402(g) elective deferral: completeness measured against the age limit.
      const additional = step('additional-401k')
      const b = c.normalized.benefits.employer401k
      const deferred = c.normalized.income.gross * b.currentContribution * 12
      const expectedComplete = b.available && deferred >= elective401kLimitFor(age) * 0.98
      if (additional.isComplete !== expectedComplete) {
        report(`additional-401k isComplete=${additional.isComplete} at ${deferred}/yr against a ${elective401kLimitFor(age)} limit`)
      }
    })
    expect(bad).toEqual([])

    // The catch-up bands are actually exercised: $625/month below 50, $717 at
    // 50+, and 415(c) at all three levels.
    const quoted = (pick: (c: Case) => string) => new Set(GRID.map(pick))
    expect(quoted((c) => c.steps.find((s) => s.id === 'roth-ira')!.implementationSteps[1])).toEqual(
      new Set(['Set up automatic $625/month transfer', 'Set up automatic $717/month transfer'])
    )
    expect(quoted((c) => c.steps.find((s) => s.id === 'mega-backdoor')!.implementationSteps[2])).toEqual(
      new Set([
        'Contribute up to annual limit ($72,000 total)',
        'Contribute up to annual limit ($80,000 total)',
        'Contribute up to annual limit ($83,250 total)',
      ])
    )
  })

  /**
   * Regression guard for: a step marked complete must not also tell the reader
   * to start contributing.
   *
   * Trigger profile: Roth IRA contributions at the annual limit, where the step
   * reported `isComplete = true` alongside "Contribute $500/month to Roth IRA" —
   * a hardcoded figure unrelated to any limit — because the recommendation never
   * consulted `isComplete`.
   */
  it('never tells the user to contribute to a step it has marked complete', () => {
    const IMPERATIVE = /\b(?:contribute|increase|need|build|complete the|open a)\b/i
    const bad = collect((c, report) => {
      for (const s of c.steps) {
        if (s.isComplete && IMPERATIVE.test(s.recommendation)) {
          report(`step ${s.id} is complete but recommends "${s.recommendation}"`)
        }
      }
    })
    expect(bad).toEqual([])

    // A maxed-out Roth IRA is the case that first broke this, and the grid's
    // $500/month contributor does not reach the limit, so build it explicitly.
    const maxedRoth = runCase({
      frequency: 'bi-weekly',
      paycheck: PAYCHECKS[2],
      bonus: BONUSES[0],
      employer: EMPLOYERS[2],
      hsa: HSAS[0],
      ira: {
        label: 'ira-at-2026-limit',
        build: () =>
          createIRAData({ currentContributions: { traditional: 0, roth: CONTRIBUTION_LIMITS_2026.ira / 12 } }),
      },
      debts: DEBT_SETS[0],
      emergencyFund: EMERGENCY_FUNDS[2],
      age: 40,
      prefs: PREF_VARIANTS[0],
    })
    const rothStep = maxedRoth.steps.find((s) => s.id === 'roth-ira')!
    expect(rothStep.isComplete).toBe(true)
    expect(rothStep.recommendation).toBe('Roth IRA maximized')
    // And no further IRA allocation is recommended on top of a full limit.
    expect(maxedRoth.result.allocations.some((a) => a.id === 'roth-ira')).toBe(false)
  })

  /**
   * Regression guard for: a $0 target means necessary expenses have not been
   * entered, not that the fund is funded — `0 >= 0` must not read as complete,
   * in the step catalogue or in the allocator.
   *
   * Trigger profile: `weekly | zero-paycheck | ... | ef-partial |
   * prefs-zero-necessary-expenses` (necessaryExpenses 0, currentEmergencyFund
   * 1500), where `emergency-1month` reported `isComplete = true` and "Emergency
   * fund complete ($1,500)" — and reported the same for a $0 fund.
   */
  it('does not declare the emergency fund complete when necessary expenses are 0', () => {
    const zeroExpense = GRID.filter((c) => c.profile.preferences.necessaryExpenses === 0)
    expect(zeroExpense.length).toBeGreaterThan(0)
    expect(zeroExpense.some((c) => c.profile.preferences.currentEmergencyFund > 0)).toBe(true)

    const bad: string[] = []
    for (const c of zeroExpense) {
      for (const stepId of ['emergency-1month', 'emergency-full']) {
        const step = c.steps.find((s) => s.id === stepId)!
        if (step.isComplete && bad.length < 6) {
          bad.push(`${c.label} :: step ${stepId} complete against a $0 target: "${step.recommendation}"`)
        }
        if (!/target unknown/i.test(step.recommendation) && bad.length < 6) {
          bad.push(`${c.label} :: step ${stepId} says "${step.recommendation}" rather than naming the missing target`)
        }
      }
      // The allocator applies the same guard, so no emergency-fund dollars are
      // recommended toward an unknown target.
      for (const a of c.result.allocations) {
        if (a.category === 'emergency_fund' && bad.length < 6) {
          bad.push(`${c.label} :: allocates ${a.amount} to ${a.account} against a $0 target`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tax impact
// ─────────────────────────────────────────────────────────────────────────────

describe('tax impact', () => {
  it('never claims a tax saving larger than the allocation that generates it', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (Math.abs(a.taxImpact) > a.amount + EPS) {
          report(`allocation ${a.id} taxImpact ${a.taxImpact} exceeds amount ${a.amount}`)
        }
      }
    })
    expect(bad).toEqual([])
  })

  it('keeps the implied tax rate of every allocation within [0, 0.65]', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (a.amount <= 0) continue
        const rate = Math.abs(a.taxImpact) / a.amount
        if (!(rate >= 0 && rate <= 0.65)) report(`allocation ${a.id} implied tax rate = ${rate}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never reports a positive taxImpact (a recommendation that raises taxes)', () => {
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (a.taxImpact > 0) report(`allocation ${a.id} taxImpact = ${a.taxImpact}`)
      }
    })
    expect(bad).toEqual([])
  })

  it('only attaches a tax saving to pre-tax destinations', () => {
    const afterTaxIds = new Set([
      'roth-ira',
      'mega-backdoor-roth',
      'taxable-investment',
      '1-month-emergency',
      'emergency-fund-completion',
      'high-interest-debt',
    ])
    const bad = collect((c, report) => {
      for (const a of c.result.allocations) {
        if (afterTaxIds.has(a.id) && a.taxImpact !== 0) {
          report(`after-tax allocation ${a.id} claims taxImpact ${a.taxImpact}`)
        }
      }
    })
    expect(bad).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IRS contribution limits
// ─────────────────────────────────────────────────────────────────────────────

describe('IRS contribution limits', () => {
  it('never recommends IRA contributions above the age-appropriate limit', () => {
    const bad = collect((c, report) => {
      const roth = c.result.allocations.find((a) => a.id === 'roth-ira')
      if (!roth) return
      const age = c.profile.preferences.age
      const limit = CONTRIBUTION_LIMITS_2026.ira + (age >= 50 ? CONTRIBUTION_LIMITS_2026.catchUp.ira : 0)
      const existing =
        (c.profile.benefits.ira.currentContributions.roth + c.profile.benefits.ira.currentContributions.traditional) * 12
      const recommended = paycheckToMonthly(roth.amount, c.profile.income.frequency) * 12
      if (existing + recommended > limit + 1e-6) {
        report(`IRA total ${existing + recommended} exceeds limit ${limit} (age ${age})`)
      }
    })
    expect(bad).toEqual([])
  })

  it('never recommends HSA contributions above the coverage-tier limit', () => {
    const bad = collect((c, report) => {
      const hsa = c.result.allocations.find((a) => a.id === 'hsa-contribution')
      if (!hsa) return
      const b = c.profile.benefits.hsa
      // IRC 223(b)(3): a flat $1,000 on top of the coverage-tier limit from the
      // year the account holder turns 55.
      const limit = hsaLimitFor(b.coverageType, c.profile.preferences.age)
      const total =
        b.employerContribution + b.currentContribution * 12 + paycheckToMonthly(hsa.amount, c.profile.income.frequency) * 12
      if (total > limit + 1e-6) report(`HSA total ${total} exceeds limit ${limit}`)
    })
    expect(bad).toEqual([])
  })

  /**
   * Regression guard for: IRC 402(g) caps elective deferrals per employee per
   * year across every source, so the match step and the top-up step have to
   * share one remaining-room budget on top of the existing payroll election.
   *
   * Trigger profile: `weekly | typical-paycheck | 401k-zero-percent-match |
   * hsa-individual | debt-low-interest | ef-exactly-target | age-60 |
   * prefs-taxable-account-on` ($156,000/yr, currentContribution 0), where
   * `employer-match` recommended $9,360/yr and `additional-401k` a further
   * $35,750/yr — $45,110 against a $35,750 limit (24,500 + 11,250 super
   * catch-up), over by exactly the match allocation. Post-fix the top-up asks
   * for 35,750 - 9,360 = $26,390 and the pair lands exactly on the limit.
   *
   * Scoped to what the shared budget can control: the match top-up is sized by
   * the employer's matched share of salary, so on a salary large enough for 6%
   * to clear $24,500 on its own it can exceed the limit before the top-up step
   * runs at all. What the top-up must never do is spend that room a second time.
   */
  it('never recommends 401k deferrals above the 402(g) limit across the match and top-up steps', () => {
    let exercised = 0
    const bad = collect((c, report) => {
      const b = c.normalized.benefits.employer401k
      const age = c.profile.preferences.age
      const limit = elective401kLimitFor(age)
      const existing = c.normalized.income.gross * 12 * b.currentContribution
      const matchTopUp = allocatedAnnual(c, 'employer-match')
      const topUp = allocatedAnnual(c, 'additional-401k')
      if (topUp > 0 && matchTopUp > 0) exercised++

      const room = Math.max(0, limit - existing - matchTopUp)
      if (topUp > room + 1e-6) {
        report(`tops up ${topUp}/yr with ${room} of room left (limit ${limit}, existing ${existing}, match step ${matchTopUp})`)
      }
      if (matchTopUp + topUp > 0 && existing + matchTopUp <= limit && existing + matchTopUp + topUp > limit + 1e-6) {
        report(`match ${matchTopUp} + top-up ${topUp} on ${existing} existing exceeds the ${limit} limit`)
      }
    })
    expect(bad).toEqual([])
    // Profiles where both steps recommend deferral are the ones that share the
    // budget, so the invariant is exercised rather than vacuous.
    expect(exercised).toBeGreaterThan(0)
  })

  /**
   * Regression guard for: IRC 415(c) caps all annual additions — employee
   * deferrals, employer match and after-tax contributions together — so the
   * mega-backdoor step has to net out what the match and top-up steps already
   * spent in the same run, including the match those deferrals induce.
   *
   * Same scoping as the 402(g) invariant above: the after-tax step is the one
   * that sweeps up whatever room is left, so it is the one held to the budget.
   */
  it('never recommends after-tax contributions above the age-banded 415(c) limit', () => {
    let exercised = 0
    const bad = collect((c, report) => {
      const b = c.normalized.benefits.employer401k
      if (!b.available) return
      const annualSalary = c.normalized.income.gross * 12
      const limit = total415cFor(c.profile.preferences.age)

      const existingDeferral = annualSalary * b.currentContribution
      const existingMatch = annualSalary * b.matchPercent * Math.min(b.matchLimit, b.currentContribution)
      const matchTopUp = allocatedAnnual(c, 'employer-match')
      const spentBefore =
        existingDeferral +
        existingMatch +
        matchTopUp * (1 + b.matchPercent) + // the top-up plus the match it induces
        allocatedAnnual(c, 'additional-401k')

      const afterTax = allocatedAnnual(c, 'mega-backdoor-roth')
      if (afterTax > 0) exercised++

      const room = Math.max(0, limit - spentBefore)
      if (afterTax > room + 1e-6) {
        report(`recommends ${afterTax}/yr of after-tax contributions with ${room} of 415(c) room (limit ${limit}, already committed ${spentBefore})`)
      }
    })
    expect(bad).toEqual([])
    expect(exercised).toBeGreaterThan(0)
  })

  /**
   * Regression guard for: the age-55 HSA catch-up (IRC 223(b)(3)) is a flat
   * $1,000 on top of the coverage-tier limit, and it has to reach both the
   * recommended amount and the cap the copy quotes.
   *
   * Trigger profile: `weekly | typical-paycheck | ... | hsa-family | age-64 |
   * prefs-six-month-target`, whose implementation read "($600/year toward the
   * $8,750 limit)" — $1,000 short in both the recommendation and the quoted cap
   * (individual: $4,400 rather than $5,400).
   */
  it('applies the HSA age-55 catch-up contribution', () => {
    let atFullLimit = 0
    const bad = collect((c, report) => {
      const hsa = c.result.allocations.find((a) => a.id === 'hsa-contribution')
      if (!hsa) return
      const b = c.profile.benefits.hsa
      const age = c.profile.preferences.age
      const limit = hsaLimitFor(b.coverageType, age)

      if (!hsa.implementation.includes(`the ${formatCurrency(limit)} limit`)) {
        report(`HSA implementation quotes the wrong cap for age ${age}: "${hsa.implementation}"`)
      }
      const total = b.employerContribution + b.currentContribution * 12 + annualize(c, hsa.amount)
      if (total > limit + 1e-6) report(`HSA total ${total} exceeds ${limit}`)
      if (age >= 55 && Math.abs(total - limit) < 1e-6) atFullLimit++
    })
    expect(bad).toEqual([])
    // Profiles that take the whole limit at 55+ are what the catch-up moves:
    // $4,400 -> $5,400 individual, $8,750 -> $9,750 family.
    expect(atFullLimit).toBeGreaterThan(0)
  })

  /**
   * Regression guard for: interest avoided can never exceed a full year of
   * interest on the balance itself — once the debt is retired there is nothing
   * left to accrue.
   *
   * Trigger profile: monthly pay, $6,000 net, one $3,000 balance at 29% APR
   * (minimum $90) and $2,800 of allocatable pay, which claimed "Pay extra $2,710
   * per paycheck toward High Card (saves $4,715/year in interest)" — more than a
   * year's interest on the balance ($870) and more than the balance itself.
   */
  it('never claims annual interest savings larger than balance x rate', () => {
    const withDebtAllocation = GRID.filter((c) =>
      c.result.allocations.some((a) => a.id === 'high-interest-debt')
    )
    expect(withDebtAllocation.length).toBeGreaterThan(0)

    const bad: string[] = []
    for (const c of withDebtAllocation) {
      const allocation = c.result.allocations.find((a) => a.id === 'high-interest-debt')!
      const target = c.profile.debts
        .filter((d) => d.interestRate > 0.07)
        .reduce((a, b) => (b.interestRate > a.interestRate ? b : a))
      const fullYearInterest = Math.max(0, target.balance) * target.interestRate
      const uncapped = (allocation.monthlyEquivalent ?? 0) * 12 * target.interestRate * 0.5
      const expected = Math.min(uncapped, fullYearInterest)

      if (!allocation.implementation.includes(`saves ${formatCurrency(expected)}/year`) && bad.length < 6) {
        bad.push(`${c.label} :: "${allocation.implementation}" against a ${formatCurrency(fullYearInterest)}/year ceiling`)
      }
      if (!allocation.reasoning.includes(`avoids up to ${formatCurrency(expected)} of interest a year`) && bad.length < 6) {
        bad.push(`${c.label} :: reasoning "${allocation.reasoning}"`)
      }
    }
    expect(bad).toEqual([])
    // The cap actually binds somewhere in the grid: a payment stream larger than
    // the balance would otherwise "save" more than the debt is worth.
    expect(
      withDebtAllocation.some((c) => {
        const a = c.result.allocations.find((x) => x.id === 'high-interest-debt')!
        const d = c.profile.debts.filter((x) => x.interestRate > 0.07).reduce((x, y) => (y.interestRate > x.interestRate ? y : x))
        return (a.monthlyEquivalent ?? 0) * 12 * d.interestRate * 0.5 > d.balance * d.interestRate
      })
    ).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Inputs the UI collects
// ─────────────────────────────────────────────────────────────────────────────

describe('inputs collected by the UI', () => {
  const baseSelection = (overrides: Partial<Selection> = {}): Selection => ({
    frequency: 'bi-weekly',
    paycheck: PAYCHECKS[2],
    bonus: BONUSES[0],
    employer: EMPLOYERS[2],
    hsa: HSAS[1],
    ira: IRAS[1],
    debts: DEBT_SETS[3],
    emergencyFund: EMERGENCY_FUNDS[1],
    age: 40,
    prefs: PREF_VARIANTS[0],
    ...overrides,
  })

  /**
   * Documents a gap rather than a miscalculation: bonus inputs (`regularBonus`,
   * `bonusAmount`, `bonusFrequency`) are collected by the UI and converted to
   * `income.bonusExpected` by core.ts `updateLegacyIncomeFields`, but no
   * downstream calculation reads `bonusExpected`, so a bonus never changes a
   * single allocation, skipped item, projection or score.
   */
  it('produces identical results with and without a bonus (bonus inputs are inert)', () => {
    const withoutBonus = runCase(baseSelection({ bonus: BONUSES[0] }))
    for (const bonus of BONUSES.slice(1)) {
      const withBonus = runCase(baseSelection({ bonus }))
      expect(withBonus.result.allocations).toEqual(withoutBonus.result.allocations)
      expect(withBonus.result.skippedItems).toEqual(withoutBonus.result.skippedItems)
      expect(withBonus.result.projections).toEqual(withoutBonus.result.projections)
      expect(withBonus.result.optimizationScore).toEqual(withoutBonus.result.optimizationScore)
    }
  })

  /**
   * Same shape for the taxable-account preferences: `hasTaxableAccount` and
   * `taxableAccountContribution` are collected (SavingsInputCard.tsx:195-212)
   * but read by no calculation — `calculateTaxableInvestment`
   * (optimization.ts:507) sweeps every remaining dollar into a taxable account
   * either way.
   */
  it('produces identical results whether or not the user reports a taxable account', () => {
    const off = runCase(baseSelection({ prefs: PREF_VARIANTS[0] }))
    const on = runCase(baseSelection({ prefs: PREF_VARIANTS[4] }))
    expect(on.result.allocations).toEqual(off.result.allocations)
    expect(on.result.projections).toEqual(off.result.projections)
  })

  /**
   * Regression guard for: the flexible-spending band the UI renders from
   * `funMoneyRange.difference` can never be negative.
   *
   * Trigger profile: `prefs-funmoney-min-above-max` (min 800, max 200) —
   * reachable because the max input is not constrained to the min, and
   * `validateProfile` only reports the error, it never blocks
   * `calculateOptimalAllocation`. It reported
   * `{ min: 800, max: 200, difference: -600 }`.
   *
   * A second, quieter case: `Number(max) || minFunMoneyMonthly || 0` treated a
   * deliberate max of 0 as falsy and silently replaced it with the minimum.
   */
  it('never reports a negative fun-money range', () => {
    const bad = collect((c, report) => {
      const range = c.result.funMoneyRange
      const min = c.profile.preferences.funMoney.min
      if (range.min !== min) report(`funMoneyRange.min ${range.min} !== preference ${min}`)
      if (range.max < range.min) report(`funMoneyRange max ${range.max} < min ${range.min}`)
      if (range.difference < 0) report(`funMoneyRange.difference = ${range.difference}`)
      if (Math.abs(range.difference - (range.max - range.min)) > 1e-9) {
        report(`funMoneyRange.difference ${range.difference} !== max - min`)
      }
    })
    expect(bad).toEqual([])

    // The inverted-input profile is in the grid, and its band collapses to zero
    // rather than going negative.
    const inverted = GRID.filter((c) => c.profile.preferences.funMoney.min > c.profile.preferences.funMoney.max)
    expect(inverted.length).toBeGreaterThan(0)
    expect(inverted[0].result.funMoneyRange).toEqual({ min: 800, max: 800, difference: 0 })

    // A maximum of 0 is a number, not a missing value: with no minimum either,
    // the band stays at zero instead of being back-filled from the minimum.
    const zeroMax = runCase(
      baseSelection({
        prefs: {
          label: 'prefs-funmoney-zero',
          necessaryExpenses: 3000,
          funMoney: { min: 0, max: 0, current: 0 },
          hasTaxableAccount: false,
          emergencyFundMonths: 3,
          emergencyFundAPY: DEFAULT_APY,
        },
      })
    )
    expect(zeroMax.result.funMoneyRange).toEqual({ min: 0, max: 0, difference: 0 })
  })

  /**
   * Regression guard for: necessary expenses above take-home pay leave nothing
   * to allocate, and the `Math.max(0, ...)` clamp on the pool hides why. The
   * result now carries the gap, so the UI can say "your necessary expenses
   * exceed your take-home pay" instead of rendering an unexplained empty plan.
   *
   * Trigger profile: `prefs-necessary-above-net-income` ($20,000/mo of expenses
   * against $4,875/mo net), or any zero-paycheck profile — both returned
   * `allocations = []`, `remainingAmount = 0` and a full projection/score
   * payload with no indication of the shortfall.
   */
  it('surfaces a shortfall when necessary expenses exceed take-home pay', () => {
    let shortfallCases = 0
    const bad = collect((c, report) => {
      const ctx = c.result.paycheckContext!
      const gap = ctx.necessaryExpensesPerPaycheck - ctx.netPaycheck
      const reported = c.result.incomeShortfall

      if (gap > 0) {
        shortfallCases++
        if (reported === undefined) {
          report(`no incomeShortfall despite ${ctx.necessaryExpensesPerPaycheck} of expenses against ${ctx.netPaycheck} of pay`)
          return
        }
        if (Math.abs(reported - gap) > 1e-9) report(`incomeShortfall ${reported} !== ${gap}`)
        if (c.result.allocations.length > 0) report(`allocates ${c.result.allocations.length} items with nothing left to allocate`)
        if (c.result.remainingAmount !== 0) report(`remainingAmount ${c.result.remainingAmount} alongside a shortfall`)
      } else if (reported !== undefined) {
        // Absence of the field has to mean "take-home pay covers the expenses".
        report(`reports incomeShortfall ${reported} with ${ctx.netPaycheck} of pay against ${ctx.necessaryExpensesPerPaycheck} of expenses`)
      }
    })
    expect(bad).toEqual([])
    expect(shortfallCases).toBeGreaterThan(0)
    // The complement is exercised too: most profiles carry no shortfall field.
    expect(GRID.some((c) => c.result.incomeShortfall === undefined)).toBe(true)
  })
})

