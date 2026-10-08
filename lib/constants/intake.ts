/**
 * Intake wizard: intents, question sets, and the pure helpers that group
 * questions into screens and turn answers into a profile patch.
 *
 * Every question maps to one FinancialProfile leaf (lib/profile/types.ts).
 * The question set follows docs/redesign-guided-flow.md section 2.3: the same
 * core questions for every calculator intent (so one intake seeds the
 * others), asked in the user's own units (per paycheck, not per month), and
 * never anything that needs a document. Anything skipped keeps its
 * placeholder default and is not marked as provided, so the calculators can
 * surface it later as a detail worth looking up.
 *
 * Screen budget: every intent except 'profile' fits in 6 screens by grouping
 * related fields on one screen (for example gross pay, pay frequency, and
 * take-home pay all come from the same pay stub line items).
 *
 * Guided flow: everyone answers the shared core first (/start, flow 'core'),
 * then picks what to learn (/start/choose, LEARN_OPTIONS), and each intent
 * then asks only its remaining questions (/start/<intent>, 'remaining' mode:
 * non-core questions whose path is not yet in profile.provided).
 */

import type { LucideIcon } from 'lucide-react';
import { Layers, Scale, Sunset, UserRound, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations/core';
import { PRESET_EMERGENCY_MONTHS, getProfileValue, splitProfilePath } from '@/lib/profile/defaults';
import { profileCompleteness } from '@/lib/profile/mappers';
import type {
  FinancialProfile,
  PayFrequency,
  ProfileFilingStatus,
  ProfilePatch,
  StrategyPreset,
} from '@/lib/profile/types';

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

export type IntakeIntent = 'paycheck' | 'retirement' | 'portfolio' | 'leverage' | 'profile';

export const INTAKE_INTENTS: readonly IntakeIntent[] = [
  'paycheck',
  'retirement',
  'portfolio',
  'leverage',
  'profile',
];

export function isIntakeIntent(value: string): value is IntakeIntent {
  return (INTAKE_INTENTS as readonly string[]).includes(value);
}

export interface IntentOption {
  id: IntakeIntent;
  /** Verb-first label shown on the landing page. */
  title: string;
  /** One line on what the answer looks like. */
  description: string;
  icon: LucideIcon;
  /** Where the intake leads once it is finished. */
  resultHint: string;
}

export const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'paycheck',
    title: 'Figure out where each paycheck should go',
    description: 'A per-paycheck split across bills, savings, and investing that you can set up in your payroll portal.',
    icon: Wallet,
    resultHint: 'Opens the Paycheck Allocator with your answers filled in.',
  },
  {
    id: 'retirement',
    title: 'See if I am on track to retire',
    description: 'A range of simulated outcomes for your savings path, not a single forecast.',
    icon: Sunset,
    resultHint: 'Opens the Retirement Calculator and runs the simulation with your answers.',
  },
  {
    id: 'portfolio',
    title: 'Rebalance my accounts with new cash',
    description: 'Which funds to buy with new cash to move your accounts toward a target mix.',
    icon: Scale,
    resultHint: 'Opens the Portfolio Rebalancer with your target mix and new cash.',
  },
  {
    id: 'leverage',
    title: 'Compare leveraged vs plain index investing',
    description: 'Monthly contributions into a 2x fund next to a plain index fund, drawdowns included.',
    icon: Layers,
    resultHint: 'Opens the Leverage Comparison with your contribution and horizon.',
  },
  {
    id: 'profile',
    title: 'Build my full financial profile',
    description: 'Answer once and every calculator starts from your numbers. Saved only in this browser.',
    icon: UserRound,
    resultHint: 'Saves your answers in this browser and opens your overview.',
  },
];

export function getIntentOption(intent: IntakeIntent): IntentOption {
  return INTENT_OPTIONS.find((o) => o.id === intent) ?? INTENT_OPTIONS[0];
}

