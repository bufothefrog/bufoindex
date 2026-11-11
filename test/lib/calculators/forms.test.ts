import { describe, expect, it } from 'vitest';
import {
  CORE_FORM,
  FORMS,
  PROFILE_FORM,
  PROFILE_FORM_ORDER,
  PROFILE_FORM_SECTION_LABELS,
  composeProfileForm,
  fieldRegistry,
  formForFlow,
  profileCompleteness,
  profileFormSection,
} from '@/lib/calculators/forms';
import { CORE_SCREENS, PROFILE_EXTRA_SCREENS } from '@/lib/fields/shared';
import { makeGet } from '@/lib/fields/paths';
import { fieldMap, screensFor } from '@/lib/fields/runtime';
import type { CrossFieldRule, FieldSpec, FormSpec, Get, ScreenSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile, isProfilePath } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

const ALL_FORMS: readonly FormSpec[] = [CORE_FORM, ...Object.values(FORMS), PROFILE_FORM];

const profileWith = (provided: string[], edits: Partial<FinancialProfile> = {}): FinancialProfile => ({
  ...getDefaultFinancialProfile(),
  ...edits,
  provided,
});

describe('FORMS and CORE_FORM', () => {
  it('has one form per calculator, keyed by its id', () => {
    expect(Object.keys(FORMS)).toEqual(['paycheck', 'retirement', 'portfolio', 'leverage']);
    for (const [id, form] of Object.entries(FORMS)) expect(form.id).toBe(id);
    expect(CORE_FORM.screens).toBe(CORE_SCREENS);
  });

  it('defines every screen field once, on a real profile path', () => {
    for (const form of ALL_FORMS) {
      const map = fieldMap(form);
      for (const screen of form.screens) {
        for (const path of screen.fields) {
          expect(map.has(path), `${form.id}:${screen.id}:${path}`).toBe(true);
          expect(isProfilePath(path), path).toBe(true);
        }
      }
      const ids = form.screens.map((screen) => screen.id);
      expect(new Set(ids).size, form.id).toBe(ids.length);
    }
  });

  it('routes each flow to its form', () => {
    expect(formForFlow('core')).toBe(CORE_FORM);
    expect(formForFlow('profile')).toBe(PROFILE_FORM);
    for (const [id, form] of Object.entries(FORMS)) expect(formForFlow(id as keyof typeof FORMS)).toBe(form);
  });
});

