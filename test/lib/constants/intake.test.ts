import { describe, expect, it } from 'vitest';
import { FORMS, PROFILE_FORM, PROFILE_FORM_ORDER, formForFlow, profileFormSection } from '@/lib/calculators/forms';
import {
  CORE_PATHS,
  CORE_START_PATH,
  INTAKE_INTENTS,
  INTAKE_SKIP_LABEL,
  INTENT_OPTIONS,
  KEEP_ASSUMPTIONS_LABEL,
  LEARN_CHOOSER_PATH,
  LEARN_OPTIONS,
  buildIntakeSubmission,
  coreDestination,
  coreStartLink,
  coreSummary,
  getIntakeScreens,
  getIntentOption,
  getLearnOption,
  isCoreComplete,
  isIntakeIntent,
  isProfileFinished,
  remainingIntakeScreens,
  skipLabelFor,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeScreenOptions,
} from '@/lib/constants/intake';
import type { ScreenSpec } from '@/lib/fields/types';
import {
  PROFILE_FIELDS,
  PROFILE_LEAF_PATHS,
  PROFILE_LIST_PATHS,
  getDefaultFinancialProfile,
  isProfilePath,
} from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import {
  OLD_CORE_FLOW,
  OLD_CORE_QUESTIONS,
  OLD_CORE_SCREENS,
  askedScreens,
  fromDefaults,
  intakePaths,
  oldScreens,
  type AskedScreen,
  type OldQuestion,
  type OldScreen,
  type OldScreenCopy,
} from '@/test/utils/intakeFixture';

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

const CALCULATOR_INTENTS = ['paycheck', 'retirement', 'portfolio', 'leverage'] as const;

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

// ---------------------------------------------------------------------------
// Behaviour-preserving: the provisional forms ask exactly what the intake
// asked before slice w1. The core and the profile-only screens are pinned
// here against the old fixture (test/utils/intakeFixture.ts); each
// calculator's own question set is pinned in its
// test/lib/calculators/<id>/form.test.ts, and the profile intake is checked
// against what those forms ask, so a calculator slice edits only its files.
// ---------------------------------------------------------------------------

const OLD_PROFILE_EXTRA_SCREENS: Record<string, OldScreenCopy> = {
  'cash-buffer': { title: 'What does your emergency fund look like today?' },
  strategy: { title: 'Which starting point should the calculators use?', description: 'This sets your starting emergency-fund target. Both presets run through the same math; your overview shows the other one next to it.' },
};

const OLD_PROFILE_EXTRA_QUESTIONS: Record<string, OldQuestion> = {
  'cash.emergencyFundBalance': { path: 'cash.emergencyFundBalance', label: 'Cash set aside for emergencies', kind: 'money', min: 0 },
  'cash.emergencyFundApy': { path: 'cash.emergencyFundApy', label: 'Interest rate (APY) on that cash', kind: 'percent', help: 'The rate your savings account pays. A guess is fine.', min: 0, max: 0.2 },
  'strategy.preset': { path: 'strategy.preset', label: 'Strategy preset', kind: 'choice', options: [{ value: 'standard', label: 'Standard', description: 'About 3 months of must-pay costs in cash, then unleveraged index funds.' }, { value: 'cashflow-investor', label: 'Cash-flow investor', description: 'About 1 month in cash backed by a plan, automated contributions, and a leverage comparison for long horizons.' }] },
};

const OLD_PROFILE_EXTRA_FLOW: readonly OldScreen[] = [
  ['cash-buffer', 'cash', ['cash.emergencyFundBalance', 'cash.emergencyFundApy']],
  ['strategy', 'cash', ['strategy.preset']],
];

/** The section each calculator form's screens take in the profile intake. */
const FORM_SECTIONS: Record<(typeof PROFILE_FORM_ORDER)[number], string> = {
  retirement: 'retirement',
  paycheck: 'paycheck',
  portfolio: 'portfolio',
  leverage: 'portfolio',
};

/**
 * What the profile intake should ask, built from what each flow asks: the
 * core, then each calculator's own intake screens in profile order, then the
 * old profile-only screens. A question is asked once, on the first screen
 * that asks it; a screen left with no question is dropped.
 */