/**
 * The "What do you want to learn?" chooser shown after the shared core:
 * finishing the profile first, then each calculator (same entries as
 * INTENT_OPTIONS).
 */
export const LEARN_OPTIONS: IntentOption[] = [
  {
    ...getIntentOption('profile'),
    title: 'Finish your profile',
    description: 'Answer the rest once; every calculator and your overview use it.',
  },
  getIntentOption('paycheck'),
  getIntentOption('retirement'),
  getIntentOption('portfolio'),
  getIntentOption('leverage'),
];

/** The chooser entry for an intent (the profile entry reads "Finish your profile"). */
export function getLearnOption(intent: IntakeIntent): IntentOption {
  return LEARN_OPTIONS.find((o) => o.id === intent) ?? getIntentOption(intent);
}

// ---------------------------------------------------------------------------
// Questions and screens
// ---------------------------------------------------------------------------

export type IntakeQuestionKind =
  | 'money'
  | 'number'
  | 'percent'
  | 'state'
  | 'frequency'
  | 'filing'
  | 'choice';

export type IntakeOptionValue = string | number | boolean;

export interface IntakeOption {
  value: IntakeOptionValue;
  label: string;
  /** Optional one-line explanation shown under the label. */
  description?: string;
}

/** Profile-intent sections, used by the 'Skip the rest of this section' affordance. */
export type IntakeSection = 'core' | 'retirement' | 'paycheck' | 'portfolio' | 'cash';

export const INTAKE_SECTION_LABELS: Record<IntakeSection, string> = {
  core: 'The basics',
  retirement: 'Retirement',
  paycheck: 'Paycheck',
  portfolio: 'Portfolio',
  cash: 'Cash and strategy',
};

export type IntakeScreenId =
  | 'about'
  | 'pay'
  | 'must-pay'
  | 'fun-money'
  | 'workplace'
  | 'match'
  | 'retire-age'
  | 'invested'
  | 'monthly-investing'
  | 'new-cash'
  | 'target-mix'
  | 'taxable-investing'
  | 'horizon'
  | 'cash-buffer'
  | 'strategy';

export interface IntakeScreenMeta {
  /** The question the screen asks, in plain language. */
  title: string;
  description?: string;
}

export const INTAKE_SCREENS: Record<IntakeScreenId, IntakeScreenMeta> = {
  about: {
    title: 'A little about you',
    description: 'Age sets the time horizon. State and filing status set the tax estimate.',
  },
  pay: {
    title: 'What does a typical paycheck look like?',
    description: 'A close guess is fine.',
  },
  'must-pay': {
    title: 'What do you have to pay each month?',
  },
  'fun-money': {
    title: 'How much fun money do you want each month?',
    description: 'Spending on things you enjoy, beyond the must-pay costs. A range is fine.',
  },
  workplace: {
    title: 'Does your employer offer a 401(k) or similar plan?',
  },
  match: {
    title: 'How does the employer match work?',
    description: 'Often written as "50% of the first 6% of pay". A guess is fine; your benefits portal has the exact terms.',
  },
  'retire-age': {
    title: 'When would you like to retire?',
  },
  invested: {
    title: 'Roughly how much do you have invested?',
  },
  'monthly-investing': {
    title: 'How much do you invest each month?',
  },
  'new-cash': {
    title: 'How much new cash are you investing this month?',
  },
  'target-mix': {
    title: 'Which stock and bond mix are you aiming for?',
    description: 'You can set a custom mix on the calculator.',
  },
  'taxable-investing': {
    title: 'How much goes into a taxable brokerage account each month?',
    description: 'The leverage comparison applies to taxable contributions, outside retirement accounts.',
  },
  horizon: {
    title: 'What is your time horizon?',
    description: 'The comparison runs from now until you plan to stop contributing.',
  },
  'cash-buffer': {
    title: 'What does your emergency fund look like today?',
  },
  strategy: {
    title: 'Which starting point should the calculators use?',
    description:
      'This sets your starting emergency-fund target. Both presets run through the same math; your overview shows the other one next to it.',
  },
};

