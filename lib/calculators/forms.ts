/**
 * Form registries derived from the calculator forms (docs/rebuild-plan.md
 * section 2.4):
 *
 * - FORMS: each calculator's FormSpec; CORE_FORM: the shared basics.
 * - PROFILE_FORM: the core, then the union of every form's non-core,
 *   non-assumption, intake-surface screens deduplicated by field path (first
 *   occurrence wins; a screen left empty is dropped), then PROFILE_EXTRA
 *   (cash buffer, strategy). This is what "Finish your profile" asks.
 * - formForFlow(flow): the form one intake flow runs.
 * - fieldRegistry(): every field spec by path.
 * - profileCompleteness(profile): answered topics over PROFILE_FORM's fact
 *   screens (O14).
 *
 * Pure: no React, no DOM, no storage.
 */

import { makeGet } from '@/lib/fields/paths';
import { isScreenComplete, screensFor } from '@/lib/fields/runtime';
import {
  CORE_FIELDS,
  CORE_RELATIONS,
  CORE_SCREENS,
  PROFILE_EXTRA_FIELDS,
  PROFILE_EXTRA_SCREENS,
  intakeOnSubmit,
} from '@/lib/fields/shared';
import type { CrossFieldRule, FieldSpec, FormSpec, ScreenSpec } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import { LEVERAGE_FORM, leverageIntakeDestination } from './leverage/form';
import { PAYCHECK_FORM, paycheckIntakeDestination } from './paycheck/form';
import { PORTFOLIO_FORM, portfolioIntakeDestination } from './portfolio/form';
import { RETIREMENT_FORM, retirementIntakeDestination } from './retirement/form';
import type { CalculatorId } from './types';

export const FORMS: Readonly<Record<CalculatorId, FormSpec>> = {
  paycheck: PAYCHECK_FORM,
  retirement: RETIREMENT_FORM,
  portfolio: PORTFOLIO_FORM,
  leverage: LEVERAGE_FORM,
};

/** Where each calculator's intake leads once finished (each form module owns its destination). */
export const INTAKE_DESTINATIONS: Readonly<Record<CalculatorId, (profile: FinancialProfile) => string>> = {
  paycheck: paycheckIntakeDestination,
  retirement: retirementIntakeDestination,
  portfolio: portfolioIntakeDestination,
  leverage: leverageIntakeDestination,
};

export const CORE_FORM: FormSpec = {
  id: 'core',
  fields: CORE_FIELDS,
  screens: CORE_SCREENS,
  relations: CORE_RELATIONS,
  onSubmit: intakeOnSubmit,
};

/** Which part of the profile intake a PROFILE_FORM screen comes from. */
export type FormSection = 'core' | CalculatorId | 'extra';

export const FORM_SECTION_LABELS: Readonly<Record<FormSection, string>> = {
  core: 'The basics',
  retirement: 'Retirement',
  paycheck: 'Paycheck',
  portfolio: 'Portfolio',
  leverage: 'Leverage',
  extra: 'Cash and strategy',
};

/** The order calculator forms contribute their screens to PROFILE_FORM. */
export const PROFILE_FORM_ORDER: readonly CalculatorId[] = ['retirement', 'paycheck', 'portfolio', 'leverage'];

function isProfileFactScreen(screen: ScreenSpec): boolean {
  return screen.tier !== 'core' && screen.tier !== 'assumption' && (screen.surface ?? 'both') !== 'calculator';
}

function sameRule(a: CrossFieldRule, b: CrossFieldRule): boolean {
  return a.lower === b.lower && a.upper === b.upper && a.checkOn === b.checkOn && a.strict === b.strict;
}

interface ProfileFormBuild {
  form: FormSpec;
  sections: Readonly<Record<string, FormSection>>;
}

