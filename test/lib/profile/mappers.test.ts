/**
 * The v1 field count (profileFieldCompleteness in lib/profile/mappers.ts),
 * which the guided-flow cards print as "N of 25 details answered".
 */

import { describe, expect, it } from 'vitest';
import { getDefaultFinancialProfile, PROFILE_FIELDS } from '@/lib/profile/defaults';
import { profileFieldCompleteness } from '@/lib/profile/mappers';
import { migrateProfile } from '@/lib/profile/migrate';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';

/**
 * A v1-shaped profile: the given v1 sections over the v1 defaults, loaded
 * the way a saved v1 profile is (migrateProfile from version 1).
 */
function makeProfile(overrides: ProfilePatch = {}): FinancialProfile {
  return migrateProfile(overrides, 1);
}

describe('profileFieldCompleteness', () => {
  it('reports nothing provided for a fresh profile', () => {
    const c = profileFieldCompleteness(getDefaultFinancialProfile());
    expect(c.provided).toBe(0);
    expect(c.total).toBe(25);
    expect(c.missing).toHaveLength(25);
    expect(c.missing[0]).toEqual({ path: 'person.age', label: 'Age' });
  });

  it('counts known provided paths and ignores unknown ones', () => {
    const c = profileFieldCompleteness({
      ...getDefaultFinancialProfile(),
      provided: ['person.age', 'income.frequency', 'cash.targetMonths', 'not.a.field', 'hsa.eligible', 'debts'],
    });
    expect(c.provided).toBe(3);
    expect(c.total).toBe(25);
    expect(c.missing).toHaveLength(22);
    expect(c.missing.map((m) => m.path)).not.toContain('person.age');
    expect(c.missing.map((m) => m.path)).toContain('person.state');
  });

  it('reports complete when every field is provided', () => {
    const c = profileFieldCompleteness(makeProfile({ provided: PROFILE_FIELDS.map((f) => f.path) }));
    expect(c).toEqual({ provided: 25, total: 25, missing: [] });
    // The new v2 leaves do not count toward the v1 completeness.
    const c2 = profileFieldCompleteness({ ...getDefaultFinancialProfile(), provided: ['hsa.eligible', 'debts'] });
    expect(c2.provided).toBe(0);
  });

  it('keeps the same result for the same v1 answers after migration', () => {
    const c = profileFieldCompleteness(makeProfile({ provided: PROFILE_FIELDS.map((f) => f.path) }));
    expect(c).toEqual({ provided: 25, total: 25, missing: [] });
  });
});
