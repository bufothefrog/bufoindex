import { describe, expect, it } from 'vitest';
import {
  CORE_PATHS,
  CORE_START_PATH,
  INTAKE_INTENTS,
  INTAKE_QUESTIONS,
  INTAKE_SCREENS,
  INTAKE_SKIP_LABEL,
  INTENT_OPTIONS,
  LEARN_CHOOSER_PATH,
  LEARN_OPTIONS,
  buildIntakeSubmission,
  coreDestination,
  coreStartLink,
  coreSummary,
  getIntakeScreens,
  getIntentOption,
  getLearnOption,
  intakePaths,
  isCoreComplete,
  isIntakeFlow,
  isIntakeIntent,
  isProfileFinished,
  remainingIntakeScreens,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeScreenOptions,
} from '@/lib/constants/intake';
import {
  PROFILE_FIELDS,
  getDefaultFinancialProfile,
  getProfileValue,
  isProfileFieldPath,
} from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

const defaults = getDefaultFinancialProfile();
const fromDefaults = (overrides: Record<string, unknown> = {}) => (path: string) =>
  path in overrides ? overrides[path] : getProfileValue(defaults, path);

const screenIds = (
  flow: IntakeFlow,
  overrides?: Record<string, unknown>,
  options?: IntakeScreenOptions
) => getIntakeScreens(flow, fromDefaults(overrides), options).map((s) => s.id);

const remainingIds = (flow: IntakeFlow, provided: string[], overrides?: Record<string, unknown>) =>
  screenIds(flow, overrides, { mode: 'remaining', provided });

const profileWith = (provided: string[], edits: Partial<FinancialProfile> = {}): FinancialProfile => ({
  ...getDefaultFinancialProfile(),
  ...edits,
  provided,
});

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

describe('core paths', () => {
  it('lists the core questions in the order they are asked', () => {
    expect(CORE_PATHS).toEqual([
      'person.age',
      'person.state',
      'person.filingStatus',
      'income.grossPerPaycheck',
      'income.frequency',
      'income.netPerPaycheck',
      'spending.necessaryMonthly',
    ]);
    expect(getIntakeScreens('core', fromDefaults()).flatMap((s) => s.questions.map((q) => q.path))).toEqual([
      ...CORE_PATHS,
    ]);
  });

  it('tags exactly the core paths with section core, in every intent', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const question of INTAKE_QUESTIONS[intent]) {
        expect(question.section === 'core', `${intent}:${question.path}`).toBe(CORE_PATHS.includes(question.path));
      }
    }
  });

  it('isCoreComplete needs every core path in profile.provided', () => {
    expect(isCoreComplete(getDefaultFinancialProfile())).toBe(false);
    expect(isCoreComplete(profileWith([...CORE_PATHS]))).toBe(true);
    expect(isCoreComplete(profileWith(['investing.investedBalance', ...CORE_PATHS]))).toBe(true);
    expect(isCoreComplete(profileWith(CORE_PATHS.filter((p) => p !== 'income.netPerPaycheck')))).toBe(false);
    // Non-core answers do not count toward the core.
    expect(isCoreComplete(profileWith(intakePaths('leverage')))).toBe(false);
  });

  it('recognizes the core flow and every intent as flows', () => {
    expect(isIntakeFlow('core')).toBe(true);
    expect(isIntakeFlow('profile')).toBe(true);
    expect(isIntakeFlow('choose')).toBe(false);
  });
});

describe('guided-flow routes', () => {
  it('starts every intent at the shared core', () => {
    expect(CORE_START_PATH).toBe('/start');
    expect(coreStartLink('retirement')).toBe('/start?next=retirement');
    expect(coreStartLink('profile')).toBe('/start?next=profile');
  });

  it('continues the core to the chosen intent, otherwise to the chooser', () => {
    expect(coreDestination('retirement')).toBe('/start/retirement');
    expect(coreDestination('profile')).toBe('/start/profile');
    expect(LEARN_CHOOSER_PATH).toBe('/start/choose');
    expect(coreDestination()).toBe('/start/choose');
    expect(coreDestination(null)).toBe('/start/choose');
    expect(coreDestination('')).toBe('/start/choose');
    expect(coreDestination('choose')).toBe('/start/choose');
    expect(coreDestination('emergency')).toBe('/start/choose');
  });
});

