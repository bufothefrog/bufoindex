import { describe, expect, it } from 'vitest';
import {
  CORE_FORM,
  FORMS,
  PROFILE_FORM,
  PROFILE_FORM_ORDER,
  PROFILE_FORM_SECTION_LABELS,
  composeProfileForm,
  formForFlow,
  profileCompleteness,
  profileFormSection,
  requiredScreens,
  topicsAnsweredText,
} from '@/lib/calculators/forms';
import { CORE_SCREENS, PROFILE_EXTRA_SCREENS } from '@/lib/fields/shared';
import { makeGet } from '@/lib/fields/paths';
import {
  fieldMap,
  isFieldVisible,
  resolveText,
  screenPaths,
  screensFor,
  visibleScreenFields,
  visibleScreenNotes,
} from '@/lib/fields/runtime';
import type { CrossFieldRule, FieldSpec, FormSpec, Get, ScreenSpec } from '@/lib/fields/types';
import { profileReview } from '@/lib/calculators/profileReview';
import { getDefaultFinancialProfile, isProfilePath, normalizeProfile } from '@/lib/profile/defaults';
import { migrateProfile } from '@/lib/profile/migrate';
import type { FinancialProfile } from '@/lib/profile/types';
import { beginnerRaw, ownerRaw } from '@/test/factories/accountsFixtures';
import { defaultPayloadAt90ef4ed } from '@/test/factories/profile-90ef4ed-v2';

const ALL_FORMS: readonly FormSpec[] = [CORE_FORM, ...Object.values(FORMS), PROFILE_FORM];

/** The calculator forms in profile order, each with the label of the section its screens take. */
const PROFILE_PARTS = PROFILE_FORM_ORDER.map((id) => ({
  form: FORMS[id],
  label: id === 'leverage' ? PROFILE_FORM_SECTION_LABELS.portfolio : PROFILE_FORM_SECTION_LABELS[id],
}));

/** A calculator form's screens that the profile form draws from (optional ones included). */
const profileDrawn = (form: FormSpec) =>
  form.screens.filter(
    (screen) => screen.tier !== 'core' && screen.tier !== 'assumption' && (screen.surface ?? 'both') !== 'calculator'
  );

/** The ones it asks in each calculator's own section (the optional ones come last, apart). */
const profileEligible = (form: FormSpec) => profileDrawn(form).filter((screen) => !screen.optional);

/** The form whose eligible screens ask `path` first, in profile order (the core first). */
const firstAsker = (path: string): FormSpec | undefined =>
  [CORE_FORM, ...PROFILE_PARTS.map((part) => part.form)].find((form) =>
    (form === CORE_FORM ? form.screens : profileEligible(form)).some((screen) => screen.fields.includes(path))
  );

/**
 * The profile-only screens PROFILE_FORM keeps: none. The paycheck form asks
 * the emergency fund (cash-buffer's three fields) first, and the strategy
 * preset screen is gone.
 */
const KEPT_EXTRAS: string[] = [];

/** The optional screens of the calculator forms, which PROFILE_FORM asks after everything else. */
const OPTIONAL_IDS = ['ss-healthcare'];