/** Builds a union form from section sources. Exported for tests with fixture forms. */
export function buildProfileForm(
  core: FormSpec,
  sources: ReadonlyArray<{ section: FormSection; form: FormSpec }>,
  extra: { fields: readonly FieldSpec[]; screens: readonly ScreenSpec[] }
): ProfileFormBuild {
  const fields: FieldSpec[] = [];
  const screens: ScreenSpec[] = [];
  const relations: CrossFieldRule[] = [];
  const sections: Record<string, FormSection> = {};
  const seenPaths = new Set<string>();
  const specs = new Map<string, FieldSpec>();

  const addScreen = (section: FormSection, screen: ScreenSpec, lookup: ReadonlyMap<string, FieldSpec>) => {
    const fresh = screen.fields.filter((path) => !seenPaths.has(path));
    if (fresh.length === 0) return;
    for (const path of fresh) {
      const spec = lookup.get(path);
      if (!spec) continue;
      seenPaths.add(path);
      for (const covered of spec.covers ?? []) seenPaths.add(covered);
      if (!specs.has(path)) {
        specs.set(path, spec);
        fields.push(spec);
      }
    }
    const id = sections[screen.id] === undefined ? screen.id : `${section}-${screen.id}`;
    sections[id] = section;
    screens.push(fresh.length === screen.fields.length && id === screen.id ? screen : { ...screen, id, fields: fresh });
  };

  const lookupOf = (list: readonly FieldSpec[]) => new Map(list.map((spec) => [spec.path, spec] as const));

  const coreLookup = lookupOf(core.fields);
  for (const screen of core.screens) addScreen('core', screen, coreLookup);
  for (const { section, form } of sources) {
    const lookup = lookupOf(form.fields);
    for (const screen of form.screens) if (isProfileFactScreen(screen)) addScreen(section, screen, lookup);
  }
  const extraLookup = lookupOf(extra.fields);
  for (const screen of extra.screens) addScreen('extra', screen, extraLookup);

  for (const rule of [core, ...sources.map((source) => source.form)].flatMap((form) => form.relations ?? [])) {
    if (!seenPaths.has(rule.lower) || !seenPaths.has(rule.upper) || !seenPaths.has(rule.checkOn)) continue;
    if (!relations.some((existing) => sameRule(existing, rule))) relations.push(rule);
  }

  return {
    form: { id: 'profile', fields, screens, relations, onSubmit: intakeOnSubmit },
    sections,
  };
}

const PROFILE_BUILD = buildProfileForm(
  CORE_FORM,
  PROFILE_FORM_ORDER.map((id) => ({ section: id, form: FORMS[id] })),
  { fields: PROFILE_EXTRA_FIELDS, screens: PROFILE_EXTRA_SCREENS }
);

/** Every profile fact, one topic screen at a time: what "Finish your profile" asks. */
export const PROFILE_FORM: FormSpec = PROFILE_BUILD.form;

/** The section a PROFILE_FORM screen belongs to ('core' for an unknown id). */
export function profileSectionOf(screenId: string): FormSection {
  return PROFILE_BUILD.sections[screenId] ?? 'core';
}

/** What a wizard flow asks: the shared core, one calculator, or the whole profile. */
export type FormFlow = 'core' | 'profile' | CalculatorId;

export function formForFlow(flow: FormFlow): FormSpec {
  if (flow === 'core') return CORE_FORM;
  if (flow === 'profile') return PROFILE_FORM;
  return FORMS[flow];
}

let registry: ReadonlyMap<string, FieldSpec> | null = null;

/**
 * Every field spec by profile path, across the core, every calculator form
 * and the profile extras. The first spec registered for a path wins (the
 * core, then PROFILE_FORM_ORDER, then the extras), matching PROFILE_FORM.
 */
export function fieldRegistry(): ReadonlyMap<string, FieldSpec> {
  if (registry) return registry;
  const map = new Map<string, FieldSpec>();
  const add = (specs: readonly FieldSpec[]) => {
    for (const spec of specs) if (!map.has(spec.path)) map.set(spec.path, spec);
  };
  add(CORE_FIELDS);
  for (const id of PROFILE_FORM_ORDER) add(FORMS[id].fields);
  add(PROFILE_EXTRA_FIELDS);
  registry = map;
  return registry;
}

export interface ProfileTopic {
  id: string;
  title: string;
  section: FormSection;
}

export interface ProfileCompleteness {
  /** Topic screens whose visible fields are all answered. */
  provided: number;
  /** Topic screens that currently apply (a hidden screen, like the match terms without a plan, does not count). */
  total: number;
  /** The topics with at least one field still on its typical value, in intake order. */
  missing: ProfileTopic[];
}

/**
 * How much of the profile the user has answered, counted by topic screen
 * (O14) over PROFILE_FORM's fact screens (core and details tiers). A screen
 * counts once every visible field on it is in profile.provided.
 */
export function profileCompleteness(profile: FinancialProfile): ProfileCompleteness {
  const get = makeGet(profile);
  const provided = new Set(profile.provided);
  const screens = screensFor(PROFILE_FORM, get, { tiers: ['core', 'details'], surface: 'intake' });
  const missing = screens
    .filter((screen) => !isScreenComplete(PROFILE_FORM, screen, get, provided))
    .map((screen) => ({ id: screen.id, title: screen.title, section: profileSectionOf(screen.id) }));
  return { provided: screens.length - missing.length, total: screens.length, missing };
}
