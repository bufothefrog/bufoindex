import { describe, expect, it } from 'vitest';
import { FORMS, PROFILE_FORM, formForFlow, profileFormSection } from '@/lib/calculators/forms';
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
  intakeForm,
  intakePaths,
  isCoreComplete,
  isIntakeFlow,
  isIntakeIntent,
  isProfileFinished,
  remainingIntakeScreens,
  skipLabelFor,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeScreenOptions,
} from '@/lib/constants/intake';
import { resolveOptions, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldOption, ScreenSpec } from '@/lib/fields/types';
import { PROFILE_FIELDS, getDefaultFinancialProfile, getProfileValue, isProfilePath } from '@/lib/profile/defaults';
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
// asked before slice w1. The fixture below was captured from the old
// INTAKE_QUESTIONS and INTAKE_SCREENS (every intent in 'all' mode, default
// profile) before they were deleted; it is compared question by question.
// ---------------------------------------------------------------------------

type OldKind = 'money' | 'number' | 'percent' | 'state' | 'frequency' | 'filing' | 'choice';
interface OldQuestion {
  path: string;
  label: string;
  kind: OldKind;
  help?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
}
type OldScreen = readonly [id: string, section: string, questions: readonly string[]];

const OLD_SCREENS: Record<string, { title: string; description?: string }> = {
  about: { title: 'A little about you', description: 'Age sets the time horizon. State and filing status set the tax estimate.' },
  pay: { title: 'What does a typical paycheck look like?', description: 'A close guess is fine.' },
  'must-pay': { title: 'What do you have to pay each month?' },
  'fun-money': { title: 'How much fun money do you want each month?', description: 'Spending on things you enjoy, beyond the must-pay costs. A range is fine.' },
  workplace: { title: 'Does your employer offer a 401(k) or similar plan?' },
  match: { title: 'How does the employer match work?', description: 'Often written as "50% of the first 6% of pay". A guess is fine; your benefits portal has the exact terms.' },
  'retire-age': { title: 'When would you like to retire?' },
  invested: { title: 'Roughly how much do you have invested?' },
  'monthly-investing': { title: 'How much do you invest each month?' },
  'new-cash': { title: 'How much new cash are you investing this month?' },
  'target-mix': { title: 'Which stock and bond mix are you aiming for?', description: 'You can set a custom mix on the calculator.' },
  horizon: { title: 'What is your time horizon?', description: 'The comparison runs from now until you plan to stop contributing.' },
  'taxable-investing': { title: 'How much goes into a taxable brokerage account each month?', description: 'The leverage comparison applies to taxable contributions, outside retirement accounts.' },
  'cash-buffer': { title: 'What does your emergency fund look like today?' },
  strategy: { title: 'Which starting point should the calculators use?', description: 'This sets your starting emergency-fund target. Both presets run through the same math; your overview shows the other one next to it.' },
};

