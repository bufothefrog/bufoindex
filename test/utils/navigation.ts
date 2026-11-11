/**
 * Shared next/navigation mock.
 *
 * Usage in a test file:
 *
 *   import { nextNavigationFactory, resetRouterMock, routerMock } from '@/test/utils/navigation'
 *   vi.mock('next/navigation', () => nextNavigationFactory('?next=retirement'))
 *   beforeEach(() => resetRouterMock())
 *   ...
 *   expect(routerMock.push).toHaveBeenCalledWith('/start/choose')
 *
 * Import this module BEFORE the component under test (or anything else that
 * loads next/navigation): vitest hoists vi.mock and runs the factory when
 * next/navigation is first imported, and the factory reads this module's
 * binding. If the import order cannot be guaranteed, use the async form:
 *
 *   vi.mock('next/navigation', async () =>
 *     (await import('@/test/utils/navigation')).nextNavigationFactory())
 *
 * `routerMock` is one stable object, so components that list the router in
 * effect dependencies do not re-run on every render.
 */

import { vi, type Mock } from 'vitest'

type NavigateFn = (href: string, options?: { scroll?: boolean }) => void

export interface RouterMock {
  push: Mock<NavigateFn>
  replace: Mock<NavigateFn>
  back: Mock<() => void>
  prefetch: Mock<(href: string) => void>
}

export const routerMock: RouterMock = {
  push: vi.fn<NavigateFn>(),
  replace: vi.fn<NavigateFn>(),
  back: vi.fn<() => void>(),
  prefetch: vi.fn<(href: string) => void>(),
}

let defaultSearch = ''
let currentSearch = ''
let currentPathname = '/'

/** Replaces the query string that useSearchParams() returns from now on. */
export function setMockSearchParams(search: string | Record<string, string> = ''): void {
  currentSearch = new URLSearchParams(search).toString()
}

/** Sets the value usePathname() returns from now on. */
export function setMockPathname(pathname: string): void {
  currentPathname = pathname
}

/**
 * Clears every router call and restores the search params given to
 * nextNavigationFactory and the '/' pathname.
 */
export function resetRouterMock(): void {
  routerMock.push.mockReset()
  routerMock.replace.mockReset()
  routerMock.back.mockReset()
  routerMock.prefetch.mockReset()
  currentSearch = defaultSearch
  currentPathname = '/'
}

/**
 * Module factory for `vi.mock('next/navigation', () => nextNavigationFactory())`.
 * `search` seeds useSearchParams() (a '?a=1' string, 'a=1', or a record).
 */
export function nextNavigationFactory(search: string | Record<string, string> = '') {
  defaultSearch = new URLSearchParams(search).toString()
  currentSearch = defaultSearch
  return {
    useRouter: () => routerMock,
    useSearchParams: () => new URLSearchParams(currentSearch),
    usePathname: () => currentPathname,
    useParams: () => ({}),
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND')
    }),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT ${url}`)
    }),
  }
}
