import { describe, expect, it } from 'vitest';
import {
  INTAKE_INTENTS,
  INTAKE_QUESTIONS,
  INTAKE_SCREENS,
  INTAKE_SKIP_LABEL,
  INTENT_OPTIONS,
  buildIntakeSubmission,
  getIntakeScreens,
  getIntentOption,
  intakePaths,
  isIntakeIntent,
  validateIntakeScreen,
  type IntakeIntent,
} from '@/lib/constants/intake';
import {
  getDefaultFinancialProfile,
  getProfileValue,
  isProfileFieldPath,
} from '@/lib/profile/defaults';

const defaults = getDefaultFinancialProfile();
const fromDefaults = (overrides: Record<string, unknown> = {}) => (path: string) =>
  path in overrides ? overrides[path] : getProfileValue(defaults, path);

const screenIds = (intent: IntakeIntent, overrides?: Record<string, unknown>) =>
  getIntakeScreens(intent, fromDefaults(overrides)).map((s) => s.id);

describe('intake intents', () => {
  it('lists the five intents in landing-page order', () => {
    expect(INTAKE_INTENTS).toEqual(['paycheck', 'retirement', 'portfolio', 'leverage', 'profile']);
    expect(INTENT_OPTIONS.map((o) => o.id)).toEqual([...INTAKE_INTENTS]);
  });

  it('uses verb-first titles', () => {
    expect(INTENT_OPTIONS.map((o) => o.title)).toEqual([
      'Figure out where each paycheck should go',
      'See if I am on track to retire',
      'Rebalance my accounts with new cash',
      'Compare leveraged vs plain index investing',
      'Build my full financial profile',
    ]);
  });

  it('recognizes only known intents', () => {
    expect(isIntakeIntent('leverage')).toBe(true);
    expect(isIntakeIntent('emergency')).toBe(false);
    expect(getIntentOption('portfolio').title).toBe('Rebalance my accounts with new cash');
  });
});