/** The screens after the calculator sections: the kept extras, then the optional screens. */
const TAIL = KEPT_EXTRAS.length + OPTIONAL_IDS.length;

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
    expect(ids.slice(-TAIL)).toEqual([...KEPT_EXTRAS, ...OPTIONAL_IDS]);
    expect(PROFILE_EXTRA_SCREENS.map((screen) => screen.id).filter((id) => !KEPT_EXTRAS.includes(id))).toEqual(['cash-buffer']);
    expect(ids).not.toContain('cash-buffer');
    // Every kept screen comes from a form, in form order.
    const middle = ids.slice(CORE_SCREENS.length, -TAIL);
    expect(middle).toEqual(Array.from(new Set(fromForms)).filter((id) => middle.includes(id)));
  });

  it('asks each profile path once, keeping the first form that asks it', () => {
    const paths = PROFILE_FORM.screens.flatMap((screen) => screen.fields);
    expect(new Set(paths).size).toBe(paths.length);
    // With the provisional forms, retirement asks the invested balance and the
    // retirement age before leverage rewords them.
    const profileSpecs = fieldMap(PROFILE_FORM);
    for (const path of paths) {
      const source = firstAsker(path);
      if (source) expect(profileSpecs.get(path), path).toBe(fieldMap(source).get(path));
    }
  });

  it('drops a screen whose fields were all asked earlier, and keeps one that adds a field', () => {
    const asked = new Set(CORE_SCREENS.flatMap((screen) => screen.fields));
    const ids = new Set(CORE_SCREENS.map((screen) => screen.id));
    const expected: [string, string[]][] = [];
    for (const { form } of PROFILE_PARTS) {
      for (const screen of profileEligible(form)) {
        const added = screen.fields.filter((path) => !asked.has(path));
        if (added.length === 0) continue;
        const id = ids.has(screen.id) ? `${form.id}-${screen.id}` : screen.id;
        ids.add(id);
        expected.push([id, added]);
        for (const path of added) asked.add(path);
      }
    }
    const middle = PROFILE_FORM.screens.slice(CORE_SCREENS.length, PROFILE_FORM.screens.length - TAIL);
    expect(middle.map((screen) => [screen.id, screen.fields])).toEqual(expected);
    // Leverage's facts screen adds nothing: the age, the retirement age and the invested balance were asked
    // before it, and the taxable contribution on paycheck's ira-taxable screen. The leverage ratio left it.
    expect(PROFILE_FORM.screens.map((screen) => screen.id)).not.toContain('facts');
  });

  it('never asks a calculator-only screen (surface "calculator"): monthly investing, the claiming age, the new cash and the leverage ratio', () => {
    const calculatorOnly = PROFILE_FORM_ORDER.flatMap((id) =>
      FORMS[id].screens.filter((screen) => screen.surface === 'calculator')
    );
    expect(calculatorOnly.map((screen) => screen.id)).toEqual(['monthly-investing', 'claiming', 'new-cash', 'comparison']);
    const profilePaths = PROFILE_FORM.screens.flatMap((screen) => screen.fields);
    for (const path of [
      'strategy.leverageRatio',
      'retirementIncome.socialSecurityAge',
      'investing.monthlyContribution',
      'portfolio.newCash',
    ]) {
      expect(profilePaths, path).not.toContain(path);
      expect(fieldMap(PROFILE_FORM).has(path), path).toBe(false);
    }
    // Even a calculator-only screen whose fields no other screen asks stays out.
    const built = composeProfileForm(
      { id: 'core', fields: [], screens: [] },
      [
        {
          form: {
            id: 'calc',
            fields: [{ path: 'only', kind: 'number', label: 'Only', tier: 'details' }],
            screens: [{ id: 'page', title: 'Page', tier: 'details', surface: 'calculator', fields: ['only'] }],
          },
          section: 'retirement',
        },
      ],
      { id: 'extra', fields: [], screens: [] }
    );
    expect(built.form.screens).toEqual([]);
  });

  it('pins the profile order: paycheck, retirement, portfolio, then leverage (the yes/no answers before the accounts)', () => {
    expect(PROFILE_FORM_ORDER).toEqual(['paycheck', 'retirement', 'portfolio', 'leverage']);
  });

  it('asks the shared accounts screen once, in its own section "Accounts", and no removed path', () => {
    expect(PROFILE_FORM.screens.filter((s) => s.fields.includes('portfolio.accounts')).map((s) => s.id)).toEqual(['accounts']);
    expect(profileFormSection('accounts')).toBe('accounts');
    expect(PROFILE_FORM_SECTION_LABELS.accounts).toBe('Accounts');
    const paths = [CORE_FORM, ...Object.values(FORMS), PROFILE_FORM].flatMap((form) => form.screens.flatMap((s) => s.fields));
    for (const removed of ['investing.investedBalance', 'ira.traditionalBalance', 'ira.rothBalance']) {
      expect(paths, removed).not.toContain(removed);
    }
    expect(paths.some((path) => path.endsWith('.deposit'))).toBe(false);
  });

  it('walks the profile sections in order: the basics, each calculator, then the optional screens', () => {
    const walked = screensFor(PROFILE_FORM, makeGet(getDefaultFinancialProfile()), { mode: 'all', surface: 'intake' }).map(
      (screen) => profileFormSection(screen.id)
    );
    // Consecutive screens of one section collapse to one entry, so the forms can grow without changing this list.
    const sections = walked.filter((section, i) => i === 0 || section !== walked[i - 1]);
    expect(sections).toEqual(['core', 'paycheck', 'accounts', 'retirement', 'portfolio', 'optional']);
  });

  it('labels every screen with its section', () => {
    const middle = PROFILE_FORM.screens.slice(CORE_SCREENS.length, PROFILE_FORM.screens.length - TAIL);
    const labelOf = (id: string) =>
      id === 'accounts'
        ? PROFILE_FORM_SECTION_LABELS.accounts
        : PROFILE_PARTS.find(({ form }) => profileEligible(form).some((s) => s.id === id || `${form.id}-${s.id}` === id))!.label;
    expect(PROFILE_FORM.screens.map((screen) => PROFILE_FORM_SECTION_LABELS[profileFormSection(screen.id)!])).toEqual([
      ...CORE_SCREENS.map(() => 'The basics'),
      ...middle.map((screen) => labelOf(screen.id)),
      ...KEPT_EXTRAS.map(() => 'Cash'),
      ...OPTIONAL_IDS.map(() => 'Optional'),
    ]);
    expect(profileFormSection('nope')).toBeUndefined();
  });

  it('asks every optional screen of the calculator forms last, whole, in the section "Optional"', () => {
    const drawn = PROFILE_FORM_ORDER.flatMap((id) => profileDrawn(FORMS[id]).filter((screen) => screen.optional));
    expect(drawn.map((screen) => screen.id)).toEqual(OPTIONAL_IDS);
    const tail = PROFILE_FORM.screens.slice(-OPTIONAL_IDS.length);
    expect(tail.map((screen) => [screen.id, screen.fields, screen.optional])).toEqual(
      drawn.map((screen) => [screen.id, screen.fields, true])
    );
    expect(tail.map((screen) => profileFormSection(screen.id))).toEqual(OPTIONAL_IDS.map(() => 'optional'));
    expect(PROFILE_FORM_SECTION_LABELS.optional).toBe('Optional');
    // The retirement screen with the Social Security benefit and the healthcare cost; the claiming age is a
    // calculator-only control on the retirement page.
    expect(tail[0].fields).toEqual(['retirementIncome.socialSecurityBenefit', 'retirementIncome.annualHealthcareCost']);
  });

  it('puts an optional screen of the profile-only form in the section "Optional" too, after the calculator ones', () => {
    const screen = (id: string, optional?: boolean): ScreenSpec => ({ id, title: id, tier: 'details', fields: [id], optional });
    const field = (path: string): FieldSpec => ({ path, label: path, kind: 'number', tier: 'details' }) as FieldSpec;
    const built = composeProfileForm(
      { id: 'core', fields: [field('a')], screens: [screen('a')] },
      [
        {
          form: { id: 'calc', fields: [field('b'), field('c'), field('d')], screens: [screen('b', true), screen('c'), screen('d')] },
          section: 'retirement',
        },
      ],
      { id: 'extra', fields: [field('e'), field('f')], screens: [screen('e', true), screen('f')] }
    );
    expect(built.form.screens.map((s) => [s.id, built.sections.get(s.id)])).toEqual([
      ['a', 'core'],
      ['c', 'retirement'],
      ['d', 'retirement'],
      ['f', 'cash'],
      ['b', 'optional'],
      ['e', 'optional'],
    ]);
  });

  it('keeps one copy of each cross-field rule, in profile order', () => {
    const key = (rule: CrossFieldRule) => `${rule.lower}|${rule.upper}|${rule.checkOn}`;
    const keys = (PROFILE_FORM.relations ?? []).map(key);
    expect(new Set(keys).size).toBe(keys.length);
    const sources = [CORE_FORM, ...PROFILE_PARTS.map((part) => part.form)];
    expect(keys).toEqual(Array.from(new Set(sources.flatMap((form) => (form.relations ?? []).map(key)))));
    expect(keys[0]).toBe('income.netPerPaycheck|income.grossPerPaycheck|income.netPerPaycheck');
  });

  it('runs the shared derived writes once', () => {
    const get = makeGet(profileWith([], { person: { ...getDefaultFinancialProfile().person, age: 62, retirementAge: 60 } }));
    // No emergency-fund months are derived any more: only the retirement age is raised.
    expect(PROFILE_FORM.onSubmit?.(get, new Set())).toEqual([{ path: 'person.retirementAge', value: 63 }]);
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

describe('profileCompleteness (by topic screen)', () => {
  const topics = (profile: FinancialProfile) =>
    screensFor(PROFILE_FORM, makeGet(profile), { mode: 'all', surface: 'intake' });
  /** The screens completeness counts: every one but the optional ones. */
  const REQUIRED = PROFILE_FORM.screens.filter((s) => !OPTIONAL_IDS.includes(s.id));

  it('counts every visible required topic screen of the profile form', () => {
    const empty = profileCompleteness(getDefaultFinancialProfile());
    expect(empty.total).toBe(topics(getDefaultFinancialProfile()).length - OPTIONAL_IDS.length);
    expect(empty.total).toBe(REQUIRED.length);
    expect(empty.total).toBe(13);
    expect(empty.provided).toBe(0);
    expect(empty.missing.map((s) => s.id)).toEqual(REQUIRED.map((s) => s.id));
  });

  it('leaves the optional screens out of the count, answered or not', () => {
    const optionalPaths = PROFILE_FORM.screens.filter((s) => s.optional).flatMap((s) => s.fields);
    const rest = REQUIRED.flatMap((s) => s.fields);
    // A profile saved before the optional section: the three optional facts answered, or not.
    const withOptional = profileCompleteness(profileWith([...CORE_SCREENS[0].fields, ...optionalPaths]));
    const withoutOptional = profileCompleteness(profileWith([...CORE_SCREENS[0].fields]));
    expect(withOptional).toEqual(withoutOptional);
    expect(withOptional).toMatchObject({ provided: 1, total: 13 });
    expect(withOptional.missing.map((s) => s.id)).not.toContain('ss-healthcare');
    // Everything else answered is complete whether the optional facts are or not.
    expect(profileCompleteness(profileWith(rest))).toEqual({ provided: 13, total: 13, missing: [] });
    expect(profileCompleteness(profileWith([...rest, ...optionalPaths]))).toEqual({ provided: 13, total: 13, missing: [] });
  });

  it('counts the same answers against 13 topics where 3bb0132 counted 16', () => {
    // At 3bb0132 the required topics were the 3 basics, retirement savings and target, the 6 paycheck
    // screens, the 3 portfolio screens, the leverage ratio (leverage "facts", trimmed) and the strategy
    // preset: 16. The leverage ratio became calculator-only and the preset was removed, so the denominator
    // lost those two topics: 14. The emergency fund months joined the emergency fund screen, which adds
    // no topic. A visitor who had answered the basics, the ratio and the preset read "5 of 16"; the same
    // stored answers read "3 of 14" at 90ef4ed. Profile v3 folds the retirement savings screen (the invested
    // balance and the monthly contribution) into the shared accounts screen and the calculator-only monthly
    // investing, and asks the accounts once for every calculator: 13, so the same answers read "3 of 13".
    const answers = [...CORE_SCREENS.flatMap((s) => s.fields), 'strategy.leverageRatio', 'strategy.preset'];
    const result = profileCompleteness(profileWith(answers));
    expect(result).toMatchObject({ provided: 3, total: 13 });
    expect(topicsAnsweredText(result)).toBe('3 of 13 topics answered');
    expect(PROFILE_FORM.screens.map((s) => s.id)).toEqual([
      'about',
      'pay',
      'must-pay',
      'spending-bonus',
      'emergency-fund',
      '401k',
      'hsa',
      'ira-taxable',
      'debts',
      'accounts',
      'target',
      'targets',
      'holdings',
      'ss-healthcare',
    ]);
    // The emergency fund screen now asks the target months too, so a profile that answered its balance and
    // rate but not the months counts it as missing.
    const emergency = PROFILE_FORM.screens.find((s) => s.id === 'emergency-fund')!;
    expect(emergency.fields).toEqual(['cash.emergencyFundBalance', 'cash.emergencyFundApy', 'cash.targetMonths']);
    const partly = profileCompleteness(profileWith(['cash.emergencyFundBalance', 'cash.emergencyFundApy']));
    expect(partly.missing.map((s) => s.id)).toContain('emergency-fund');
  });

  it('keeps only the screens without the optional flag (requiredScreens)', () => {
    const screens: ScreenSpec[] = [
      { id: 'a', title: 'A', tier: 'details', fields: ['a'] },
      { id: 'b', title: 'B', tier: 'details', fields: ['b'], optional: true },
      { id: 'c', title: 'C', tier: 'details', fields: ['c'], optional: false },
    ];
    expect(requiredScreens(screens).map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('counts a screen once every fact on it is answered', () => {
    const core = CORE_SCREENS.flatMap((s) => s.fields);
    const partial = PROFILE_FORM.screens.slice(CORE_SCREENS.length).find((s) => s.fields.length > 1)!;
    const result = profileCompleteness(profileWith([...core, partial.fields[0]]));
    expect(result.provided).toBe(CORE_SCREENS.length);
    // A partly answered screen still counts as missing.
    expect(result.missing.map((s) => s.id)).toContain(partial.id);
    expect(result.provided + result.missing.length).toBe(result.total);
  });

  it('leaves out a screen with no visible fact', () => {
    const base = getDefaultFinancialProfile();
    const noPlan = profileWith([], { workplace: { ...base.workplace, has401k: false } });
    const get = makeGet(noPlan);
    const specs = fieldMap(PROFILE_FORM);
    const hidden = PROFILE_FORM.screens.filter((s) => !s.fields.some((path) => isFieldVisible(specs.get(path)!, get)));
    // Every screen of the grown paycheck form keeps a visible fact (the 401(k)
    // screen asks has401k itself), so no screen hides; screensFor's own tests
    // (test/lib/fields/runtime.test.ts) cover a screen with none.
    expect(hidden.map((s) => s.id)).toEqual([]);
    const result = profileCompleteness(noPlan);
    expect(result.total).toBe(REQUIRED.length - hidden.length);
    for (const screen of hidden) expect(result.missing.map((s) => s.id)).not.toContain(screen.id);
  });

  it('is complete when every profile path is answered', () => {
    const all = PROFILE_FORM.screens.flatMap((s) => s.fields);
    const result = profileCompleteness(profileWith(all));
    expect(result).toEqual({ provided: result.total, total: REQUIRED.length, missing: [] });
  });
});

describe('topicsAnsweredText', () => {
  it('reads the count the way every completeness card prints it', () => {
    expect(topicsAnsweredText({ provided: 3, total: 17 })).toBe('3 of 17 topics answered');
    expect(topicsAnsweredText({ provided: 0, total: 0 })).toBe('0 of 0 topics answered');
  });
});

describe('profile v3: the accounts screen, question counts and completeness (contract section 10)', () => {
  const required = (profile: FinancialProfile) =>
    requiredScreens(screensFor(PROFILE_FORM, makeGet(profile), { mode: 'all', surface: 'intake' }));
  const accountsScreen = PROFILE_FORM.screens.find((s) => s.id === 'accounts')!;

  it('never puts the new cash on the accounts screen: it is calculator-only', () => {
    expect(screenPaths(PROFILE_FORM, accountsScreen, makeGet(getDefaultFinancialProfile()))).not.toContain(
      'portfolio.newCash'
    );
    expect(accountsScreen.fields).toEqual(['portfolio.accounts']);
  });

  it('asks the beginner 11 required screens and 28 inputs, counting a list as one', () => {
    const beginner = normalizeProfile(beginnerRaw());
    const get = makeGet(beginner);
    const screens = required(beginner);
    expect(screens.map((s) => s.id)).toEqual([
      'about',
      'pay',
      'must-pay',
      'spending-bonus',
      'emergency-fund',
      '401k',
      'hsa',
      'ira-taxable',
      'debts',
      'accounts',
      'target',
    ]);
    const inputs = screens.map((s) => [s.id, visibleScreenFields(PROFILE_FORM, s, get).length]);
    expect(Object.fromEntries(inputs)).toEqual({
      about: 3,
      pay: 3,
      'must-pay': 1,
      'spending-bonus': 3,
      'emergency-fund': 3,
      '401k': 6,
      hsa: 1,
      'ira-taxable': 3,
      debts: 1,
      accounts: 1,
      target: 3,
    });
    expect(inputs.reduce((sum, [, count]) => sum + (count as number), 0)).toBe(28);
    expect(profileCompleteness(beginner).total).toBe(11);
  });

  it('moves the total between 11 and 13 as the rebalanced accounts and the holdings change', () => {
    // The default: the example brokerage has holdings, so the targets and holdings screens show.
    expect(profileCompleteness(getDefaultFinancialProfile()).total).toBe(13);
    // Answered with an empty brokerage that gets new cash: targets show, holdings do not.
    const base = getDefaultFinancialProfile();
    const noHoldings: FinancialProfile = {
      ...base,
      portfolio: { ...base.portfolio, holdings: [] },
      provided: ['portfolio.accounts'],
    };
    expect(profileCompleteness(noHoldings)).toMatchObject({ total: 12 });
    // No account is rebalanced (typed balances only, no taxable): both hide.
    const typed: FinancialProfile = {
      ...noHoldings,
      investing: { ...base.investing, taxableMonthlyContribution: 0 },
      portfolio: {
        ...noHoldings.portfolio,
        accounts: [{ id: 'acc-401k', kind: '401k', name: '', balance: 16225, holdsEmergencyFund: false }],
      },
    };
    expect(profileCompleteness(typed)).toMatchObject({ total: 11 });
  });

  it('loads a profile completed at 90ef4ed as 13 of 13', () => {
    const all = Array.from(new Set(PROFILE_FORM.screens.flatMap((s) => s.fields)));
    const v2Paths = [
      ...all.filter((path) => path !== 'portfolio.accounts'),
      'investing.investedBalance',
      'investing.monthlyContribution',
      'portfolio.accounts',
      'portfolio.holdings',
    ];
    const migrated = migrateProfile({ ...defaultPayloadAt90ef4ed(), provided: v2Paths }, 2);
    expect(profileCompleteness(migrated)).toEqual({ provided: 13, total: 13, missing: [] });
  });

  it('reviews the owner fixture with the account summary of the worked example', () => {
    const owner = normalizeProfile(ownerRaw());
    const topic = profileReview(owner)
      .groups.flatMap((group) => group.topics)
      .find((each) => each.id === 'accounts')!;
    expect(topic.status).toBe('answered');
    expect(topic.summary).toBe(
      '401(k) or similar $80,000; HSA $12,000; Roth IRA $10,050 (2 holdings); Brokerage $3,750 (1 holding); Robinhood $10,350 (1 holding) (emergency fund)'
    );
    expect(profileReview(owner).groups.map((group) => group.label)).toContain('Accounts');
  });

  it('hides the typed emergency fund for the owner and says where it is held', () => {
    const owner = normalizeProfile(ownerRaw());
    const get = makeGet(owner);
    const screen = PROFILE_FORM.screens.find((s) => s.id === 'emergency-fund')!;
    expect(visibleScreenFields(PROFILE_FORM, screen, get).map((spec) => spec.path)).toEqual([
      'cash.emergencyFundApy',
      'cash.targetMonths',
    ]);
    expect(visibleScreenNotes(screen, get).map((note) => resolveText(note.text, get))).toEqual([
      'Held in your accounts: Robinhood $10,350.',
    ]);
  });
});
