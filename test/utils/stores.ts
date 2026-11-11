/**
 * Store and browser-state resets shared by component and store tests.
 */

import { getDefaultFinancialProfile } from '@/lib/profile/defaults'
import type { FinancialProfile } from '@/lib/profile/types'
import { useProfileStore } from '@/lib/store/profileStore'

export interface ResetProfileStoreOptions {
  /** Whether the store reports storage as read. Defaults to true, as in a mounted client. */
  hydrated?: boolean
  /** Profile to install; defaults to a fresh default profile with nothing answered. */
  profile?: FinancialProfile
}

/**
 * Puts the shared profile store into a known state without touching storage.
 * `hasProfile` follows the profile's answered paths, as the store derives it.
 */
export function resetProfileStore({ hydrated = true, profile }: ResetProfileStoreOptions = {}): void {
  const next = profile ?? getDefaultFinancialProfile()
  useProfileStore.setState({
    profile: next,
    hasProfile: next.provided.length > 0,
    hasHydrated: hydrated,
  })
}

/** Clears localStorage, sessionStorage, and the location's search and hash. */
export function clearBrowserState(): void {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', window.location.pathname)
}