describe('intake questions', () => {
  it('maps every question to a real profile field and offers a skip', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const question of INTAKE_QUESTIONS[intent]) {
        expect(isProfileFieldPath(question.path), `${intent}:${question.path}`).toBe(true);
        expect(question.skipLabel).toBe(INTAKE_SKIP_LABEL);
        expect(INTAKE_SCREENS[question.screen].title.length).toBeGreaterThan(0);
      }
    }
  });

  it('asks the shared core in the same order for every calculator intent', () => {
    const core = [
      'person.age',
      'person.state',
      'person.filingStatus',
      'income.grossPerPaycheck',
      'income.frequency',
      'income.netPerPaycheck',
      'spending.necessaryMonthly',
    ];
    for (const intent of ['paycheck', 'retirement', 'portfolio', 'profile'] as const) {
      expect(intakePaths(intent).slice(0, core.length)).toEqual(core);
    }
  });

  it('keeps question ids unique within an intent', () => {
    for (const intent of INTAKE_INTENTS) {
      const ids = INTAKE_QUESTIONS[intent].map((question) => question.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('asks the leverage intent only about horizon, contribution, and balance', () => {
    expect(intakePaths('leverage')).toEqual([
      'person.age',
      'person.retirementAge',
      'investing.taxableMonthlyContribution',
      'investing.investedBalance',
    ]);
  });
});

describe('getIntakeScreens', () => {
  it('fits every intent except profile in six screens', () => {
    expect(screenIds('paycheck')).toEqual(['about', 'pay', 'must-pay', 'fun-money', 'workplace', 'match']);
    expect(screenIds('retirement')).toEqual(['about', 'pay', 'must-pay', 'retire-age', 'invested', 'monthly-investing']);
    expect(screenIds('portfolio')).toEqual(['about', 'pay', 'must-pay', 'new-cash', 'target-mix']);
    expect(screenIds('leverage')).toEqual(['horizon', 'taxable-investing', 'invested']);
    expect(screenIds('profile')).toHaveLength(14);
  });

  it('groups gross pay, frequency, and take-home on one screen', () => {
    const pay = getIntakeScreens('paycheck', fromDefaults()).find((s) => s.id === 'pay');
    expect(pay?.questions.map((question) => question.path)).toEqual([
      'income.grossPerPaycheck',
      'income.frequency',
      'income.netPerPaycheck',
    ]);
  });

  it('hides the employer-match screen when there is no 401(k)', () => {
    expect(screenIds('paycheck', { 'workplace.has401k': false })).toEqual([
      'about',
      'pay',
      'must-pay',
      'fun-money',
      'workplace',
    ]);
    expect(screenIds('profile', { 'workplace.has401k': false })).toHaveLength(13);
  });

  it('tags profile screens with their section, in order', () => {
    const sections = getIntakeScreens('profile', fromDefaults()).map((s) => s.section);
    expect(sections).toEqual([
      'core', 'core', 'core',
      'retirement', 'retirement', 'retirement',
      'paycheck', 'paycheck', 'paycheck',
      'portfolio', 'portfolio', 'portfolio',
      'cash', 'cash',
    ]);
  });
});

describe('validateIntakeScreen', () => {
  const screen = (intent: IntakeIntent, id: string) =>
    getIntakeScreens(intent, fromDefaults()).find((s) => s.id === id)!.questions;

  it('accepts the default profile on every screen', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const s of getIntakeScreens(intent, fromDefaults())) {
        expect(validateIntakeScreen(s.questions, fromDefaults())).toBeNull();
      }
    }
  });

  it('flags take-home pay above gross pay', () => {
    const get = fromDefaults({ 'income.grossPerPaycheck': 2000, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen(screen('paycheck', 'pay'), get)).toMatch(/Take-home pay is above gross pay/);
    // Equal is allowed (no withholding at all is possible).
    const equal = fromDefaults({ 'income.grossPerPaycheck': 2600, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen(screen('paycheck', 'pay'), equal)).toBeNull();
  });

  it('flags a fun-money minimum above the maximum', () => {
    const get = fromDefaults({ 'spending.funMoneyMin': 700, 'spending.funMoneyMax': 600 });
    expect(validateIntakeScreen(screen('paycheck', 'fun-money'), get)).toMatch(/minimum is above the maximum/);
  });

  it('requires retirement age strictly above current age, on the retirement-age screen only', () => {
    const get = fromDefaults({ 'person.age': 60, 'person.retirementAge': 60 });
    expect(validateIntakeScreen(screen('retirement', 'retire-age'), get)).toMatch(/above your current age/);
    expect(validateIntakeScreen(screen('leverage', 'horizon'), get)).toMatch(/above your current age/);
    expect(validateIntakeScreen(screen('retirement', 'about'), get)).toBeNull();
  });
});

describe('buildIntakeSubmission', () => {
  const answers = (overrides: Record<string, unknown> = {}) => {
    const out: Record<string, unknown> = {};
    for (const intent of INTAKE_INTENTS) {
      for (const path of intakePaths(intent)) out[path] = getProfileValue(defaults, path);
    }
    return { ...out, 'cash.targetMonths': 3, ...overrides };
  };

  it('writes the answered paths, grouped by section, plus the preset-derived cash target', () => {
    const result = buildIntakeSubmission(
      answers({ 'person.age': 27, 'income.grossPerPaycheck': 4200, 'person.state': 'CA' }),
      ['person.age', 'income.grossPerPaycheck', 'income.grossPerPaycheck']
    );
    // The default preset is cashflow-investor (1 month); person.state was not answered.
    expect(result.patch).toEqual({
      person: { age: 27 },
      income: { grossPerPaycheck: 4200 },
      cash: { targetMonths: 1 },
    });
    expect(result.providedPaths).toEqual(['person.age', 'income.grossPerPaycheck']);
  });

  it('drops unknown paths', () => {
    const result = buildIntakeSubmission(answers(), ['person.age', 'person.nickname'], ['cash.targetMonths']);
    expect(result.providedPaths).toEqual(['person.age']);
    expect(result.patch).toEqual({ person: { age: 30 } });
  });

  it('derives emergency months from the chosen preset without marking them provided', () => {
    const cashflow = buildIntakeSubmission(answers({ 'strategy.preset': 'cashflow-investor' }), ['strategy.preset']);
    expect(cashflow.patch).toEqual({ strategy: { preset: 'cashflow-investor' }, cash: { targetMonths: 1 } });
    expect(cashflow.providedPaths).toEqual(['strategy.preset']);

    const standard = buildIntakeSubmission(answers({ 'strategy.preset': 'standard' }), ['strategy.preset']);
    expect(standard.patch.cash).toEqual({ targetMonths: 3 });
  });

  it('leaves user-entered emergency months alone', () => {
    const result = buildIntakeSubmission(
      answers({ 'strategy.preset': 'cashflow-investor' }),
      ['strategy.preset'],
      ['cash.targetMonths']
    );
    expect(result.patch.cash).toBeUndefined();
  });

  it('derives emergency months from the profile preset when the preset question was not asked', () => {
    // Paycheck, retirement, portfolio and leverage intakes never ask the preset;
    // answers are seeded with the profile's current one.
    const cashflow = buildIntakeSubmission(answers({ 'cash.targetMonths': 3 }), ['person.age']);
    expect(cashflow.patch).toEqual({ person: { age: 30 }, cash: { targetMonths: 1 } });
    expect(cashflow.providedPaths).toEqual(['person.age']);

    const standard = buildIntakeSubmission(
      answers({ 'strategy.preset': 'standard', 'cash.targetMonths': 1 }),
      ['person.age']
    );
    expect(standard.patch.cash).toEqual({ targetMonths: 3 });
  });

  it('keeps emergency months entered in the same intake', () => {
    const result = buildIntakeSubmission(
      answers({ 'strategy.preset': 'cashflow-investor', 'cash.targetMonths': 6 }),
      ['strategy.preset', 'cash.targetMonths']
    );
    expect(result.patch.cash).toEqual({ targetMonths: 6 });
    expect(result.providedPaths).toEqual(['strategy.preset', 'cash.targetMonths']);
  });

  it('skips the derivation when the preset value is not a known preset', () => {
    const result = buildIntakeSubmission(answers({ 'strategy.preset': 'yolo' }), ['person.age']);
    expect(result.patch.cash).toBeUndefined();
  });

  it('raises a retirement age at or below the current age to age + 1', () => {
    const result = buildIntakeSubmission(
      answers({ 'person.age': 62, 'person.retirementAge': 60 }),
      ['person.age']
    );
    expect(result.patch.person).toEqual({ age: 62, retirementAge: 63 });
    expect(result.providedPaths).toEqual(['person.age']);
  });
});