function expectedProfile(get = fromDefaults()): { screen: AskedScreen; section: string }[] {
  const seen = new Set<string>();
  const ids = new Set<string>();
  const out: { screen: AskedScreen; section: string }[] = [];
  const take = (source: string, screen: AskedScreen, section: string) => {
    const questions = screen.questions.filter((question) => !seen.has(question.path));
    if (questions.length === 0) return;
    for (const question of questions) seen.add(question.path);
    const id = ids.has(screen.id) ? `${source}-${screen.id}` : screen.id;
    ids.add(id);
    out.push({ screen: { ...screen, id, questions }, section });
  };
  for (const screen of askedScreens('core', get)) take('core', screen, 'core');
  for (const id of PROFILE_FORM_ORDER) {
    const specs = new Map(FORMS[id].screens.map((spec) => [spec.id, spec]));
    for (const screen of askedScreens(id, get)) {
      const spec = specs.get(screen.id)!;
      if (spec.tier === 'core' || spec.tier === 'assumption' || spec.surface === 'calculator') continue;
      take(id, screen, FORM_SECTIONS[id]);
    }
  }
  const extras = oldScreens(OLD_PROFILE_EXTRA_FLOW, OLD_PROFILE_EXTRA_SCREENS, OLD_PROFILE_EXTRA_QUESTIONS);
  for (const screen of extras) take('profile-extra', screen, 'cash');
  return out;
}

describe('behaviour-preserving: the provisional forms carry the old question sets', () => {
  it('asks the core exactly as before, question by question', () => {
    expect(askedScreens('core')).toEqual(oldScreens(OLD_CORE_FLOW, OLD_CORE_SCREENS, OLD_CORE_QUESTIONS));
  });

  it('starts every calculator form that has basics with the core screens, labelled and bounded the same', () => {
    // A form's basics show on its calculator page only (an intent's intake
    // asks the shared core, then the form's own screens), so the page may
    // keep its old help, hint and placeholder and leave out a core fact its
    // engine does not read (retirement: take-home pay). Labels, kinds,
    // options and bounds are the core's, and the order is the core's.
    const core = askedScreens('core');
    const strip = (question: AskedScreen['questions'][number]) => {
      const rest: Partial<AskedScreen['questions'][number]> = { ...question };
      delete rest.help;
      return rest;
    };
    for (const intent of CALCULATOR_INTENTS) {
      if (!FORMS[intent].screens.some((s) => s.tier === 'core')) continue;
      const basics = askedScreens(intent).slice(0, core.length);
      expect(basics.map((screen) => screen.id), intent).toEqual(core.map((screen) => screen.id));
      basics.forEach((screen, i) => {
        expect({ ...screen, questions: [] }, intent).toEqual({ ...core[i], questions: [] });
        const coreQuestions = new Map(core[i].questions.map((question) => [question.path, strip(question)]));
        const paths = screen.questions.map((question) => question.path);
        expect(paths, intent).toEqual(core[i].questions.map((q) => q.path).filter((path) => paths.includes(path)));
        for (const question of screen.questions) expect(strip(question), intent).toEqual(coreQuestions.get(question.path));
      });
    }
    expect(intakePaths('retirement')).not.toContain('income.netPerPaycheck');
    expect(askedScreens('paycheck').slice(0, core.length).flatMap((screen) => screen.questions.map((q) => q.path))).toEqual([
      ...CORE_PATHS,
    ]);
  });

  it('never asks a calculator form\'s own basics in the intent intake: that asks the shared core', () => {
    for (const intent of CALCULATOR_INTENTS) {
      const screens = getIntakeScreens(intent, fromDefaults(), { mode: 'remaining', provided: [] });
      expect(screens.some((screen) => screen.tier === 'core'), intent).toBe(false);
    }
  });

  it('asks the profile intent the core, each calculator\'s screens once, then the old profile-only screens', () => {
    expect(askedScreens('profile')).toEqual(expectedProfile().map(({ screen }) => screen));
    const noPlan = fromDefaults({ 'workplace.has401k': false });
    expect(askedScreens('profile', noPlan)).toEqual(expectedProfile(noPlan).map(({ screen }) => screen));
  });

  it('keeps the profile sections in order', () => {
    const sections = getIntakeScreens('profile', fromDefaults()).map((s) => profileFormSection(s.id));
    expect(sections).toEqual(expectedProfile().map(({ section }) => section));
  });

  it('counts the profile screens from the forms (14, 13 without a 401(k), 11 after the core, with the provisional forms)', () => {
    const all = expectedProfile().length;
    expect(screenIds('profile')).toHaveLength(all);
    expect(screenIds('profile', { 'workplace.has401k': false })).toHaveLength(
      expectedProfile(fromDefaults({ 'workplace.has401k': false })).length
    );
    expect(remainingIds('profile', [...CORE_PATHS])).toHaveLength(
      expectedProfile().filter(({ section }) => section !== 'core').length
    );
  });
});

