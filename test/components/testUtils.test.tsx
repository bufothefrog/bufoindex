import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
// The helper import must precede anything that loads next/navigation: the
// hoisted vi.mock factory below reads it when next/navigation first loads.
import {
  nextNavigationFactory,
  resetRouterMock,
  routerMock,
  setMockPathname,
  setMockSearchParams,
} from '@/test/utils/navigation'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getDefaultFinancialProfile } from '@/lib/profile/defaults'
import { useProfileStore } from '@/lib/store/profileStore'
import { renderWithProfile } from '@/test/utils/render'
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores'

vi.mock('next/navigation', () => nextNavigationFactory('?next=retirement'))

beforeEach(() => {
  resetRouterMock()
  clearBrowserState()
  resetProfileStore()
})

function Probe() {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const { hasHydrated, hasProfile, profile } = useProfileStore()
  return (
    <button type="button" onClick={() => router.push('/start/choose')}>
      {`${pathname}|${params.get('next') ?? 'none'}|${hasHydrated}|${hasProfile}|${profile.person.age}`}
    </button>
  )
}

describe('test/utils/navigation', () => {
  it('serves the factory search params, a stable router and the default pathname', () => {
    renderWithProfile(<Probe />)
    expect(screen.getByRole('button')).toHaveTextContent(/^\/\|retirement\|/)
    screen.getByRole('button').click()
    expect(routerMock.push).toHaveBeenCalledWith('/start/choose')
    expect(useRouter()).toBe(routerMock)
  })

  it('lets a test change search params and pathname, and resetRouterMock restores them', () => {
    setMockSearchParams({ next: 'portfolio' })
    setMockPathname('/start')
    routerMock.replace('/x')
    expect(useSearchParams().get('next')).toBe('portfolio')
    expect(usePathname()).toBe('/start')

    resetRouterMock()
    expect(routerMock.replace).not.toHaveBeenCalled()
    expect(useSearchParams().get('next')).toBe('retirement')
    expect(usePathname()).toBe('/')
  })
})

describe('test/utils/stores and render', () => {
  it('renders with a supplied profile and hydration flag', () => {
    const profile = getDefaultFinancialProfile()
    profile.person.age = 41
    profile.provided = ['person.age']
    renderWithProfile(<Probe />, { profile, hydrated: false })
    expect(screen.getByRole('button')).toHaveTextContent('|false|true|41')
  })

  it('resets to the default, hydrated, unanswered profile', () => {
    useProfileStore.getState().setProvidedValue('person.age', 50)
    resetProfileStore()
    const state = useProfileStore.getState()
    expect(state.hasHydrated).toBe(true)
    expect(state.hasProfile).toBe(false)
    expect(state.profile).toEqual(getDefaultFinancialProfile())
  })

  it('clears storage and the location search and hash', () => {
    localStorage.setItem('a', '1')
    sessionStorage.setItem('b', '2')
    window.history.replaceState(null, '', '/tools/x?from=profile#abc')
    clearBrowserState()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/tools/x')
  })
})

describe('test/setup', () => {
  it('registers toBeCloseToCurrency and a ResizeObserver stub', () => {
    expect(1000.004).toBeCloseToCurrency(1000)
    expect(1000.02).not.toBeCloseToCurrency(1000)
    const observer = new ResizeObserver(() => {})
    expect(() => {
      observer.observe(document.body)
      observer.disconnect()
    }).not.toThrow()
  })
})
