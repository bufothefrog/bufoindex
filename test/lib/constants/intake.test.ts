import { describe, expect, it } from 'vitest';
import { FORMS, PROFILE_FORM, formForFlow } from '@/lib/calculators/forms';
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
  intentStartLink,
  coreSummary,
  getIntakeScreens,
  getIntentOption,
  getLearnOption,
  intakePaths,
  intakeScreenPaths,
  intakeSection,
  intakeSectionLabel,
  intakeSkipLabel,
  intentRequiresCore,
  isCoreComplete,
  isIntakeFlow,
  isIntakeIntent,
  isProfileFinished,
  remainingIntakeScreens,
  splitIntakeErrors,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeScreenOptions,
} from '@/lib/constants/intake';
import { makeGet } from '@/lib/fields/paths';
import { CORE_SCREENS } from '@/lib/fields/shared';
import type { ScreenSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile, isProfilePath } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

const defaults = getDefaultFinancialProfile();
const fromDefaults =
  (overrides: Record<string, unknown> = {}) =>
  (path: string) =>
    path in overrides ? overrides[path] : makeGet(defaults)(path);

const screenIds = (flow: IntakeFlow, overrides?: Record<string, unknown>, options?: IntakeScreenOptions) =>
  getIntakeScreens(flow, fromDefaults(overrides), options).map((s) => s.id);

const remainingIds = (flow: IntakeFlow, provided: string[], overrides?: Record<string, unknown>) =>
  screenIds(flow, overrides, { mode: 'remaining', provided });

const profileWith = (provided: string[], edits: Partial<FinancialProfile> = {}): FinancialProfile => ({
  ...getDefaultFinancialProfile(),
  ...edits,
  provided,
});

const CALCULATOR_INTENTS = ['paycheck', 'retirement', 'portfolio', 'leverage'] as const;

/** Every path a flow's intake screens list ('all' mode), from the forms. */
function allPaths(flow: IntakeFlow): string[] {
  return Array.from(new Set(formForFlow(flow).screens.flatMap((screen) => screen.fields)));
}

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

describe('intake flows', () => {
  it('recognizes the core and every intent as flows', () => {
    expect(isIntakeFlow('core')).toBe(true);
    for (const intent of INTAKE_INTENTS) expect(isIntakeFlow(intent)).toBe(true);
    expect(isIntakeFlow('choose')).toBe(false);
  });

  it('derives the core paths from the core screens, in order', () => {
    expect(CORE_PATHS).toEqual([
      'person.age',
      'person.state',
      'person.filingStatus',
      'income.grossPerPaycheck',
      'income.frequency',
      'income.netPerPaycheck',
      'spending.necessaryMonthly',
    ]);
    expect(CORE_PATHS).toEqual(CORE_SCREENS.flatMap((screen) => screen.fields));
  });

  it('keys every intake field by a real profile path', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const path of intakePaths(intent)) expect(isProfilePath(path), `${intent}:${path}`).toBe(true);
    }
  });

  it('lists each intent\'s intake paths from its form', () => {
    for (const intent of INTAKE_INTENTS) expect(intakePaths(intent)).toEqual(allPaths(intent));
  });

  it('gates every intent on the basics except the portfolio rebalancer (O5)', () => {
    expect(intentRequiresCore('portfolio')).toBe(false);
    for (const intent of ['paycheck', 'retirement', 'leverage', 'profile'] as const) {
      expect(intentRequiresCore(intent)).toBe(true);
    }
  });

  it('links into the guided flow', () => {
    expect(CORE_START_PATH).toBe('/start');
    expect(LEARN_CHOOSER_PATH).toBe('/start/choose');
    expect(coreStartLink('retirement')).toBe('/start?next=retirement');
    expect(intentStartLink('retirement')).toBe('/start?next=retirement');
    expect(intentStartLink('paycheck')).toBe('/start?next=paycheck');
    expect(intentStartLink('leverage')).toBe('/start?next=leverage');
    // The rebalancer reads none of the basics (O5).
    expect(intentStartLink('portfolio')).toBe('/start/portfolio');
    expect(coreDestination('leverage')).toBe('/start/leverage');
    expect(coreDestination('choose')).toBe('/start/choose');
    expect(coreDestination(null)).toBe('/start/choose');
    expect(coreDestination()).toBe('/start/choose');
  });

  it('checks the core against profile.provided', () => {
    expect(isCoreComplete(getDefaultFinancialProfile())).toBe(false);
    expect(isCoreComplete(profileWith(CORE_PATHS.slice(1)))).toBe(false);
    expect(isCoreComplete(profileWith([...CORE_PATHS]))).toBe(true);
  });
});