describe('getIntakeScreens flows and modes', () => {
  it('asks only the core screens for the core flow', () => {
    const screens = getIntakeScreens('core', fromDefaults());
    expect(screens.map((s) => s.id)).toEqual(['about', 'pay', 'must-pay']);
    expect(screens.every((s) => s.section === 'core')).toBe(true);
  });

  it("keeps today's behaviour in 'all' mode, the default", () => {
    for (const intent of INTAKE_INTENTS) {
      expect(screenIds(intent, undefined, { mode: 'all', provided: [...CORE_PATHS] })).toEqual(screenIds(intent));
    }
  });

  it("drops the core and the provided paths from an intent in 'remaining' mode", () => {
    expect(remainingIds('retirement', [])).toEqual(['retire-age', 'invested', 'monthly-investing']);
    expect(remainingIds('retirement', [...CORE_PATHS, 'investing.investedBalance'])).toEqual([
      'retire-age',
      'monthly-investing',
    ]);
    expect(remainingIds('portfolio', [...CORE_PATHS])).toEqual(['new-cash', 'target-mix']);
    expect(remainingIds('paycheck', [...CORE_PATHS])).toEqual(['fun-money', 'workplace', 'match']);
    expect(remainingIds('retirement', intakePaths('retirement'))).toEqual([]);
  });

  it('asks leverage only for what is left once age is in the core', () => {
    const horizon = getIntakeScreens('leverage', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] })[0];
    expect(horizon.id).toBe('horizon');
    expect(horizon.questions.map((q) => q.path)).toEqual(['person.retirementAge']);
    expect(horizon.section).toBe('retirement');

    // After the retirement intake, only the taxable contribution is new.
    expect(remainingIds('leverage', [...CORE_PATHS, ...intakePaths('retirement')])).toEqual(['taxable-investing']);
  });

  it('keeps a screen with only part of its questions answered, showing the rest', () => {
    const screens = getIntakeScreens('paycheck', fromDefaults(), {
      mode: 'remaining',
      provided: [...CORE_PATHS, 'spending.funMoneyMin', 'workplace.has401k', 'workplace.matchPercent'],
    });
    expect(screens.map((s) => s.id)).toEqual(['fun-money', 'match']);
    expect(screens[0].questions.map((q) => q.path)).toEqual(['spending.funMoneyMax']);
    expect(screens[1].questions.map((q) => q.path)).toEqual(['workplace.matchLimit']);
  });

  it('applies the employer-match visibility rule in remaining mode', () => {
    const provided = [...CORE_PATHS, 'spending.funMoneyMin', 'spending.funMoneyMax', 'workplace.has401k'];
    expect(remainingIds('paycheck', provided, { 'workplace.has401k': true })).toEqual(['match']);
    expect(remainingIds('paycheck', provided, { 'workplace.has401k': false })).toEqual([]);
  });

  it('asks the profile intent everything but the core, in section order', () => {
    const screens = getIntakeScreens('profile', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    expect(screens).toHaveLength(11);
    expect(screens.map((s) => s.section)).toEqual([
      'retirement', 'retirement', 'retirement',
      'paycheck', 'paycheck', 'paycheck',
      'portfolio', 'portfolio', 'portfolio',
      'cash', 'cash',
    ]);
  });

  it("asks only the unanswered core questions for the core flow in 'remaining' mode", () => {
    expect(remainingIds('core', [])).toEqual(['about', 'pay', 'must-pay']);
    expect(remainingIds('core', ['person.age', 'person.state', 'person.filingStatus', 'income.frequency'])).toEqual([
      'pay',
      'must-pay',
    ]);
    expect(remainingIds('core', [...CORE_PATHS])).toEqual([]);
  });
});

describe('LEARN_OPTIONS', () => {
  it('puts finishing the profile first, then the four calculators', () => {
    expect(LEARN_OPTIONS.map((o) => o.id)).toEqual(['profile', 'paycheck', 'retirement', 'portfolio', 'leverage']);
    expect(LEARN_OPTIONS[0].title).toBe('Finish your profile');
    expect(LEARN_OPTIONS[0].description).toBe('Answer the rest once; every calculator and your overview use it.');
    expect(LEARN_OPTIONS[0].icon).toBe(getIntentOption('profile').icon);
  });

  it('reuses the calculator entries from INTENT_OPTIONS', () => {
    for (const option of LEARN_OPTIONS.slice(1)) {
      expect(option).toBe(getIntentOption(option.id));
    }
    expect(getLearnOption('profile').title).toBe('Finish your profile');
    expect(getLearnOption('leverage').title).toBe('Compare leveraged vs plain index investing');
  });
});