const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'person.age': { path: 'person.age', label: 'Your age', kind: 'number', min: 16, max: 100, step: 1 },
  'person.state': { path: 'person.state', label: 'State you live in', kind: 'state' },
  'person.filingStatus': { path: 'person.filingStatus', label: 'Tax filing status', kind: 'filing', options: [{ value: 'single', label: 'Single' }, { value: 'marriedJoint', label: 'Married filing jointly' }] },
  'income.grossPerPaycheck': { path: 'income.grossPerPaycheck', label: 'Gross pay per paycheck', kind: 'money', help: 'Before taxes and deductions.', min: 0 },
  'income.frequency': { path: 'income.frequency', label: 'How often you are paid', kind: 'frequency', options: [{ value: 'weekly', label: 'Every week' }, { value: 'bi-weekly', label: 'Every two weeks' }, { value: 'semi-monthly', label: 'Twice a month' }, { value: 'monthly', label: 'Once a month' }] },
  'income.netPerPaycheck': { path: 'income.netPerPaycheck', label: 'Take-home pay per paycheck', kind: 'money', help: 'What lands in your bank account after taxes and deductions.', min: 0 },
  'spending.necessaryMonthly': { path: 'spending.necessaryMonthly', label: 'Must-pay costs per month', kind: 'money', help: 'Rent or mortgage, utilities, insurance, groceries, minimum debt payments.', min: 0 },
  'spending.funMoneyMin': { path: 'spending.funMoneyMin', label: 'At least, per month', kind: 'money', min: 0 },
  'spending.funMoneyMax': { path: 'spending.funMoneyMax', label: 'At most, per month', kind: 'money', min: 0 },
  'workplace.has401k': { path: 'workplace.has401k', label: 'Workplace retirement plan', kind: 'choice', options: [{ value: true, label: 'Yes', description: 'Not sure? Pick Yes and check your benefits portal later.' }, { value: false, label: 'No' }] },
  'workplace.matchPercent': { path: 'workplace.matchPercent', label: 'Employer match rate', kind: 'percent', help: 'What your employer adds per dollar you contribute. 50% means 50 cents per dollar.', min: 0, max: 2 },
  'workplace.matchLimit': { path: 'workplace.matchLimit', label: 'Matched up to this share of your pay', kind: 'percent', help: 'In "50% of the first 6%", this is the 6%.', min: 0, max: 1 },
  'person.retirementAge': { path: 'person.retirementAge', label: 'Target retirement age', kind: 'number', min: 30, max: 85, step: 1 },
  'investing.investedBalance': { path: 'investing.investedBalance', label: 'Invested balance', kind: 'money', help: 'A rough total across 401(k), IRA, and brokerage accounts is fine. Leave out your emergency fund.', min: 0 },
  'investing.monthlyContribution': { path: 'investing.monthlyContribution', label: 'Monthly investing contribution', kind: 'money', help: 'What you put toward investing each month across all accounts, including your own 401(k) contributions.', min: 0 },
  'investing.newCashThisMonth': { path: 'investing.newCashThisMonth', label: 'New cash to invest this month', kind: 'money', help: 'Money you are ready to put into your accounts now.', min: 0 },
  'investing.targetMix': { path: 'investing.targetMix', label: 'Target mix', kind: 'choice', options: [{ value: '100-0', label: '100% stocks', description: 'The highest expected growth and the deepest drawdowns.' }, { value: '80-20', label: '80% stocks, 20% bonds', description: 'Mostly stocks, with a bond cushion.' }, { value: '60-40', label: '60% stocks, 40% bonds', description: 'Smaller swings and lower expected growth.' }] },
  'leverage:person.retirementAge': { path: 'person.retirementAge', label: 'Age you plan to stop contributing', kind: 'number', min: 30, max: 85, step: 1 },
  'investing.taxableMonthlyContribution': { path: 'investing.taxableMonthlyContribution', label: 'Monthly taxable contribution', kind: 'money', help: 'Money you invest each month outside 401(k) and IRA accounts.', min: 0 },
  'leverage:investing.investedBalance': { path: 'investing.investedBalance', label: 'Starting balance', kind: 'money', help: 'What you already have invested. A rough number is fine.', min: 0 },
  'cash.emergencyFundBalance': { path: 'cash.emergencyFundBalance', label: 'Cash set aside for emergencies', kind: 'money', min: 0 },
  'cash.emergencyFundApy': { path: 'cash.emergencyFundApy', label: 'Interest rate (APY) on that cash', kind: 'percent', help: 'The rate your savings account pays. A guess is fine.', min: 0, max: 0.2 },
  'strategy.preset': { path: 'strategy.preset', label: 'Strategy preset', kind: 'choice', options: [{ value: 'standard', label: 'Standard', description: 'About 3 months of must-pay costs in cash, then unleveraged index funds.' }, { value: 'cashflow-investor', label: 'Cash-flow investor', description: 'About 1 month in cash backed by a plan, automated contributions, and a leverage comparison for long horizons.' }] },
};

