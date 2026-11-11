/**
 * Store and browser-state resets for tests. The profile store is touched only
 * through its public API (reset, setValues, setState).
 */

import { useProfileStore } from '@/lib/store/profileStore'
import { patchWrites } from '@/lib/profile/defaults'
import type { ProfilePatch } from '@/lib/profile/types'

export interface ResetProfileStoreOptions {
  /** Value of hasHydrated after the reset. Defaults to true. */
  hydrated?: boolean
  /**
   * Answers to seed. Every valid leaf given, at any depth, is marked as
   * provided, and so is every list given (by its list path). Invalid values
   * keep the default and are not marked.
   */
  profile?: ProfilePatch
}

/** Restores the default profile, optionally seeds answers and sets hasHydrated. */
export function resetProfileStore({ hydrated = true, profile }: ResetProfileStoreOptions = {}): void {
  const store = useProfileStore
  store.getState().reset()
  if (profile) store.getState().setValues(patchWrites(profile))
  store.setState({ hasHydrated: hydrated })
}

/** Empties localStorage, sessionStorage, the location hash and the query string. */
export function clearBrowserState(): void {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', window.location.pathname)
}