export interface IntakeQuestion {
  id: string;
  /** FinancialProfile dot path, e.g. 'person.age'. */
  path: string;
  label: string;
  help?: string;
  kind: IntakeQuestionKind;
  options?: IntakeOption[];
  min?: number;
  max?: number;
  step?: number;
  skipLabel?: string;
  /** Questions sharing a screen id (consecutively) render on one screen. */
  screen: IntakeScreenId;
  /** Section the question belongs to (drives section skipping in the profile intake). */
  section: IntakeSection;
  /** Shown only when another answer equals this value. */
  showIf?: { path: string; equals: IntakeOptionValue };
}

export const INTAKE_SKIP_LABEL = 'Skip, use a typical value';

type QuestionSpec = Omit<IntakeQuestion, 'skipLabel' | 'section'>;

function q(section: IntakeSection, spec: QuestionSpec): IntakeQuestion {
  return { ...spec, section, skipLabel: INTAKE_SKIP_LABEL };
}

const FILING_OPTIONS: IntakeOption[] = [
  { value: 'single', label: 'Single' },
  { value: 'marriedJoint', label: 'Married filing jointly' },
];

const FREQUENCY_OPTIONS: IntakeOption[] = [
  { value: 'weekly', label: 'Every week' },
  { value: 'bi-weekly', label: 'Every two weeks' },
  { value: 'semi-monthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Once a month' },
];

const YES_NO_OPTIONS: IntakeOption[] = [
  { value: true, label: 'Yes', description: 'Not sure? Pick Yes and check your benefits portal later.' },
  { value: false, label: 'No' },
];

const TARGET_MIX_OPTIONS: IntakeOption[] = [
  { value: '100-0', label: '100% stocks', description: 'The highest expected growth and the deepest drawdowns.' },
  { value: '80-20', label: '80% stocks, 20% bonds', description: 'Mostly stocks, with a bond cushion.' },
  { value: '60-40', label: '60% stocks, 40% bonds', description: 'Smaller swings and lower expected growth.' },
];

const STRATEGY_OPTIONS: IntakeOption[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'About 3 months of must-pay costs in cash, then unleveraged index funds.',
  },
  {
    value: 'cashflow-investor',
    label: 'Cash-flow investor',
    description: 'About 1 month in cash backed by a plan, automated contributions, and a leverage comparison for long horizons.',
  },
];

// Shared core: identical for every calculator intent so one intake seeds the others.
const CORE: IntakeQuestion[] = [
  q('core', { id: 'age', path: 'person.age', label: 'Your age', kind: 'number', min: 16, max: 100, step: 1, screen: 'about' }),
  q('core', { id: 'state', path: 'person.state', label: 'State you live in', kind: 'state', screen: 'about' }),
  q('core', { id: 'filing-status', path: 'person.filingStatus', label: 'Tax filing status', kind: 'filing', options: FILING_OPTIONS, screen: 'about' }),
  q('core', { id: 'gross-pay', path: 'income.grossPerPaycheck', label: 'Gross pay per paycheck', help: 'Before taxes and deductions.', kind: 'money', min: 0, screen: 'pay' }),
  q('core', { id: 'pay-frequency', path: 'income.frequency', label: 'How often you are paid', kind: 'frequency', options: FREQUENCY_OPTIONS, screen: 'pay' }),
  q('core', { id: 'net-pay', path: 'income.netPerPaycheck', label: 'Take-home pay per paycheck', help: 'What lands in your bank account after taxes and deductions.', kind: 'money', min: 0, screen: 'pay' }),
  q('core', { id: 'necessary-monthly', path: 'spending.necessaryMonthly', label: 'Must-pay costs per month', help: 'Rent or mortgage, utilities, insurance, groceries, minimum debt payments.', kind: 'money', min: 0, screen: 'must-pay' }),
];

