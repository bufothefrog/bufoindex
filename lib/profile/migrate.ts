/**
 * Migration of persisted profiles to the current version (3).
 *
 * - Version 3 made portfolio.accounts the single list of what the visitor
 *   owns. A payload saved under version 2 or earlier first goes through
 *   migrateV2Payload (./migrateV2.ts), which turns the typed invested and
 *   IRA balances and the account deposits into account rows and new cash
 *   rows, losing no money the visitor entered and counting none twice.
 * - Every payload is then normalized against the v3 defaults: leaves that
 *   still exist keep their values, missing leaves and lists get their
 *   defaults, and anything that is not a v3 profile path is dropped.
 *   `provided` paths carry over.
 *
 * This is the seam the persist `migrate` hook calls (lib/store/profileStore.ts).
 * A later schema change that renames or moves a leaf bumps PROFILE_VERSION
 * and adds a `fromVersion < N` step here that reads the raw payload before
 * it is normalized.
 */

import { normalizeProfile } from './defaults';
import { migrateV2Payload } from './migrateV2';
import type { FinancialProfile } from './types';

export const PROFILE_VERSION: FinancialProfile['version'] = 3;

/**
 * Brings a persisted profile saved under `fromVersion` to the current
 * version. Untrusted input is normalized, so garbage yields the defaults
 * rather than an error. A version above the current one is treated as
 * current (normalized only).
 */
export function migrateProfile(persisted: unknown, fromVersion: number): FinancialProfile {
  if (fromVersion < 3) return normalizeProfile(migrateV2Payload(persisted));
  return normalizeProfile(persisted);
}
