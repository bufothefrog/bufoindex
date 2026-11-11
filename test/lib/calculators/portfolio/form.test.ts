/**
 * The portfolio intent's intake (slice w1's provisional PORTFOLIO_FORM): it
 * asks exactly what the intake asked before w1, with the same 'remaining'
 * behaviour. Slice c5 owns this file and replaces these pins when it grows
 * the form (and drops the portfolio core, O5).
 */

import { describe, expect, it } from 'vitest';
import { CORE_PATHS, getIntakeScreens, remainingIntakeScreens } from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
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
  'new-cash': { title: 'How much new cash are you investing this month?' },
  'target-mix': { title: 'Which stock and bond mix are you aiming for?', description: 'You can set a custom mix on the calculator.' },
};

const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'investing.newCashThisMonth': { path: 'investing.newCashThisMonth', label: 'New cash to invest this month', kind: 'money', help: 'Money you are ready to put into your accounts now.', min: 0 },
  'investing.targetMix': { path: 'investing.targetMix', label: 'Target mix', kind: 'choice', options: [{ value: '100-0', label: '100% stocks', description: 'The highest expected growth and the deepest drawdowns.' }, { value: '80-20', label: '80% stocks, 20% bonds', description: 'Mostly stocks, with a bond cushion.' }, { value: '60-40', label: '60% stocks, 40% bonds', description: 'Smaller swings and lower expected growth.' }] },
};

const OLD_FLOW: readonly OldScreen[] = [
  ...OLD_CORE_FLOW,
  ['new-cash', 'portfolio', ['investing.newCashThisMonth']],
  ['target-mix', 'portfolio', ['investing.targetMix']],
];

describe('portfolio intake: the provisional form carries the old question set', () => {
  it('asks the portfolio intent exactly as before, question by question', () => {
    expect(askedScreens('portfolio')).toEqual(
      oldScreens(OLD_FLOW, { ...OLD_CORE_SCREENS, ...OLD_SCREENS }, { ...OLD_CORE_QUESTIONS, ...OLD_QUESTIONS })
    );
  });
});

describe("portfolio intake: 'remaining' mode", () => {
  it('drops the core', () => {
    const ids = getIntakeScreens('portfolio', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    expect(ids.map((s) => s.id)).toEqual(['new-cash', 'target-mix']);
  });

  it('matches what /start/portfolio asks on arrival, from the saved profile', () => {
    const profile = { ...getDefaultFinancialProfile(), provided: [...CORE_PATHS, 'investing.investedBalance'] };
    expect(remainingIntakeScreens('portfolio', profile).map((s) => s.id)).toEqual(['new-cash', 'target-mix']);
  });
});
