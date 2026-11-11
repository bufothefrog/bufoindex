/**
 * next/navigation mock shared by component tests.
 *
 *   import { nextNavigationFactory, routerMock, resetRouterMock } from '@/test/utils/navigation'
 *   vi.mock('next/navigation', () => nextNavigationFactory())
 *
 * List this import before any import that loads next/navigation, because the
 * factory runs the first time the mocked module is imported.
 */

import { vi } from 'vitest'

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
}

/** Clears recorded calls on every router method. */
export function resetRouterMock(): void {
  routerMock.push.mockReset()
  routerMock.replace.mockReset()
  routerMock.back.mockReset()
  routerMock.prefetch.mockReset()
}

/**
 * Module factory for vi.mock('next/navigation', ...). `search` is the query
 * string that useSearchParams reports (with or without a leading '?').
 * redirect and notFound throw like the real ones, so code after them does
 * not run.
 */
export function nextNavigationFactory(search = '') {
  return {
    useRouter: () => routerMock,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(search),
    redirect: (url: string): never => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    },
    notFound: (): never => {
      throw new Error('NEXT_NOT_FOUND')
    },
  }
}
