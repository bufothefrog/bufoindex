import { describe, expect, it } from 'vitest';
import {
  CORE_FORM,
  FORMS,
  FORM_SECTION_LABELS,
  INTAKE_DESTINATIONS,
  PROFILE_FORM,
  PROFILE_FORM_ORDER,
  buildProfileForm,
  fieldRegistry,
  formForFlow,
  profileCompleteness,
  profileSectionOf,
} from '@/lib/calculators/forms';
import { CALCULATOR_IDS } from '@/lib/calculators/types';
import { makeGet } from '@/lib/fields/paths';
import { fieldMap } from '@/lib/fields/runtime';
import { CORE_FIELDS, CORE_SCREENS, PROFILE_EXTRA_FIELDS, PROFILE_EXTRA_SCREENS } from '@/lib/fields/shared';
import type { FieldSpec, FormSpec, ScreenSpec } from '@/lib/fields/types';
import {
  LEVERAGE_PATH,
  PAYCHECK_PATH,
  PORTFOLIO_PATH,
  RETIREMENT_PATH,
} from '@/lib/profile/links';
import { getDefaultFinancialProfile, isProfilePath } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

const money = (path: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  path,
  kind: 'money',
  label: path,
  tier: 'details',
  ...extra,
});

const screen = (id: string, fields: string[], extra: Partial<ScreenSpec> = {}): ScreenSpec => ({
  id,
  title: id,
  tier: 'details',
  fields,
  ...extra,
});

const profileWith = (provided: string[], edits: Partial<FinancialProfile> = {}): FinancialProfile => ({
  ...getDefaultFinancialProfile(),
  ...edits,
  provided,
});

function isFactScreen(s: ScreenSpec): boolean {
  return s.tier !== 'core' && s.tier !== 'assumption' && (s.surface ?? 'both') !== 'calculator';
}

describe('FORMS', () => {
  it('has one valid form per calculator', () => {
    expect(Object.keys(FORMS).sort()).toEqual([...CALCULATOR_IDS].sort());
    for (const id of CALCULATOR_IDS) {
      expect(FORMS[id].id).toBe(id);
      expect(() => fieldMap(FORMS[id])).not.toThrow();
    }
    expect(() => fieldMap(CORE_FORM)).not.toThrow();
    expect(() => fieldMap(PROFILE_FORM)).not.toThrow();
  });

  it('keys every field by a real profile path', () => {
    for (const form of [CORE_FORM, PROFILE_FORM, ...Object.values(FORMS)]) {
      for (const spec of form.fields) expect(isProfilePath(spec.path), `${form.id}:${spec.path}`).toBe(true);
    }
  });

  it('runs the shared derived writes on finish', () => {
    for (const form of [CORE_FORM, PROFILE_FORM, ...Object.values(FORMS)]) {
      expect(typeof form.onSubmit, form.id).toBe('function');
    }
  });

  it('routes each calculator intake to its calculator path', () => {
    const paths = {
      paycheck: PAYCHECK_PATH,
      retirement: RETIREMENT_PATH,
      portfolio: PORTFOLIO_PATH,
      leverage: LEVERAGE_PATH,
    };
    const profile = getDefaultFinancialProfile();
    for (const id of CALCULATOR_IDS) {
      const href = INTAKE_DESTINATIONS[id](profile);
      expect(href.startsWith(paths[id]), href).toBe(true);
      expect(href).toContain('from=profile');
    }
  });
});

describe('formForFlow', () => {
  it('maps flows to forms', () => {
    expect(formForFlow('core')).toBe(CORE_FORM);
    expect(formForFlow('profile')).toBe(PROFILE_FORM);
    for (const id of CALCULATOR_IDS) expect(formForFlow(id)).toBe(FORMS[id]);
  });

  it('gives the core form exactly the core screens', () => {
    expect(CORE_FORM.screens).toBe(CORE_SCREENS);
    expect(CORE_FORM.fields).toBe(CORE_FIELDS);
  });
});

