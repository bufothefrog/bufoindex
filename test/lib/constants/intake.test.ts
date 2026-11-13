import { describe, expect, it } from 'vitest';
import {
  CORE_FORM,
  FORMS,
  PROFILE_FORM,
  PROFILE_FORM_ORDER,
  formForFlow,
  profileCompleteness,
  profileFormSection,
} from '@/lib/calculators/forms';
import {
  CORE_PATHS,
  CORE_START_PATH,
  INTAKE_INTENTS,
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
  isCoreComplete,
  intentAsksScreen,
  isIntakeIntent,
  isProfileFinished,
  remainingIntakeScreens,
  nextNeedsOwnAnswer,
  ownAnswerMessage,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeScreenOptions,
} from '@/lib/constants/intake';
import { makeGet } from '@/lib/fields/paths';
import { summarizeScreen } from '@/lib/fields/runtime';
import { CORE_SCREENS } from '@/lib/fields/shared';
import type { ScreenSpec } from '@/lib/fields/types';
import {
  PROFILE_LEAF_PATHS,
  PROFILE_LIST_PATHS,
  getDefaultFinancialProfile,
  isProfilePath,
} from '@/lib/profile/defaults';
import { migrateProfile } from '@/lib/profile/migrate';
import type { FinancialProfile } from '@/lib/profile/types';
import {
  OLD_CORE_FLOW,
  OLD_CORE_QUESTIONS,
  OLD_CORE_SCREENS,
  askedScreen,
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

  it('says the rebalancer opens with the accounts and the target mix (the new cash is asked on the page)', () => {
    expect(getIntentOption('portfolio').resultHint).toBe('Opens the Portfolio Rebalancer with your accounts and target mix.');
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

// The old strategy preset screen is gone (slice c1): the preset was removed.
const OLD_PROFILE_EXTRA_SCREENS: Record<string, OldScreenCopy> = {
  'cash-buffer': { title: 'What does your emergency fund look like today?' },
};

const OLD_PROFILE_EXTRA_QUESTIONS: Record<string, OldQuestion> = {
  'cash.emergencyFundBalance': { path: 'cash.emergencyFundBalance', label: 'Cash set aside for emergencies', kind: 'money', min: 0 },
  'cash.emergencyFundApy': { path: 'cash.emergencyFundApy', label: 'Interest rate (APY) on that cash', kind: 'percent', min: 0, max: 0.2 },
};

const OLD_PROFILE_EXTRA_FLOW: readonly OldScreen[] = [
  ['cash-buffer', 'cash', ['cash.emergencyFundBalance', 'cash.emergencyFundApy']],
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
    // The intent intake leaves its optional screens out; the profile form asks them last.
    for (const screen of askedScreens(id, get)) {
      const spec = specs.get(screen.id)!;
      expect(spec.optional, `${id}:${spec.id}`).not.toBe(true);
      if (spec.tier === 'core' || spec.tier === 'assumption' || spec.surface === 'calculator') continue;
      // The shared accounts screen takes the section 'accounts', whichever form asks it first.
      take(id, screen, screen.id === 'accounts' ? 'accounts' : FORM_SECTIONS[id]);
    }
  }
  const extras = oldScreens(OLD_PROFILE_EXTRA_FLOW, OLD_PROFILE_EXTRA_SCREENS, OLD_PROFILE_EXTRA_QUESTIONS);
  for (const screen of extras) take('profile-extra', screen, 'cash');
  for (const id of PROFILE_FORM_ORDER) {
    for (const spec of FORMS[id].screens.filter((screen) => screen.optional)) {
      take(id, askedScreen(FORMS[id], spec, get), 'optional');
    }
  }
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

  it('counts the profile screens from the forms: all of them, fewer without a 401(k), and the non-core ones after the core', () => {
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

  it('counts each intent from its form, without its optional, assumption and calculator-only screens', () => {
    for (const intent of CALCULATOR_INTENTS) {
      expect(screenIds(intent)).toEqual(
        FORMS[intent].screens
          .filter((s) => s.surface !== 'calculator' && !s.optional && s.tier !== 'assumption')
          .map((s) => s.id)
      );
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

  it('needs the own entry on the basics screens only (nextNeedsOwnAnswer, both branches)', () => {
    const basics = getIntakeScreens('core', fromDefaults());
    expect(basics.map((s) => s.id)).toEqual(['about', 'pay', 'must-pay']);
    expect(basics.map((s) => nextNeedsOwnAnswer(s))).toEqual([true, true, true]);
    for (const intent of INTAKE_INTENTS) {
      for (const screen of getIntakeScreens(intent, fromDefaults())) {
        expect(nextNeedsOwnAnswer(screen), `${intent}/${screen.id}`).toBe(screen.tier === 'core');
      }
    }
    const details: ScreenSpec = { id: 'd', title: 'Details', tier: 'details', fields: [] };
    expect(nextNeedsOwnAnswer(details)).toBe(false);
    expect(nextNeedsOwnAnswer({ ...details, tier: 'assumption' })).toBe(false);
    expect(nextNeedsOwnAnswer({ ...details, tier: 'core' })).toBe(true);
  });

  it('words a blank basic as a short instruction, with a fallback per kind', () => {
    const form = formForFlow('core');
    const spec = (path: string) => form.fields.find((f) => f.path === path)!;
    expect(CORE_PATHS.map((path) => ownAnswerMessage(spec(path)))).toEqual([
      'Enter your age',
      'Choose your state',
      'Choose your filing status',
      'Enter your gross pay',
      'Choose how often you are paid',
      'Enter your take-home pay',
      'Enter your must-pay costs',
    ]);
    expect(ownAnswerMessage({ path: 'x', kind: 'money', label: 'X', tier: 'core' })).toBe('Enter a value');
    expect(ownAnswerMessage({ path: 'x', kind: 'choice', label: 'X', tier: 'core' })).toBe('Choose an answer');
  });
});

describe('each intent intake asks only its calculator\'s profile questions', () => {
  it('lists the screens of each intake in "all" mode', () => {
    expect(screenIds('paycheck')).toEqual([
      'about',
      'pay',
      'must-pay',
      'spending-bonus',
      'emergency-fund',
      '401k',
      'hsa',
      'ira-taxable',
      'debts',
    ]);
    expect(screenIds('retirement')).toEqual(['about', 'pay', 'must-pay', 'accounts', 'target']);
    expect(screenIds('portfolio')).toEqual(['targets', 'accounts', 'holdings']);
    expect(screenIds('leverage')).toEqual(['facts', 'accounts']);
  });

  it('lists the screens each intake asks after the core', () => {
    expect(remainingIds('paycheck', [...CORE_PATHS])).toEqual([
      'spending-bonus',
      'emergency-fund',
      '401k',
      'hsa',
      'ira-taxable',
      'debts',
    ]);
    expect(remainingIds('retirement', [...CORE_PATHS])).toEqual(['accounts', 'target']);
    expect(remainingIds('portfolio', [...CORE_PATHS])).toEqual(['targets', 'accounts', 'holdings']);
    expect(remainingIds('leverage', [...CORE_PATHS])).toEqual(['facts', 'accounts']);
  });

  it('never asks an assumption, optional or calculator-only screen in any intent (intentAsksScreen)', () => {
    for (const intent of CALCULATOR_INTENTS) {
      for (const screen of getIntakeScreens(intent, fromDefaults())) {
        expect(screen.tier, `${intent}/${screen.id}`).not.toBe('assumption');
        expect(screen.optional, `${intent}/${screen.id}`).not.toBe(true);
        expect(screen.surface, `${intent}/${screen.id}`).not.toBe('calculator');
      }
    }
    const details: ScreenSpec = { id: 'd', title: 'D', tier: 'details', fields: [] };
    expect(intentAsksScreen(details)).toBe(true);
    expect(intentAsksScreen({ ...details, tier: 'assumption' })).toBe(false);
    expect(intentAsksScreen({ ...details, optional: true })).toBe(false);
  });

  it('has nothing left to ask once the profile questions are answered, whatever the assumptions say', () => {
    // The "nothing to ask" redirect (an empty remainingIntakeScreens) applies with every assumption,
    // the leverage ratio and the claiming age still unanswered.
    for (const intent of CALCULATOR_INTENTS) {
      const asked = getIntakeScreens(intent, fromDefaults()).flatMap((screen) => screen.fields);
      expect(asked.some((path) => path.startsWith('assumptions.')), intent).toBe(false);
      expect(asked, intent).not.toContain('strategy.leverageRatio');
      expect(asked, intent).not.toContain('retirementIncome.socialSecurityAge');
      expect(remainingIntakeScreens(intent, profileWith([...CORE_PATHS, ...asked])), intent).toEqual([]);
    }
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

  it('writes the answered paths and derives no emergency-fund months', () => {
    const result = buildIntakeSubmission(
      'paycheck',
      values({ person: { age: 27, state: 'CA' }, income: { grossPerPaycheck: 4200 } }),
      ['person.age', 'income.grossPerPaycheck', 'income.grossPerPaycheck']
    );
    // person.state was not answered.
    expect(result.writes).toEqual([
      { path: 'person.age', value: 27 },
      { path: 'income.grossPerPaycheck', value: 4200 },
    ]);
    expect(result.providedPaths).toEqual(['person.age', 'income.grossPerPaycheck']);
  });

  it('drops unknown paths', () => {
    const result = buildIntakeSubmission('core', values(), ['person.age', 'person.nickname'], ['cash.targetMonths']);
    expect(result.providedPaths).toEqual(['person.age']);
    expect(result.writes).toEqual([{ path: 'person.age', value: 25 }]);
  });

  it('keeps stored emergency months that came from the old preset write, in every flow', () => {
    // A profile saved before slice c1 may hold 1 month, written by the removed
    // cash-flow investor preset without marking it provided. No intake rewrites it.
    for (const flow of [...CALCULATOR_INTENTS, 'core', 'profile'] as const) {
      const result = buildIntakeSubmission(flow, values({ cash: { targetMonths: 1 } }), ['person.age']);
      expect(result.writes, flow).toEqual([{ path: 'person.age', value: 25 }]);
    }
  });

  it('marks a "strategy.preset" answer from an old wizard session as unknown and drops it', () => {
    const result = buildIntakeSubmission('profile', values(), ['strategy.preset', 'person.age']);
    expect(result.providedPaths).toEqual(['person.age']);
    expect(result.writes).toEqual([{ path: 'person.age', value: 25 }]);
  });

  it('keeps emergency months entered in the same intake', () => {
    const result = buildIntakeSubmission('profile', values({ cash: { targetMonths: 6 } }), ['cash.targetMonths']);
    expect(result.writes).toEqual([{ path: 'cash.targetMonths', value: 6 }]);
    expect(result.providedPaths).toEqual(['cash.targetMonths']);
  });

  it('raises a retirement age at or below the current age to age + 1, after the answers', () => {
    const result = buildIntakeSubmission('leverage', values({ person: { age: 62, retirementAge: 60 } }), [
      'person.age',
    ]);
    expect(result.writes).toEqual([
      { path: 'person.age', value: 62 },
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
    expect(coreSummary(profileWith([...CORE_PATHS]))).toBe(
      '25, CA, single, $4,000 gross every 2 weeks, $2,550 take-home, $3,000 a month in must-pay costs'
    );
  });

  it('leaves out answers that are still placeholders', () => {
    const base = getDefaultFinancialProfile();
    const profile = profileWith(['person.age', 'person.filingStatus', 'income.grossPerPaycheck'], {
      person: { ...base.person, age: 41, filingStatus: 'marriedJoint' },
      income: { ...base.income, grossPerPaycheck: 4250.4 },
    });
    expect(coreSummary(profile)).toBe('41, married filing jointly, $4,250 gross per paycheck');
  });

  it('words each pay frequency, with or without the gross amount', () => {
    const base = getDefaultFinancialProfile();
    const withFrequency = (frequency: FinancialProfile['income']['frequency'], provided: string[]) =>
      coreSummary(profileWith(provided, { income: { ...base.income, grossPerPaycheck: 1200, frequency } }));

    expect(withFrequency('weekly', ['income.grossPerPaycheck', 'income.frequency'])).toBe('$1,200 gross every week');
    expect(withFrequency('semi-monthly', ['income.grossPerPaycheck', 'income.frequency'])).toBe('$1,200 gross twice a month');
    expect(withFrequency('monthly', ['income.grossPerPaycheck', 'income.frequency'])).toBe('$1,200 gross once a month');
    expect(withFrequency('semi-monthly', ['income.frequency', 'spending.necessaryMonthly'])).toBe(
      'paid twice a month, $3,000 a month in must-pay costs'
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
    expect(coreSummary(profileWith(['investing.investedBalance', 'person.retirementAge']))).toBe('');
  });

  it('words take-home pay, with the cadence on the gross amount when both are saved', () => {
    expect(coreSummary(profileWith(['income.netPerPaycheck']))).toBe('$2,550 take-home');
    expect(coreSummary(profileWith(['income.netPerPaycheck', 'income.frequency']))).toBe(
      'paid every 2 weeks, $2,550 take-home'
    );
  });

  it('says what the collapsed core cards say, piece for piece', () => {
    const profile = profileWith([...CORE_PATHS]);
    const get = makeGet(profile);
    const cards = CORE_SCREENS.map((screen) => summarizeScreen(CORE_FORM, screen, get));
    expect(cards).toEqual(['25, CA, single', '$4,000 gross every 2 weeks, $2,550 take-home', '$3,000 a month']);
    expect(coreSummary(profile)).toBe(`${cards[0]}, ${cards[1]}, ${cards[2]} in must-pay costs`);
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

  it('never counts an optional screen, answered or not, though /start/profile still asks it', () => {
    const optional = PROFILE_FORM.screens.filter((s) => s.optional);
    expect(optional.map((s) => s.id)).toEqual(['ss-healthcare']);
    const optionalPaths = optional.flatMap((s) => s.fields);
    const required = intakePaths('profile').filter((path) => !optionalPaths.includes(path));
    for (const intent of INTAKE_INTENTS) {
      // A profile saved before the optional section, with the optional facts answered or not.
      const without = ids(intent, profileWith([...CORE_PATHS]));
      expect(without, intent).not.toContain('ss-healthcare');
      expect(ids(intent, profileWith([...CORE_PATHS, ...optionalPaths])), intent).toEqual(without);
    }
    expect(ids('profile', profileWith(required))).toEqual([]);
    // The profile wizard asks the unanswered optional screen at the end.
    const asked = getIntakeScreens('profile', makeGet(profileWith(required)), { mode: 'remaining', provided: required });
    expect(asked.map((s) => [s.id, profileFormSection(s.id)])).toEqual([['ss-healthcare', 'optional']]);
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
    const neverAsked = PROFILE_LEAF_PATHS.filter((path) => !asked.includes(path));
    // The calculator-only leaves (the leverage ratio, the claiming age) and the assumptions are never
    // asked by the profile intake; the emergency-fund months are (slice c1).
    expect(neverAsked).toContain('strategy.leverageRatio');
    expect(neverAsked).toContain('retirementIncome.socialSecurityAge');
    expect(neverAsked).toContain('assumptions.paycheck.riskTolerance');
    expect(asked).toContain('cash.targetMonths');
    expect(isProfileFinished(profileWith(asked))).toBe(true);
    const required = PROFILE_FORM.screens.filter((s) => !s.optional);
    const lastFields = required[required.length - 1].fields;
    const lastRequired = lastFields[lastFields.length - 1];
    expect(isProfileFinished(profileWith(asked.filter((path) => path !== lastRequired)))).toBe(false);
  });

  it('does not wait for the optional screens', () => {
    const optionalPaths = PROFILE_FORM.screens.filter((s) => s.optional).flatMap((s) => s.fields);
    expect(optionalPaths).toEqual(['retirementIncome.socialSecurityBenefit', 'retirementIncome.annualHealthcareCost']);
    const required = intakePaths('profile').filter((path) => !optionalPaths.includes(path));
    expect(isProfileFinished(profileWith(required))).toBe(true);
    expect(isProfileFinished(profileWith([...required, ...optionalPaths]))).toBe(true);
    expect(isProfileFinished(profileWith(optionalPaths))).toBe(false);
  });
});

describe('a profile finished at 3bb0132', () => {
  // Every fact answered except the emergency fund target, which the profile
  // form of 3bb0132 never asked; the cash-flow investor preset had written
  // 1 month there without marking it provided.
  const saved = {
    ...getDefaultFinancialProfile(),
    cash: { emergencyFundBalance: 5000, emergencyFundApy: 0.04, targetMonths: 1 },
    provided: [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS].filter((path) => path !== 'cash.targetMonths'),
  };

  it('loads the unanswered months as the typical 3, never 1', () => {
    expect(migrateProfile(saved, 2).cash.targetMonths).toBe(3);
  });

  it('has one topic left, the emergency fund screen that now asks the months', () => {
    const profile = migrateProfile(saved, 2);
    expect(remainingIntakeScreens('profile', profile).map((screen) => screen.id)).toEqual(['emergency-fund']);
    expect(isProfileFinished(profile)).toBe(false);
    const completeness = profileCompleteness(profile);
    expect(completeness.missing.map((screen) => screen.id)).toEqual(['emergency-fund']);
    expect(completeness.provided).toBe(completeness.total - 1);
  });
});
