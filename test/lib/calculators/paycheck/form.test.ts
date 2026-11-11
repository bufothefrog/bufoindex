/**
 * The paycheck intent's intake over the grown PAYCHECK_FORM (slice c3,
 * docs/rebuild-plan.md sections 2.12 to 2.14): the screens in order, the
 * fields on each, the visibility rules, the validation messages, 'remaining'
 * mode with its seven screens after the core, the skip labels, the tax
 * note, and every question the old intake asked still asked.
 */

import { describe, expect, it } from 'vitest';
import { FORMS } from '@/lib/calculators/forms';
import {
  CORE_PATHS,
  INTAKE_SKIP_LABEL,
  KEEP_ASSUMPTIONS_LABEL,
  getIntakeScreens,
  intakePaths,
  isProfileFinished,
  remainingIntakeScreens,
  skipLabelFor,
  validateIntakeScreen,
} from '@/lib/constants/intake';
import { summarizeScreen, visibleScreenFields, visibleScreenNotes } from '@/lib/fields/runtime';
import type { Get } from '@/lib/fields/types';
import { getDefaultFinancialProfile, getProfileValue } from '@/lib/profile/defaults';
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

const FORM = FORMS.paycheck;

/** The paycheck screens after the core, in order (section 2.12). */
const AFTER_CORE = ['spending-bonus', 'emergency-fund', '401k', 'hsa', 'ira-taxable', 'debts', 'assumptions'];

/** The questions the old paycheck intake asked, captured before w1 (see intakeFixture). */
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

const screen = (id: string) => FORM.screens.find((s) => s.id === id)!;

const visible = (id: string, get: Get = fromDefaults()) => visibleScreenFields(FORM, screen(id), get).map((spec) => spec.path);

const notes = (id: string, get: Get = fromDefaults()) => visibleScreenNotes(screen(id), get);

const remainingIds = (provided: string[], overrides?: Record<string, unknown>) =>
  getIntakeScreens('paycheck', fromDefaults(overrides), { mode: 'remaining', provided }).map((s) => s.id);

/** A Get over the default profile with these debt rows, row field paths included. */
const withDebts = (debts: FinancialProfile['debts']): Get => {
  const profile = { ...getDefaultFinancialProfile(), debts };
  return (path) => getProfileValue(profile, path);
};

const profileWith = (provided: string[], edits: Partial<FinancialProfile> = {}): FinancialProfile => ({
  ...getDefaultFinancialProfile(),
  ...edits,
  provided,
});