describe('PROFILE_FORM', () => {
  it('asks the core, then each calculator in profile order, then the profile-only screens', () => {
    const fromForms = PROFILE_FORM_ORDER.flatMap((id) =>
      FORMS[id].screens.filter((screen) => screen.tier !== 'core').map((screen) => screen.id)
    );
    const ids = PROFILE_FORM.screens.map((screen) => screen.id);
    expect(ids.slice(0, CORE_SCREENS.length)).toEqual(CORE_SCREENS.map((screen) => screen.id));
    expect(ids.slice(-PROFILE_EXTRA_SCREENS.length)).toEqual(PROFILE_EXTRA_SCREENS.map((screen) => screen.id));
    // Every kept screen comes from a form, in form order.
    const middle = ids.slice(CORE_SCREENS.length, -PROFILE_EXTRA_SCREENS.length);
    expect(middle).toEqual(Array.from(new Set(fromForms)).filter((id) => middle.includes(id)));
  });

  it('asks each profile path once, keeping the first form that asks it', () => {
    const paths = PROFILE_FORM.screens.flatMap((screen) => screen.fields);
    expect(new Set(paths).size).toBe(paths.length);
    // Retirement asks the invested balance before leverage rewords it as "Starting balance".
    expect(fieldMap(PROFILE_FORM).get('investing.investedBalance')?.label).toBe('Invested balance');
    expect(fieldMap(PROFILE_FORM).get('person.retirementAge')?.label).toBe('Target retirement age');
  });

  it('drops a screen whose fields were all asked earlier', () => {
    // Leverage's horizon (age, stop age) and balance screens are covered by the core and retirement.
    const leverageIds = PROFILE_FORM.screens.filter((screen) => profileFormSection(screen.id) === 'portfolio');
    expect(leverageIds.map((screen) => screen.id)).toEqual(['new-cash', 'target-mix', 'taxable-investing']);
    expect(PROFILE_FORM.screens.some((screen) => screen.id === 'horizon')).toBe(false);
  });

  it('labels every screen with its section', () => {
    expect(PROFILE_FORM.screens.map((screen) => PROFILE_FORM_SECTION_LABELS[profileFormSection(screen.id)!])).toEqual([
      'The basics', 'The basics', 'The basics',
      'Retirement', 'Retirement', 'Retirement',
      'Paycheck', 'Paycheck', 'Paycheck',
      'Portfolio', 'Portfolio', 'Portfolio',
      'Cash and strategy', 'Cash and strategy',
    ]);
    expect(profileFormSection('nope')).toBeUndefined();
  });

  it('keeps one copy of each cross-field rule', () => {
    const keys = (PROFILE_FORM.relations ?? []).map((rule) => `${rule.lower}|${rule.upper}|${rule.checkOn}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      'income.netPerPaycheck|income.grossPerPaycheck|income.netPerPaycheck',
      'person.age|person.retirementAge|person.retirementAge',
      'spending.funMoneyMin|spending.funMoneyMax|spending.funMoneyMax',
    ]);
  });

  it('runs the shared derived writes once', () => {
    const get = makeGet(profileWith([], { person: { ...getDefaultFinancialProfile().person, age: 62, retirementAge: 60 } }));
    expect(PROFILE_FORM.onSubmit?.(get, new Set())).toEqual([
      { path: 'cash.targetMonths', value: 1 },
      { path: 'person.retirementAge', value: 63 },
    ]);
  });
});

describe('composeProfileForm', () => {
  const field = (path: string, label = path): FieldSpec => ({ path, kind: 'money', label, tier: 'details' });
  const screen = (id: string, fields: string[], extra: Partial<ScreenSpec> = {}): ScreenSpec => ({
    id,
    title: id,
    tier: 'details',
    fields,
    ...extra,
  });
  const rule = (lower: string, upper: string): CrossFieldRule => ({
    lower,
    upper,
    strict: false,
    checkOn: upper,
    message: `${lower} above ${upper}`,
  });

  const core: FormSpec = {
    id: 'core',
    fields: [field('a')],
    screens: [screen('basics', ['a'], { tier: 'core' })],
    relations: [rule('a', 'b')],
  };
  const first: FormSpec = {
    id: 'first',
    fields: [field('a'), field('b', 'B from first'), field('c'), field('x')],
    screens: [
      screen('basics', ['a'], { tier: 'core' }),
      screen('one', ['b', 'c']),
      screen('assume', ['x'], { tier: 'assumption' }),
      screen('page-only', ['x'], { surface: 'calculator' }),
    ],
    relations: [rule('a', 'b')],
    onSubmit: (get: Get) => [{ path: 'c', value: get('b') }],
  };
  const second: FormSpec = {
    id: 'second',
    fields: [field('b', 'B from second'), field('c'), field('d')],
    screens: [screen('one', ['b', 'd']), screen('covered', ['b', 'c']), screen('intake-only', ['d'], { surface: 'intake' })],
    relations: [rule('c', 'd')],
    onSubmit: (get: Get) => [
      { path: 'c', value: 'second' },
      { path: 'd', value: get('a') },
    ],
  };
  const extra: FormSpec = { id: 'extra', fields: [field('d'), field('e')], screens: [screen('last', ['d', 'e'])] };

  const built = composeProfileForm(
    core,
    [
      { form: first, section: 'retirement' },
      { form: second, section: 'paycheck' },
    ],
    extra
  );

  it('keeps the first occurrence of each path and drops screens left empty', () => {
    expect(built.form.screens.map((s) => [s.id, s.fields])).toEqual([
      ['basics', ['a']],
      ['one', ['b', 'c']],
      ['second-one', ['d']],
      ['last', ['e']],
    ]);
    expect(fieldMap(built.form).get('b')?.label).toBe('B from first');
  });

  it('leaves out assumption and calculator-only screens, and the core screens of each form', () => {
    expect(built.form.fields.map((spec) => spec.path)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(built.form.screens.some((s) => s.fields.includes('x'))).toBe(false);
  });

  it('records each screen section, prefixing a repeated screen id with its form', () => {
    expect(Object.fromEntries(built.sections)).toEqual({
      basics: 'core',
      one: 'retirement',
      'second-one': 'paycheck',
      last: 'cash',
    });
  });

  it('unions the relations and the derived writes, first write to a path winning', () => {
    expect(built.form.relations).toEqual([rule('a', 'b'), rule('c', 'd')]);
    const values: Record<string, unknown> = { a: 1, b: 2 };
    expect(built.form.onSubmit?.((path) => values[path], new Set())).toEqual([
      { path: 'c', value: 2 },
      { path: 'd', value: 1 },
    ]);
  });
});

describe('fieldRegistry', () => {
  it('lists every field any form defines, once, first wording first', () => {
    const registry = fieldRegistry();
    const all = new Set([CORE_FORM, ...Object.values(FORMS), PROFILE_FORM].flatMap((form) => form.fields.map((spec) => spec.path)));
    expect(new Set(registry.keys())).toEqual(all);
    expect(registry.get('investing.investedBalance')?.label).toBe('Invested balance');
    expect(registry.get('person.age')?.label).toBe('Your age');
    expect(fieldRegistry()).toBe(registry);
  });
});

describe('profileCompleteness (by topic screen)', () => {
  const topics = (profile: FinancialProfile) =>
    screensFor(PROFILE_FORM, makeGet(profile), { mode: 'all', surface: 'intake' });

  it('counts every visible topic screen of the profile form', () => {
    const empty = profileCompleteness(getDefaultFinancialProfile());
    expect(empty.total).toBe(topics(getDefaultFinancialProfile()).length);
    expect(empty.total).toBe(PROFILE_FORM.screens.length);
    expect(empty.provided).toBe(0);
    expect(empty.missing.map((s) => s.id)).toEqual(PROFILE_FORM.screens.map((s) => s.id));
  });

  it('counts a screen once every fact on it is answered', () => {
    const core = CORE_SCREENS.flatMap((s) => s.fields);
    const result = profileCompleteness(profileWith([...core, 'spending.funMoneyMin']));
    expect(result.provided).toBe(CORE_SCREENS.length);
    // A partly answered screen still counts as missing.
    expect(result.missing.map((s) => s.id)).toContain('fun-money');
    expect(result.provided + result.missing.length).toBe(result.total);
  });

  it('leaves out a screen with no visible fact', () => {
    const base = getDefaultFinancialProfile();
    const noPlan = profileWith([], { workplace: { ...base.workplace, has401k: false } });
    const result = profileCompleteness(noPlan);
    expect(result.total).toBe(PROFILE_FORM.screens.length - 1);
    expect(result.missing.map((s) => s.id)).not.toContain('match');
  });

  it('is complete when every profile path is answered', () => {
    const all = PROFILE_FORM.screens.flatMap((s) => s.fields);
    const result = profileCompleteness(profileWith(all));
    expect(result).toEqual({ provided: result.total, total: PROFILE_FORM.screens.length, missing: [] });
  });
});
