/**
 * The calculator-only flag (surface 'calculator' on a ScreenSpec, see Surface
 * in lib/fields/types.ts), place by place: such a screen is never in the
 * profile form, the profile wizard, the review page, the completeness figure
 * or any /start/<intent> intake, and it is shown on its calculator page. The
 * four calculator-only screens with profile leaves are the retirement monthly
 * investing (Auto from the contribution answers) and claiming age, the
 * rebalancer's new cash for this run, and the leverage comparison (the
 * leverage ratio and the three overrides).
 */

import { describe, expect, it } from 'vitest';
import { FORMS, PROFILE_FORM, profileCompleteness } from '@/lib/calculators/forms';
import { isProfileScreenId, profileReview, profileScreenIds } from '@/lib/calculators/profileReview';
import { CALCULATOR_IDS } from '@/lib/calculators/registry';
import { getIntakeScreens, remainingIntakeScreens } from '@/lib/constants/intake';
import { makeGet } from '@/lib/fields/paths';
import { screensFor, visibleScreenFields } from '@/lib/fields/runtime';
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
  it('are the retirement monthly investing and claiming age, the new cash and the leverage comparison', () => {
    expect(CALCULATOR_ONLY.map(({ id, screen }) => [id, screen.id])).toEqual([
      ['retirement', 'monthly-investing'],
      ['retirement', 'claiming'],
      ['portfolio', 'new-cash'],
      ['leverage', 'comparison'],
    ]);
    expect(CALCULATOR_ONLY_PATHS).toEqual([
      'investing.monthlyContribution',
      'retirementIncome.socialSecurityAge',
      'portfolio.newCash',
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

/**
 * A calculator-only value never changes which profile screens exist (R1 of
 * the second PR 4 review): completeness, the review page, the intake screens
 * and remaining mode all read a Custom new cash as unset (intakeScreens in
 * lib/calculators/forms.ts), while the rebalancer page still reads it.
 */
describe('a Custom new cash and the profile screens', () => {
  const EMPTY_BROKERAGE = { id: 'acc-b', kind: 'brokerage' as const, name: '', balance: 0, holdsEmergencyFund: false };

  /** One stored empty brokerage, no 401(k), taxable `taxable`, every profile topic answered but `leave`. */
  function emptyBrokerage(taxable: number, leave: readonly string[] = []): FinancialProfile {
    const profile = getDefaultFinancialProfile();
    profile.workplace.has401k = false;
    profile.investing.taxableMonthlyContribution = taxable;
    profile.portfolio.accounts = [EMPTY_BROKERAGE];
    profile.portfolio.holdings = [];
    profile.portfolio.securities = [];
    const get = makeGet(profile);
    const shown = screensFor(PROFILE_FORM, get, { mode: 'all', surface: 'intake' }).filter((s) => !leave.includes(s.id));
    profile.provided = Array.from(new Set(['workplace.has401k', 'investing.taxableMonthlyContribution', ...pathsOf(shown)]));
    return profile;
  }

  const withNewCash = (profile: FinancialProfile, id: string, amount: number): FinancialProfile => ({
    ...profile,
    portfolio: { ...profile.portfolio, newCash: [{ id, amount }] },
  });

  /** Everything that decides which profile screens exist, in one comparable shape. */
  function screensDecided(profile: FinancialProfile) {
    const get = makeGet(profile);
    const review = profileReview(profile);
    return {
      completeness: profileCompleteness(profile),
      review: review.groups.flatMap((group) => group.topics.map((topic) => `${topic.id}:${topic.status}`)),
      hasUnansweredRequired: review.hasUnansweredRequired,
      profileRemaining: getIntakeScreens('profile', get, { mode: 'remaining', provided: profile.provided }).map((s) => s.id),
      profileAll: getIntakeScreens('profile', get, { mode: 'all' }).map((s) => s.id),
      portfolioRemaining: remainingIntakeScreens('portfolio', profile).map((s) => s.id),
    };
  }

  it('one empty brokerage and taxable 0: a Custom 300 leaves every count, topic and remaining screen as it was', () => {
    const before = emptyBrokerage(0);
    const after = withNewCash(before, 'acc-b', 300);
    expect(screensDecided(after)).toEqual(screensDecided(before));
    const decided = screensDecided(after);
    expect(decided.completeness.provided).toBe(decided.completeness.total);
    expect(decided.review.map((topic) => topic.split(':')[0])).not.toContain('targets');
    expect(decided.hasUnansweredRequired).toBe(false);
    expect(decided.profileRemaining).toEqual([]);
    expect(decided.portfolioRemaining).toEqual([]);
  });

  it('one empty brokerage and taxable 0, one topic left: remaining mode asks only that topic, Custom or not', () => {
    const before = emptyBrokerage(0, ['debts']);
    const after = withNewCash(before, 'acc-b', 300);
    expect(screensDecided(after)).toEqual(screensDecided(before));
    expect(screensDecided(after).profileRemaining).toEqual(['debts']);
  });

  it('the default profile: a Custom 0 on the brokerage leaves every count, topic and remaining screen as it was', () => {
    const before = getDefaultFinancialProfile();
    expect(screensDecided(withNewCash(before, 'acc-brok', 0))).toEqual(screensDecided(before));
    expect(screensDecided(withNewCash(before, 'acc-brok', 900))).toEqual(screensDecided(before));
  });

  it('an empty brokerage with normal contributions and a Custom 0: the targets screen stays, with its fields', () => {
    const before = emptyBrokerage(500, ['targets']);
    const after = withNewCash(before, 'acc-b', 0);
    expect(screensDecided(after)).toEqual(screensDecided(before));
    expect(screensDecided(after).profileRemaining).toEqual(['targets']);
    // The wizard renders the screen's fields from the values as they are; the target mix is one of them.
    const targets = PROFILE_FORM.screens.find((s) => s.id === 'targets');
    if (!targets) throw new Error('no targets screen');
    expect(visibleScreenFields(PROFILE_FORM, targets, makeGet(after)).map((spec) => spec.path)).toContain(
      'investing.targetMix'
    );
  });

  it('the rebalancer page still follows a Custom new cash', () => {
    const before = emptyBrokerage(0);
    const page = (profile: FinancialProfile) =>
      screensFor(FORMS.portfolio, makeGet(profile), { mode: 'all', surface: 'calculator' }).map((s) => s.id);
    expect(page(before)).not.toContain('targets');
    expect(page(withNewCash(before, 'acc-b', 300))).toContain('targets');
  });
});