describe('paycheck form: screens and fields', () => {
  it('lists the screens in order: the core, then the seven paycheck screens', () => {
    expect(FORM.screens.map((s) => s.id)).toEqual(['about', 'pay', 'must-pay', ...AFTER_CORE]);
    expect(getIntakeScreens('paycheck', fromDefaults()).map((s) => s.id)).toEqual([
      'about',
      'pay',
      'must-pay',
      ...AFTER_CORE,
    ]);
  });

  it('puts each field on its screen', () => {
    expect(Object.fromEntries(FORM.screens.map((s) => [s.id, s.fields]))).toEqual({
      about: ['person.age', 'person.state', 'person.filingStatus'],
      pay: ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck'],
      'must-pay': ['spending.necessaryMonthly'],
      'spending-bonus': [
        'spending.funMoneyMin',
        'spending.funMoneyMax',
        'income.hasBonus',
        'income.bonusAmount',
        'income.bonusFrequency',
      ],
      'emergency-fund': ['cash.emergencyFundBalance', 'cash.emergencyFundApy'],
      '401k': [
        'workplace.has401k',
        'workplace.matchPercent',
        'workplace.matchLimit',
        'workplace.contributionType',
        'workplace.contributionPercent',
        'workplace.rothContributionPercent',
        'workplace.afterTaxAvailable',
      ],
      hsa: ['hsa.eligible', 'hsa.coverage', 'hsa.monthlyContribution', 'hsa.employerAnnualContribution', 'hsa.investing'],
      'ira-taxable': [
        'ira.traditional',
        'ira.traditionalMonthly',
        'ira.traditionalBalance',
        'ira.roth',
        'ira.rothMonthly',
        'ira.rothBalance',
        'investing.taxableMonthlyContribution',
      ],
      debts: ['debts'],
      assumptions: [
        'cash.targetMonths',
        'assumptions.paycheck.riskTolerance',
        'assumptions.paycheck.optimizationGoal',
        'assumptions.paycheck.expectedRetirementBracket',
      ],
    });
  });

  it('defines every field a screen names exactly once, and none that no screen asks', () => {
    const defined = FORM.fields.map((spec) => spec.path);
    expect(new Set(defined).size).toBe(defined.length);
    expect(FORM.screens.flatMap((s) => s.fields).sort()).toEqual([...defined].sort());
  });

  it('words the paycheck screens', () => {
    expect(
      FORM.screens.slice(3).map((s) => [s.id, s.title, s.question, s.description, s.tier])
    ).toEqual([
      ['spending-bonus', 'Fun money and bonuses', 'How much fun money do you want each month?', 'Spending on things you enjoy, beyond the must-pay costs. A range is fine.', 'details'],
      ['emergency-fund', 'Emergency fund', 'What does your emergency fund look like today?', undefined, 'details'],
      ['401k', '401(k) or similar plan', 'Does your employer offer a 401(k) or similar plan?', 'Matches are often written as "50% of the first 6% of pay". A guess is fine; your benefits portal has the exact terms.', 'details'],
      ['hsa', 'Health savings account', 'Do you have a health savings account (HSA)?', undefined, 'details'],
      ['ira-taxable', 'IRAs and taxable investing', 'Do you invest in an IRA or a taxable account?', undefined, 'details'],
      ['debts', 'Debts', 'Do you have any debts?', undefined, 'details'],
      ['assumptions', 'Assumptions', 'Which assumptions should the allocation use?', undefined, 'assumption'],
    ]);
  });

  it('labels the skip on each screen by its tier', () => {
    expect(FORM.screens.slice(3).map((s) => skipLabelFor(s))).toEqual([
      INTAKE_SKIP_LABEL,
      INTAKE_SKIP_LABEL,
      INTAKE_SKIP_LABEL,
      INTAKE_SKIP_LABEL,
      INTAKE_SKIP_LABEL,
      INTAKE_SKIP_LABEL,
      KEEP_ASSUMPTIONS_LABEL,
    ]);
    expect(INTAKE_SKIP_LABEL).toBe('Skip, use a typical value');
    expect(KEEP_ASSUMPTIONS_LABEL).toBe('Keep the default assumptions');
  });
});

describe('paycheck form: collapsed summaries', () => {
  const summary = (id: string, get: Get = fromDefaults()) => summarizeScreen(FORM, screen(id), get);

  it('summarizes each paycheck screen of the default profile in one line', () => {
    expect(summary('spending-bonus')).toBe('fun money $300\u2013$600/mo, no regular bonus');
    expect(summary('emergency-fund')).toBe('$5,000 saved, 4% APY');
    expect(summary('401k')).toBe('50% match on the first 6%, contributing 6% traditional (pre-tax)');
    expect(summary('hsa')).toBe('no HSA');
    expect(summary('ira-taxable')).toBe('no IRA, taxable $500/mo');
    expect(summary('debts')).toBe('no debts');
    expect(summary('assumptions')).toBe('3-month emergency fund, moderate risk, balanced goal, 12% retirement bracket');
  });

  it('summarizes what the visitor turned on', () => {
    const get = fromDefaults({
      'income.hasBonus': true,
      'income.bonusAmount': 6000,
      'income.bonusFrequency': 'quarterly',
      'workplace.contributionType': 'split',
      'workplace.afterTaxAvailable': true,
      'hsa.eligible': true,
      'hsa.coverage': 'family',
      'hsa.monthlyContribution': 300,
      'hsa.investing': true,
      'ira.traditional': true,
      'ira.traditionalMonthly': 200,
      'ira.roth': true,
      'ira.rothMonthly': 500,
      'investing.taxableMonthlyContribution': 0,
      'cash.targetMonths': 4.5,
      'assumptions.paycheck.riskTolerance': 'optimizer',
    });
    expect(summary('spending-bonus', get)).toBe('fun money $300\u2013$600/mo, $6,000 quarterly bonus');
    expect(summary('401k', get)).toBe(
      '50% match on the first 6%, contributing 6% split between traditional and Roth, after-tax contributions allowed'
    );
    expect(summary('hsa', get)).toBe('family HSA, $300/mo, invested');
    expect(summary('ira-taxable', get)).toBe('traditional IRA $200/mo, Roth IRA $500/mo, no taxable investing');
    expect(summary('assumptions', get)).toBe('4.5-month emergency fund, optimizer risk, balanced goal, 12% retirement bracket');
    expect(summary('401k', fromDefaults({ 'workplace.has401k': false }))).toBe('no workplace plan');
    expect(summary('debts', withDebts([{ id: 'd1', name: 'Card', balance: 3000, interestRate: 0.24, minimumPayment: 90, extraPayment: 0, taxDeductible: false }]))).toBe('1 debt');
  });
});