describe('coreSummary', () => {
  it('summarizes a complete core in one line', () => {
    expect(coreSummary(profileWith([...CORE_PATHS]))).toBe('30, TX, single, $3,500 every 2 weeks, $3,000/mo must-pay');
  });

  it('leaves out answers that are still placeholders', () => {
    const base = getDefaultFinancialProfile();
    const profile = profileWith(['person.age', 'person.filingStatus', 'income.grossPerPaycheck'], {
      person: { ...base.person, age: 41, filingStatus: 'marriedJoint' },
      income: { ...base.income, grossPerPaycheck: 4250.4 },
    });
    expect(coreSummary(profile)).toBe('41, married filing jointly, $4,250 per paycheck');
  });

  it('words each pay frequency, with or without the gross amount', () => {
    const base = getDefaultFinancialProfile();
    const withFrequency = (frequency: FinancialProfile['income']['frequency'], provided: string[]) =>
      coreSummary(profileWith(provided, { income: { ...base.income, grossPerPaycheck: 1200, frequency } }));

    expect(withFrequency('weekly', ['income.grossPerPaycheck', 'income.frequency'])).toBe('$1,200 every week');
    expect(withFrequency('semi-monthly', ['income.grossPerPaycheck', 'income.frequency'])).toBe('$1,200 twice a month');
    expect(withFrequency('monthly', ['income.grossPerPaycheck', 'income.frequency'])).toBe('$1,200 once a month');
    expect(withFrequency('semi-monthly', ['income.frequency', 'spending.necessaryMonthly'])).toBe(
      'paid twice a month, $3,000/mo must-pay'
    );
  });

  it('is empty when no summarized answer is saved', () => {
    expect(coreSummary(getDefaultFinancialProfile())).toBe('');
    // Take-home pay is a core answer but not part of the summary.
    expect(coreSummary(profileWith(['income.netPerPaycheck', 'investing.investedBalance']))).toBe('');
  });
});

describe('remainingIntakeScreens', () => {
  const ids = (intent: IntakeIntent, profile: FinancialProfile) =>
    remainingIntakeScreens(intent, profile).map((screen) => screen.id);

  it('matches what /start/<intent> asks on arrival, from the saved profile', () => {
    const profile = profileWith([...CORE_PATHS, 'investing.investedBalance']);
    expect(ids('retirement', profile)).toEqual(['retire-age', 'monthly-investing']);
    expect(ids('leverage', profile)).toEqual(['horizon', 'taxable-investing']);
    expect(ids('portfolio', profile)).toEqual(['new-cash', 'target-mix']);
  });

  it('reads saved answers for visibility rules: no 401(k) means no match screen', () => {
    const base = getDefaultFinancialProfile();
    const noPlan = profileWith([...CORE_PATHS, 'spending.funMoneyMin', 'spending.funMoneyMax', 'workplace.has401k'], {
      workplace: { ...base.workplace, has401k: false },
    });
    expect(ids('paycheck', noPlan)).toEqual([]);

    const withPlan = profileWith([...CORE_PATHS, 'spending.funMoneyMin', 'spending.funMoneyMax', 'workplace.has401k']);
    expect(ids('paycheck', withPlan)).toEqual(['match']);
  });

  it('is empty once an intent has every path answered', () => {
    for (const intent of INTAKE_INTENTS) {
      expect(ids(intent, profileWith([...CORE_PATHS, ...intakePaths(intent)])), intent).toEqual([]);
    }
  });
});

describe('isProfileFinished', () => {
  it('is false while the profile intake still has questions', () => {
    expect(isProfileFinished(getDefaultFinancialProfile())).toBe(false);
    expect(isProfileFinished(profileWith([...CORE_PATHS]))).toBe(false);
    expect(isProfileFinished(profileWith([...CORE_PATHS, ...intakePaths('retirement')]))).toBe(false);
  });

  it('is true once every profile field is answered', () => {
    expect(isProfileFinished(profileWith(PROFILE_FIELDS.map((field) => field.path)))).toBe(true);
  });

  it('is true once the profile intake has nothing left, though a few fields are never asked', () => {
    const asked = intakePaths('profile');
    const neverAsked = PROFILE_FIELDS.map((field) => field.path).filter((path) => !asked.includes(path));
    expect(neverAsked).toEqual([
      'spending.targetRetirementIncome',
      'cash.targetMonths',
      'workplace.contributionPercent',
      'strategy.leverageRatio',
    ]);
    expect(isProfileFinished(profileWith(asked))).toBe(true);
  });

  it('counts the hidden match terms as nothing left to ask without a 401(k)', () => {
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
