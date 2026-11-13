/**
 * Intake wizard: intents, the guided-flow routes, and the pure helpers that
 * run each flow's FormSpec (lib/calculators/forms.ts) as wizard screens and
 * turn the answers into profile writes.
 *
 * Each intent asks its calculator's profile questions, a few related
 * questions per screen (docs/rebuild-plan.md section 2.12), with the facts
 * every calculator shares asked once, in the core. Assumptions, optional
 * screens and calculator-only screens stay on the calculator page
 * (intentAsksScreen). Questions come in the user's
 * own units (per paycheck, not per month). A skipped screen keeps its
 * values on arrival and is not marked as provided, so the calculators can
 * surface it later as a detail worth looking up.
 *
 * Guided flow: everyone answers the shared core first (/start, flow 'core'),
 * then picks what to learn (/start/choose, LEARN_OPTIONS), and each intent
 * then asks its remaining screens (/start/<intent>, 'remaining' mode: the
 * intent's non-core screens with a fact not yet in profile.provided).
 */

import type { LucideIcon } from 'lucide-react';
import { Layers, Scale, Sunset, UserRound, Wallet } from 'lucide-react';
import { formForFlow, requiredScreens } from '@/lib/calculators/forms';
import { CLASS_TARGETS_PATH, classTargetsError } from '@/lib/calculators/portfolio/bindings';
import {
  CORE_SCREENS,
  ageSummary,
  filingStatusSummary,
  grossPaySummary,
  monthlyCostSummary,
  payFrequencySummary,
  stateSummary,
  takeHomeSummary,
} from '@/lib/fields/shared';
import { getAt, makeGet } from '@/lib/fields/paths';
import { screenPaths, screensFor, validateFields } from '@/lib/fields/runtime';
import type { FieldErrors, FieldSpec, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { isProfilePath } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

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
    resultHint: 'Opens the Portfolio Rebalancer with your accounts and target mix.',
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
// Flows and routes
// ---------------------------------------------------------------------------

/** What the wizard asks: the shared core, or one intent's form. */
export type IntakeFlow = IntakeIntent | 'core';

/** Profile dot paths of the shared core questions, in the order they are asked. */
export const CORE_PATHS: readonly string[] = CORE_SCREENS.flatMap((screen) => screen.fields);

const CORE_PATH_SET: ReadonlySet<string> = new Set(CORE_PATHS);

/** True when every core question has an answer saved in the profile. */
export function isCoreComplete(profile: FinancialProfile): boolean {
  const provided = new Set(profile.provided);
  return CORE_PATHS.every((path) => provided.has(path));
}

/**
 * Intents whose calculator reads none of the core fields, so their intake does
 * not send a visitor without the basics to the core first (O5: the rebalancer
 * asks its holdings and needs no income, state or spending).
 */
const CORE_FREE_INTENTS: ReadonlySet<IntakeIntent> = new Set<IntakeIntent>(['portfolio']);

/** Whether an intent's intake sends a visitor without the basics to the core first. */
export function intentNeedsCore(intent: IntakeIntent): boolean {
  return !CORE_FREE_INTENTS.has(intent);
}

/** The shared core intake. */
export const CORE_START_PATH = '/start';

/** The "What do you want to learn?" chooser shown after the core. */
export const LEARN_CHOOSER_PATH = '/start/choose';

/**
 * Where an entry link for `intent` starts: the core intake, continuing to
 * `intent`'s remaining questions afterwards, or `intent`'s own intake when it
 * needs no core field (O5: /start/portfolio skips the basics).
 */
export function coreStartLink(intent: IntakeIntent): string {
  return intentNeedsCore(intent) ? `${CORE_START_PATH}?next=${intent}` : `/start/${intent}`;
}

/**
 * Where the core intake goes once finished: '/start/<next>' when `next` is a
 * known intent, otherwise the chooser.
 */
export function coreDestination(next?: string | null): string {
  return next && isIntakeIntent(next) ? `/start/${next}` : LEARN_CHOOSER_PATH;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export type IntakeMode = 'all' | 'remaining';

export interface IntakeScreenOptions {
  /**
   * 'all' (the default) asks every intake screen of the flow's form.
   * 'remaining' asks, for an intent, its non-core screens without the core
   * facts (the shared core is asked once, on its own), and drops every
   * screen whose visible facts are all in `provided`. A partly answered
   * screen shows all of its facts (the answered ones with their values).
   */
  mode?: IntakeMode;
  /** Paths already answered (profile.provided); used by 'remaining' mode. */
  provided?: readonly string[];
}

// ---------------------------------------------------------------------------
// Skip or Next
// ---------------------------------------------------------------------------
//
// Every wizard screen offers two actions: Skip (the screen goes back to its
// values on arrival, unanswered) and Next. A field the visitor has not
// answered shows no value, with the typical value as its grey placeholder.

/**
 * Whether Next on `screen` needs the visitor's own entry in every visible
 * field (true), or takes the typical value for each field left blank and
 * marks it answered (false).
 *
 * The rule is: the three basics screens (tier 'core': about, pay, must-pay)
 * need the visitor's own entry; every other screen accepts the typical
 * values. This is the default the guided-flow design picked for a question
 * that is still open, so it lives here, in one place, to be changed alone.
 * Skip stays available on every screen either way.
 */
export function nextNeedsOwnAnswer(screen: ScreenSpec): boolean {
  return screen.tier === 'core';
}

/** The short error of a blank field on a screen whose Next needs the visitor's own entry. */
const OWN_ANSWER_MESSAGES: Readonly<Record<string, string>> = {
  'person.age': 'Enter your age',
  'person.state': 'Choose your state',
  'person.filingStatus': 'Choose your filing status',
  'income.grossPerPaycheck': 'Enter your gross pay',
  'income.frequency': 'Choose how often you are paid',
  'income.netPerPaycheck': 'Enter your take-home pay',
  'spending.necessaryMonthly': 'Enter your must-pay costs',
};

const CHOSEN_KINDS: ReadonlySet<FieldSpec['kind']> = new Set<FieldSpec['kind']>(['select', 'state', 'choice', 'boolean']);

/** The message for `spec` left blank where Next needs the visitor's own entry. */
export function ownAnswerMessage(spec: FieldSpec): string {
  return OWN_ANSWER_MESSAGES[spec.path] ?? (CHOSEN_KINDS.has(spec.kind) ? 'Choose an answer' : 'Enter a value');
}

/** The muted line under a screen heading while the screen has blank fields, by its Next rule. */
export const BLANK_FIELDS_NOTE = {
  /** Next takes the typical values. */
  typical: 'Grey values are typical. Next uses them for anything left blank.',
  /** The same rule in single-screen mode (/start/review/<id>), whose only button is Save. */
  typicalOnSave: 'Grey values are typical. Save uses them for anything left blank.',
  /** Next needs the visitor's own entry (nextNeedsOwnAnswer). */
  examples: 'Grey values are examples.',
} as const;

/** The line on an unanswered screen that shows example rows (accounts, holdings, class targets). */
export const EXAMPLE_ROWS_NOTE = 'This is an example. Change it to match yours, or skip.';

/** EXAMPLE_ROWS_NOTE in single-screen mode, which has no Skip. */
export const EXAMPLE_ROWS_NOTE_ON_SAVE = 'This is an example. Change it to match yours.';

const REMAINING_FORMS = new WeakMap<FormSpec, FormSpec>();
const INTENT_FORMS = new WeakMap<FormSpec, FormSpec>();

/**
 * Whether /start/<intent> asks a screen of its calculator's form. It asks
 * only the calculator's profile questions: never an optional screen (the
 * profile form asks those, last) and never an assumption screen (tier
 * 'assumption': a collapsed card on the calculator page only). Calculator-only
 * screens (surface 'calculator') are left out by getIntakeScreens, which asks
 * the intake surface only. The one place that says which calculator screens
 * an intent intake asks.
 */
export function intentAsksScreen(screen: ScreenSpec): boolean {
  return !screen.optional && screen.tier !== 'assumption';
}

/** A calculator intent's form with only the screens intentAsksScreen keeps. */
function intentScreensOnly(form: FormSpec): FormSpec {
  const cached = INTENT_FORMS.get(form);
  if (cached) return cached;
  const intent = { ...form, screens: form.screens.filter(intentAsksScreen) };
  INTENT_FORMS.set(form, intent);
  return intent;
}

/** An intent's form for 'remaining' mode: its non-core screens, with the core facts left out. */
function withoutCore(form: FormSpec): FormSpec {
  const cached = REMAINING_FORMS.get(form);
  if (cached) return cached;
  const screens = form.screens
    .filter((screen) => screen.tier !== 'core')
    .map((screen) => ({ ...screen, fields: screen.fields.filter((path) => !CORE_PATH_SET.has(path)) }))
    .filter((screen) => screen.fields.length > 0);
  const remaining = { ...form, screens };
  REMAINING_FORMS.set(form, remaining);
  return remaining;
}

/**
 * The form whose screens a flow asks in `mode` (shares its field specs with
 * formForFlow). A calculator intent leaves out its optional and assumption
 * screens (intentAsksScreen); the profile flow asks the optional ones, last.
 */
export function intakeForm(flow: IntakeFlow, mode: IntakeMode = 'all'): FormSpec {
  if (flow === 'core') return formForFlow(flow);
  const form = flow === 'profile' ? formForFlow(flow) : intentScreensOnly(formForFlow(flow));
  return mode === 'all' ? form : withoutCore(form);
}

/**
 * The flow's intake screens, in form order. Visibility rules follow the
 * values `get` reads in every mode, so in 'remaining' mode the employer-match
 * screen still appears only when the (saved or new) 401(k) answer is Yes.
 */
export function getIntakeScreens(flow: IntakeFlow, get: Get, options: IntakeScreenOptions = {}): ScreenSpec[] {
  const mode = options.mode ?? 'all';
  return screensFor(intakeForm(flow, mode), get, { mode, provided: options.provided, surface: 'intake' });
}

/**
 * The required screens `intent` still asks in 'remaining' mode given the
 * saved profile: the questions the chooser counts as left. For a calculator
 * intent this is what /start/<intent> shows on arrival (empty means it goes
 * straight to the calculator). For 'profile' the optional screens are left
 * out, although /start/profile still asks the unanswered ones at the end.
 */
export function remainingIntakeScreens(intent: IntakeIntent, profile: FinancialProfile): ScreenSpec[] {
  return requiredScreens(getIntakeScreens(intent, makeGet(profile), { mode: 'remaining', provided: profile.provided }));
}

/**
 * Whether "Finish your profile" has nothing left to do, so the guided flow
 * offers the overview in its place: the profile intake has no required
 * screen left (optional screens never hold it back).
 * Fields on a calculator-only screen are never asked by an intake, and
 * fields behind an unmet condition (the match terms without a 401(k)) are
 * not asked, so /start/profile can have nothing left to ask while some
 * fields are unanswered; it would then only redirect to the overview.
 */
export function isProfileFinished(profile: FinancialProfile): boolean {
  return remainingIntakeScreens('profile', profile).length === 0;
}

// ---------------------------------------------------------------------------
// Validation and submission
// ---------------------------------------------------------------------------

/**
 * Engine rules a custom editor's value must meet before the intake moves on,
 * by field path: the calculator page reports them from the engine's own
 * validation, which the intake does not run.
 */
const ENGINE_FIELD_CHECKS: Readonly<Record<string, (get: Get) => string | undefined>> = {
  [CLASS_TARGETS_PATH]: classTargetsError,
};

/**
 * Checks one screen: each visible field's bounds and options, the flow's
 * cross-field rules checked on that screen (take-home above gross,
 * fun-money minimum above maximum, retirement at or before the current
 * age), and the engine rules of ENGINE_FIELD_CHECKS for the fields it shows
 * (custom portfolio targets that do not total 100%). Keyed by path; empty
 * when the screen is fine. Relation messages are keyed by the rule's
 * checkOn path (relationErrors tells them apart).
 */
export function validateIntakeScreen(flow: IntakeFlow, screen: ScreenSpec, get: Get): FieldErrors {
  const form = formForFlow(flow);
  const errors = validateFields(form, get, { screen });
  for (const path of screenPaths(form, screen, get)) {
    const message = errors[path] === undefined ? ENGINE_FIELD_CHECKS[path]?.(get) : undefined;
    if (message) errors[path] = message;
  }
  return errors;
}

export interface IntakeSubmission {
  writes: Write[];
  /** The answered paths to mark provided (the derived writes are not among them). */
  providedPaths: string[];
}

/**
 * Builds the store update for a finished intake from `values` (the
 * wizard's working copy of the profile).
 *
 * - Answered (provided) paths are written whole, a list by its list path;
 *   skipped screens keep the profile's existing values and are not marked
 *   as provided. Unknown paths are dropped.
 * - Then the form's onSubmit writes (a retirement age raised above the
 *   current age), read from `values`.
 */
export function buildIntakeSubmission(
  flow: IntakeFlow,
  values: unknown,
  providedPaths: readonly string[],
  alreadyProvided: readonly string[] = []
): IntakeSubmission {
  const provided = Array.from(new Set(providedPaths)).filter(isProfilePath);
  const writes: Write[] = provided.map((path) => ({ path, value: getAt(values, path) }));
  const derived = formForFlow(flow).onSubmit?.(makeGet(values), new Set([...provided, ...alreadyProvided])) ?? [];
  return { writes: [...writes, ...derived], providedPaths: provided };
}

// ---------------------------------------------------------------------------
// Core summary
// ---------------------------------------------------------------------------

/**
 * One-line summary of the saved core answers, e.g. "25, CA, single, $4,000
 * gross every 2 weeks, $2,550 take-home, $3,000 a month in must-pay costs".
 * The pieces are the ones the collapsed core cards use (lib/fields/shared.ts),
 * so both say the same thing. Parts the user has not answered (still
 * placeholders) are left out; an empty string means none of the core answers
 * are saved.
 */
export function coreSummary(profile: FinancialProfile): string {
  const provided = new Set(profile.provided);
  const answered = (path: string, value: unknown): unknown => (provided.has(path) ? value : undefined);
  const { person, income, spending } = profile;
  const gross = answered('income.grossPerPaycheck', income.grossPerPaycheck);
  const frequency = answered('income.frequency', income.frequency);
  const mustPay = monthlyCostSummary(answered('spending.necessaryMonthly', spending.necessaryMonthly));

  const parts = [
    ageSummary(answered('person.age', person.age)),
    stateSummary(answered('person.state', person.state)),
    filingStatusSummary(answered('person.filingStatus', person.filingStatus)),
    grossPaySummary(gross, frequency) ?? payFrequencySummary(frequency),
    takeHomeSummary(answered('income.netPerPaycheck', income.netPerPaycheck)),
    mustPay && `${mustPay} in must-pay costs`,
  ];
  return parts.filter((part): part is string => Boolean(part)).join(', ');
}
