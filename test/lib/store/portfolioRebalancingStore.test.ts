/**
 * Portfolio Rebalancing Store Test Suite
 *
 * Exercises the Zustand store's actions directly through
 * usePortfolioRebalancingStore.getState() — no React rendering. Covers the
 * worked-example seed state, entity CRUD with security garbage collection,
 * ticker linking, target management with clamping, the calculate trigger
 * (including the auto-recalculate-after-first-calculate behavior), the
 * share-URL round trip, and reset.
 *
 * Portfolio value of the seed state, hand-computed:
 *   Roth IRA:   10 VTI × $250 = $2,500 ; 5 BND × $75 = $375   → $2,875
 *   Brokerage:  20 VTI × $250 = $5,000 ; 15 VXUS × $60 = $900 → $5,900
 *   Total holdings value: $8,775 ; deposits: $500 + $1,500 = $2,000
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  selectCustomAssetClasses,
  usePortfolioRebalancingStore,
} from '@/lib/store/portfolioRebalancingStore'
import { encodeRebalancingToUrlHash } from '@/lib/utils/portfolioRebalancingState'
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers'

const store = usePortfolioRebalancingStore

beforeEach(() => {
  store.getState().reset()
  window.location.hash = ''
})

describe('seed state', () => {
  it('starts with the worked-example three-fund portfolio', () => {
    const { inputs, result, errors, hasCalculatedOnce } = store.getState()
    expect(result).toBeNull()
    expect(errors).toEqual([])
    expect(hasCalculatedOnce).toBe(false)

    expect(inputs.setupMode).toBe('multi-shared')
    expect(inputs.securities.map((s) => s.ticker)).toEqual(['VTI', 'VXUS', 'BND'])
    expect(inputs.accounts.map((a) => a.name)).toEqual(['Roth IRA', 'Brokerage'])
    expect(inputs.holdings).toHaveLength(4)
    // Classic 60/25/15 targets (plus a 0% cash row) sum to exactly 1.
    const sum = inputs.classTargets.reduce((s, t) => s + t.target, 0)
    expect(sum).toBeCloseTo(1, 10)
    expect(inputs.mode).toBe('whole')
    expect(inputs.allowTaxableSelling).toBe(false)
  })
})

describe('security actions', () => {
  it('addSecurity appends a blank security and returns its id', () => {
    const id = store.getState().addSecurity()
    const { securities } = store.getState().inputs
    expect(securities).toHaveLength(4)
    const added = securities.find((s) => s.id === id)
    expect(added).toEqual({ id, ticker: '', price: 0, assetClass: 'other' })
  })

  it('updateSecurity patches fields in place', () => {
    store.getState().updateSecurity('sec-vti', { price: 260, name: 'Renamed' })
    const vti = store.getState().inputs.securities.find((s) => s.id === 'sec-vti')
    expect(vti?.price).toBe(260)
    expect(vti?.name).toBe('Renamed')
    expect(vti?.ticker).toBe('VTI') // untouched field preserved
  })

  it('removeSecurity drops the security and every holding referencing it', () => {
    store.getState().removeSecurity('sec-vti')
    const { securities, holdings } = store.getState().inputs
    expect(securities.map((s) => s.id)).toEqual(['sec-vxus', 'sec-bnd'])
    // Both VTI holdings (Roth + Brokerage) are gone.
    expect(holdings.map((h) => h.id)).toEqual(['hld-roth-bnd', 'hld-brok-vxus'])
  })
})

describe('account actions', () => {
  it('addAccount appends a numbered taxable account with zero deposit', () => {
    store.getState().addAccount()
    const { accounts } = store.getState().inputs
    expect(accounts).toHaveLength(3)
    expect(accounts[2]).toMatchObject({
      name: 'Account 3',
      accountType: 'taxable',
      deposit: 0,
    })
  })

  it('updateAccount patches fields in place', () => {
    store.getState().updateAccount('acc-roth', { deposit: 1000 })
    const roth = store.getState().inputs.accounts.find((a) => a.id === 'acc-roth')
    expect(roth?.deposit).toBe(1000)
    expect(roth?.accountType).toBe('tax-free')
  })

  it('removeAccount drops its holdings and garbage-collects orphaned securities', () => {
    store.getState().removeAccount('acc-roth')
    const { accounts, holdings, securities } = store.getState().inputs
    expect(accounts.map((a) => a.id)).toEqual(['acc-brok'])
    expect(holdings.map((h) => h.id)).toEqual(['hld-brok-vti', 'hld-brok-vxus'])
    // BND was held only in the Roth, so its security is GC'd; VTI survives
    // because the brokerage still holds it.
    expect(securities.map((s) => s.id)).toEqual(['sec-vti', 'sec-vxus'])
  })
})

describe('holding actions', () => {
  it('addHolding defaults to the first account and creates a paired blank security', () => {
    store.getState().addHolding()
    const { holdings, securities } = store.getState().inputs
    expect(holdings).toHaveLength(5)
    expect(securities).toHaveLength(4)
    const added = holdings[4]
    expect(added.accountId).toBe('acc-roth')
    expect(added.shares).toBe(0)
    const paired = securities.find((s) => s.id === added.securityId)
    expect(paired).toMatchObject({ ticker: '', price: 0, assetClass: 'other' })
  })

  it('addHolding targets an explicit account', () => {
    store.getState().addHolding('acc-brok')
    const added = store.getState().inputs.holdings[4]
    expect(added.accountId).toBe('acc-brok')
  })

  it('updateHolding patches shares', () => {
    store.getState().updateHolding('hld-roth-vti', { shares: 42 })
    const h = store.getState().inputs.holdings.find((x) => x.id === 'hld-roth-vti')
    expect(h?.shares).toBe(42)
  })

  it('removeHolding garbage-collects a security only when it becomes orphaned', () => {
    // BND is held only by the Roth holding → security GC'd with it.
    store.getState().removeHolding('hld-roth-bnd')
    expect(
      store.getState().inputs.securities.some((s) => s.id === 'sec-bnd'),
    ).toBe(false)

    // VTI is held by both accounts → removing one keeps the security.
    store.getState().removeHolding('hld-roth-vti')
    expect(
      store.getState().inputs.securities.some((s) => s.id === 'sec-vti'),
    ).toBe(true)
    expect(store.getState().inputs.holdings).toHaveLength(2)
  })

  it('linkHoldingToSecurity swaps the reference and GCs the orphaned security', () => {
    store.getState().linkHoldingToSecurity('hld-roth-bnd', 'sec-vxus')
    const { holdings, securities } = store.getState().inputs
    expect(holdings.find((h) => h.id === 'hld-roth-bnd')?.securityId).toBe('sec-vxus')
    expect(securities.some((s) => s.id === 'sec-bnd')).toBe(false)
  })
})

describe('linkHoldingByTicker', () => {
  it('normalizes the ticker and swaps to an existing security, GCing the orphan', () => {
    store.getState().linkHoldingByTicker('hld-roth-bnd', '  vti ')
    const { holdings, securities } = store.getState().inputs
    expect(holdings.find((h) => h.id === 'hld-roth-bnd')?.securityId).toBe('sec-vti')
    expect(securities.some((s) => s.id === 'sec-bnd')).toBe(false)
    expect(securities).toHaveLength(2)
  })

  it('renames the security in place when this holding is its only user', () => {
    store.getState().linkHoldingByTicker('hld-brok-vxus', 'schf')
    const { holdings, securities } = store.getState().inputs
    // Same security id, new ticker — no new security created.
    expect(holdings.find((h) => h.id === 'hld-brok-vxus')?.securityId).toBe('sec-vxus')
    expect(securities.find((s) => s.id === 'sec-vxus')?.ticker).toBe('SCHF')
    expect(securities).toHaveLength(3)
  })

  it('creates a new security when the current one is shared with another holding', () => {
    store.getState().linkHoldingByTicker('hld-roth-vti', 'VOO')
    const { holdings, securities } = store.getState().inputs
    const rothVti = holdings.find((h) => h.id === 'hld-roth-vti')
    expect(rothVti?.securityId).not.toBe('sec-vti')
    // The brokerage's VTI is untouched.
    expect(holdings.find((h) => h.id === 'hld-brok-vti')?.securityId).toBe('sec-vti')
    expect(securities).toHaveLength(4)
    expect(securities.find((s) => s.id === rothVti?.securityId)?.ticker).toBe('VOO')
  })

  it('ignores blank tickers', () => {
    const before = store.getState().inputs
    store.getState().linkHoldingByTicker('hld-roth-bnd', '   ')
    expect(store.getState().inputs).toBe(before)
  })
})

describe('asset-class targets', () => {
  it('setClassTarget updates an existing portfolio-wide row', () => {
    store.getState().setClassTarget('us-stock', 0.5)
    const row = store
      .getState()
      .inputs.classTargets.find((t) => t.assetClass === 'us-stock')
    expect(row).toEqual({ accountId: null, assetClass: 'us-stock', target: 0.5 })
    // No duplicate row was appended.
    expect(
      store.getState().inputs.classTargets.filter((t) => t.assetClass === 'us-stock'),
    ).toHaveLength(1)
  })

  it('setClassTarget clamps to [0, 1] and zeroes non-finite input', () => {
    store.getState().setClassTarget('us-stock', 1.5)
    expect(
      store.getState().inputs.classTargets.find((t) => t.assetClass === 'us-stock')
        ?.target,
    ).toBe(1)

    store.getState().setClassTarget('us-stock', -0.25)
    expect(
      store.getState().inputs.classTargets.find((t) => t.assetClass === 'us-stock')
        ?.target,
    ).toBe(0)

    store.getState().setClassTarget('us-stock', NaN)
    expect(
      store.getState().inputs.classTargets.find((t) => t.assetClass === 'us-stock')
        ?.target,
    ).toBe(0)
  })

  it('setClassTarget appends a row for a class with no existing target', () => {
    store.getState().setClassTarget('reit', 0.1)
    const row = store
      .getState()
      .inputs.classTargets.find((t) => t.assetClass === 'reit')
    expect(row).toEqual({ accountId: null, assetClass: 'reit', target: 0.1 })
  })

  it('ensureAssetClassVisible adds a 0% row exactly once', () => {
    store.getState().ensureAssetClassVisible('reit')
    store.getState().ensureAssetClassVisible('reit')
    const rows = store
      .getState()
      .inputs.classTargets.filter((t) => t.assetClass === 'reit')
    expect(rows).toEqual([{ accountId: null, assetClass: 'reit', target: 0 }])
  })

  it('removeAssetClass drops the target row', () => {
    store.getState().removeAssetClass('cash')
    expect(
      store.getState().inputs.classTargets.some((t) => t.assetClass === 'cash'),
    ).toBe(false)
  })

  it('addCustomAssetClass registers the class with a 0% target and returns its id', () => {
    const id = store.getState().addCustomAssetClass('  Crypto  ')
    expect(id).toMatch(/^cac-/)
    const { customAssetClasses, classTargets } = store.getState().inputs
    expect(customAssetClasses).toEqual([{ id, label: 'Crypto' }])
    expect(classTargets.find((t) => t.assetClass === id)).toEqual({
      accountId: null,
      assetClass: id,
      target: 0,
    })
  })

  it('addCustomAssetClass reuses an existing class on a case-insensitive label match', () => {
    const first = store.getState().addCustomAssetClass('Crypto')
    const second = store.getState().addCustomAssetClass('crypto')
    expect(second).toBe(first)
    expect(store.getState().inputs.customAssetClasses).toHaveLength(1)
    expect(
      store.getState().inputs.classTargets.filter((t) => t.assetClass === first),
    ).toHaveLength(1)
  })

  it('addCustomAssetClass rejects blank labels', () => {
    expect(store.getState().addCustomAssetClass('   ')).toBe('')
    expect(store.getState().inputs.customAssetClasses).toEqual([])
  })

  it('removeAssetClass on a custom class also unregisters it', () => {
    const id = store.getState().addCustomAssetClass('Crypto')
    store.getState().removeAssetClass(id)
    expect(store.getState().inputs.customAssetClasses).toEqual([])
    expect(
      store.getState().inputs.classTargets.some((t) => t.assetClass === id),
    ).toBe(false)
  })
})

describe('flags', () => {
  it('setAllowTaxableSelling and setMode update inputs', () => {
    store.getState().setAllowTaxableSelling(true)
    store.getState().setMode('fractional')
    expect(store.getState().inputs.allowTaxableSelling).toBe(true)
    expect(store.getState().inputs.mode).toBe('fractional')
  })
})

describe('calculate', () => {
  it('populates the result with the hand-computed portfolio totals', () => {
    store.getState().calculate()
    const { result, errors, hasCalculatedOnce } = store.getState()
    expect(errors).toEqual([])
    expect(hasCalculatedOnce).toBe(true)
    expect(result).not.toBeNull()
    // Seed portfolio: $2,875 (Roth) + $5,900 (Brokerage) = $8,775
    expect(result!.totalValueBefore).toBe(8775)
    // Deposits: $500 + $1,500 = $2,000
    expect(result!.totalDeposit).toBe(2000)
    expect(result!.accounts).toHaveLength(2)
    expect(result!.mode).toBe('whole')
    // Money conservation: after = before + deposit − uninvested cash.
    expect(result!.totalValueAfter).toBeCloseTo(
      8775 + 2000 - result!.cashLeftover,
      6,
    )
  })

  it('surfaces validation errors and nulls the result when targets do not sum to 100%', () => {
    store.getState().setClassTarget('us-stock', 0.9) // sum now 1.30
    store.getState().calculate()
    const { result, errors } = store.getState()
    expect(result).toBeNull()
    expect(errors.map((e) => e.field)).toContain('classTargets.sum')
    expect(store.getState().hasCalculatedOnce).toBe(true)
  })

  it('recalculates automatically on mutation after the first calculate', () => {
    store.getState().calculate()
    // Doubling the Roth VTI position adds 10 × $250 = $2,500 → $11,275.
    store.getState().updateHolding('hld-roth-vti', { shares: 20 })
    expect(store.getState().result?.totalValueBefore).toBe(8775 + 2500)
  })

  it('does not calculate on mutation before the first explicit calculate', () => {
    store.getState().updateHolding('hld-roth-vti', { shares: 20 })
    expect(store.getState().result).toBeNull()
    expect(store.getState().hasCalculatedOnce).toBe(false)
  })
})

describe('share-URL round trip', () => {
  it('loadFromUrl restores inputs encoded by encodeRebalancingToUrlHash', () => {
    const original = store.getState().inputs
    const hash = encodeRebalancingToUrlHash(original)
    expect(hash).not.toBe('')

    // Make the pre-load state dirty so we can see loadFromUrl clear it.
    store.getState().calculate()
    expect(store.getState().result).not.toBeNull()

    window.location.hash = hash
    store.getState().loadFromUrl()

    const state = store.getState()
    // An empty custom-class list encodes to an absent key but must come back
    // as [] (never undefined), so the whole input object round-trips.
    expect(state.inputs).toEqual(original)
    expect(state.inputs.customAssetClasses).toEqual([])
    // A hash is a complete scenario, so loading it runs the rebalance: the
    // same worked example as the explicit-calculate test above.
    expect(state.errors).toEqual([])
    expect(state.hasCalculatedOnce).toBe(true)
    expect(state.result).not.toBeNull()
    expect(state.result!.totalValueBefore).toBe(8775)
    expect(state.result!.totalDeposit).toBe(2000)
  })

  it('selectCustomAssetClasses returns a stable reference when the list is absent', () => {
    // The shape a pre-fix decoded hash produced: the key present but undefined.
    const state = { inputs: { ...store.getState().inputs, customAssetClasses: undefined } }
    const first = selectCustomAssetClasses(state)
    expect(first).toEqual([])
    // Same reference on every read, so useSyncExternalStore sees no change.
    expect(selectCustomAssetClasses(state)).toBe(first)
    // The default store state carries its own list, which is returned as-is.
    expect(selectCustomAssetClasses(store.getState())).toBe(
      store.getState().inputs.customAssetClasses,
    )
  })

  it('loadFromUrl surfaces validation errors from a hash whose targets do not sum to 100%', () => {
    store.getState().setClassTarget('us-stock', 0.9) // sum now 1.30
    const hash = encodeRebalancingToUrlHash(store.getState().inputs)
    store.getState().reset()
    window.location.hash = hash
    store.getState().loadFromUrl()
    const state = store.getState()
    expect(state.result).toBeNull()
    expect(state.hasCalculatedOnce).toBe(true)
    expect(state.errors.map((e) => e.field)).toContain('classTargets.sum')
  })

  it('round-trips mutated inputs including flags and custom asset classes', () => {
    store.getState().setAllowTaxableSelling(true)
    store.getState().setMode('fractional')
    const cryptoId = store.getState().addCustomAssetClass('Crypto')
    store.getState().setClassTarget('us-stock', 0.5)
    store.getState().setClassTarget(cryptoId, 0.1)
    const mutated = store.getState().inputs
    const hash = encodeRebalancingToUrlHash(mutated)

    store.getState().reset() // wipe to defaults (also clears the URL hash)
    window.location.hash = hash
    store.getState().loadFromUrl()

    expect(store.getState().inputs).toEqual(mutated)
  })

  it('loadFromUrl ignores an unparseable hash', () => {
    const before = store.getState().inputs
    window.location.hash = '#not-a-valid-hash!!!'
    store.getState().loadFromUrl()
    expect(store.getState().inputs).toBe(before)
  })
})

describe('reset', () => {
  it('restores the seed state after arbitrary mutation', () => {
    store.getState().removeAccount('acc-roth')
    store.getState().setMode('fractional')
    store.getState().calculate()

    store.getState().reset()

    const { inputs, result, errors, hasCalculatedOnce } = store.getState()
    expect(inputs.accounts.map((a) => a.id)).toEqual(['acc-roth', 'acc-brok'])
    expect(inputs.holdings).toHaveLength(4)
    expect(inputs.securities.map((s) => s.ticker)).toEqual(['VTI', 'VXUS', 'BND'])
    expect(inputs.mode).toBe('whole')
    expect(result).toBeNull()
    expect(errors).toEqual([])
    expect(hasCalculatedOnce).toBe(false)
  })
})
