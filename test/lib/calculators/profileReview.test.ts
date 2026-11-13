import { describe, expect, it } from 'vitest';
import { PROFILE_FORM, PROFILE_FORM_SECTION_LABELS, profileFormSection } from '@/lib/calculators/forms';
import {
  ANSWERED_WITHOUT_SUMMARY,
  NOT_ANSWERED,
  answeredScreenFields,
  isOptionalSection,
  isProfileScreenId,
  profileReview,
  profileScreenIds,
  reviewTopic,
  reviewTopicAnchor,
  reviewTopicEditHref,
  reviewTopicReturnHref,
} from '@/lib/calculators/profileReview';
import { makeGet } from '@/lib/fields/paths';
import { screenPaths, summarizeScreen } from '@/lib/fields/runtime';
import type { FormSpec, ScreenSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

const screenOf = (id: string): ScreenSpec => {
  const found = PROFILE_FORM.screens.find((screen) => screen.id === id);
  if (!found) throw new Error(`no screen ${id}`);
  return found;
};

const withProvided = (provided: string[], profile: FinancialProfile = getDefaultFinancialProfile()): FinancialProfile => ({
  ...profile,
  provided,
});

/** Every path every profile screen answers, as a finished profile would hold. */
function everyPath(profile: FinancialProfile): string[] {
  const get = makeGet(profile);
  return PROFILE_FORM.screens.flatMap((screen) => screenPaths(PROFILE_FORM, screen, get));
}

describe('reviewTopic', () => {
  const get = makeGet(getDefaultFinancialProfile());

  it('reads "Not answered" for a topic with no answered fact, although every fact holds a typical value', () => {
    expect(reviewTopic(PROFILE_FORM, screenOf('pay'), get, [])).toEqual({ status: 'unanswered', summary: NOT_ANSWERED });
  });

  it('shows the collapsed card summary for a fully answered topic', () => {
    const pay = screenOf('pay');
    const result = reviewTopic(PROFILE_FORM, pay, get, screenPaths(PROFILE_FORM, pay, get));
    expect(result.status).toBe('answered');
    expect(result.summary).toBe(summarizeScreen(PROFILE_FORM, pay, get));
    expect(result.summary).not.toBe('');
  });

  it('lists only the answered facts of a partly answered topic, never a typical sibling value', () => {
    const result = reviewTopic(PROFILE_FORM, screenOf('pay'), get, ['income.grossPerPaycheck']);
    expect(result.status).toBe('partial');
    expect(result.summary).toBe('Gross pay per paycheck: $3,500');
    // The card summary would word the typical pay frequency with it.
    expect(result.summary).not.toMatch(/week/);
    expect(result.summary).not.toMatch(/2,600/);
  });

  it('accepts the answered paths as a set or an array', () => {
    const asSet = reviewTopic(PROFILE_FORM, screenOf('about'), get, new Set(['person.age']));
    const asArray = reviewTopic(PROFILE_FORM, screenOf('about'), get, ['person.age']);
    expect(asSet).toEqual(asArray);
    expect(asArray.summary).toMatch(/30/);
  });

  it('falls back to "Answered" when no answered fact can be put in words', () => {
    const form: FormSpec = {
      id: 'fixture',
      fields: [{ path: 'portfolio.holdings', kind: 'custom', label: 'Holdings', tier: 'details', renderer: 'x' }],
      screens: [{ id: 'h', title: 'Holdings', tier: 'details', fields: ['portfolio.holdings'] }],
    };
    const hidden = makeGet({ ...getDefaultFinancialProfile() });
    const result = reviewTopic(form, form.screens[0], (path) => (path === 'portfolio.holdings' ? { a: 1 } : hidden(path)), [
      'portfolio.holdings',
    ]);
    expect(result).toEqual({ status: 'answered', summary: ANSWERED_WITHOUT_SUMMARY });
  });
});

describe('answeredScreenFields', () => {
  it('keeps the visible fields whose own path is answered, in screen order', () => {
    const get = makeGet(getDefaultFinancialProfile());
    const fields = answeredScreenFields(PROFILE_FORM, screenOf('pay'), get, ['income.netPerPaycheck', 'income.grossPerPaycheck']);
    expect(fields.map((spec) => spec.path)).toEqual(['income.grossPerPaycheck', 'income.netPerPaycheck']);
  });
});

describe('profileReview', () => {
  it('groups every topic by its profile section, in profile form order, every topic unanswered on an empty profile', () => {
    const profile = withProvided([]);
    const review = profileReview(profile);
    const topics = review.groups.flatMap((group) => group.topics);

    expect(topics.length).toBeGreaterThan(0);
    expect(topics.every((topic) => topic.status === 'unanswered' && topic.summary === NOT_ANSWERED)).toBe(true);
    for (const group of review.groups) {
      expect(group.label).toBe(PROFILE_FORM_SECTION_LABELS[group.section]);
      for (const topic of group.topics) expect(profileFormSection(topic.id)).toBe(group.section);
    }
    // Profile form order.
    const order = PROFILE_FORM.screens.map((screen) => screen.id);
    const ids = topics.map((topic) => topic.id);
    expect([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(ids);
    expect(review.groups[0].label).toBe('The basics');
    expect(review.hasUnansweredRequired).toBe(true);
  });

  it('leaves out a topic the saved values hide (the match terms without a 401(k))', () => {
    const form: FormSpec = {
      id: 'fixture',
      fields: [
        { path: 'workplace.has401k', kind: 'boolean', label: 'Has a 401(k)', tier: 'details' },
        {
          path: 'workplace.matchPercent',
          kind: 'percent',
          label: 'Match',
          tier: 'details',
          visibleWhen: (get) => get('workplace.has401k') === true,
        },
      ],
      screens: [
        { id: 'plan', title: 'Plan', tier: 'details', fields: ['workplace.has401k'] },
        { id: 'match', title: 'Match', tier: 'details', fields: ['workplace.matchPercent'] },
      ],
    };
    const profile = getDefaultFinancialProfile();
    const ids = (p: FinancialProfile) => profileReview(p, form).groups.flatMap((group) => group.topics.map((topic) => topic.id));
    const withPlan = { ...profile, workplace: { ...profile.workplace, has401k: true } } as FinancialProfile;
    const withoutPlan = { ...profile, workplace: { ...profile.workplace, has401k: false } } as FinancialProfile;
    expect(ids(withPlan)).toEqual(['plan', 'match']);
    expect(ids(withoutPlan)).toEqual(['plan']);
  });

  it('marks every topic answered and needs no remaining questions on a full profile', () => {
    const base = getDefaultFinancialProfile();
    const review = profileReview(withProvided(everyPath(base), base));
    const topics = review.groups.flatMap((group) => group.topics);
    expect(topics.every((topic) => topic.status === 'answered' && topic.summary !== NOT_ANSWERED)).toBe(true);
    expect(review.hasUnansweredRequired).toBe(false);
  });

  it('needs the remaining questions while a required topic is only partly answered', () => {
    const base = getDefaultFinancialProfile();
    const all = everyPath(base).filter((path) => path !== 'income.netPerPaycheck');
    expect(profileReview(withProvided(all, base)).hasUnansweredRequired).toBe(true);
  });

  it('does not need the remaining questions for an unanswered optional topic', () => {
    const base = getDefaultFinancialProfile();
    const get = makeGet(base);
    const optional = new Set(
      PROFILE_FORM.screens
        .filter((screen) => isOptionalSection(profileFormSection(screen.id) ?? ''))
        .flatMap((screen) => screenPaths(PROFILE_FORM, screen, get))
    );
    const review = profileReview(withProvided(everyPath(base).filter((path) => !optional.has(path)), base));
    expect(review.hasUnansweredRequired).toBe(false);
    const optionalTopics = review.groups.flatMap((group) => group.topics).filter((topic) => topic.optional);
    expect(optionalTopics.length).toBeGreaterThan(0);
    for (const topic of optionalTopics) expect(topic.status).not.toBe('answered');
  });
});

describe('isOptionalSection', () => {
  it('names the optional section only', () => {
    expect(isOptionalSection('optional')).toBe(true);
    expect(isOptionalSection('core')).toBe(false);
    expect(isOptionalSection('retirement')).toBe(false);
  });
});

describe('review links', () => {
  it('builds the row anchor, the return link and the edit link from the screen id', () => {
    expect(reviewTopicAnchor('pay')).toBe('topic-pay');
    expect(reviewTopicReturnHref('pay')).toBe('/start/review#topic-pay');
    expect(reviewTopicEditHref('pay')).toBe('/start/review/pay');
  });

  it('knows the profile screen ids', () => {
    expect(profileScreenIds()).toEqual(PROFILE_FORM.screens.map((screen) => screen.id));
    expect(isProfileScreenId('pay')).toBe(true);
    expect(isProfileScreenId('nope')).toBe(false);
  });
});