const RETIREMENT: IntakeQuestion[] = [
  q('retirement', { id: 'retirement-age', path: 'person.retirementAge', label: 'Target retirement age', kind: 'number', min: 30, max: 85, step: 1, screen: 'retire-age' }),
  q('retirement', { id: 'invested-balance', path: 'investing.investedBalance', label: 'Invested balance', help: 'A rough total across 401(k), IRA, and brokerage accounts is fine. Leave out your emergency fund.', kind: 'money', min: 0, screen: 'invested' }),
  q('retirement', { id: 'monthly-contribution', path: 'investing.monthlyContribution', label: 'Monthly investing contribution', help: 'What you put toward investing each month across all accounts, including your own 401(k) contributions.', kind: 'money', min: 0, screen: 'monthly-investing' }),
];

const PAYCHECK: IntakeQuestion[] = [
  q('paycheck', { id: 'fun-money-min', path: 'spending.funMoneyMin', label: 'At least, per month', kind: 'money', min: 0, screen: 'fun-money' }),
  q('paycheck', { id: 'fun-money-max', path: 'spending.funMoneyMax', label: 'At most, per month', kind: 'money', min: 0, screen: 'fun-money' }),
  q('paycheck', { id: 'has-401k', path: 'workplace.has401k', label: 'Workplace retirement plan', kind: 'choice', options: YES_NO_OPTIONS, screen: 'workplace' }),
  q('paycheck', {
    id: 'match-percent',
    path: 'workplace.matchPercent',
    label: 'Employer match rate',
    help: 'What your employer adds per dollar you contribute. 50% means 50 cents per dollar.',
    kind: 'percent',
    min: 0,
    max: 2,
    screen: 'match',
    showIf: { path: 'workplace.has401k', equals: true },
  }),
  q('paycheck', {
    id: 'match-limit',
    path: 'workplace.matchLimit',
    label: 'Matched up to this share of your pay',
    help: 'In "50% of the first 6%", this is the 6%.',
    kind: 'percent',
    min: 0,
    max: 1,
    screen: 'match',
    showIf: { path: 'workplace.has401k', equals: true },
  }),
];

const PORTFOLIO: IntakeQuestion[] = [
  q('portfolio', { id: 'new-cash', path: 'investing.newCashThisMonth', label: 'New cash to invest this month', help: 'Money you are ready to put into your accounts now.', kind: 'money', min: 0, screen: 'new-cash' }),
  q('portfolio', { id: 'target-mix', path: 'investing.targetMix', label: 'Target mix', kind: 'choice', options: TARGET_MIX_OPTIONS, screen: 'target-mix' }),
];

const TAXABLE_CONTRIBUTION = (section: IntakeSection): IntakeQuestion =>
  q(section, {
    id: 'taxable-monthly',
    path: 'investing.taxableMonthlyContribution',
    label: 'Monthly taxable contribution',
    help: 'Money you invest each month outside 401(k) and IRA accounts.',
    kind: 'money',
    min: 0,
    screen: 'taxable-investing',
  });

const CASH: IntakeQuestion[] = [
  q('cash', { id: 'emergency-balance', path: 'cash.emergencyFundBalance', label: 'Cash set aside for emergencies', kind: 'money', min: 0, screen: 'cash-buffer' }),
  q('cash', { id: 'emergency-apy', path: 'cash.emergencyFundApy', label: 'Interest rate (APY) on that cash', help: 'The rate your savings account pays. A guess is fine.', kind: 'percent', min: 0, max: 0.2, screen: 'cash-buffer' }),
  q('cash', { id: 'strategy-preset', path: 'strategy.preset', label: 'Strategy preset', kind: 'choice', options: STRATEGY_OPTIONS, screen: 'strategy' }),
];

