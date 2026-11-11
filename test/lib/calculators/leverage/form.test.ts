/**
 * The leverage intent's intake (slice w1's provisional LEVERAGE_FORM): it
 * asks exactly what the intake asked before w1, with the same validation and
 * 'remaining' behaviour. Slice c7 owns this file and replaces these pins
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
import {
  OLD_CORE_QUESTIONS,
  askedScreens,
  fromDefaults,
  oldScreens,
  type OldQuestion,
  type OldScreen,
  type OldScreenCopy,
} from '@/test/utils/intakeFixture';

const OLD_SCREENS: Record<string, OldScreenCopy> = {
  horizon: { title: 'What is your time horizon?', description: 'The comparison runs from now until you plan to stop contributing.' },
  'taxable-investing': { title: 'How much goes into a taxable brokerage account each month?', description: 'The leverage comparison applies to taxable contributions, outside retirement accounts.' },
  invested: { title: 'Roughly how much do you have invested?' },
};

const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'leverage:person.retirementAge': { path: 'person.retirementAge', label: 'Age you plan to stop contributing', kind: 'number', min: 30, max: 85, step: 1 },
  'investing.taxableMonthlyContribution': { path: 'investing.taxableMonthlyContribution', label: 'Monthly taxable contribution', kind: 'money', help: 'Money you invest each month outside 401(k) and IRA accounts.', min: 0 },
  'leverage:investing.investedBalance': { path: 'investing.investedBalance', label: 'Starting balance', kind: 'money', help: 'What you already have invested. A rough number is fine.', min: 0 },
};

const OLD_FLOW: readonly OldScreen[] = [
  ['horizon', 'core', ['person.age', 'leverage:person.retirementAge']],
  ['taxable-investing', 'portfolio', ['investing.taxableMonthlyContribution']],
  ['invested', 'retirement', ['leverage:investing.investedBalance']],
];

const remainingIds = (provided: string[]) =>
  getIntakeScreens('leverage', fromDefaults(), { mode: 'remaining', provided }).map((s) => s.id);

describe('leverage intake: the provisional form carries the old question set', () => {
  it('asks the leverage intent exactly as before, question by question', () => {
    expect(askedScreens('leverage')).toEqual(oldScreens(OLD_FLOW, OLD_SCREENS, { ...OLD_CORE_QUESTIONS, ...OLD_QUESTIONS }));
  });

  it('asks only about horizon, contribution, and balance', () => {
    expect(intakePaths('leverage')).toEqual([
      'person.age',
      'person.retirementAge',
      'investing.taxableMonthlyContribution',
      'investing.investedBalance',
    ]);
  });
});

describe('leverage intake: validation', () => {
  it('requires the stop age strictly above current age on the horizon screen', () => {
    const get = fromDefaults({ 'person.age': 60, 'person.retirementAge': 60 });
    const horizon = getIntakeScreens('leverage', get).find((s) => s.id === 'horizon')!;
    expect(validateIntakeScreen('leverage', horizon, get)).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
  });
});

describe("leverage intake: 'remaining' mode", () => {
  it('asks only for what is left once age is in the core', () => {
    const [horizon] = getIntakeScreens('leverage', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    expect(horizon.id).toBe('horizon');
    expect(horizon.fields).toEqual(['person.retirementAge']);
    // 'all' mode keeps the age on the horizon screen.
    expect(getIntakeScreens('leverage', fromDefaults())[0].fields).toEqual(['person.age', 'person.retirementAge']);

    // After the retirement intake, only the taxable contribution is new.
    expect(remainingIds([...CORE_PATHS, ...intakePaths('retirement')])).toEqual(['taxable-investing']);
  });

  it('matches what /start/leverage asks on arrival, from the saved profile', () => {
    const profile = { ...getDefaultFinancialProfile(), provided: [...CORE_PATHS, 'investing.investedBalance'] };
    expect(remainingIntakeScreens('leverage', profile).map((s) => s.id)).toEqual(['horizon', 'taxable-investing']);
  });
});
