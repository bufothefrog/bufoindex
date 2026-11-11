/**
 * next/navigation mock shared by component tests.
 *
 *   import { routerMock, resetRouterMock } from '@/test/utils/navigation'
 *   vi.mock('next/navigation', async () =>
 *     (await import('@/test/utils/navigation')).nextNavigationFactory()
 *   )
 *
 * Use this async form. vi.mock is hoisted above the imports, so a factory
 * that calls a statically imported nextNavigationFactory fails to load
 * ("Cannot access ... before initialization") whenever a module that loads
 * next/navigation is imported before this helper, e.g. after an editor
 * sorts the imports. The dynamic import gives the same module instance, so
 * routerMock is shared with the test.
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