describe('intake screens', () => {
  it('maps every question to a real profile path', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const path of intakePaths(intent)) {
        expect(isProfilePath(path), `${intent}:${path}`).toBe(true);
      }
    }
  });

  it('counts each intent from its form', () => {
    for (const intent of CALCULATOR_INTENTS) {
      expect(screenIds(intent)).toEqual(FORMS[intent].screens.filter((s) => s.surface !== 'calculator').map((s) => s.id));
    }
    expect(screenIds('profile')).toEqual(PROFILE_FORM.screens.map((s) => s.id));
    expect(screenIds('core')).toEqual(formForFlow('core').screens.map((s) => s.id));
  });

  it('asks the shared core in the same order for every intent that has it', () => {
    const withCore = CALCULATOR_INTENTS.filter((intent) => FORMS[intent].screens.some((s) => s.tier === 'core'));
    for (const intent of withCore) {
      // The form's basics: the core facts its engine reads, in core order.
      const basics = FORMS[intent].screens.filter((s) => s.tier === 'core').flatMap((s) => s.fields);
      expect(basics, intent).toEqual(CORE_PATHS.filter((path) => basics.includes(path)));
      expect(intakePaths(intent).slice(0, basics.length), intent).toEqual(basics);
    }
    expect(intakePaths('profile').slice(0, CORE_PATHS.length)).toEqual([...CORE_PATHS]);
  });

  it('offers the typical-value skip, and keeps the defaults on an assumption screen', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const screen of getIntakeScreens(intent, fromDefaults())) {
        expect(skipLabelFor(screen)).toBe(screen.tier === 'assumption' ? KEEP_ASSUMPTIONS_LABEL : INTAKE_SKIP_LABEL);
      }
    }
    const assumptions: ScreenSpec = { id: 'a', title: 'Assumptions', tier: 'assumption', fields: [] };
    expect(skipLabelFor(assumptions)).toBe(KEEP_ASSUMPTIONS_LABEL);
    expect(KEEP_ASSUMPTIONS_LABEL).toBe('Keep the default assumptions');
    expect(skipLabelFor({ ...assumptions, skipLabel: 'I have no debts' })).toBe('I have no debts');
  });
});

describe('validateIntakeScreen', () => {
  const screen = (flow: IntakeFlow, id: string) => getIntakeScreens(flow, fromDefaults()).find((s) => s.id === id)!;

  it('accepts the default profile on every screen', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const s of getIntakeScreens(intent, fromDefaults())) {
        expect(validateIntakeScreen(intent, s, fromDefaults()), `${intent}:${s.id}`).toEqual({});
      }
    }
  });

  it('flags take-home pay above gross pay on the take-home path', () => {
    const get = fromDefaults({ 'income.grossPerPaycheck': 2000, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen('core', screen('core', 'pay'), get)).toEqual({
      'income.netPerPaycheck':
        'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
    });
    // Equal is allowed (no withholding at all is possible).
    const equal = fromDefaults({ 'income.grossPerPaycheck': 2600, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen('core', screen('core', 'pay'), equal)).toEqual({});
  });

  it('flags custom portfolio targets that do not total 100% on the targets screen, as the engine words it', () => {
    const targets = (us: number) => [
      { accountId: null, assetClass: 'us-stock', target: us },
      { accountId: null, assetClass: 'bonds', target: 0.4 },
    ];
    const custom = fromDefaults({ 'investing.targetMix': 'custom', 'portfolio.classTargets': targets(0.9) });
    const targetsScreen = getIntakeScreens('portfolio', custom)[0];
    expect(validateIntakeScreen('portfolio', targetsScreen, custom)).toEqual({
      'portfolio.classTargets': 'Target allocations must sum to 100% (currently 130.00%).',
    });
    const whole = fromDefaults({ 'investing.targetMix': 'custom', 'portfolio.classTargets': targets(0.6) });
    expect(validateIntakeScreen('portfolio', targetsScreen, whole)).toEqual({});
    // A preset mix never shows the editor, so its stale custom rows are not checked.
    const preset = fromDefaults({ 'investing.targetMix': '60-40', 'portfolio.classTargets': targets(0.9) });
    expect(validateIntakeScreen('portfolio', getIntakeScreens('portfolio', preset)[0], preset)).toEqual({});
  });

  it('checks each field against its bounds', () => {
    const get = fromDefaults({ 'person.age': 12 });
    expect(validateIntakeScreen('core', screen('core', 'about'), get)).toEqual({
      'person.age': 'Your age must be between 16 and 100.',
    });
  });
});