const OLD_FLOWS: Record<IntakeIntent, readonly OldScreen[]> = {
  paycheck: [
    ['about', 'core', ['person.age', 'person.state', 'person.filingStatus']],
    ['pay', 'core', ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck']],
    ['must-pay', 'core', ['spending.necessaryMonthly']],
    ['fun-money', 'paycheck', ['spending.funMoneyMin', 'spending.funMoneyMax']],
    ['workplace', 'paycheck', ['workplace.has401k']],
    ['match', 'paycheck', ['workplace.matchPercent', 'workplace.matchLimit']],
  ],
  retirement: [
    ['about', 'core', ['person.age', 'person.state', 'person.filingStatus']],
    ['pay', 'core', ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck']],
    ['must-pay', 'core', ['spending.necessaryMonthly']],
    ['retire-age', 'retirement', ['person.retirementAge']],
    ['invested', 'retirement', ['investing.investedBalance']],
    ['monthly-investing', 'retirement', ['investing.monthlyContribution']],
  ],
  portfolio: [
    ['about', 'core', ['person.age', 'person.state', 'person.filingStatus']],
    ['pay', 'core', ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck']],
    ['must-pay', 'core', ['spending.necessaryMonthly']],
    ['new-cash', 'portfolio', ['investing.newCashThisMonth']],
    ['target-mix', 'portfolio', ['investing.targetMix']],
  ],
  leverage: [
    ['horizon', 'core', ['person.age', 'leverage:person.retirementAge']],
    ['taxable-investing', 'portfolio', ['investing.taxableMonthlyContribution']],
    ['invested', 'retirement', ['leverage:investing.investedBalance']],
  ],
  profile: [
    ['about', 'core', ['person.age', 'person.state', 'person.filingStatus']],
    ['pay', 'core', ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck']],
    ['must-pay', 'core', ['spending.necessaryMonthly']],
    ['retire-age', 'retirement', ['person.retirementAge']],
    ['invested', 'retirement', ['investing.investedBalance']],
    ['monthly-investing', 'retirement', ['investing.monthlyContribution']],
    ['fun-money', 'paycheck', ['spending.funMoneyMin', 'spending.funMoneyMax']],
    ['workplace', 'paycheck', ['workplace.has401k']],
    ['match', 'paycheck', ['workplace.matchPercent', 'workplace.matchLimit']],
    ['new-cash', 'portfolio', ['investing.newCashThisMonth']],
    ['target-mix', 'portfolio', ['investing.targetMix']],
    ['taxable-investing', 'portfolio', ['investing.taxableMonthlyContribution']],
    ['cash-buffer', 'cash', ['cash.emergencyFundBalance', 'cash.emergencyFundApy']],
    ['strategy', 'cash', ['strategy.preset']],
  ],
};
/** The FieldKind each old question kind became; a Yes/No choice is a boolean field. */
function newKind(question: OldQuestion): string {
  if (question.kind === 'frequency') return 'select';
  if (question.kind === 'filing') return 'choice';
  if (question.kind === 'choice' && question.options?.every((option) => typeof option.value === 'boolean')) {
    return 'boolean';
  }
  return question.kind;
}

function asked(intent: IntakeIntent) {
  const get = fromDefaults();
  const form = intakeForm(intent);
  return getIntakeScreens(intent, get).map((screen) => ({
    id: screen.id,
    title: screen.title,
    description: screen.description,
    questions: visibleScreenFields(form, screen, get).map((spec) => ({
      path: spec.path,
      label: spec.label,
      kind: spec.kind,
      help: spec.help,
      options: resolveOptions(spec, get).length > 0 ? resolveOptions(spec, get) : undefined,
      min: spec.min,
      max: spec.max,
      step: spec.step,
    })),
  }));
}

function expected(intent: IntakeIntent) {
  return OLD_FLOWS[intent].map(([id, , keys]) => ({
    id,
    title: OLD_SCREENS[id].title,
    description: OLD_SCREENS[id].description,
    questions: keys.map((key) => {
      const question = OLD_QUESTIONS[key];
      return {
        path: question.path,
        label: question.label,
        kind: newKind(question),
        help: question.help,
        options: question.options,
        min: question.min,
        max: question.max,
        step: question.step,
      };
    }),
  }));
}

describe('behaviour-preserving: the provisional forms carry the old question sets', () => {
  it.each([...INTAKE_INTENTS])('asks the %s intent exactly as before, question by question', (intent) => {
    expect(asked(intent)).toEqual(expected(intent));
  });

  it('keeps the profile sections in order', () => {
    const sections = getIntakeScreens('profile', fromDefaults()).map((s) => profileFormSection(s.id));
    expect(sections).toEqual(OLD_FLOWS.profile.map(([, section]) => section));
  });

  it('keeps the old screen counts: 14 profile screens, 13 without a 401(k), 11 after the core', () => {
    expect(screenIds('profile')).toHaveLength(OLD_FLOWS.profile.length);
    expect(OLD_FLOWS.profile).toHaveLength(14);
    expect(screenIds('profile', { 'workplace.has401k': false })).toHaveLength(13);
    expect(remainingIds('profile', [...CORE_PATHS])).toHaveLength(11);
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
      expect(screenIds(intent)).toEqual(FORMS[intent].screens.map((s) => s.id));
    }
    expect(screenIds('profile')).toEqual(PROFILE_FORM.screens.map((s) => s.id));
    expect(screenIds('core')).toEqual(formForFlow('core').screens.map((s) => s.id));
  });

  it('asks the shared core in the same order for every calculator intent that has it', () => {
    for (const intent of ['paycheck', 'retirement', 'portfolio', 'profile'] as const) {
      expect(intakePaths(intent).slice(0, CORE_PATHS.length)).toEqual([...CORE_PATHS]);
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

  it('hides the employer-match screen when there is no 401(k)', () => {
    expect(screenIds('paycheck', { 'workplace.has401k': false })).toEqual(
      FORMS.paycheck.screens.map((s) => s.id).filter((id) => id !== 'match')
    );
  });

  it('offers the typical-value skip, and keeps the defaults on an assumption screen', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const screen of getIntakeScreens(intent, fromDefaults())) {
        expect(skipLabelFor(screen)).toBe(INTAKE_SKIP_LABEL);
      }
    }
    const assumptions: ScreenSpec = { id: 'a', title: 'Assumptions', tier: 'assumption', fields: [] };
    expect(skipLabelFor(assumptions)).toBe(KEEP_ASSUMPTIONS_LABEL);
    expect(KEEP_ASSUMPTIONS_LABEL).toBe('Keep the default assumptions');
    expect(skipLabelFor({ ...assumptions, skipLabel: 'I have no debts' })).toBe('I have no debts');
  });
});

describe('validateIntakeScreen', () => {
  const screen = (intent: IntakeIntent, id: string) =>
    getIntakeScreens(intent, fromDefaults()).find((s) => s.id === id)!;

  it('accepts the default profile on every screen', () => {
    for (const intent of INTAKE_INTENTS) {
      for (const s of getIntakeScreens(intent, fromDefaults())) {
        expect(validateIntakeScreen(intent, s, fromDefaults()), `${intent}:${s.id}`).toEqual({});
      }
    }
  });

  it('flags take-home pay above gross pay on the take-home path', () => {
    const get = fromDefaults({ 'income.grossPerPaycheck': 2000, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen('paycheck', screen('paycheck', 'pay'), get)).toEqual({
      'income.netPerPaycheck':
        'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
    });
    // Equal is allowed (no withholding at all is possible).
    const equal = fromDefaults({ 'income.grossPerPaycheck': 2600, 'income.netPerPaycheck': 2600 });
    expect(validateIntakeScreen('paycheck', screen('paycheck', 'pay'), equal)).toEqual({});
  });

  it('flags a fun-money minimum above the maximum', () => {
    const get = fromDefaults({ 'spending.funMoneyMin': 700, 'spending.funMoneyMax': 600 });
    expect(validateIntakeScreen('paycheck', screen('paycheck', 'fun-money'), get)).toEqual({
      'spending.funMoneyMax': 'The minimum is above the maximum. Adjust one of them.',
    });
  });

  it('requires retirement age strictly above current age, on the retirement-age screen only', () => {
    const get = fromDefaults({ 'person.age': 60, 'person.retirementAge': 60 });
    const message = { 'person.retirementAge': 'The retirement age needs to be above your current age.' };
    expect(validateIntakeScreen('retirement', screen('retirement', 'retire-age'), get)).toEqual(message);
    expect(validateIntakeScreen('leverage', screen('leverage', 'horizon'), get)).toEqual(message);
    expect(validateIntakeScreen('retirement', screen('retirement', 'about'), get)).toEqual({});
  });

  it('checks each field against its bounds', () => {
    const get = fromDefaults({ 'person.age': 12, 'workplace.matchPercent': 2.5 });
    expect(validateIntakeScreen('paycheck', screen('paycheck', 'about'), get)).toEqual({
      'person.age': 'Your age must be between 16 and 100.',
    });
    expect(validateIntakeScreen('paycheck', screen('paycheck', 'match'), get)).toEqual({
      'workplace.matchPercent': 'Employer match rate must be between 0% and 200%.',
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
    expect(screenIds('core')).toEqual(['about', 'pay', 'must-pay']);
    expect(getIntakeScreens('core', fromDefaults()).every((s) => s.tier === 'core')).toBe(true);
  });

  it("ignores provided paths in 'all' mode, the default", () => {
    for (const intent of INTAKE_INTENTS) {
      expect(screenIds(intent, undefined, { mode: 'all', provided: [...CORE_PATHS] })).toEqual(screenIds(intent));
    }
  });

  it("drops the core and the answered screens from an intent in 'remaining' mode", () => {
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
    const [horizon] = getIntakeScreens('leverage', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    expect(horizon.id).toBe('horizon');
    expect(horizon.fields).toEqual(['person.retirementAge']);
    // 'all' mode keeps the age on the horizon screen.
    expect(getIntakeScreens('leverage', fromDefaults())[0].fields).toEqual(['person.age', 'person.retirementAge']);

    // After the retirement intake, only the taxable contribution is new.
    expect(remainingIds('leverage', [...CORE_PATHS, ...intakePaths('retirement')])).toEqual(['taxable-investing']);
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
    expect(remainingIds('paycheck', provided, { 'workplace.has401k': true })).toEqual(['match']);
    expect(remainingIds('paycheck', provided, { 'workplace.has401k': false })).toEqual([]);
  });

  it('asks the profile intent everything but the core, in section order', () => {
    const screens = getIntakeScreens('profile', fromDefaults(), { mode: 'remaining', provided: [...CORE_PATHS] });
    expect(screens.map((s) => profileFormSection(s.id))).toEqual([
      'retirement', 'retirement', 'retirement',
      'paycheck', 'paycheck', 'paycheck',
      'portfolio', 'portfolio', 'portfolio',
      'cash', 'cash',
    ]);
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

  it('words the two filing statuses the intake does not offer', () => {
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