// Age is a core path (dropped in 'remaining' mode); the rest are tagged with
// the profile section that asks the same path.
const LEVERAGE: IntakeQuestion[] = [
  q('core', { id: 'age', path: 'person.age', label: 'Your age', kind: 'number', min: 16, max: 100, step: 1, screen: 'horizon' }),
  q('retirement', { id: 'retirement-age', path: 'person.retirementAge', label: 'Age you plan to stop contributing', kind: 'number', min: 30, max: 85, step: 1, screen: 'horizon' }),
  TAXABLE_CONTRIBUTION('portfolio'),
  q('retirement', { id: 'invested-balance', path: 'investing.investedBalance', label: 'Starting balance', help: 'What you already have invested. A rough number is fine.', kind: 'money', min: 0, screen: 'invested' }),
];

export const INTAKE_QUESTIONS: Record<IntakeIntent, IntakeQuestion[]> = {
  paycheck: [...CORE, ...PAYCHECK],
  retirement: [...CORE, ...RETIREMENT],
  portfolio: [...CORE, ...PORTFOLIO],
  leverage: LEVERAGE,
  profile: [...CORE, ...RETIREMENT, ...PAYCHECK, ...PORTFOLIO, TAXABLE_CONTRIBUTION('portfolio'), ...CASH],
};

/** Every profile path an intent can ask about, in order, deduped. */
export function intakePaths(intent: IntakeIntent): string[] {
  return Array.from(new Set(INTAKE_QUESTIONS[intent].map((question) => question.path)));
}

/** Profile dot paths of the shared core questions, in the order they are asked. */
export const CORE_PATHS: readonly string[] = CORE.map((question) => question.path);

const CORE_PATH_SET: ReadonlySet<string> = new Set(CORE_PATHS);

/** True when every core question has an answer saved in the profile. */
export function isCoreComplete(profile: FinancialProfile): boolean {
  const provided = new Set(profile.provided);
  return CORE_PATHS.every((path) => provided.has(path));
}

/** What the wizard asks: the shared core, or one intent's question set. */
export type IntakeFlow = IntakeIntent | 'core';

export function isIntakeFlow(value: string): value is IntakeFlow {
  return value === 'core' || isIntakeIntent(value);
}

/** The shared core intake. */
export const CORE_START_PATH = '/start';

/** The "What do you want to learn?" chooser shown after the core. */
export const LEARN_CHOOSER_PATH = '/start/choose';

/** The core intake, continuing to `intent`'s remaining questions afterwards. */
export function coreStartLink(intent: IntakeIntent): string {
  return `${CORE_START_PATH}?next=${intent}`;
}

/**
 * Where the core intake goes once finished: '/start/<next>' when `next` is a
 * known intent, otherwise the chooser.
 */