describe('buildIntakeSubmission', () => {
  const values = (edits: Record<string, Record<string, unknown>> = {}): FinancialProfile => {
    const base = getDefaultFinancialProfile();
    const out: Record<string, unknown> = { ...base };
    for (const [section, leaves] of Object.entries(edits)) {
      out[section] = { ...(base as unknown as Record<string, Record<string, unknown>>)[section], ...leaves };
    }
    return out as unknown as FinancialProfile;
  };

  it('writes the answered paths, then the preset-derived cash target', () => {
    const result = buildIntakeSubmission(
      'paycheck',
      values({ person: { age: 27, state: 'CA' }, income: { grossPerPaycheck: 4200 } }),
      ['person.age', 'income.grossPerPaycheck', 'income.grossPerPaycheck']
    );
    // The default preset is cashflow-investor (1 month); person.state was not answered.
    expect(result.writes).toEqual([
      { path: 'person.age', value: 27 },
      { path: 'income.grossPerPaycheck', value: 4200 },
      { path: 'cash.targetMonths', value: 1 },
    ]);
    expect(result.providedPaths).toEqual(['person.age', 'income.grossPerPaycheck']);
  });

  it('drops unknown paths', () => {
    const result = buildIntakeSubmission('core', values(), ['person.age', 'person.nickname'], ['cash.targetMonths']);
    expect(result.providedPaths).toEqual(['person.age']);
    expect(result.writes).toEqual([{ path: 'person.age', value: 30 }]);
  });

  it('derives emergency months from the chosen preset without marking them provided', () => {
    const cashflow = buildIntakeSubmission('profile', values({ strategy: { preset: 'cashflow-investor' } }), [
      'strategy.preset',
    ]);
    expect(cashflow.writes).toEqual([
      { path: 'strategy.preset', value: 'cashflow-investor' },
      { path: 'cash.targetMonths', value: 1 },
    ]);
    expect(cashflow.providedPaths).toEqual(['strategy.preset']);

    const standard = buildIntakeSubmission('profile', values({ strategy: { preset: 'standard' } }), [
      'strategy.preset',
    ]);
    expect(standard.writes).toContainEqual({ path: 'cash.targetMonths', value: 3 });
  });

  it('leaves user-entered emergency months alone', () => {
    const result = buildIntakeSubmission('profile', values(), ['strategy.preset'], ['cash.targetMonths']);
    expect(result.writes.map((write) => write.path)).toEqual(['strategy.preset']);
  });

  it('derives emergency months from the profile preset when the preset question was not asked', () => {
    // Paycheck, retirement, portfolio and leverage intakes never ask the
    // preset; the working copy holds the profile's current one.
    for (const intent of CALCULATOR_INTENTS) {
      const cashflow = buildIntakeSubmission(intent, values({ cash: { targetMonths: 3 } }), ['person.age']);
      expect(cashflow.writes, intent).toEqual([
        { path: 'person.age', value: 30 },
        { path: 'cash.targetMonths', value: 1 },
      ]);
    }
    const standard = buildIntakeSubmission(
      'core',
      values({ strategy: { preset: 'standard' }, cash: { targetMonths: 1 } }),
      ['person.age']
    );
    expect(standard.writes).toContainEqual({ path: 'cash.targetMonths', value: 3 });
  });

  it('keeps emergency months entered in the same intake', () => {
    const result = buildIntakeSubmission('profile', values({ cash: { targetMonths: 6 } }), [
      'strategy.preset',
      'cash.targetMonths',
    ]);
    expect(result.writes).toEqual([
      { path: 'strategy.preset', value: 'cashflow-investor' },
      { path: 'cash.targetMonths', value: 6 },
    ]);
    expect(result.providedPaths).toEqual(['strategy.preset', 'cash.targetMonths']);
  });

  it('skips the derivation when the preset value is not a known preset', () => {
    const result = buildIntakeSubmission('core', values({ strategy: { preset: 'yolo' } }), ['person.age']);
    expect(result.writes).toEqual([{ path: 'person.age', value: 30 }]);
  });

  it('raises a retirement age at or below the current age to age + 1, after the answers', () => {
    const result = buildIntakeSubmission('leverage', values({ person: { age: 62, retirementAge: 60 } }), [
      'person.age',
    ]);
    expect(result.writes).toEqual([
      { path: 'person.age', value: 62 },
      { path: 'cash.targetMonths', value: 1 },
      { path: 'person.retirementAge', value: 63 },
    ]);
    expect(result.providedPaths).toEqual(['person.age']);
  });

  it('writes a list whole, by its list path', () => {
    const debts = [
      { id: 'd1', name: 'Card', balance: 1200, interestRate: 0.24, minimumPayment: 40, extraPayment: 0, taxDeductible: false },
    ];
    const result = buildIntakeSubmission('core', { ...values(), debts }, ['debts'], ['cash.targetMonths']);
    expect(result.writes).toEqual([{ path: 'debts', value: debts }]);
    expect(result.providedPaths).toEqual(['debts']);
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
    expect(intakePaths('core')).toEqual([...CORE_PATHS]);
  });

  it('isCoreComplete needs every core path in profile.provided', () => {
    expect(isCoreComplete(getDefaultFinancialProfile())).toBe(false);
    expect(isCoreComplete(profileWith([...CORE_PATHS]))).toBe(true);
    expect(isCoreComplete(profileWith(['investing.investedBalance', ...CORE_PATHS]))).toBe(true);
    expect(isCoreComplete(profileWith(CORE_PATHS.filter((p) => p !== 'income.netPerPaycheck')))).toBe(false);
    // Non-core answers do not count toward the core.
    expect(
      isCoreComplete(
        profileWith(['person.age', 'person.retirementAge', 'investing.taxableMonthlyContribution', 'investing.investedBalance'])
      )
    ).toBe(false);
  });
});

