/**
 * Render helpers that put the shared profile store into a known state first.
 */

import type { ReactElement } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { FinancialProfile } from '@/lib/profile/types'
import { resetProfileStore } from './stores'

export interface RenderWithProfileOptions extends Omit<RenderOptions, 'queries'> {
  /** Profile to install before rendering; defaults to the default profile. */
  profile?: FinancialProfile
  /** Whether the store reports storage as read; defaults to true. */
  hydrated?: boolean
}

/** Resets the profile store to `profile` / `hydrated`, then renders `ui`. */
export function renderWithProfile(
  ui: ReactElement,
  { profile, hydrated, ...options }: RenderWithProfileOptions = {}
): RenderResult {
  resetProfileStore({ profile, hydrated })
  return render(ui, options)
}