export function coreDestination(next?: string | null): string {
  return next && isIntakeIntent(next) ? `/start/${next}` : LEARN_CHOOSER_PATH;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export interface IntakeScreen extends IntakeScreenMeta {
  id: IntakeScreenId;
  section: IntakeSection;
  questions: IntakeQuestion[];
}

export type IntakeValueGetter = (path: string) => unknown;

function isVisible(question: IntakeQuestion, getValue: IntakeValueGetter): boolean {
  return !question.showIf || getValue(question.showIf.path) === question.showIf.equals;
}

export type IntakeMode = 'all' | 'remaining';

export interface IntakeScreenOptions {
  /**
   * 'all' (the default) asks every question in the flow. 'remaining' drops
   * the paths in `provided`, and for an intent also drops the core questions
   * (the shared core is asked once, on its own).
   */
  mode?: IntakeMode;
  /** Paths already answered (profile.provided); used by 'remaining' mode. */
  provided?: readonly string[];
}

function flowQuestions(flow: IntakeFlow, options: IntakeScreenOptions): IntakeQuestion[] {
  const questions = flow === 'core' ? CORE : INTAKE_QUESTIONS[flow];
  if (options.mode !== 'remaining') return questions;
  const provided = new Set(options.provided ?? []);
  return questions.filter(
    (question) => !provided.has(question.path) && (flow === 'core' || !CORE_PATH_SET.has(question.path))
  );
}

/**
 * Groups a flow's visible questions into screens. Consecutive questions
 * with the same screen id share a screen; a screen whose questions are all
 * hidden (showIf not met) is dropped. Conditional questions follow their
 * visibility rule in every mode, so in 'remaining' mode the employer-match
 * screen still appears only when the (saved or new) 401(k) answer is Yes.
 */
export function getIntakeScreens(
  flow: IntakeFlow,
  getValue: IntakeValueGetter,
  options: IntakeScreenOptions = {}
): IntakeScreen[] {
  const screens: IntakeScreen[] = [];
  for (const question of flowQuestions(flow, options)) {
    if (!isVisible(question, getValue)) continue;
    const last = screens[screens.length - 1];
    if (last && last.id === question.screen) {
      last.questions.push(question);
    } else {
      screens.push({
        id: question.screen,
        section: question.section,
        ...INTAKE_SCREENS[question.screen],
        questions: [question],
      });
    }
  }
  return screens;
}

/**
 * The screens `intent` still asks in 'remaining' mode given the saved
 * profile: what /start/<intent> shows on arrival. Empty means that page goes
 * straight to its destination (the calculator, or the overview for
 * 'profile').
 */
export function remainingIntakeScreens(intent: IntakeIntent, profile: FinancialProfile): IntakeScreen[] {
  return getIntakeScreens(intent, (path) => getProfileValue(profile, path), {
    mode: 'remaining',
    provided: profile.provided,
  });
}

/**
 * Whether "Finish your profile" has nothing left to do, so the guided flow
 * offers the overview in its place: every profile field is answered
 * (profileCompleteness lists nothing missing), or the profile intake has no
 * questions left. The second case matters because a few fields (target
 * retirement income, your 401(k) contribution rate, the emergency-fund target
 * months, the leverage ratio) are not asked by any intake, and the match
 * terms are not asked without a 401(k), so /start/profile would only
 * redirect to the overview.
 */
export function isProfileFinished(profile: FinancialProfile): boolean {
  return (
    profileCompleteness(profile).missing.length === 0 ||
    remainingIntakeScreens('profile', profile).length === 0
  );
}

interface IntakeRelation {
  lower: string;
  upper: string;
  /** True when lower must be strictly below upper. */
  strict: boolean;
  /** The relation is checked on screens that ask this path. */
  checkOn: string;
  message: string;
}

const INTAKE_RELATIONS: IntakeRelation[] = [
  {
    lower: 'income.netPerPaycheck',
    upper: 'income.grossPerPaycheck',
    strict: false,
    checkOn: 'income.netPerPaycheck',
    message: 'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
  },
  {
    lower: 'spending.funMoneyMin',
    upper: 'spending.funMoneyMax',
    strict: false,
    checkOn: 'spending.funMoneyMax',
    message: 'The minimum is above the maximum. Adjust one of them.',
  },
  {
    lower: 'person.age',
    upper: 'person.retirementAge',
    strict: true,
    checkOn: 'person.retirementAge',
    message: 'The retirement age needs to be above your current age.',
  },
];

/**
 * Checks the answers on one screen for combinations that cannot be right
 * (take-home above gross, fun-money minimum above maximum, retirement at or
 * before the current age). Returns the first message, or null when fine.
 * Age always comes before retirement age in every intent, so that relation
 * is checked on the retirement-age screen only.
 */
export function validateIntakeScreen(
  questions: readonly IntakeQuestion[],
  getValue: IntakeValueGetter
): string | null {
  const onScreen = new Set(questions.map((question) => question.path));
  for (const relation of INTAKE_RELATIONS) {
    if (!onScreen.has(relation.checkOn)) continue;
    const lower = getValue(relation.lower);
    const upper = getValue(relation.upper);
    if (typeof lower !== 'number' || typeof upper !== 'number') continue;
    if (relation.strict ? lower >= upper : lower > upper) return relation.message;
  }
  return null;
}

export interface IntakeSubmission {
  patch: ProfilePatch;
  providedPaths: string[];
}

function isStrategyPreset(value: unknown): value is StrategyPreset {
  return value === 'standard' || value === 'cashflow-investor';
}

/**
 * Builds the store update for a finished intake.
 *
 * - Answered (provided) paths are written; skipped questions keep the
 *   profile's existing value and are not marked as provided. The two derived
 *   values below are the only other writes.
 * - The emergency-fund target months follow the strategy preset in effect
 *   (the answer if the preset was asked, otherwise the profile's current
 *   preset, which seeds `answers`) via PRESET_EMERGENCY_MONTHS, unless the
 *   user has entered target months themselves (now or earlier). This runs
 *   for every intake, so a target the user never entered cannot drift from
 *   the preset shown as active. The derived value is not marked provided.
 * - If the retirement age ends up at or below the current age (for example,
 *   age answered but retirement age skipped), it is raised to age + 1 so
 *   every calculator gets a positive horizon.
 */
export function buildIntakeSubmission(
  answers: Readonly<Record<string, unknown>>,
  providedPaths: readonly string[],
  alreadyProvided: readonly string[] = []
): IntakeSubmission {
  const provided = Array.from(new Set(providedPaths));
  const sections: Record<string, Record<string, unknown>> = {};
  const write = (path: string, value: unknown) => {
    const parts = splitProfilePath(path);
    if (!parts) return;
    sections[parts.section] = { ...sections[parts.section], [parts.key]: value };
  };

  for (const path of provided) {
    if (path in answers) write(path, answers[path]);
  }

  const preset = answers['strategy.preset'];
  const monthsKnown =
    provided.includes('cash.targetMonths') || alreadyProvided.includes('cash.targetMonths');
  if (isStrategyPreset(preset) && !monthsKnown) {
    write('cash.targetMonths', PRESET_EMERGENCY_MONTHS[preset]);
  }

  const age = answers['person.age'];
  const retirementAge = answers['person.retirementAge'];
  if (typeof age === 'number' && typeof retirementAge === 'number' && retirementAge <= age) {
    write('person.retirementAge', age + 1);
  }

  return {
    patch: sections as ProfilePatch,
    providedPaths: provided.filter((path) => splitProfilePath(path) !== null),
  };
}

// ---------------------------------------------------------------------------
// Core summary
// ---------------------------------------------------------------------------

const FILING_SUMMARY: Record<ProfileFilingStatus, string> = {
  single: 'single',
  marriedJoint: 'married filing jointly',
};

const FREQUENCY_SUMMARY: Record<PayFrequency, string> = {
  weekly: 'every week',
  'bi-weekly': 'every 2 weeks',
  'semi-monthly': 'twice a month',
  monthly: 'once a month',
};

/**
 * One-line summary of the saved core answers, e.g.
 * "30, TX, single, $3,500 every 2 weeks, $3,000/mo must-pay". Parts the user
 * has not answered (still placeholders) are left out; an empty string means
 * none of the summarized answers are saved. Take-home pay is not summarized.
 */
export function coreSummary(profile: FinancialProfile): string {
  const provided = new Set(profile.provided);
  const has = (path: string) => provided.has(path);
  const { person, income, spending } = profile;
  const parts: string[] = [];

  if (has('person.age')) parts.push(String(person.age));
  if (has('person.state')) parts.push(person.state);
  if (has('person.filingStatus')) parts.push(FILING_SUMMARY[person.filingStatus]);

  const frequency = has('income.frequency') ? FREQUENCY_SUMMARY[income.frequency] : null;
  if (has('income.grossPerPaycheck')) {
    parts.push(`${formatCurrency(income.grossPerPaycheck)} ${frequency ?? 'per paycheck'}`);
  } else if (frequency) {
    parts.push(`paid ${frequency}`);
  }

  if (has('spending.necessaryMonthly')) {
    parts.push(`${formatCurrency(spending.necessaryMonthly)}/mo must-pay`);
  }
  return parts.join(', ');
}