describe('PROFILE_FORM', () => {
  const screenPaths = PROFILE_FORM.screens.flatMap((s) => s.fields);

  it('starts with the core screens and ends with the profile extras', () => {
    const ids = PROFILE_FORM.screens.map((s) => s.id);
    expect(ids.slice(0, CORE_SCREENS.length)).toEqual(CORE_SCREENS.map((s) => s.id));
    expect(ids.slice(-PROFILE_EXTRA_SCREENS.length)).toEqual(PROFILE_EXTRA_SCREENS.map((s) => s.id));
  });

  it('asks every path once, on screens with unique ids', () => {
    expect(new Set(screenPaths).size).toBe(screenPaths.length);
    const ids = PROFILE_FORM.screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PROFILE_FORM.screens.every((s) => s.fields.length > 0)).toBe(true);
  });

  it('is the union of every fact screen of every form (no assumptions, no calculator-only screens)', () => {
    const expected = new Set<string>([
      ...CORE_SCREENS.flatMap((s) => s.fields),
      ...PROFILE_FORM_ORDER.flatMap((id) => FORMS[id].screens.filter(isFactScreen).flatMap((s) => s.fields)),
      ...PROFILE_EXTRA_SCREENS.flatMap((s) => s.fields),
    ]);
    expect(new Set(screenPaths)).toEqual(expected);
    expect(PROFILE_FORM.screens.some((s) => s.tier === 'assumption' || s.surface === 'calculator')).toBe(false);
  });

  it('keeps the first spec registered for a shared path', () => {
    const registry = fieldRegistry();
    for (const spec of PROFILE_FORM.fields) expect(registry.get(spec.path)).toBe(spec);
    expect(fieldRegistry()).toBe(registry);
    for (const spec of [...CORE_FIELDS, ...PROFILE_EXTRA_FIELDS]) expect(registry.has(spec.path)).toBe(true);
  });

  it('labels each screen with the section it comes from', () => {
    for (const s of CORE_SCREENS) expect(profileSectionOf(s.id)).toBe('core');
    for (const s of PROFILE_EXTRA_SCREENS) expect(profileSectionOf(s.id)).toBe('extra');
    expect(profileSectionOf('not-a-screen')).toBe('core');
    for (const s of PROFILE_FORM.screens) expect(FORM_SECTION_LABELS[profileSectionOf(s.id)]).toBeTruthy();
  });

  it('keeps only relations whose paths it asks', () => {
    for (const rule of PROFILE_FORM.relations ?? []) {
      expect(screenPaths).toContain(rule.lower);
      expect(screenPaths).toContain(rule.upper);
    }
  });
});

