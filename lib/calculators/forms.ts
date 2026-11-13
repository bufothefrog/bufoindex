/**
 * The form registries (docs/rebuild-plan.md section 2.4): every calculator's
 * FormSpec, the shared core, and the profile form derived from them, plus
 * profile completeness counted by topic screen (O14). Pure.
 *
 * PROFILE_FORM is the core screens, then the union of every calculator
 * form's non-core, non-assumption, intake-surface screens in
 * PROFILE_FORM_ORDER, then PROFILE_EXTRA_SCREENS. Fields are deduplicated by
 * path across all of them: the first screen that asks a path keeps it (with
 * that form's spec), later screens drop it, and a screen left with no field
 * is dropped; a trimmed screen takes the wording in TRIMMED_SCREEN_COPY when
 * it has an entry there. Relations are the union of every form's (one per
 * lower, upper and checkOn), and onSubmit runs each distinct form onSubmit,
 * the first write to a path winning.
 */

import {
  CORE_FIELDS,
  CORE_SCREENS,
  NET_PAY_AT_MOST_GROSS,
  PROFILE_EXTRA_FIELDS,
  PROFILE_EXTRA_SCREENS,
  intakeDerivedWrites,
} from '@/lib/fields/shared';
import { makeGet } from '@/lib/fields/paths';
import { fieldMap, screensFor } from '@/lib/fields/runtime';
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

/** The order the profile asks each calculator's screens in. */
export const PROFILE_FORM_ORDER: readonly CalculatorId[] = ['retirement', 'paycheck', 'portfolio', 'leverage'];

/**
 * The section each profile screen belongs to, for the profile intake's
 * progress label and "Skip the rest of this section". The leverage form's
 * profile screen (the taxable contribution) sits with the portfolio
 * questions, so the two calculators share one section.
 */
export type ProfileFormSection = 'core' | 'retirement' | 'paycheck' | 'portfolio' | 'cash';

export const PROFILE_FORM_SECTION_LABELS: Readonly<Record<ProfileFormSection, string>> = {
  core: 'The basics',
  retirement: 'Retirement',
  paycheck: 'Paycheck',
  portfolio: 'Portfolio',
  cash: 'Cash and strategy',
};

const FORM_SECTION: Readonly<Record<CalculatorId, ProfileFormSection>> = {
  retirement: 'retirement',
  paycheck: 'paycheck',
  portfolio: 'portfolio',
  leverage: 'portfolio',
};

/** The wording of a screen: what the wizard heading and the topic lists show. */
type ScreenCopy = Pick<ScreenSpec, 'title' | 'question' | 'description'>;

/**
 * Wording for a calculator screen the profile form trims, where the
 * screen's own title and description speak of the fields it lost. The
 * leverage 'facts' screen keeps only the leverage ratio: the age, the
 * retirement age, the invested balance and the taxable contribution are
 * asked earlier.
 */
const TRIMMED_SCREEN_COPY: Partial<Record<CalculatorId, Readonly<Record<string, ScreenCopy>>>> = {
  leverage: {
    facts: {
      title: 'Leverage ratio',
      question: 'Which leverage ratio should the comparison use?',
    },
  },
};

function relationKey(rule: CrossFieldRule): string {
  return `${rule.lower}|${rule.upper}|${rule.checkOn}`;
}

/** One calculator form's part of the profile form. */
export interface ProfileFormPart {
  form: FormSpec;
  section: ProfileFormSection;
  /** Replaces the wording of a screen of this form, by screen id, when the profile form trims its fields. */
  trimmedCopy?: Readonly<Record<string, ScreenCopy>>;
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

  const take = (
    source: FormSpec,
    screen: ScreenSpec,
    section: ProfileFormSection,
    trimmedCopy?: Readonly<Record<string, ScreenCopy>>
  ) => {
    const specs = fieldMap(source);
    const kept = screen.fields.filter((path) => !fields.has(path));
    if (kept.length === 0) return;
    for (const path of kept) fields.set(path, specs.get(path) as FieldSpec);
    // Screen ids are unique per form; prefix one that another form already used.
    const id = sections.has(screen.id) ? `${source.id}-${screen.id}` : screen.id;
    const copy = kept.length < screen.fields.length ? trimmedCopy?.[screen.id] : undefined;
    screens.push({ ...screen, ...copy, id, fields: kept });
    sections.set(id, section);
  };

  for (const screen of core.screens) take(core, screen, 'core');
  for (const { form, section, trimmedCopy } of parts) {
    for (const screen of form.screens) {
      const surface = screen.surface ?? 'both';
      if (screen.tier === 'core' || screen.tier === 'assumption' || surface === 'calculator') continue;
      take(form, screen, section, trimmedCopy);
    }
  }
  for (const screen of extra.screens) take(extra, screen, 'cash');

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
  PROFILE_FORM_ORDER.map((id) => ({ form: FORMS[id], section: FORM_SECTION[id], trimmedCopy: TRIMMED_SCREEN_COPY[id] })),
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

export interface ProfileCompleteness {
  /** Topic screens whose every visible fact is answered. */
  provided: number;
  /** Topic screens with at least one visible fact. */
  total: number;
  /** The screens still to answer, in PROFILE_FORM order. */
  missing: ScreenSpec[];
}

/**
 * Profile completeness counted by topic screen (O14): a PROFILE_FORM screen
 * counts once every fact visible on it is in profile.provided. A screen with
 * no visible fact (the employer match without a 401(k)) is left out.
 */
export function profileCompleteness(profile: FinancialProfile): ProfileCompleteness {
  const get = makeGet(profile);
  const total = screensFor(PROFILE_FORM, get, { mode: 'all', surface: 'intake' }).length;
  const missing = screensFor(PROFILE_FORM, get, { mode: 'remaining', provided: profile.provided, surface: 'intake' });
  return { provided: total - missing.length, total, missing };
}

/** The unit the completeness count is read in, after "N of M". */
export const TOPICS_ANSWERED = 'topics answered';

/** "N of M topics answered": the completeness count as every card prints it. */
export function topicsAnsweredText({ provided, total }: Pick<ProfileCompleteness, 'provided' | 'total'>): string {
  return `${provided} of ${total} ${TOPICS_ANSWERED}`;
}
