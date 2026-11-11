import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { screen } from '@testing-library/react'
// next/navigation is imported before the helper on purpose: the async
// factory form works in any import order.
import { useRouter, useSearchParams, redirect, notFound } from 'next/navigation'
import { resetRouterMock, routerMock } from '@/test/utils/navigation'
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores'
import { renderWithProfile } from '@/test/utils/render'
import { getDefaultFinancialProfile } from '@/lib/profile/defaults'
import { useProfileStore } from '@/lib/store/profileStore'

vi.mock('next/navigation', async () =>
  (await import('@/test/utils/navigation')).nextNavigationFactory('a=1&b=two')
)

function AgeProbe() {
  const age = useProfileStore((s) => s.profile.person.age)
  return createElement('p', null, `Age is ${age}`)
}

describe('navigation helpers', () => {
  it('records router calls and forgets them on reset', () => {
    const router = useRouter()
    router.push('/start')
    router.replace('/overview')
    expect(routerMock.push).toHaveBeenCalledWith('/start')
    expect(routerMock.replace).toHaveBeenCalledTimes(1)

    resetRouterMock()
    expect(routerMock.push).not.toHaveBeenCalled()
    expect(routerMock.replace).not.toHaveBeenCalled()
  })

  it('serves the configured search string and throws from redirect and notFound', () => {
    expect(useSearchParams().get('b')).toBe('two')
    expect(() => redirect('/start')).toThrow('NEXT_REDIRECT:/start')
    expect(() => notFound()).toThrow('NEXT_NOT_FOUND')
  })
})

describe('resetProfileStore', () => {
  it('restores defaults and the hydration flag', () => {
    useProfileStore.getState().setProvidedValue('person.age', 41)
    resetProfileStore({ hydrated: false })

    const state = useProfileStore.getState()
    expect(state.profile.person.age).toBe(getDefaultFinancialProfile().person.age)
    expect(state.hasProfile).toBe(false)
    expect(state.hasHydrated).toBe(false)

    resetProfileStore()
    expect(useProfileStore.getState().hasHydrated).toBe(true)
  })

  it('seeds a profile patch and marks its leaves as provided', () => {
    resetProfileStore({ profile: { person: { age: 52, state: 'WA' } } })

    const state = useProfileStore.getState()
    expect(state.profile.person.age).toBe(52)
    expect(state.profile.person.state).toBe('WA')
    expect(state.profile.provided).toEqual(['person.age', 'person.state'])
    expect(state.hasProfile).toBe(true)
  })

  it('marks nested assumption leaves and whole lists as provided', () => {
    const debt = { id: 'd1', name: 'Card', balance: 1200, interestRate: 0.2, minimumPayment: 40, extraPayment: 0, taxDeductible: false }
    resetProfileStore({
      profile: {
        assumptions: { retirement: { riskProfile: 'custom', volatility: 0.2 } },
        debts: [debt],
      },
    })

    const state = useProfileStore.getState()
    expect(state.profile.assumptions.retirement.riskProfile).toBe('custom')
    expect(state.profile.assumptions.retirement.volatility).toBe(0.2)
    expect(state.profile.debts).toHaveLength(1)
    // Section order: debts comes before assumptions.
    expect(state.profile.provided).toEqual([
      'debts',
      'assumptions.retirement.riskProfile',
      'assumptions.retirement.volatility',
    ])
    expect(state.hasProfile).toBe(true)
  })
})

describe('clearBrowserState', () => {
  it('empties both storages, the hash and the query string', () => {
    localStorage.setItem('k', 'v')
    sessionStorage.setItem('k', 'v')
    window.history.replaceState(null, '', '/?q=1#h=abc')
    expect(window.location.search).toBe('?q=1')
    expect(window.location.hash).toBe('#h=abc')

    clearBrowserState()

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })
})

describe('renderWithProfile', () => {
  it('renders against the given profile', () => {
    renderWithProfile(createElement(AgeProbe), { profile: { person: { age: 47 } } })
    expect(screen.getByText('Age is 47')).toBeInTheDocument()
  })

  it('renders against the defaults when no profile is given', () => {
    renderWithProfile(createElement(AgeProbe))
    expect(screen.getByText('Age is 30')).toBeInTheDocument()
  })
})

describe('global setup', () => {
  it('registers toBeCloseToCurrency and a ResizeObserver', () => {
    expect(10.004).toBeCloseToCurrency(10)
    expect(() => expect(10.5).toBeCloseToCurrency(10)).toThrow()
    expect(() => new ResizeObserver(() => {}).observe(document.body)).not.toThrow()
  })
})
