/**
 * The calculator-only flag (surface 'calculator' on a ScreenSpec, see Surface
 * in lib/fields/types.ts), place by place: such a screen is never in the
 * profile form, the profile wizard, the review page, the completeness figure
 * or any /start/<intent> intake, and it is shown on its calculator page. The
 * two calculator-only screens with profile leaves are the leverage
 * comparison (the leverage ratio and the three overrides) and the retirement
 * claiming age.
 */

import { describe, expect, it } from 'vitest';
import { FORMS, PROFILE_FORM, profileCompleteness } from '@/lib/calculators/forms';
import { isProfileScreenId, profileReview, profileScreenIds } from '@/lib/calculators/profileReview';
import { CALCULATOR_IDS } from '@/lib/calculators/registry';
import { getIntakeScreens, remainingIntakeScreens } from '@/lib/constants/intake';
import { makeGet } from '@/lib/fields/paths';
import { screensFor } from '@/lib/fields/runtime';
import type { ScreenSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

/** Every calculator-only screen, with its calculator. */
const CALCULATOR_ONLY = CALCULATOR_IDS.flatMap((id) =>
  FORMS[id].screens.filter((screen) => screen.surface === 'calculator').map((screen) => ({ id, screen }))
);

const CALCULATOR_ONLY_IDS = CALCULATOR_ONLY.map(({ screen }) => screen.id);
const CALCULATOR_ONLY_PATHS = CALCULATOR_ONLY.flatMap(({ screen }) => screen.fields);

const profileWith = (provided: string[]): FinancialProfile => ({ ...getDefaultFinancialProfile(), provided });

const pathsOf = (screens: readonly ScreenSpec[]) => screens.flatMap((screen) => screen.fields);

describe('calculator-only screens', () => {
  it('are the leverage comparison and the retirement claiming age', () => {
    expect(CALCULATOR_ONLY.map(({ id, screen }) => [id, screen.id])).toEqual([
      ['retirement', 'claiming'],
      ['leverage', 'comparison'],
    ]);
    expect(CALCULATOR_ONLY_PATHS).toEqual([
      'retirementIncome.socialSecurityAge',
      'leverage.monthlyContribution',
      'leverage.years',
      'leverage.startingBalance',
      'strategy.leverageRatio',
    ]);
  });

  it('1. are never in the profile form', () => {
    for (const id of CALCULATOR_ONLY_IDS) expect(PROFILE_FORM.screens.map((s) => s.id)).not.toContain(id);
    for (const path of CALCULATOR_ONLY_PATHS) {
      expect(pathsOf(PROFILE_FORM.screens), path).not.toContain(path);
      expect(PROFILE_FORM.fields.map((spec) => spec.path), path).not.toContain(path);
    }
  });

  it('2. are never asked by the profile wizard, in either mode', () => {
    const get = makeGet(getDefaultFinancialProfile());
    for (const mode of ['all', 'remaining'] as const) {
      const asked = getIntakeScreens('profile', get, { mode, provided: [] });
      for (const path of CALCULATOR_ONLY_PATHS) expect(pathsOf(asked), `${mode}:${path}`).not.toContain(path);
    }
  });

  it('3. are never on the review page, and have no single-topic edit route', () => {
    const review = profileReview(profileWith(CALCULATOR_ONLY_PATHS));
    const topics = review.groups.flatMap((group) => group.topics.map((topic) => topic.id));
    for (const id of CALCULATOR_ONLY_IDS) {
      expect(topics).not.toContain(id);
      expect(isProfileScreenId(id)).toBe(false);
      expect(profileScreenIds()).not.toContain(id);
    }
    // The leverage-ratio topic of 3bb0132 is gone too.
    expect(topics).not.toContain('facts');
  });

  it('4. never count toward completeness, answered or not', () => {
    const without = profileCompleteness(profileWith([]));
    const withThem = profileCompleteness(profileWith(CALCULATOR_ONLY_PATHS));
    expect(withThem).toEqual(without);
    for (const path of CALCULATOR_ONLY_PATHS) expect(pathsOf(without.missing), path).not.toContain(path);
  });

  it('5. are never asked by a /start/<intent> intake, in either mode', () => {
    for (const id of CALCULATOR_IDS) {
      const get = makeGet(getDefaultFinancialProfile());
      for (const mode of ['all', 'remaining'] as const) {
        const asked = getIntakeScreens(id, get, { mode, provided: [] });
        for (const screenId of CALCULATOR_ONLY_IDS) expect(asked.map((s) => s.id), `${id}:${mode}`).not.toContain(screenId);
        for (const path of CALCULATOR_ONLY_PATHS) expect(pathsOf(asked), `${id}:${mode}:${path}`).not.toContain(path);
      }
      expect(pathsOf(remainingIntakeScreens(id, profileWith([])))).not.toContain('strategy.leverageRatio');
    }
  });

  it('are shown on their calculator page', () => {
    for (const { id, screen } of CALCULATOR_ONLY) {
      const page = screensFor(FORMS[id], makeGet(getDefaultFinancialProfile()), { mode: 'all', surface: 'calculator' });
      expect(page.map((s) => s.id), id).toContain(screen.id);
    }
  });

  it('keep their values in the stored profile, so the browser remembers them', () => {
    const profile = getDefaultFinancialProfile();
    expect(profile.strategy.leverageRatio).toBe(2);
    expect(profile.retirementIncome.socialSecurityAge).toBe(67);
  });
});
