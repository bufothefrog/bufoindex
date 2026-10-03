import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  encodeToUrlHash,
  decodeFromUrlHash,
  formatCurrency,
  parseCurrency,
  formatPercent,
} from '@/lib/utils'
import { createPaycheckProfile, createIncomeData } from '@/test/factories/test-data-factory'
import type { PaycheckProfile, IncomeData } from '@/lib/types'

type DecodedShare = {
  displayMode: 'today' | 'nominal'
  profile: PaycheckProfile & { income: IncomeData }
}

/** Build a hash the way an old shared link would look, from a raw payload. */
function hashFromPayload(payload: unknown): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encodeToUrlHash / decodeFromUrlHash round trip', () => {
  it('is URL-safe (no +, / or = characters)', () => {
    const hash = encodeToUrlHash({ profile: createPaycheckProfile(), displayMode: 'today' })
    expect(hash.length).toBeGreaterThan(0)
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('round-trips the per-paycheck income fields the UI and engine consume', () => {
    const profile = createPaycheckProfile()
    const hash = encodeToUrlHash({ profile, displayMode: 'today' })
    const decoded = decodeFromUrlHash(hash) as DecodedShare

    // Factory income: grossPaycheck 3000, netPaycheck 2250, bi-weekly
    expect(decoded.profile.income.grossPaycheck).toBe(3000)
    expect(decoded.profile.income.netPaycheck).toBe(2250)
    expect(decoded.profile.income.frequency).toBe('bi-weekly')
  })

  it('round-trips bonus settings exactly', () => {
    const profile = createPaycheckProfile({
      income: createIncomeData({ regularBonus: true, bonusAmount: 2000, bonusFrequency: 'quarterly', bonusExpected: 2000 / 3 }),
    })
    const decoded = decodeFromUrlHash(encodeToUrlHash({ profile, displayMode: 'today' })) as DecodedShare

    expect(decoded.profile.income.regularBonus).toBe(true)
    expect(decoded.profile.income.bonusAmount).toBe(2000)
    expect(decoded.profile.income.bonusFrequency).toBe('quarterly')
  })

  it('round-trips taxes and preferences', () => {
    const profile = createPaycheckProfile()
    const decoded = decodeFromUrlHash(encodeToUrlHash({ profile, displayMode: 'today' })) as DecodedShare

    expect(decoded.profile.taxes.state).toBe(profile.taxes.state)
    expect(decoded.profile.taxes.filingStatus).toBe(profile.taxes.filingStatus)
    expect(decoded.profile.preferences.necessaryExpenses).toBe(profile.preferences.necessaryExpenses)
    expect(decoded.profile.preferences.age).toBe(profile.preferences.age)
    expect(decoded.profile.source).toBe('shared')
  })

  it('round-trips the emergency-fund target months, eliding the legacy default of 6', () => {
    const three = createPaycheckProfile()
    three.preferences.emergencyFundMonths = 3
    const six = createPaycheckProfile()
    six.preferences.emergencyFundMonths = 6
    const one = createPaycheckProfile()
    one.preferences.emergencyFundMonths = 1

    expect((decodeFromUrlHash(encodeToUrlHash({ profile: three })) as DecodedShare).profile.preferences.emergencyFundMonths).toBe(3)
    expect((decodeFromUrlHash(encodeToUrlHash({ profile: one })) as DecodedShare).profile.preferences.emergencyFundMonths).toBe(1)
    expect((decodeFromUrlHash(encodeToUrlHash({ profile: six })) as DecodedShare).profile.preferences.emergencyFundMonths).toBe(6)
    // 6 is elided from the payload entirely
    const sixPayload = JSON.parse(atob(encodeToUrlHash({ profile: six }).replace(/-/g, '+').replace(/_/g, '/')))
    expect(sixPayload.p.pr?.efm).toBeUndefined()
  })

  it('round-trips IRA contributions and balances when the user has an IRA', () => {
    const profile = createPaycheckProfile()
    profile.benefits.ira = {
      hasIRA: true,
      accountTypes: { traditional: false, roth: true },
      currentContributions: { traditional: 0, roth: 250 },
      currentBalances: { traditional: 1200, roth: 8000 },
    }
    const decoded = decodeFromUrlHash(encodeToUrlHash({ profile })) as DecodedShare

    expect(decoded.profile.benefits.ira).toEqual({
      hasIRA: true,
      accountTypes: { traditional: false, roth: true },
      currentContributions: { traditional: 0, roth: 250 },
      currentBalances: { traditional: 1200, roth: 8000 },
    })
  })

  it('round-trips a 0% emergency-fund APY instead of falling back to 4%', () => {
    const profile = createPaycheckProfile()
    profile.preferences.emergencyFundAPY = 0
    const decoded = decodeFromUrlHash(encodeToUrlHash({ profile })) as DecodedShare
    expect(decoded.profile.preferences.emergencyFundAPY).toBe(0)

    // The default is elided from the payload and restored on decode.
    const defaultApy = createPaycheckProfile()
    defaultApy.preferences.emergencyFundAPY = 0.04
    const payload = JSON.parse(atob(encodeToUrlHash({ profile: defaultApy }).replace(/-/g, '+').replace(/_/g, '/')))
    expect(payload.p.pr?.apy).toBeUndefined()
    expect((decodeFromUrlHash(encodeToUrlHash({ profile: defaultApy })) as DecodedShare).profile.preferences.emergencyFundAPY).toBe(0.04)
  })

  it("preserves 'nominal' display mode and defaults to 'today' when elided", () => {
    const profile = createPaycheckProfile()
    const nominal = decodeFromUrlHash(encodeToUrlHash({ profile, displayMode: 'nominal' })) as DecodedShare
    const today = decodeFromUrlHash(encodeToUrlHash({ profile, displayMode: 'today' })) as DecodedShare

    expect(nominal.displayMode).toBe('nominal')
    expect(today.displayMode).toBe('today')
  })
})