describe('guided-flow routes', () => {
  it('starts every intent that needs the core at the shared core', () => {
    expect(CORE_START_PATH).toBe('/start');
    expect(coreStartLink('retirement')).toBe('/start?next=retirement');
    expect(coreStartLink('profile')).toBe('/start?next=profile');
  });

  it('starts the portfolio intake on its own screens, without the core (O5)', () => {
    expect(coreStartLink('portfolio')).toBe('/start/portfolio');
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
    expect(screenIds('core')).toEqual(['about', 'pay', 'must-pay']);
    expect(getIntakeScreens('core', fromDefaults()).every((s) => s.tier === 'core')).toBe(true);
  });

  it("ignores provided paths in 'all' mode, the default", () => {
    for (const intent of INTAKE_INTENTS) {
      expect(screenIds(intent, undefined, { mode: 'all', provided: [...CORE_PATHS] })).toEqual(screenIds(intent));
    }
  });

  it('asks the profile intent everything but the core, in section order', () => {
    const screens = getIntakeScreens('profile', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    const expected = expectedProfile().filter(({ section }) => section !== 'core');
    expect(screens.map((s) => s.id)).toEqual(expected.map(({ screen }) => screen.id));
    expect(screens.map((s) => profileFormSection(s.id))).toEqual(expected.map(({ section }) => section));
  });

  it("asks only the unanswered core screens for the core flow in 'remaining' mode", () => {
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

  it('words head of household and married filing separately', () => {
    const base = getDefaultFinancialProfile();
    const filing = (filingStatus: FinancialProfile['person']['filingStatus']) =>
      coreSummary(profileWith(['person.filingStatus'], { person: { ...base.person, filingStatus } }));
    expect(filing('marriedSeparate')).toBe('married filing separately');
    expect(filing('headOfHousehold')).toBe('head of household');
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
    expect(isProfileFinished(profileWith([...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS]))).toBe(true);
  });

  it('is true once the profile intake has nothing left, though a few fields are never asked', () => {
    const asked = intakePaths('profile');
    const neverAsked = PROFILE_FIELDS.map((field) => field.path).filter((path) => !asked.includes(path));
    // The derived emergency-month target is never asked; with the provisional
    // forms neither is the contribution rate.
    expect(neverAsked).toContain('cash.targetMonths');
    expect(isProfileFinished(profileWith(asked))).toBe(true);
    expect(isProfileFinished(profileWith(asked.filter((path) => path !== asked[asked.length - 1])))).toBe(false);
  });
});
