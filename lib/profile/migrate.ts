/**
 * Persisted-profile migrations (pure).
 *
 * v1 (Sept 2026 guided-flow prototype) held 25 leaves in seven sections.
 * v2 adds a home for every calculator input (docs/rebuild-plan.md 2.3).
 * Every v1 leaf keeps its path in v2, so the v1 -> v2 step is a
 * normalization against the v2 defaults plus one move: the rebalancer's
 * one-off new cash (investing.newCashThisMonth) becomes the deposit on the
 * default Brokerage account, which is where toRebalanceInputs put it in v1.
 */

import { getAt } from '@/lib/fields/paths';
import { getDefaultFinancialProfile, normalizeProfile, PROFILE_VERSION } from './defaults';
import type { FinancialProfile } from './types';

/** Id of the default taxable account that receives v1 new cash. */
export const BROKERAGE_ACCOUNT_ID = 'acc-brok';

/** v1 new cash as a deposit: negative or non-finite amounts deposit nothing. */
export function newCashDeposit(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Index of the account that receives investing.newCashThisMonth: the
 * default Brokerage account when present, otherwise the first taxable
 * account; -1 when there is none.
 */
export function newCashAccountIndex(profile: FinancialProfile): number {
  const { accounts } = profile.portfolio;
  const brokerage = accounts.findIndex((a) => a.id === BROKERAGE_ACCOUNT_ID);
  return brokerage >= 0 ? brokerage : accounts.findIndex((a) => a.accountType === 'taxable');
}

function migrateV1(persisted: unknown): FinancialProfile {
  // v1 leaves map 1:1 onto v2 paths; v2-only paths take their defaults.
  const profile = normalizeProfile(persisted, getDefaultFinancialProfile());
  const index = newCashAccountIndex(profile);
  if (index < 0) return profile;
  const deposit = newCashDeposit(profile.investing.newCashThisMonth);
  const accounts = profile.portfolio.accounts.map((account, i) => (i === index ? { ...account, deposit } : account));
  return { ...profile, portfolio: { ...profile.portfolio, accounts } };
}

/**
 * Upgrades a persisted profile written at `fromVersion` to the current
 * shape. Anything at or below v1 (including a missing or unknown version)
 * runs the v1 -> v2 step; v2 payloads are normalized only. Never throws:
 * corrupt input yields the default profile.
 */
export function migrateProfile(persisted: unknown, fromVersion: number): FinancialProfile {
  const declared = getAt(persisted, 'version');
  const version = Number.isFinite(fromVersion) ? fromVersion : typeof declared === 'number' ? declared : 1;
  if (version >= PROFILE_VERSION) return normalizeProfile(persisted);
  return migrateV1(persisted);
}
