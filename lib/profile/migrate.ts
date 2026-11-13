/**
 * Migration of persisted profiles to the current version (2).
 *
 * There is no migration step today: every stored payload, of any version,
 * is normalized against the v2 defaults. Leaves that still exist keep their
 * values, missing leaves and lists get their defaults, and anything that is
 * not a v2 profile path is dropped. `provided` paths carry over.
 *
 * This is the seam the persist `migrate` hook calls (lib/store/profileStore.ts).
 * A later schema change that renames or moves a leaf bumps PROFILE_VERSION
 * and adds a `fromVersion < N` step here that reads the raw payload before
 * it is normalized.
 */

import { normalizeProfile } from './defaults';
import type { FinancialProfile } from './types';

export const PROFILE_VERSION: FinancialProfile['version'] = 2;

/**
 * Brings a persisted profile saved under `fromVersion` to the current
 * version. Untrusted input is normalized, so garbage yields the defaults
 * rather than an error. A version above the current one is treated as
 * current (normalized only).
 */
export function migrateProfile(persisted: unknown, fromVersion: number): FinancialProfile {
  void fromVersion;
  return normalizeProfile(persisted);
}