describe('getIntakeScreens', () => {
  it("asks the core screens for the core flow in 'all' mode", () => {
    expect(screenIds('core')).toEqual(CORE_SCREENS.map((screen) => screen.id));
  });

  it("asks every intake screen of an intent's form in 'all' mode", () => {
    for (const intent of CALCULATOR_INTENTS) {
      const expected = FORMS[intent].screens
        .filter((screen) => (screen.surface ?? 'both') !== 'calculator')
        .map((screen) => screen.id);
      const ids = screenIds(intent, {}, { mode: 'all' });
      // Hidden-by-default screens drop out; everything else keeps form order.
      expect(expected.filter((id) => ids.includes(id))).toEqual(ids);
    }
  });

  it("asks only the unanswered core screens for the core flow in 'remaining' mode", () => {
    expect(remainingIds('core', [])).toEqual(['about', 'pay', 'must-pay']);
    expect(remainingIds('core', ['person.age', 'person.state', 'person.filingStatus', 'income.frequency'])).toEqual([
      'pay',
      'must-pay',
    ]);
    expect(remainingIds('core', [...CORE_PATHS])).toEqual([]);
  });

  it("drops the core from an intent in 'remaining' mode, including core fields on shared screens", () => {
    for (const intent of INTAKE_INTENTS) {
      const screens = getIntakeScreens(intent, fromDefaults(), { mode: 'remaining', provided: [] });
      for (const screen of screens) {
        expect(screen.tier, `${intent}:${screen.id}`).not.toBe('core');
        for (const path of screen.fields) expect(CORE_PATHS, `${intent}:${path}`).not.toContain(path);
      }
    }
  });

  it('keeps a partly answered screen whole and drops a fully answered one', () => {
    const [first] = getIntakeScreens('profile', fromDefaults(), { mode: 'remaining', provided: [] });
    const all = getIntakeScreens('profile', fromDefaults(), { mode: 'remaining', provided: [] }).map((s) => s.id);
    expect(remainingIds('profile', [...first.fields])).toEqual(all.slice(1));
    if (first.fields.length > 1) {
      const partly = remainingIds('profile', [first.fields[0]]);
      expect(partly[0]).toBe(first.id);
    }
  });

  it('applies visibility rules in every mode', () => {
    // A screen whose fields are all hidden drops out (the employer match
    // without a workplace plan).
    const withPlan = screenIds('profile', { 'workplace.has401k': true });
    const withoutPlan = screenIds('profile', { 'workplace.has401k': false });
    expect(withPlan.length).toBeGreaterThan(withoutPlan.length);
    expect(withPlan.filter((id) => !withoutPlan.includes(id))).toEqual(['match']);
  });

  it('lists the screens a profile still needs', () => {
    const profile = profileWith([...CORE_PATHS]);
    expect(remainingIntakeScreens('profile', profile).map((s) => s.id)).toEqual(
      remainingIds('profile', [...CORE_PATHS])
    );
    for (const intent of INTAKE_INTENTS) {
      const everything = [...CORE_PATHS, ...intakePaths(intent)];
      expect(remainingIntakeScreens(intent, profileWith(everything)), intent).toEqual([]);
    }
  });
});

describe('profile flow helpers', () => {
  it('labels profile screens by the section they come from', () => {
    const screens = getIntakeScreens('profile', fromDefaults());
    expect(intakeSectionLabel('profile', screens[0])).toBe('The basics');
    expect(intakeSection('profile', screens[0])).toBe('core');
    expect(intakeSectionLabel('profile', screens[screens.length - 1])).toBe('Cash and strategy');
    expect(intakeSectionLabel('retirement', screens[0])).toBeUndefined();
    expect(intakeSection('retirement', screens[0])).toBe('retirement');
  });

  it('marks a screen\'s visible paths as answered', () => {
    const [about] = getIntakeScreens('core', fromDefaults());
    expect(intakeScreenPaths('core', about, fromDefaults())).toEqual([...about.fields]);
  });

  it('offers the typical-value skip on facts and keeping the defaults on assumptions (O3)', () => {
    const base: ScreenSpec = { id: 'x', title: 'X', tier: 'details', fields: [] };
    expect(intakeSkipLabel(base)).toBe(INTAKE_SKIP_LABEL);
    expect(intakeSkipLabel({ ...base, tier: 'assumption' })).toBe(KEEP_ASSUMPTIONS_LABEL);
    expect(intakeSkipLabel({ ...base, skipLabel: 'I have no debts' })).toBe('I have no debts');
  });
});

describe('isProfileFinished', () => {
  it('is false while profile topics remain', () => {
    expect(isProfileFinished(getDefaultFinancialProfile())).toBe(false);
    expect(isProfileFinished(profileWith([...CORE_PATHS]))).toBe(false);
  });

  it('is true once every profile path is answered', () => {
    expect(isProfileFinished(profileWith(allPaths('profile')))).toBe(true);
  });

  it('is true when only skipped basics remain (the profile intake no longer asks them)', () => {
    const withoutCore = allPaths('profile').filter((path) => !CORE_PATHS.includes(path));
    expect(isProfileFinished(profileWith(withoutCore))).toBe(true);
  });
});

