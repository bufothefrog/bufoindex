/**
 * Intake wizard: intents, flows, and the pure helpers that pick a flow's
 * screens, validate one screen, and turn answers into profile writes.
 *
 * The wizard runs FormSpecs (docs/rebuild-plan.md section 2.12): the shared
 * core is CORE_FORM, each calculator intent runs that calculator's form, and
 * 'profile' runs PROFILE_FORM (lib/calculators/forms.ts). Every field is
 * keyed by its FinancialProfile path. Questions are asked in the user's own
 * units (per paycheck, not per month) and a few related fields share a topic
 * screen. Anything skipped keeps its placeholder default and is not marked as
 * provided, so the calculators can surface it later as a detail worth
 * looking up.
 *
 * Guided flow: everyone answers the shared core first (/start, flow 'core'),
 * then picks what to learn (/start/choose, LEARN_OPTIONS), and each intent
 * then asks only its remaining screens (/start/<intent>, 'remaining' mode:
 * non-core screens with a field not yet in profile.provided). The portfolio
 * rebalancer reads none of the basics, so /start/portfolio skips the core
 * gate (O5).
 */

import type { LucideIcon } from 'lucide-react';
import { Layers, Scale, Sunset, UserRound, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { FILING_STATUS_META } from '@/lib/constants/labels';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import {
  FORM_SECTION_LABELS,
  formForFlow,
  profileCompleteness,
  profileSectionOf,
} from '@/lib/calculators/forms';
import { getAt, makeGet } from '@/lib/fields/paths';
import { fieldMap, screenPaths, screensFor, validateFields } from '@/lib/fields/runtime';
import { CORE_SCREENS, INTAKE_SKIP_LABEL, KEEP_ASSUMPTIONS_LABEL } from '@/lib/fields/shared';
import type { FieldErrors, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { providedPathFor } from '@/lib/profile/defaults';
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
// Flows
// ---------------------------------------------------------------------------

export { INTAKE_SKIP_LABEL, KEEP_ASSUMPTIONS_LABEL };

/** Profile dot paths of the shared core fields, in the order they are asked. */
export const CORE_PATHS: readonly string[] = CORE_SCREENS.flatMap((screen) => screen.fields);

const CORE_PATH_SET: ReadonlySet<string> = new Set(CORE_PATHS);

/** True when every core field has an answer saved in the profile. */
export function isCoreComplete(profile: FinancialProfile): boolean {
  const provided = new Set(profile.provided);
  return CORE_PATHS.every((path) => provided.has(path));
}

/** What the wizard asks: the shared core, or one intent's form. */
export type IntakeFlow = IntakeIntent | 'core';

export function isIntakeFlow(value: string): value is IntakeFlow {
  return value === 'core' || isIntakeIntent(value);
}

/**
 * Whether an intent sends a visitor without the basics to the core intake
 * first. The portfolio rebalancer reads none of the basics (O5).
 */
export function intentRequiresCore(intent: IntakeIntent): boolean {
  return intent !== 'portfolio';
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
// Screens
// ---------------------------------------------------------------------------

/** @deprecated Use Get from lib/fields/types. */
export type IntakeValueGetter = Get;

export type IntakeMode = 'all' | 'remaining';

export interface IntakeScreenOptions {
  /**
   * 'all' (the default) asks every intake screen of the flow's form.
   * 'remaining' drops screens whose visible fields are all in `provided`, and
   * for an intent also drops the core: core screens go, and core fields
   * leave the screens they share (the shared core is asked once, on its own).
   */
  mode?: IntakeMode;
  /** Paths already answered (profile.provided); used by 'remaining' mode. */
  provided?: readonly string[];
}

const WITHOUT_CORE = new WeakMap<FormSpec, FormSpec>();

/** The form with core screens removed and core fields taken off the other screens. */
function withoutCore(form: FormSpec): FormSpec {
  const cached = WITHOUT_CORE.get(form);
  if (cached) return cached;
  fieldMap(form);
  const screens: ScreenSpec[] = [];
  for (const screen of form.screens) {
    if (screen.tier === 'core') continue;
    const fields = screen.fields.filter((path) => !CORE_PATH_SET.has(path));
    if (fields.length === 0) continue;
    screens.push(fields.length === screen.fields.length ? screen : { ...screen, fields });
  }
  const derived: FormSpec = { ...form, screens };
  WITHOUT_CORE.set(form, derived);
  return derived;
}

/** Assumption screens go last (O3); the order is otherwise the form's. */
function assumptionsLast(screens: ScreenSpec[]): ScreenSpec[] {
  return [
    ...screens.filter((screen) => screen.tier !== 'assumption'),
    ...screens.filter((screen) => screen.tier === 'assumption'),
  ];
}

/**
 * The screens a flow asks, in order. Fields follow their visibility rule in
 * every mode, so a screen whose fields are all hidden is dropped (the
 * employer-match screen appears only while the 401(k) answer is Yes). In
 * 'remaining' mode a partly answered screen keeps every field, prefilled.
 */
export function getIntakeScreens(flow: IntakeFlow, get: Get, options: IntakeScreenOptions = {}): ScreenSpec[] {
  const base = formForFlow(flow);
  if (options.mode !== 'remaining') return assumptionsLast(screensFor(base, get, { surface: 'intake' }));
  const form = flow === 'core' ? base : withoutCore(base);
  return assumptionsLast(
    screensFor(form, get, { mode: 'remaining', provided: options.provided ?? [], surface: 'intake' })
  );
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
 * Every profile path an intent's intake screens list (including fields that
 * show only conditionally, such as the match terms), in order, deduped.
 */
export function intakePaths(intent: IntakeIntent): string[] {
  const form = formForFlow(intent);
  const paths: string[] = [];
  for (const screen of form.screens) {
    if ((screen.surface ?? 'both') === 'calculator') continue;
    for (const path of screen.fields) if (!paths.includes(path)) paths.push(path);
  }
  return paths;
}

/**
 * Whether "Finish your profile" has nothing left to do, so the guided flow
 * offers the overview in its place: every profile topic is answered, or the
 * profile intake has no screens left (skipped basics stay unanswered but are
 * edited through "Edit the basics", not the profile intake).
 */
export function isProfileFinished(profile: FinancialProfile): boolean {
  return (
    profileCompleteness(profile).missing.length === 0 || remainingIntakeScreens('profile', profile).length === 0
  );
}

/** The section label shown before the step count ("Paycheck · Step 2 of 5"); profile flow only. */
export function intakeSectionLabel(flow: IntakeFlow, screen: ScreenSpec): string | undefined {
  return flow === 'profile' ? FORM_SECTION_LABELS[profileSectionOf(screen.id)] : undefined;
}

/** The section key of a profile-flow screen, for "Skip the rest of this section". */
export function intakeSection(flow: IntakeFlow, screen: ScreenSpec): string {
  return flow === 'profile' ? profileSectionOf(screen.id) : flow;
}

/** The per-screen skip text: the screen's own, "Keep the default assumptions" (O3), or the typical-value skip. */
export function intakeSkipLabel(screen: ScreenSpec): string {
  if (screen.skipLabel) return screen.skipLabel;
  return screen.tier === 'assumption' ? KEEP_ASSUMPTIONS_LABEL : INTAKE_SKIP_LABEL;
}

/** The paths a finished screen marks as answered (visible fields plus what their renderers cover). */
export function intakeScreenPaths(flow: IntakeFlow, screen: ScreenSpec, get: Get): string[] {
  return screenPaths(formForFlow(flow), screen, get);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates one screen: field bounds (inline, keyed by path) and the
 * cross-field relations checked on it (take-home above gross, fun-money
 * minimum above maximum, retirement at or before the current age). An empty
 * object means the screen can advance.
 */
export function validateIntakeScreen(flow: IntakeFlow, screen: ScreenSpec, get: Get): FieldErrors {
  return validateFields(formForFlow(flow), get, { screen });
}

export interface SplitIntakeErrors {
  /** Field errors shown under their input. */
  fields: FieldErrors;
  /** Relation messages shown as one screen-level alert. */
  relations: string[];
}

/** Separates relation messages (screen-level alert) from field errors (inline). */
export function splitIntakeErrors(flow: IntakeFlow, errors: FieldErrors): SplitIntakeErrors {
  const rules = formForFlow(flow).relations ?? [];
  const fields: FieldErrors = {};
  const relations: string[] = [];
  for (const [path, message] of Object.entries(errors)) {
    if (rules.some((rule) => rule.checkOn === path && rule.message === message)) relations.push(message);
    else fields[path] = message;
  }
  return { fields, relations };
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export interface IntakeSubmission {
  writes: Write[];
  providedPaths: string[];
}

/**
 * Builds the store update for a finished intake (pass both to
 * profileStore.setValues(writes, { provide: providedPaths })).
 *
 * - Answered (provided) paths are written with their value in `values` (a
 *   list path writes the whole list); skipped screens keep the profile's
 *   existing value and are not marked as provided.
 * - Then the flow form's onSubmit adds its derived writes (lib/fields/shared
 *   intakeOnSubmit: the emergency-fund target months follow the strategy
 *   preset unless entered now or earlier; a retirement age at or below the
 *   age is raised to age + 1). Derived values are not marked provided.
 */
export function buildIntakeSubmission(
  flow: IntakeFlow,
  values: unknown,
  providedPaths: readonly string[],
  alreadyProvided: readonly string[] = []
): IntakeSubmission {
  const provided = Array.from(new Set(providedPaths)).filter((path) => providedPathFor(path) !== null);
  const writes: Write[] = [];
  for (const path of provided) {
    const value = getAt(values, path);
    if (value !== undefined) writes.push({ path, value });
  }
  const known = new Set([...provided, ...alreadyProvided]);
  const derived = formForFlow(flow).onSubmit?.(makeGet(values), known) ?? [];
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

  const frequency = has('income.frequency') ? PAY_FREQUENCY_META[income.frequency].phrase : null;
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
