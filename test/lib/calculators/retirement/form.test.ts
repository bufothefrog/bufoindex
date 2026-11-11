/**
 * The retirement intent's intake (slice w1's provisional RETIREMENT_FORM):
 * it asks exactly what the intake asked before w1, with the same validation
 * and 'remaining' behaviour. Slice c1 owns this file and replaces these pins
 * when it grows the form.
 */

import { describe, expect, it } from 'vitest';
import {
  CORE_PATHS,
  getIntakeScreens,
  intakePaths,
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
  'retire-age': { title: 'When would you like to retire?' },
  invested: { title: 'Roughly how much do you have invested?' },
  'monthly-investing': { title: 'How much do you invest each month?' },
};

const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'person.retirementAge': { path: 'person.retirementAge', label: 'Target retirement age', kind: 'number', min: 30, max: 85, step: 1 },
  'investing.investedBalance': { path: 'investing.investedBalance', label: 'Invested balance', kind: 'money', help: 'A rough total across 401(k), IRA, and brokerage accounts is fine. Leave out your emergency fund.', min: 0 },
  'investing.monthlyContribution': { path: 'investing.monthlyContribution', label: 'Monthly investing contribution', kind: 'money', help: 'What you put toward investing each month across all accounts, including your own 401(k) contributions.', min: 0 },
};

const OLD_FLOW: readonly OldScreen[] = [
  ...OLD_CORE_FLOW,
  ['retire-age', 'retirement', ['person.retirementAge']],
  ['invested', 'retirement', ['investing.investedBalance']],
  ['monthly-investing', 'retirement', ['investing.monthlyContribution']],
];

const remainingIds = (provided: string[]) =>
  getIntakeScreens('retirement', fromDefaults(), { mode: 'remaining', provided }).map((s) => s.id);

const screen = (id: string) => getIntakeScreens('retirement', fromDefaults()).find((s) => s.id === id)!;

const profileWith = (provided: string[]): FinancialProfile => ({ ...getDefaultFinancialProfile(), provided });

describe('retirement intake: the provisional form carries the old question set', () => {
  it('asks the retirement intent exactly as before, question by question', () => {
    expect(askedScreens('retirement')).toEqual(
      oldScreens(OLD_FLOW, { ...OLD_CORE_SCREENS, ...OLD_SCREENS }, { ...OLD_CORE_QUESTIONS, ...OLD_QUESTIONS })
    );
  });
});

describe('retirement intake: validation', () => {
  it('requires retirement age strictly above current age, on the retirement-age screen only', () => {
    const get = fromDefaults({ 'person.age': 60, 'person.retirementAge': 60 });
    expect(validateIntakeScreen('retirement', screen('retire-age'), get)).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
    expect(validateIntakeScreen('retirement', screen('about'), get)).toEqual({});
  });
});

describe("retirement intake: 'remaining' mode", () => {
  it('drops the core and the answered screens', () => {
    expect(remainingIds([])).toEqual(['retire-age', 'invested', 'monthly-investing']);
    expect(remainingIds([...CORE_PATHS, 'investing.investedBalance'])).toEqual(['retire-age', 'monthly-investing']);
    expect(remainingIds(intakePaths('retirement'))).toEqual([]);
  });

  it('matches what /start/retirement asks on arrival, from the saved profile', () => {
    const profile = profileWith([...CORE_PATHS, 'investing.investedBalance']);
    expect(remainingIntakeScreens('retirement', profile).map((s) => s.id)).toEqual(['retire-age', 'monthly-investing']);
  });
});