describe('paycheck form: visibility', () => {
  it('shows the bonus amount and frequency, and the bonus note, only with regular bonuses', () => {
    expect(visible('spending-bonus')).toEqual(['spending.funMoneyMin', 'spending.funMoneyMax', 'income.hasBonus']);
    expect(notes('spending-bonus')).toEqual([]);
    const bonus = fromDefaults({ 'income.hasBonus': true });
    expect(visible('spending-bonus', bonus)).toEqual([
      'spending.funMoneyMin',
      'spending.funMoneyMax',
      'income.hasBonus',
      'income.bonusAmount',
      'income.bonusFrequency',
    ]);
    expect(notes('spending-bonus', bonus)).toEqual([
      {
        text: 'Bonuses are recorded for context; the per-paycheck allocation math is based on regular paychecks only.',
        tone: 'info',
      },
    ]);
  });

  it('shows the plan terms only with a plan, and the Roth part only for a split', () => {
    expect(visible('401k')).toEqual([
      'workplace.has401k',
      'workplace.matchPercent',
      'workplace.matchLimit',
      'workplace.contributionType',
      'workplace.contributionPercent',
      'workplace.afterTaxAvailable',
    ]);
    expect(visible('401k', fromDefaults({ 'workplace.contributionType': 'split' }))).toEqual([
      'workplace.has401k',
      'workplace.matchPercent',
      'workplace.matchLimit',
      'workplace.contributionType',
      'workplace.contributionPercent',
      'workplace.rothContributionPercent',
      'workplace.afterTaxAvailable',
    ]);
    expect(visible('401k', fromDefaults({ 'workplace.contributionType': 'roth' }))).not.toContain(
      'workplace.rothContributionPercent'
    );
    expect(
      visible('401k', fromDefaults({ 'workplace.has401k': false, 'workplace.contributionType': 'split' }))
    ).toEqual(['workplace.has401k']);
  });

  it('shows the HSA details and notes only when eligible, the investing note by the investing answer', () => {
    expect(visible('hsa')).toEqual(['hsa.eligible']);
    expect(notes('hsa')).toEqual([]);
    const eligible = fromDefaults({ 'hsa.eligible': true });
    expect(visible('hsa', eligible)).toEqual([
      'hsa.eligible',
      'hsa.coverage',
      'hsa.monthlyContribution',
      'hsa.employerAnnualContribution',
      'hsa.investing',
    ]);
    const cashNotes = notes('hsa', eligible);
    expect(cashNotes.map((note) => note.text.split(':')[0])).toEqual([
      'Three tax advantages',
      '$4,400/year limit',
      'Reimbursement timing',
      'HSA and Roth IRA compared',
    ]);
    expect(cashNotes[1].text).toBe('$4,400/year limit: $367 per month');
    expect(cashNotes[3].tone).toBe('caution');
    const investing = notes('hsa', fromDefaults({ 'hsa.eligible': true, 'hsa.investing': true }));
    expect(investing.map((note) => note.text.split(':')[0])).toEqual([
      'Three tax advantages',
      '$4,400/year limit',
      'Reimbursement timing',
      'Held as an investment',
    ]);
    expect(investing[3].tone).toBe('info');
  });

  it('shows each IRA amount only with that IRA, and the taxable note only with a taxable contribution', () => {
    expect(visible('ira-taxable', fromDefaults({ 'investing.taxableMonthlyContribution': 0 }))).toEqual([
      'ira.traditional',
      'ira.roth',
      'investing.taxableMonthlyContribution',
    ]);
    expect(visible('ira-taxable', fromDefaults({ 'ira.traditional': true }))).toEqual([
      'ira.traditional',
      'ira.traditionalMonthly',
      'ira.traditionalBalance',
      'ira.roth',
      'investing.taxableMonthlyContribution',
    ]);
    expect(visible('ira-taxable', fromDefaults({ 'ira.roth': true }))).toEqual([
      'ira.traditional',
      'ira.roth',
      'ira.rothMonthly',
      'ira.rothBalance',
      'investing.taxableMonthlyContribution',
    ]);
    expect(notes('ira-taxable', fromDefaults({ 'investing.taxableMonthlyContribution': 0 }))).toEqual([]);
    expect(notes('ira-taxable')).toHaveLength(1);
  });
});

