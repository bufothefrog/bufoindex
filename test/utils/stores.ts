/**
 * Store and browser-state resets for tests. The profile store is touched only
 * through its public API (reset, setFields, setState).
 */

import { useProfileStore } from '@/lib/store/profileStore'
import { PROFILE_SECTIONS } from '@/lib/profile/defaults'
import type { ProfilePatch } from '@/lib/profile/types'

export interface ResetProfileStoreOptions {
  /** Value of hasHydrated after the reset. Defaults to true. */
  hydrated?: boolean
  /** Answers to seed; every leaf given is marked as provided. */
  profile?: ProfilePatch
}

function providedPaths(patch: ProfilePatch): string[] {
  return PROFILE_SECTIONS.flatMap((section) =>
    Object.keys(patch[section] ?? {}).map((key) => `${section}.${key}`)
  )
}

/** Restores the default profile, optionally seeds answers and sets hasHydrated. */
export function resetProfileStore({ hydrated = true, profile }: ResetProfileStoreOptions = {}): void {
  const store = useProfileStore
  store.getState().reset()
  if (profile) store.getState().setFields(profile, providedPaths(profile))
  store.setState({ hasHydrated: hydrated })
}

/** Empties localStorage, sessionStorage, the location hash and the query string. */
export function clearBrowserState(): void {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', window.location.pathname)
}
