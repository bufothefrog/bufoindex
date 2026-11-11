import type { ReactElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { resetProfileStore, type ResetProfileStoreOptions } from './stores'

/**
 * Renders `ui` after resetting the profile store to the defaults, then
 * seeding `profile` and the hydration flag (see resetProfileStore).
 */
export function renderWithProfile(
  ui: ReactElement,
  options: ResetProfileStoreOptions = {}
): RenderResult {
  resetProfileStore(options)
  return render(ui)
}