describe('buildProfileForm', () => {
  const core: FormSpec = {
    id: 'core',
    fields: [money('person.age', { tier: 'core' })],
    screens: [screen('about', ['person.age'], { tier: 'core' })],
    relations: [],
  };

  it('dedupes by path (first wins), drops emptied screens, and prefixes colliding ids', () => {
    const a: FormSpec = {
      id: 'a',
      fields: [money('person.age', { label: 'Other age' }), money('x.one'), money('x.two', { label: 'Two (a)' })],
      screens: [
        screen('mixed', ['person.age', 'x.one']),
        screen('two', ['x.two']),
        screen('assume', ['x.one'], { tier: 'assumption' }),
      ],
      relations: [
        { lower: 'x.one', upper: 'x.two', strict: false, checkOn: 'x.two', message: 'one above two' },
        { lower: 'x.one', upper: 'x.missing', strict: false, checkOn: 'x.one', message: 'dropped' },
      ],
    };
    const b: FormSpec = {
      id: 'b',
      fields: [money('x.two', { label: 'Two (b)' }), money('x.three'), money('x.calc'), money('x.four')],
      screens: [
        screen('only-dupes', ['x.two']),
        screen('two', ['x.three']),
        screen('calc', ['x.calc'], { surface: 'calculator' }),
        screen('assume', ['x.four'], { tier: 'assumption' }),
      ],
      relations: [{ lower: 'x.one', upper: 'x.two', strict: false, checkOn: 'x.two', message: 'one above two' }],
    };
    const { form, sections } = buildProfileForm(
      core,
      [
        { section: 'paycheck', form: a },
        { section: 'leverage', form: b },
      ],
      { fields: [money('x.extra')], screens: [screen('extra', ['x.extra'])] }
    );

    expect(form.screens.map((s) => [s.id, s.fields])).toEqual([
      ['about', ['person.age']],
      ['mixed', ['x.one']],
      ['two', ['x.two']],
      ['leverage-two', ['x.three']],
      ['extra', ['x.extra']],
    ]);
    expect(form.fields.map((f) => f.label)).toEqual(['person.age', 'x.one', 'Two (a)', 'x.three', 'x.extra']);
    expect(sections).toEqual({
      about: 'core',
      mixed: 'paycheck',
      two: 'paycheck',
      'leverage-two': 'leverage',
      extra: 'extra',
    });
    expect(form.relations?.map((r) => r.message)).toEqual(['one above two']);
    expect(() => fieldMap(form)).not.toThrow();
  });

  it('treats paths a custom renderer covers as asked', () => {
    const a: FormSpec = {
      id: 'a',
      fields: [money('x.list', { kind: 'custom', covers: ['x.sibling'] }), money('x.sibling')],
      screens: [screen('editor', ['x.list']), screen('sibling', ['x.sibling'])],
    };
    const { form } = buildProfileForm(core, [{ section: 'portfolio', form: a }], { fields: [], screens: [] });
    expect(form.screens.map((s) => s.id)).toEqual(['about', 'editor']);
  });
});

describe('profileCompleteness', () => {
  /** Fact screens with at least one field visible for the profile. */
  const factScreens = (profile: FinancialProfile) => {
    const get = makeGet(profile);
    return PROFILE_FORM.screens.filter(
      (s) =>
        s.tier !== 'assumption' &&
        s.fields.some((path) => {
          const spec = PROFILE_FORM.fields.find((f) => f.path === path);
          return spec?.visibleWhen ? spec.visibleWhen(get) : true;
        })
    );
  };

  it('counts topic screens, none answered by default', () => {
    const profile = getDefaultFinancialProfile();
    const result = profileCompleteness(profile);
    expect(result.provided).toBe(0);
    expect(result.total).toBe(factScreens(profile).length);
    expect(result.missing.map((t) => t.id)).toEqual(factScreens(profile).map((s) => s.id));
    expect(result.missing[0]).toEqual({ id: 'about', title: CORE_SCREENS[0].title, section: 'core' });
  });

  it('counts a screen once every visible field on it is answered', () => {
    const core = CORE_SCREENS.flatMap((s) => s.fields);
    expect(profileCompleteness(profileWith(core)).provided).toBe(CORE_SCREENS.length);
    // One of two fields on a screen does not complete it.
    expect(profileCompleteness(profileWith([CORE_SCREENS[0].fields[0]])).provided).toBe(0);
  });

  it('leaves hidden screens out of the total', () => {
    const base = getDefaultFinancialProfile();
    const withPlan = profileCompleteness({ ...base, workplace: { ...base.workplace, has401k: true } });
    const withoutPlan = profileCompleteness({ ...base, workplace: { ...base.workplace, has401k: false } });
    expect(withPlan.total - withoutPlan.total).toBe(1);
  });

  it('is complete when every profile path is answered', () => {
    const all = PROFILE_FORM.screens.flatMap((s) => s.fields);
    const result = profileCompleteness(profileWith(all));
    expect(result.missing).toEqual([]);
    expect(result.provided).toBe(result.total);
  });
});