describe('validateIntakeScreen', () => {
  const about = CORE_SCREENS[0];
  const pay = CORE_SCREENS[1];

  it('passes the default answers on every screen of every flow', () => {
    for (const flow of ['core', ...INTAKE_INTENTS] as const) {
      for (const screen of getIntakeScreens(flow, fromDefaults())) {
        expect(validateIntakeScreen(flow, screen, fromDefaults()), `${flow}:${screen.id}`).toEqual({});
      }
    }
  });

  it('keys field bounds by path', () => {
    expect(validateIntakeScreen('core', about, fromDefaults({ 'person.age': 120 }))).toHaveProperty('person.age');
  });

  it('checks take-home against gross on the pay screen only', () => {
    const get = fromDefaults({ 'income.netPerPaycheck': 5000, 'income.grossPerPaycheck': 4000 });
    const errors = validateIntakeScreen('core', pay, get);
    expect(errors['income.netPerPaycheck']).toMatch(/Take-home pay is above gross pay/);
    expect(validateIntakeScreen('core', about, get)).toEqual({});
    expect(splitIntakeErrors('core', errors)).toEqual({ fields: {}, relations: [errors['income.netPerPaycheck']] });
  });

  it('checks the retirement age against the age wherever the retirement age is asked', () => {
    const screen = PROFILE_FORM.screens.find((s) => s.fields.includes('person.retirementAge'));
    expect(screen).toBeDefined();
    const errors = validateIntakeScreen('profile', screen!, fromDefaults({ 'person.age': 65, 'person.retirementAge': 60 }));
    expect(errors['person.retirementAge']).toBe('The retirement age needs to be above your current age.');
  });

  it('separates field errors from relation messages', () => {
    expect(splitIntakeErrors('core', { 'person.age': 'Too high' })).toEqual({
      fields: { 'person.age': 'Too high' },
      relations: [],
    });
  });
});

describe('buildIntakeSubmission', () => {
  const values = (edits: Record<string, unknown>): FinancialProfile => {
    let profile = getDefaultFinancialProfile();
    for (const [path, value] of Object.entries(edits)) {
      const [section, key] = path.split('.');
      profile = { ...profile, [section]: { ...(profile as unknown as Record<string, Record<string, unknown>>)[section], [key]: value } };
    }
    return profile;
  };

  it('writes only the answered paths, plus the derived target months', () => {
    const { writes, providedPaths } = buildIntakeSubmission(
      'core',
      values({ 'person.age': 41, 'person.state': 'CA' }),
      ['person.age', 'person.age']
    );
    expect(providedPaths).toEqual(['person.age']);
    expect(writes).toEqual([
      { path: 'person.age', value: 41 },
      // The default preset is cashflow-investor: 1 month.
      { path: 'cash.targetMonths', value: 1 },
    ]);
  });

  it('drops unknown paths', () => {
    const { writes, providedPaths } = buildIntakeSubmission('core', values({}), ['nope.path', 'person.age']);
    expect(providedPaths).toEqual(['person.age']);
    expect(writes.map((w) => w.path)).not.toContain('nope.path');
  });

  it('follows the strategy preset unless target months were entered now or earlier', () => {
    const standard = values({ 'strategy.preset': 'standard' });
    expect(buildIntakeSubmission('profile', standard, ['strategy.preset']).writes).toContainEqual({
      path: 'cash.targetMonths',
      value: 3,
    });
    const earlier = buildIntakeSubmission('profile', standard, ['strategy.preset'], ['cash.targetMonths']);
    expect(earlier.writes.map((w) => w.path)).not.toContain('cash.targetMonths');
    const now = buildIntakeSubmission('profile', standard, ['strategy.preset', 'cash.targetMonths']);
    expect(now.writes.filter((w) => w.path === 'cash.targetMonths')).toEqual([
      { path: 'cash.targetMonths', value: standard.cash.targetMonths },
    ]);
  });

  it('raises a retirement age at or below the age to age + 1, without marking it', () => {
    const { writes, providedPaths } = buildIntakeSubmission(
      'retirement',
      values({ 'person.age': 64, 'person.retirementAge': 60 }),
      ['person.age']
    );
    expect(writes).toContainEqual({ path: 'person.retirementAge', value: 65 });
    expect(providedPaths).toEqual(['person.age']);
  });

  it('writes a whole list for a list path', () => {
    const profile = getDefaultFinancialProfile();
    const { writes } = buildIntakeSubmission('portfolio', profile, ['portfolio.accounts']);
    expect(writes[0]).toEqual({ path: 'portfolio.accounts', value: profile.portfolio.accounts });
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
