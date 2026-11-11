/**
 * The paycheck intent's intake (slice w1's provisional PAYCHECK_FORM): it
 * asks exactly what the intake asked before w1, with the same visibility,
 * validation and 'remaining' behaviour. Slice c3 owns this file and replaces
 * these pins when it grows the form.
 */

import { describe, expect, it } from 'vitest';
import { FORMS } from '@/lib/calculators/forms';
import {
  CORE_PATHS,
  getIntakeScreens,
  intakePaths,
  isProfileFinished,
  remainingIntakeScreens,
  validateIntakeScreen,
} from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import {
  OLD_CORE_FLOW,
  OLD_CORE_QUESTIONS,
  OLD_CORE_SCREENS,
  askedScreens,
  fromDefaults,
  oldScreens,
  type OldQuestion,
  type OldScreen,
  type OldScreenCopy,
} from '@/test/utils/intakeFixture';

const OLD_SCREENS: Record<string, OldScreenCopy> = {
  'fun-money': { title: 'How much fun money do you want each month?', description: 'Spending on things you enjoy, beyond the must-pay costs. A range is fine.' },
  workplace: { title: 'Does your employer offer a 401(k) or similar plan?' },
  match: { title: 'How does the employer match work?', description: 'Often written as "50% of the first 6% of pay". A guess is fine; your benefits portal has the exact terms.' },
};

const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'spending.funMoneyMin': { path: 'spending.funMoneyMin', label: 'At least, per month', kind: 'money', min: 0 },
  'spending.funMoneyMax': { path: 'spending.funMoneyMax', label: 'At most, per month', kind: 'money', min: 0 },
  'workplace.has401k': { path: 'workplace.has401k', label: 'Workplace retirement plan', kind: 'choice', options: [{ value: true, label: 'Yes', description: 'Not sure? Pick Yes and check your benefits portal later.' }, { value: false, label: 'No' }] },
  'workplace.matchPercent': { path: 'workplace.matchPercent', label: 'Employer match rate', kind: 'percent', help: 'What your employer adds per dollar you contribute. 50% means 50 cents per dollar.', min: 0, max: 2 },
  'workplace.matchLimit': { path: 'workplace.matchLimit', label: 'Matched up to this share of your pay', kind: 'percent', help: 'In "50% of the first 6%", this is the 6%.', min: 0, max: 1 },
};

const OLD_FLOW: readonly OldScreen[] = [
  ...OLD_CORE_FLOW,
  ['fun-money', 'paycheck', ['spending.funMoneyMin', 'spending.funMoneyMax']],
  ['workplace', 'paycheck', ['workplace.has401k']],
  ['match', 'paycheck', ['workplace.matchPercent', 'workplace.matchLimit']],
];

const remainingIds = (provided: string[], overrides?: Record<string, unknown>) =>
  getIntakeScreens('paycheck', fromDefaults(overrides), { mode: 'remaining', provided }).map((s) => s.id);

const screen = (id: string) => getIntakeScreens('paycheck', fromDefaults()).find((s) => s.id === id)!;

const profileWith = (provided: string[], edits: Partial<FinancialProfile> = {}): FinancialProfile => ({
  ...getDefaultFinancialProfile(),
  ...edits,
  provided,
});

describe('paycheck intake: the provisional form carries the old question set', () => {
  it('asks the paycheck intent exactly as before, question by question', () => {
    expect(askedScreens('paycheck')).toEqual(
      oldScreens(OLD_FLOW, { ...OLD_CORE_SCREENS, ...OLD_SCREENS }, { ...OLD_CORE_QUESTIONS, ...OLD_QUESTIONS })
    );
  });

  it('hides the employer-match screen when there is no 401(k)', () => {
    const ids = getIntakeScreens('paycheck', fromDefaults({ 'workplace.has401k': false })).map((s) => s.id);
    expect(ids).toEqual(FORMS.paycheck.screens.map((s) => s.id).filter((id) => id !== 'match'));
  });
});

describe('paycheck intake: validation', () => {
  it('flags a fun-money minimum above the maximum', () => {
    const get = fromDefaults({ 'spending.funMoneyMin': 700, 'spending.funMoneyMax': 600 });
    expect(validateIntakeScreen('paycheck', screen('fun-money'), get)).toEqual({
      'spending.funMoneyMax': 'The minimum is above the maximum. Adjust one of them.',
    });
  });

  it('checks the match rate against its bounds', () => {
    const get = fromDefaults({ 'workplace.matchPercent': 2.5 });
    expect(validateIntakeScreen('paycheck', screen('match'), get)).toEqual({
      'workplace.matchPercent': 'Employer match rate must be between 0% and 200%.',
    });
  });
});

describe("paycheck intake: 'remaining' mode", () => {
  it('drops the core and asks the paycheck screens', () => {
    expect(remainingIds([...CORE_PATHS])).toEqual(['fun-money', 'workplace', 'match']);
  });

  it('keeps a screen with only part of its questions answered, showing all of them prefilled', () => {
    const screens = getIntakeScreens('paycheck', fromDefaults(), {
      mode: 'remaining',
      provided: [...CORE_PATHS, 'spending.funMoneyMin', 'workplace.has401k', 'workplace.matchPercent'],
    });
    expect(screens.map((s) => s.id)).toEqual(['fun-money', 'match']);
    expect(screens[0].fields).toEqual(['spending.funMoneyMin', 'spending.funMoneyMax']);
    expect(screens[1].fields).toEqual(['workplace.matchPercent', 'workplace.matchLimit']);
  });

  it('applies the employer-match visibility rule in remaining mode', () => {
    const provided = [...CORE_PATHS, 'spending.funMoneyMin', 'spending.funMoneyMax', 'workplace.has401k'];
    expect(remainingIds(provided, { 'workplace.has401k': true })).toEqual(['match']);
    expect(remainingIds(provided, { 'workplace.has401k': false })).toEqual([]);
  });

  it('reads saved answers for visibility rules on arrival: no 401(k) means no match screen', () => {
    const base = getDefaultFinancialProfile();
    const answered = [...CORE_PATHS, 'spending.funMoneyMin', 'spending.funMoneyMax', 'workplace.has401k'];
    const noPlan = profileWith(answered, { workplace: { ...base.workplace, has401k: false } });
    expect(remainingIntakeScreens('paycheck', noPlan).map((s) => s.id)).toEqual([]);
    expect(remainingIntakeScreens('paycheck', profileWith(answered)).map((s) => s.id)).toEqual(['match']);
  });

  it('counts the hidden match terms as nothing left for the profile without a 401(k)', () => {
    const base = getDefaultFinancialProfile();
    const askedWithoutMatch = intakePaths('profile').filter(
      (path) => path !== 'workplace.matchPercent' && path !== 'workplace.matchLimit'
    );
    const noPlan = profileWith(askedWithoutMatch, { workplace: { ...base.workplace, has401k: false } });
    expect(isProfileFinished(noPlan)).toBe(true);
    // With a 401(k), the unanswered match terms are still to be asked.
    expect(isProfileFinished(profileWith(askedWithoutMatch))).toBe(false);
  });
});