describe('paycheck form: the tax note (O9)', () => {
  it('says the bracket is fixed, and no longer claims brackets are calculated automatically', () => {
    const tax = notes('about');
    expect(tax).toEqual([
      {
        text: 'Tax savings in this allocator use a fixed 22% federal bracket plus one 2026 rate for your state. Brackets are not calculated from your income.',
        tone: 'info',
      },
    ]);
    const words = JSON.stringify(FORM).toLowerCase();
    expect(words).not.toContain('calculated automatically');
    expect(words).not.toContain('automatically calculated');
  });
});

describe('paycheck intake: validation', () => {
  it('flags a fun-money minimum above the maximum', () => {
    const get = fromDefaults({ 'spending.funMoneyMin': 700, 'spending.funMoneyMax': 600 });
    expect(validateIntakeScreen('paycheck', screen('spending-bonus'), get)).toEqual({
      'spending.funMoneyMax': 'The minimum is above the maximum. Adjust one of them.',
    });
    const equal = fromDefaults({ 'spending.funMoneyMin': 600, 'spending.funMoneyMax': 600 });
    expect(validateIntakeScreen('paycheck', screen('spending-bonus'), equal)).toEqual({});
  });

  it('flags take-home pay above gross pay on the take-home path', () => {
    const get = fromDefaults({ 'income.grossPerPaycheck': 2000, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen('paycheck', screen('pay'), get)).toEqual({
      'income.netPerPaycheck':
        'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
    });
    const below = fromDefaults({ 'income.grossPerPaycheck': 2000, 'income.netPerPaycheck': 1500 });
    expect(validateIntakeScreen('paycheck', screen('pay'), below)).toEqual({});
  });

  it('checks the match rate and the matched share against their bounds', () => {
    const get = fromDefaults({ 'workplace.matchPercent': 2.5, 'workplace.matchLimit': 0.3 });
    expect(validateIntakeScreen('paycheck', screen('401k'), get)).toEqual({
      'workplace.matchPercent': 'Employer match rate must be between 0% and 200%.',
      'workplace.matchLimit': 'Matched up to this share of your pay must be between 0% and 25%.',
    });
    expect(validateIntakeScreen('paycheck', screen('401k'), fromDefaults({ 'workplace.matchLimit': 0.25 }))).toEqual({});
  });

  it('does not check plan terms that are hidden', () => {
    const get = fromDefaults({ 'workplace.has401k': false, 'workplace.matchPercent': 2.5 });
    expect(validateIntakeScreen('paycheck', screen('401k'), get)).toEqual({});
  });

  it('checks the emergency-fund target against its bounds', () => {
    const get = fromDefaults({ 'cash.targetMonths': 30 });
    expect(Object.keys(validateIntakeScreen('paycheck', screen('assumptions'), get))).toEqual(['cash.targetMonths']);
    expect(validateIntakeScreen('paycheck', screen('assumptions'), fromDefaults({ 'cash.targetMonths': 6 }))).toEqual({});
  });

  it('checks a debt row rate against its bounds', () => {
    const row = { id: 'd1', name: 'Card', balance: 3000, interestRate: 0.6, minimumPayment: 90, extraPayment: 0, taxDeductible: false };
    const errors = validateIntakeScreen('paycheck', screen('debts'), withDebts([row]));
    expect(errors).toEqual({ 'debts.0.interestRate': 'Interest rate must be between 0% and 50%.' });
    const fine = { ...row, interestRate: 0.24 };
    expect(validateIntakeScreen('paycheck', screen('debts'), withDebts([fine]))).toEqual({});
  });
});

describe('paycheck intake: every old question is still asked', () => {
  it('asks each old paycheck question with its old wording, kind and help; the matched share is capped at 25% now', () => {
    const old = oldScreens(OLD_FLOW, { ...OLD_CORE_SCREENS, ...OLD_SCREENS }, { ...OLD_CORE_QUESTIONS, ...OLD_QUESTIONS });
    const asked = new Map(askedScreens('paycheck').flatMap((s) => s.questions).map((q) => [q.path, q]));
    const oldQuestions = old.flatMap((s) => s.questions);
    expect(oldQuestions).toHaveLength(12);
    for (const question of oldQuestions) {
      const expected = question.path === 'workplace.matchLimit' ? { ...question, max: 0.25 } : question;
      expect(asked.get(question.path), question.path).toEqual(expected);
    }
  });

  it('keeps the old core screens word for word', () => {
    const old = oldScreens(OLD_CORE_FLOW, OLD_CORE_SCREENS, OLD_CORE_QUESTIONS);
    expect(askedScreens('paycheck').slice(0, 3)).toEqual(old);
  });
});

describe("paycheck intake: 'remaining' mode", () => {
  it('drops the core and asks the seven paycheck screens, debts included (O4)', () => {
    expect(remainingIds([...CORE_PATHS])).toEqual(AFTER_CORE);
    expect(remainingIds([...CORE_PATHS])).toHaveLength(7);
  });

  it('keeps a screen with only part of its questions answered, showing all of its visible questions', () => {
    const screens = getIntakeScreens('paycheck', fromDefaults(), {
      mode: 'remaining',
      provided: [...CORE_PATHS, 'spending.funMoneyMin', 'workplace.has401k', 'workplace.matchPercent'],
    });
    expect(screens.map((s) => s.id)).toEqual(AFTER_CORE);
    expect(visibleScreenFields(FORM, screens[0], fromDefaults()).map((s) => s.path)).toEqual([
      'spending.funMoneyMin',
      'spending.funMoneyMax',
      'income.hasBonus',
    ]);
  });

  it('drops a screen once every visible question on it is answered, applying the visibility rules', () => {
    const provided = [
      ...CORE_PATHS,
      'spending.funMoneyMin',
      'spending.funMoneyMax',
      'income.hasBonus',
      'workplace.has401k',
      'hsa.eligible',
      'ira.traditional',
      'ira.roth',
      'investing.taxableMonthlyContribution',
    ];
    expect(remainingIds(provided, { 'workplace.has401k': false })).toEqual(['emergency-fund', 'debts', 'assumptions']);
    // A plan, an HSA or a bonus brings its questions back.
    expect(remainingIds(provided, { 'hsa.eligible': true, 'workplace.has401k': false, 'income.hasBonus': true })).toEqual([
      'spending-bonus',
      'emergency-fund',
      'hsa',
      'debts',
      'assumptions',
    ]);
    expect(remainingIds([...provided, 'cash.emergencyFundBalance', 'cash.emergencyFundApy', 'debts'], { 'workplace.has401k': false })).toEqual([
      'assumptions',
    ]);
  });

  it('reads saved answers for visibility rules on arrival: no 401(k) means no plan terms', () => {
    const base = getDefaultFinancialProfile();
    const answered = intakePaths('paycheck').filter((path) => path.startsWith('workplace.') ? path === 'workplace.has401k' : true);
    const noPlan = profileWith(answered, { workplace: { ...base.workplace, has401k: false } });
    expect(remainingIntakeScreens('paycheck', noPlan).map((s) => s.id)).toEqual([]);
    expect(remainingIntakeScreens('paycheck', profileWith(answered)).map((s) => s.id)).toEqual(['401k']);
  });

  it('counts the hidden plan terms as nothing left for the profile without a 401(k)', () => {
    const base = getDefaultFinancialProfile();
    const askedWithoutTerms = intakePaths('profile').filter(
      (path) => !path.startsWith('workplace.') || path === 'workplace.has401k'
    );
    const noPlan = profileWith(askedWithoutTerms, { workplace: { ...base.workplace, has401k: false } });
    expect(isProfileFinished(noPlan)).toBe(true);
    // With a 401(k), the unanswered plan terms are still to be asked.
    expect(isProfileFinished(profileWith(askedWithoutTerms))).toBe(false);
  });
});
