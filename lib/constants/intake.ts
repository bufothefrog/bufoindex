/**
 * Intake wizard: intents, the guided-flow routes, and the pure helpers that
 * run each flow's FormSpec (lib/calculators/forms.ts) as wizard screens and
 * turn the answers into profile writes.
 *
 * Each intent asks everything its calculator uses, a few related questions
 * per screen (docs/rebuild-plan.md section 2.12), with the facts every
 * calculator shares asked once, in the core. Questions come in the user's
 * own units (per paycheck, not per month). Anything skipped keeps its
 * typical value and is not marked as provided, so the calculators can
 * surface it later as a detail worth looking up.
 *
 * Guided flow: everyone answers the shared core first (/start, flow 'core'),
 * then picks what to learn (/start/choose, LEARN_OPTIONS), and each intent
 * then asks its remaining screens (/start/<intent>, 'remaining' mode: the
 * intent's non-core screens with a fact not yet in profile.provided).
 */

import type { LucideIcon } from 'lucide-react';
import { Layers, Scale, Sunset, UserRound, Wallet } from 'lucide-react';
import { formForFlow } from '@/lib/calculators/forms';
import { CLASS_TARGETS_PATH, classTargetsError } from '@/lib/calculators/portfolio/bindings';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { FILING_STATUS_META } from '@/lib/constants/labels';
import { CORE_SCREENS } from '@/lib/fields/shared';
import { getAt, makeGet } from '@/lib/fields/paths';
import { screenPaths, screensFor, validateFields } from '@/lib/fields/runtime';
import type { FieldErrors, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { formatCurrency } from '@/lib/format';
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
   * screen shows all of its facts, prefilled.
   */
  mode?: IntakeMode;
  /** Paths already answered (profile.provided); used by 'remaining' mode. */
  provided?: readonly string[];
}

/** The per-screen skip: the screen keeps its typical values, unanswered. */
export const INTAKE_SKIP_LABEL = 'Skip, use a typical value';

/** The skip on an assumption screen. */
export const KEEP_ASSUMPTIONS_LABEL = 'Keep the default assumptions';

/** The skip button's text for a screen: its own, or the one for its tier. */
export function skipLabelFor(screen: ScreenSpec): string {
  return screen.skipLabel ?? (screen.tier === 'assumption' ? KEEP_ASSUMPTIONS_LABEL : INTAKE_SKIP_LABEL);
}

const REMAINING_FORMS = new WeakMap<FormSpec, FormSpec>();

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

/** The form whose screens a flow asks in `mode` (shares its field specs with formForFlow). */
export function intakeForm(flow: IntakeFlow, mode: IntakeMode = 'all'): FormSpec {
  const form = formForFlow(flow);
  return flow === 'core' || mode === 'all' ? form : withoutCore(form);
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
 * The screens `intent` still asks in 'remaining' mode given the saved
 * profile: what /start/<intent> shows on arrival. Empty means that page goes
 * straight to its destination (the calculator, or the overview for
 * 'profile').
 */
export function remainingIntakeScreens(intent: IntakeIntent, profile: FinancialProfile): ScreenSpec[] {
  return getIntakeScreens(intent, makeGet(profile), { mode: 'remaining', provided: profile.provided });
}

/**
 * Whether "Finish your profile" has nothing left to do, so the guided flow
 * offers the overview in its place: the profile intake has no screen left.
 * A few profile fields (target retirement income, your 401(k) contribution
 * rate, the emergency-fund target months, the leverage ratio) are not asked
 * by any intake yet, and the match terms are not asked without a 401(k), so
 * /start/profile would only redirect to the overview.
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
 * - Then the form's onSubmit writes (the strategy preset's emergency-fund
 *   months unless target months were entered now or earlier, and a
 *   retirement age raised above the current age), read from `values`.
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
  if (has('person.filingStatus')) parts.push(FILING_STATUS_META[person.filingStatus].phrase);

  const frequency = has('income.frequency') ? PAY_FREQUENCY_META[income.frequency].cadence : null;
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