describe('decodeFromUrlHash legacy payloads (no per-paycheck keys)', () => {
  it('derives per-paycheck amounts from monthly figures via the frequency multiplier', () => {
    // An old link that only carried monthly gross/net at bi-weekly frequency
    const decoded = decodeFromUrlHash(
      hashFromPayload({ v: 2, p: { ig: 6500, in: 4500, if: 'bi-weekly' } })
    ) as DecodedShare

    // bi-weekly multiplier is 26/12, so paycheck = monthly / (26/12)
    expect(decoded.profile.income.grossPaycheck).toBeCloseTo(6500 / (26 / 12), 6)
    expect(decoded.profile.income.netPaycheck).toBeCloseTo(4500 / (26 / 12), 6)
    expect(decoded.profile.income.monthlyGross).toBe(6500)
    expect(decoded.profile.income.monthlyNet).toBe(4500)
  })

  it('derives bonus settings from the monthly bonus equivalent', () => {
    // v1 payload: monthly bonus equivalent of 500 with no bonus detail keys
    const decoded = decodeFromUrlHash(hashFromPayload({ v: 1, p: { ib: 500 } })) as DecodedShare

    expect(decoded.displayMode).toBe('today')
    expect(decoded.profile.income.regularBonus).toBe(true)
    expect(decoded.profile.income.bonusFrequency).toBe('annual')
    expect(decoded.profile.income.bonusAmount).toBe(500 * 12)
  })

  it('fills the ira and hsa blocks the engine reads, and keeps the 6-month target, for payloads without them', () => {
    const decoded = decodeFromUrlHash(
      hashFromPayload({ v: 2, p: { ipg: 3000, ipn: 2250, if: 'bi-weekly', pr: { ne: 2000 } } })
    ) as DecodedShare

    expect(decoded.profile.benefits.ira).toEqual({
      hasIRA: false,
      accountTypes: { traditional: false, roth: false },
      currentContributions: { traditional: 0, roth: 0 },
      currentBalances: { traditional: 0, roth: 0 },
    })
    expect(decoded.profile.benefits.hsa.investmentStrategy).toBe(false)
    expect(decoded.profile.preferences.emergencyFundMonths).toBe(6)
  })

  it('returns null for empty, garbage, or unsupported-version hashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(decodeFromUrlHash('')).toBeNull()
    expect(decodeFromUrlHash('#')).toBeNull()
    expect(decodeFromUrlHash('not-valid-base64!!!')).toBeNull()
    expect(decodeFromUrlHash(hashFromPayload({ v: 99, p: {} }))).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('formatCurrency rounds to whole dollars with separators', () => {
    expect(formatCurrency(1526.67)).toBe('$1,527')
    expect(formatCurrency(0)).toBe('$0')
  })

  it('parseCurrency strips formatting', () => {
    expect(parseCurrency('$1,527')).toBe(1527)
    expect(parseCurrency('')).toBe(0)
  })

  it('formatPercent renders decimals as percentages', () => {
    expect(formatPercent(0.06)).toBe('6%')
    expect(formatPercent(0.235)).toBe('23.5%')
  })
})
