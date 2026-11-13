/**
 * The form registries (docs/rebuild-plan.md section 2.4): every calculator's
 * FormSpec, the shared core, and the profile form derived from them, plus
 * profile completeness counted by topic screen (O14). Pure.
 *
 * PROFILE_FORM is the core screens, then the union of every calculator
 * form's non-core, non-assumption screens in PROFILE_FORM_ORDER, then
 * PROFILE_EXTRA_SCREENS, then every optional screen (ScreenSpec.optional) of
 * those forms, in the same order, in the section "Optional". A
 * calculator-only screen (surface 'calculator', see Surface in
 * lib/fields/types.ts) is never taken: this is the one place that keeps it
 * out of the profile form, and so out of the profile wizard, the review page
 * and completeness. Fields are deduplicated by
 * path across all of them: the first screen that asks a path keeps it (with
 * that form's spec), later screens drop it, and a screen left with no field
 * is dropped. Relations are the union of every form's (one per
 * lower, upper and checkOn), and onSubmit runs each distinct form onSubmit,
 * the first write to a path winning.
 *
 * Completeness leaves the optional screens out (requiredScreens).
 */

import {
  ACCOUNTS_SCREEN,
  CORE_FIELDS,
  CORE_SCREENS,
  NET_PAY_AT_MOST_GROSS,
  PROFILE_EXTRA_FIELDS,
  PROFILE_EXTRA_SCREENS,
  intakeDerivedWrites,
} from '@/lib/fields/shared';
import { makeGet } from '@/lib/fields/paths';
import { fieldMap, screensFor, type ScreensForOptions } from '@/lib/fields/runtime';
import type { CrossFieldRule, FieldSpec, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import { LEVERAGE_FORM } from './leverage/form';
import { PAYCHECK_FORM } from './paycheck/form';
import { PORTFOLIO_FORM } from './portfolio/form';
import { RETIREMENT_FORM } from './retirement/form';
import type { CalculatorId } from './types';

/** What a flow runs: one calculator's form, the shared core, or the whole profile. */
export type FormFlow = CalculatorId | 'core' | 'profile';

export const FORMS: Readonly<Record<CalculatorId, FormSpec>> = {
  paycheck: PAYCHECK_FORM,
  retirement: RETIREMENT_FORM,
  portfolio: PORTFOLIO_FORM,
  leverage: LEVERAGE_FORM,
};

export const CORE_FORM: FormSpec = {
  id: 'core',
  fields: CORE_FIELDS,
  screens: CORE_SCREENS,
  relations: [NET_PAY_AT_MOST_GROSS],
  onSubmit: intakeDerivedWrites,
};

/**
 * The order the profile asks each calculator's screens in. The paycheck
 * form comes first, so the 401(k), HSA, IRA and taxable answers come before
 * the account list that they suggest rows for.
 */
export const PROFILE_FORM_ORDER: readonly CalculatorId[] = ['paycheck', 'retirement', 'portfolio', 'leverage'];

/**
 * The section each profile screen belongs to, for the profile intake's
 * progress label. The leverage form's
 * profile screen (the taxable contribution) sits with the portfolio
 * questions, so the two calculators share one section. The shared account
 * list (ACCOUNTS_SCREEN) is its own section, whichever form it is taken from.
 */
export type ProfileFormSection = 'core' | 'retirement' | 'paycheck' | 'portfolio' | 'accounts' | 'cash' | 'optional';

export const PROFILE_FORM_SECTION_LABELS: Readonly<Record<ProfileFormSection, string>> = {
  core: 'The basics',
  retirement: 'Retirement',
  paycheck: 'Paycheck',
  portfolio: 'Portfolio',
  accounts: 'Accounts',
  cash: 'Cash',
  optional: 'Optional',
};

const FORM_SECTION: Readonly<Record<CalculatorId, ProfileFormSection>> = {
  retirement: 'retirement',
  paycheck: 'paycheck',
  portfolio: 'portfolio',
  leverage: 'portfolio',
};

function relationKey(rule: CrossFieldRule): string {
  return `${rule.lower}|${rule.upper}|${rule.checkOn}`;
}

/** One calculator form's part of the profile form. */
export interface ProfileFormPart {
  form: FormSpec;
  section: ProfileFormSection;
}

export interface ProfileFormBuild {
  form: FormSpec;
  /** Screen id -> section. */
  sections: ReadonlyMap<string, ProfileFormSection>;
}

/**
 * Composes the profile form from the core form, the calculator forms in
 * order and the profile-only form, with the rules in this file's header.
 * Exported for tests; PROFILE_FORM is the one the app uses.
 */
export function composeProfileForm(
  core: FormSpec,
  parts: readonly ProfileFormPart[],
  extra: FormSpec
): ProfileFormBuild {
  const fields = new Map<string, FieldSpec>();
  const screens: ScreenSpec[] = [];
  const sections = new Map<string, ProfileFormSection>();

  const take = (source: FormSpec, screen: ScreenSpec, section: ProfileFormSection) => {
    const specs = fieldMap(source);
    const kept = screen.fields.filter((path) => !fields.has(path));
    if (kept.length === 0) return;
    for (const path of kept) fields.set(path, specs.get(path) as FieldSpec);
    // Screen ids are unique per form; prefix one that another form already used.
    const id = sections.has(screen.id) ? `${source.id}-${screen.id}` : screen.id;
    screens.push({ ...screen, id, fields: kept });
    sections.set(id, screen.id === ACCOUNTS_SCREEN.id ? 'accounts' : section);
  };

  // Optional screens wait until every other screen is taken, then come last.
  const optional: { form: FormSpec; screen: ScreenSpec }[] = [];

  for (const screen of core.screens) take(core, screen, 'core');
  for (const { form, section } of parts) {
    for (const screen of form.screens) {
      const surface = screen.surface ?? 'both';
      // Calculator-only screens (surface 'calculator') stay on their page.
      if (screen.tier === 'core' || screen.tier === 'assumption' || surface === 'calculator') continue;
      if (screen.optional) optional.push({ form, screen });
      else take(form, screen, section);
    }
  }
  for (const screen of extra.screens) {
    if (screen.optional) optional.push({ form: extra, screen });
    else take(extra, screen, 'cash');
  }
  for (const { form, screen } of optional) take(form, screen, 'optional');

  const sources = [core, ...parts.map((part) => part.form), extra];
  const relations = new Map<string, CrossFieldRule>();
  for (const rule of sources.flatMap((form) => form.relations ?? [])) {
    if (!relations.has(relationKey(rule))) relations.set(relationKey(rule), rule);
  }
  const submits = Array.from(new Set(sources.flatMap((form) => (form.onSubmit ? [form.onSubmit] : []))));
  const onSubmit = (get: Get, provided: ReadonlySet<string>): Write[] => {
    const writes = new Map<string, Write>();
    for (const write of submits.flatMap((submit) => submit(get, provided))) {
      if (!writes.has(write.path)) writes.set(write.path, write);
    }
    return Array.from(writes.values());
  };

  return {
    form: {
      id: 'profile',
      fields: Array.from(fields.values()),
      screens,
      relations: Array.from(relations.values()),
      onSubmit,
    },
    sections,
  };
}

const PROFILE = composeProfileForm(
  CORE_FORM,
  PROFILE_FORM_ORDER.map((id) => ({ form: FORMS[id], section: FORM_SECTION[id] })),
  { id: 'profile-extra', fields: PROFILE_EXTRA_FIELDS, screens: PROFILE_EXTRA_SCREENS }
);

/** Every profile fact, once, in topic screens (the /start/profile and /start/review intake). */
export const PROFILE_FORM: FormSpec = PROFILE.form;

/** The section of a PROFILE_FORM screen, by screen id. */
export function profileFormSection(screenId: string): ProfileFormSection | undefined {
  return PROFILE.sections.get(screenId);
}

/** The form a flow runs. */
export function formForFlow(flow: FormFlow): FormSpec {
  if (flow === 'core') return CORE_FORM;
  if (flow === 'profile') return PROFILE_FORM;
  return FORMS[flow];
}

/**
 * The screens that count toward profile completeness, remaining questions
 * and every "finished" state: all but the optional ones (ScreenSpec.optional).
 */
export function requiredScreens(screens: readonly ScreenSpec[]): ScreenSpec[] {
  return screens.filter((screen) => !screen.optional);
}

export interface ProfileCompleteness {
  /** Required topic screens whose every visible fact is answered. */
  provided: number;
  /** Required topic screens with at least one visible fact. */
  total: number;
  /** The screens still to answer, in PROFILE_FORM order. */
  missing: ScreenSpec[];
}

/**
 * Calculator-only values (the fields of the calculator-only screens, Surface
 * 'calculator', that no other screen asks): set for one run on a calculator
 * page and never asked by the profile. Every place that decides which
 * profile screens exist (completeness, the review page, the intake screens
 * and remaining mode) reads them as unset through intakeScreens, so a figure
 * typed on the rebalancer (this month's new cash) never changes which topics
 * the profile has. The calculator page reads them as they are.
 */
const CALCULATOR_ONLY_PATHS: readonly string[] = (() => {
  const screens = Object.values(FORMS).flatMap((form) => form.screens);
  const elsewhere = new Set(screens.filter((screen) => screen.surface !== 'calculator').flatMap((screen) => screen.fields));
  const only = screens.filter((screen) => screen.surface === 'calculator').flatMap((screen) => screen.fields);
  return Array.from(new Set(only.filter((path) => !elsewhere.has(path))));
})();

function withoutCalculatorOnly(get: Get): Get {
  return (path) =>
    CALCULATOR_ONLY_PATHS.some((only) => path === only || path.startsWith(`${only}.`)) ? undefined : get(path);
}

/**
 * The intake-surface screens of `form` for `get`, with the calculator-only
 * values read as unset: the one rule for which profile screens exist.
 */
export function intakeScreens(form: FormSpec, get: Get, options: Omit<ScreensForOptions, 'surface'>): ScreenSpec[] {
  return screensFor(form, withoutCalculatorOnly(get), { ...options, surface: 'intake' });
}

/**
 * Profile completeness counted by topic screen (O14): a PROFILE_FORM screen
 * counts once every fact visible on it is in profile.provided. A screen with
 * no visible fact (the employer match without a 401(k)) is left out, and so
 * is every optional screen, answered or not.
 */
export function profileCompleteness(profile: FinancialProfile): ProfileCompleteness {
  const get = makeGet(profile);
  const total = requiredScreens(intakeScreens(PROFILE_FORM, get, { mode: 'all' })).length;
  const missing = requiredScreens(intakeScreens(PROFILE_FORM, get, { mode: 'remaining', provided: profile.provided }));
  return { provided: total - missing.length, total, missing };
}

/** The unit the completeness count is read in, after "N of M". */
export const TOPICS_ANSWERED = 'topics answered';

/** "N of M topics answered": the completeness count as every card prints it. */
export function topicsAnsweredText({ provided, total }: Pick<ProfileCompleteness, 'provided' | 'total'>): string {
  return `${provided} of ${total} ${TOPICS_ANSWERED}`;
}
