/**
 * The v1 field count of the shared profile (25 fields, PROFILE_FIELDS), which
 * the guided-flow cards still print ("N of 25 details answered"). The
 * overview counts by topic screen instead (lib/calculators/forms.ts).
 */

import { PROFILE_FIELDS } from './defaults';
import type { FinancialProfile } from './types';

/**
 * How many of the 25 v1 fields the user actually answered, and which ones
 * are still placeholders. Paths in `provided` that are not v1 fields are
 * ignored, except the accounts list: the new cash lives on the accounts
 * (each account's deposit) and no form asks investing.newCashThisMonth, so
 * an answered account list answers it.
 */
export function profileFieldCompleteness(profile: FinancialProfile): {
  provided: number;
  total: number;
  missing: { path: string; label: string }[];
} {
  const answered = new Set(profile.provided);
  if (answered.has('portfolio.accounts')) answered.add('investing.newCashThisMonth');
  const missing = PROFILE_FIELDS.filter((f) => !answered.has(f.path)).map(({ path, label }) => ({
    path,
    label,
  }));
  return {
    provided: PROFILE_FIELDS.length - missing.length,
    total: PROFILE_FIELDS.length,
    missing,
  };
}
