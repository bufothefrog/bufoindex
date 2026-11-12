/**
 * Migration of persisted profiles to the current version (2).
 *
 * v1 -> v2: every v1 leaf but one keeps its path, so normalizing against the
 * v2 defaults carries the answers over and fills the new leaves and lists
 * with their defaults. The one move is the one-off new cash: v1 kept it in
 * investing.newCashThisMonth, and v2 keeps it as the Brokerage account's
 * deposit in portfolio.accounts. v2 has no such leaf, so normalizing drops
 * it (from a v2 payload too) and the v1 value is read from the raw payload.
 * `provided` paths carry over; anything that is not a profile path
 * (including investing.newCashThisMonth) is dropped.
 */

import { applyWrites, getAt } from '@/lib/fields/paths';
import { isFiniteNumber } from '@/lib/fields/runtime';
import { newCashDepositWrites, normalizeProfile } from './defaults';
import type { FinancialProfile } from './types';

export const PROFILE_VERSION: FinancialProfile['version'] = 2;

/** Where v1 kept the one-off new cash; not a v2 path. */
const V1_NEW_CASH_PATH = 'investing.newCashThisMonth';

/**
 * Brings a persisted profile saved under `fromVersion` to v2. Untrusted
 * input is normalized, so garbage yields the defaults rather than an error.
 * A version above the current one is treated as current (normalized only).
 */
export function migrateProfile(persisted: unknown, fromVersion: number): FinancialProfile {
  const profile = normalizeProfile(persisted);
  if (fromVersion >= PROFILE_VERSION) return profile;
  const newCash = getAt(persisted, V1_NEW_CASH_PATH);
  if (!isFiniteNumber(newCash)) return profile;
  return applyWrites(profile, newCashDepositWrites(profile, newCash));
}
