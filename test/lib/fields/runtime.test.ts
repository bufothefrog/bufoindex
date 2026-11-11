/**
 * Tests for the field-schema runtime: screen selection ('all' and
 * 'remaining'), visibility, validation (field checks, list rows, relations),
 * summaries and the paths a screen answers. The form below is synthetic but
 * shaped like the paycheck and retirement forms in docs/rebuild-plan.md.
 */

import { describe, expect, it } from 'vitest';
import { makeGet, setAt } from '@/lib/fields/paths';
import {
  fieldError,
  fieldMap,
  isEmptyValue,
  isFieldVisible,
  listRows,
  relationErrors,
  resolveOptions,
  resolveOverrideDefault,
  resolveText,
  rowGet,
  screenPaths,
  screensFor,
  summarizeScreen,
  validateFields,
  visibleScreenFields,
  visibleScreenNotes,
} from '@/lib/fields/runtime';
import type { FieldSpec, FormSpec, Get, ScreenSpec } from '@/lib/fields/types';

const AGE: FieldSpec = {
  path: 'person.age', kind: 'number', label: 'Age', tier: 'core', required: true, min: 16, max: 100,
  summary: (value) => (typeof value === 'number' ? `age ${value}` : null),
};
const RETIREMENT_AGE: FieldSpec = {
  path: 'person.retirementAge', kind: 'number', label: 'Retirement age', tier: 'details', min: 30, max: 85,
  summary: (value) => `retire at ${String(value)}`,
};
const FILING: FieldSpec = {
  path: 'person.filingStatus', kind: 'select', label: 'Filing status', tier: 'core',
  options: [
    { value: 'single', label: 'Single' },
    { value: 'marriedJoint', label: 'Married filing jointly' },
  ],
};
const HAS_401K: FieldSpec = {
  path: 'workplace.has401k', kind: 'boolean', label: 'Has a 401(k)', tier: 'details',
  summary: (value) => (value ? '401(k)' : 'no 401(k)'),
};
const MATCH: FieldSpec = {
  path: 'workplace.matchPercent', kind: 'percent', label: 'Employer match', tier: 'details', min: 0, max: 2,
  required: true,
  visibleWhen: (get) => get('workplace.has401k') === true,
  summary: () => null,
};
const GROSS: FieldSpec = {
  path: 'income.grossPerPaycheck', kind: 'money', label: 'Gross pay', tier: 'core', min: 0,
};
const NET: FieldSpec = {
  path: 'income.netPerPaycheck', kind: 'money', label: 'Take-home pay', tier: 'core', min: 0,
};
const HEALTHCARE: FieldSpec = {
  path: 'retirementIncome.annualHealthcareCost', kind: 'money', label: 'Healthcare cost', tier: 'details',
  min: 0, max: 100000,
  nullable: {
    autoLabel: (get) => `Estimated from age ${String(get('person.age'))}`,
    overrideDefault: (get) => (get('person.age') as number) * 100,
  },
};
const DEBTS: FieldSpec = {
  path: 'debts', kind: 'list', label: 'Debts', tier: 'details', maxRows: 2,
  row: [
    { path: 'name', kind: 'text', label: 'Name', tier: 'details', required: true, maxLength: 10 },
    { path: 'balance', kind: 'money', label: 'Balance', tier: 'details', min: 0 },
    {
      path: 'interestRate', kind: 'percent', label: 'Interest rate', tier: 'details', min: 0, max: 0.5,
      visibleWhen: (get) => (get('balance') as number) > 0,
    },
  ],
};
const HOLDINGS: FieldSpec = {
  path: 'portfolio.holdings', kind: 'custom', label: 'Holdings', tier: 'details', renderer: 'holdings',
  covers: ['portfolio.securities', 'portfolio.holdings'],
};

const SCREENS: Record<string, ScreenSpec> = {
  about: { id: 'about', title: 'About you', tier: 'core', fields: ['person.age', 'person.filingStatus'] },
  pay: { id: 'pay', title: 'Pay', tier: 'core', fields: ['income.grossPerPaycheck', 'income.netPerPaycheck'] },
  target: {
    id: 'target', title: 'Target', tier: 'details', fields: ['person.retirementAge'],
    notes: [
      { text: 'Retirement age is checked against your age.' },
      { text: (get) => (get('person.age') === 65 ? 'Already 65.' : undefined), tone: 'caution' },
      { text: 'Hidden note', visibleWhen: () => false },
    ],
  },
  workplace: {
    id: 'workplace', title: '401(k)', tier: 'details', surface: 'intake',
    fields: ['workplace.has401k', 'workplace.matchPercent'],
  },
  match: { id: 'match', title: 'Match only', tier: 'details', fields: ['workplace.matchPercent'] },
  debts: { id: 'debts', title: 'Debts', tier: 'details', fields: ['debts'] },
  holdings: { id: 'holdings', title: 'Holdings', tier: 'details', surface: 'calculator', fields: ['portfolio.holdings'] },
  healthcare: { id: 'healthcare', title: 'Healthcare', tier: 'assumption', fields: ['retirementIncome.annualHealthcareCost'] },
};

const FORM: FormSpec = {
  id: 'test',
  fields: [AGE, RETIREMENT_AGE, FILING, HAS_401K, MATCH, GROSS, NET, HEALTHCARE, DEBTS, HOLDINGS],
  screens: Object.values(SCREENS),
  relations: [
    {
      lower: 'person.age', upper: 'person.retirementAge', strict: true, checkOn: 'person.retirementAge',
      message: 'The retirement age needs to be above your current age.',
    },
    {
      lower: 'income.netPerPaycheck', upper: 'income.grossPerPaycheck', strict: false,
      checkOn: 'income.netPerPaycheck', message: 'Take-home pay is above gross pay.',
    },
  ],
};

const VALUES = {
  person: { age: 30, retirementAge: 60, filingStatus: 'single' },
  income: { grossPerPaycheck: 3500, netPerPaycheck: 2600 },
  workplace: { has401k: false, matchPercent: 0.5 },
  retirementIncome: { annualHealthcareCost: null },
  debts: [{ name: 'Car', balance: 8000, interestRate: 0.07 }],
  portfolio: { holdings: [], securities: [] },
};

function getWith(...writes: [string, unknown][]): Get {
  let values: unknown = VALUES;
  for (const [path, value] of writes) values = setAt(values, path, value);
  return makeGet(values);
}

const ids = (screens: readonly ScreenSpec[]) => screens.map((screen) => screen.id);

describe('fieldMap', () => {
  it('keys every field by path and returns the same map for the same form', () => {
    const map = fieldMap(FORM);
    expect(map.get('debts')).toBe(DEBTS);
    expect(map.size).toBe(10);
    expect(fieldMap(FORM)).toBe(map);
  });

  it('throws on a path defined twice', () => {
    expect(() => fieldMap({ id: 'dup', fields: [AGE, AGE], screens: [] })).toThrow(
      'Form "dup" defines the field "person.age" twice'
    );
  });
});

describe('resolvers', () => {
  const get = getWith();

  it('resolveText passes strings through and calls functions', () => {
    expect(resolveText('Plain', get)).toBe('Plain');
    expect(resolveText(HEALTHCARE.nullable?.autoLabel, get)).toBe('Estimated from age 30');
    expect(resolveText(undefined, get)).toBeUndefined();
  });

  it('resolveOptions handles static lists, functions and no options', () => {
    expect(resolveOptions(FILING, get).map((option) => option.value)).toEqual(['single', 'marriedJoint']);
    const dynamic: FieldSpec = {
      ...FILING, options: (g) => [{ value: String(g('person.age')), label: 'Age' }],
    };
    expect(resolveOptions(dynamic, get)).toEqual([{ value: '30', label: 'Age' }]);
    expect(resolveOptions(AGE, get)).toEqual([]);
  });

  it('resolveOverrideDefault handles numbers, functions and non-nullable fields', () => {
    expect(resolveOverrideDefault(HEALTHCARE, get)).toBe(3000);
    expect(resolveOverrideDefault({ ...HEALTHCARE, nullable: { autoLabel: 'Auto', overrideDefault: 12 } }, get)).toBe(12);
    expect(resolveOverrideDefault(AGE, get)).toBeUndefined();
  });

  it('isFieldVisible follows visibleWhen and defaults to visible', () => {
    expect(isFieldVisible(AGE, get)).toBe(true);
    expect(isFieldVisible(MATCH, get)).toBe(false);
    expect(isFieldVisible(MATCH, getWith(['workplace.has401k', true]))).toBe(true);
  });

  it('rowGet reads relative to one row', () => {
    const row = rowGet(get, 'debts', 0);
    expect(row('balance')).toBe(8000);
    expect(row('person.age')).toBeUndefined();
  });

  it('listRows returns the rows, or nothing for a non-list', () => {
    expect(listRows(VALUES.debts)).toBe(VALUES.debts);
    expect(listRows(undefined)).toEqual([]);
    expect(listRows({ 0: 'x' })).toEqual([]);
  });

  it('isEmptyValue treats undefined, null, NaN, blank strings and empty lists as empty', () => {
    for (const value of [undefined, null, Number.NaN, '', '   ', []]) expect(isEmptyValue(value)).toBe(true);
    for (const value of [0, false, 'x', [0], {}]) expect(isEmptyValue(value)).toBe(false);
  });
});

describe('visibleScreenFields and visibleScreenNotes', () => {
  it('lists the visible fields in screen order', () => {
    expect(visibleScreenFields(FORM, SCREENS.workplace, getWith())).toEqual([HAS_401K]);
    expect(visibleScreenFields(FORM, SCREENS.workplace, getWith(['workplace.has401k', true]))).toEqual([
      HAS_401K,
      MATCH,
    ]);
  });

  it('throws when a screen lists a path the form does not define', () => {
    const bad: ScreenSpec = { id: 'bad', title: 'Bad', tier: 'core', fields: ['nope'] };
    expect(() => visibleScreenFields(FORM, bad, getWith())).toThrow(
      'Screen "bad" of form "test" lists "nope", which the form does not define'
    );
  });

  it('resolves visible notes with an info tone by default and drops empty ones', () => {
    expect(visibleScreenNotes(SCREENS.target, getWith())).toEqual([
      { text: 'Retirement age is checked against your age.', tone: 'info' },
    ]);
    expect(visibleScreenNotes(SCREENS.target, getWith(['person.age', 65]))).toEqual([
      { text: 'Retirement age is checked against your age.', tone: 'info' },
      { text: 'Already 65.', tone: 'caution' },
    ]);
    expect(visibleScreenNotes(SCREENS.about, getWith())).toEqual([]);
  });
});

describe('screensFor', () => {
  const ALL = ['about', 'pay', 'target', 'workplace', 'debts', 'holdings', 'healthcare'];

  it("'all' mode keeps every screen with a visible field, in form order", () => {
    // 'match' holds only the hidden match field, so it is dropped in every mode.
    expect(ids(screensFor(FORM, getWith(), { mode: 'all' }))).toEqual(ALL);
    expect(ids(screensFor(FORM, getWith(['workplace.has401k', true]), { mode: 'all' }))).toEqual([
      'about', 'pay', 'target', 'workplace', 'match', 'debts', 'holdings', 'healthcare',
    ]);
  });

  it("'all' mode ignores provided", () => {
    const provided = ['person.age', 'person.filingStatus'];
    expect(ids(screensFor(FORM, getWith(), { mode: 'all', provided }))).toEqual(ALL);
  });

  it("'remaining' mode drops a screen whose visible fields are all provided", () => {
    const provided = new Set(['person.age', 'person.filingStatus', 'debts']);
    expect(ids(screensFor(FORM, getWith(), { mode: 'remaining', provided }))).toEqual([
      'pay', 'target', 'workplace', 'holdings', 'healthcare',
    ]);
  });

  it("'remaining' mode keeps a partly provided screen", () => {
    const screens = screensFor(FORM, getWith(), { mode: 'remaining', provided: ['income.grossPerPaycheck'] });
    expect(ids(screens)).toContain('pay');
    // The renderer then shows every field of the kept screen.
    expect(visibleScreenFields(FORM, SCREENS.pay, getWith()).map((spec) => spec.path)).toEqual([
      'income.grossPerPaycheck',
      'income.netPerPaycheck',
    ]);
  });

  it("'remaining' mode counts only visible fields: a hidden unanswered field does not keep a screen", () => {
    const provided = ['workplace.has401k'];
    expect(ids(screensFor(FORM, getWith(), { mode: 'remaining', provided }))).not.toContain('workplace');
    // Once the field shows (401(k) is Yes), the unanswered match keeps the screen.
    expect(ids(screensFor(FORM, getWith(['workplace.has401k', true]), { mode: 'remaining', provided }))).toContain(
      'workplace'
    );
  });

  it("'remaining' mode reads a custom field by its own path, not its covers", () => {
    expect(ids(screensFor(FORM, getWith(), { mode: 'remaining', provided: ['portfolio.securities'] }))).toContain(
      'holdings'
    );
    expect(ids(screensFor(FORM, getWith(), { mode: 'remaining', provided: ['portfolio.holdings'] }))).not.toContain(
      'holdings'
    );
  });

  it("'remaining' mode reads a list by its list path, not its row paths", () => {
    expect(ids(screensFor(FORM, getWith(), { mode: 'remaining', provided: ['debts.0.balance'] }))).toContain('debts');
    expect(ids(screensFor(FORM, getWith(), { mode: 'remaining', provided: ['debts'] }))).not.toContain('debts');
  });

  it('filters by tier', () => {
    expect(ids(screensFor(FORM, getWith(), { mode: 'all', tiers: ['core'] }))).toEqual(['about', 'pay']);
    expect(ids(screensFor(FORM, getWith(), { mode: 'all', tiers: ['details', 'assumption'] }))).toEqual([
      'target', 'workplace', 'debts', 'holdings', 'healthcare',
    ]);
  });

  it('filters by surface, a screen without one counting as both', () => {
    expect(ids(screensFor(FORM, getWith(), { mode: 'all', surface: 'intake' }))).toEqual([
      'about', 'pay', 'target', 'workplace', 'debts', 'healthcare',
    ]);
    expect(ids(screensFor(FORM, getWith(), { mode: 'all', surface: 'calculator' }))).toEqual([
      'about', 'pay', 'target', 'debts', 'holdings', 'healthcare',
    ]);
    expect(ids(screensFor(FORM, getWith(), { mode: 'all', surface: 'both' }))).toEqual(ALL);
  });
});

describe('fieldError', () => {
  const get = getWith();

  it('requires a value only when the field is required', () => {
    expect(fieldError(AGE, undefined, get)).toBe('Age is required.');
    expect(fieldError(AGE, Number.NaN, get)).toBe('Age is required.');
    expect(fieldError(RETIREMENT_AGE, undefined, get)).toBeUndefined();
    expect(fieldError({ ...FILING, required: true }, '', get)).toBe('Filing status is required.');
  });

  it('reports a range when both bounds are set, formatted for the kind', () => {
    expect(fieldError(AGE, 15, get)).toBe('Age must be between 16 and 100.');
    expect(fieldError(AGE, 101, get)).toBe('Age must be between 16 and 100.');
    expect(fieldError(AGE, 16, get)).toBeUndefined();
    expect(fieldError(AGE, 100, get)).toBeUndefined();
    expect(fieldError(MATCH, 2.5, get)).toBe('Employer match must be between 0% and 200%.');
    expect(fieldError(HEALTHCARE, 100001, get)).toBe('Healthcare cost must be between $0 and $100,000.');
  });

  it('reports a single bound when only one is set', () => {
    expect(fieldError(GROSS, -1, get)).toBe('Gross pay must be at least $0.');
    expect(fieldError({ ...GROSS, min: undefined, max: -0.5 }, 1, get)).toBe('Gross pay must be at most -$0.5.');
    const months: FieldSpec = { path: 'm', kind: 'number', label: 'Months', tier: 'details', min: 0.5, unit: { suffix: ' mo' } };
    expect(fieldError(months, 0, get)).toBe('Months must be at least 0.5 mo.');
  });

  it('rejects non-numbers in numeric kinds', () => {
    expect(fieldError(GROSS, '3500', get)).toBe('Gross pay must be a number.');
    expect(fieldError(MATCH, true, get)).toBe('Employer match must be a number.');
  });

  it('accepts null in a nullable field (derive) but treats it as empty elsewhere', () => {
    expect(fieldError({ ...HEALTHCARE, required: true }, null, get)).toBeUndefined();
    expect(fieldError(HEALTHCARE, -5, get)).toBe('Healthcare cost must be between $0 and $100,000.');
    expect(fieldError(AGE, null, get)).toBe('Age is required.');
  });

  it('enforces maxLength on text', () => {
    const name: FieldSpec = { path: 'n', kind: 'text', label: 'Name', tier: 'details', maxLength: 3 };
    expect(fieldError(name, 'abc', get)).toBeUndefined();
    expect(fieldError(name, 'abcd', get)).toBe('Name must be 3 characters or fewer.');
  });

  it('enforces option membership with strict equality', () => {
    expect(fieldError(FILING, 'marriedJoint', get)).toBeUndefined();
    expect(fieldError(FILING, 'headOfHousehold', get)).toBe('Filing status must be one of the listed options.');
    const numeric: FieldSpec = {
      path: 'r', kind: 'choice', label: 'Ratio', tier: 'details', options: [{ value: 2, label: '2x' }],
    };
    expect(fieldError(numeric, '2', get)).toBe('Ratio must be one of the listed options.');
  });

  it('checks list row counts', () => {
    expect(fieldError(DEBTS, [{}, {}, {}], get)).toBe('Debts allows at most 2 entries.');
    // minRows > 0 rejects an empty list even when the field is not required.
    expect(fieldError({ ...DEBTS, minRows: 1 }, [], get)).toBe('Debts needs at least 1 entry.');
    expect(fieldError({ ...DEBTS, minRows: 0 }, [], get)).toBeUndefined();
    expect(fieldError(DEBTS, [], get)).toBeUndefined();
    expect(fieldError({ ...DEBTS, minRows: 2 }, [{}], get)).toBe('Debts needs at least 2 entries.');
    expect(fieldError({ ...DEBTS, minRows: 1, maxRows: 1 }, [{}, {}], get)).toBe('Debts allows at most 1 entry.');
    expect(fieldError({ ...DEBTS, required: true }, [], get)).toBe('Debts is required.');
  });
});

describe('fieldError with non-finite numbers', () => {
  const get = getWith();

  it('rejects Infinity and -Infinity whatever bounds are set', () => {
    expect(fieldError(GROSS, Number.POSITIVE_INFINITY, get)).toBe('Gross pay must be a number.');
    expect(fieldError(GROSS, Number.NEGATIVE_INFINITY, get)).toBe('Gross pay must be a number.');
    const unbounded: FieldSpec = { path: 'n', kind: 'number', label: 'Count', tier: 'details' };
    expect(fieldError(unbounded, Number.NEGATIVE_INFINITY, get)).toBe('Count must be a number.');
    expect(fieldError(unbounded, 3, get)).toBeUndefined();
  });

  it('reports an empty minRows list through validateFields', () => {
    const form: FormSpec = { id: 'f', fields: [{ ...DEBTS, minRows: 1 }], screens: [] };
    expect(validateFields(form, getWith(['debts', []]))).toEqual({ debts: 'Debts needs at least 1 entry.' });
  });
});

describe('validateFields', () => {
  it('returns no errors for valid values', () => {
    expect(validateFields(FORM, getWith())).toEqual({});
  });

  it('keys field errors by path across the whole form', () => {
    const errors = validateFields(FORM, getWith(['person.age', 10], ['person.filingStatus', 'x']));
    expect(errors).toEqual({
      'person.age': 'Age must be between 16 and 100.',
      'person.filingStatus': 'Filing status must be one of the listed options.',
    });
  });

  it('skips hidden fields', () => {
    expect(validateFields(FORM, getWith(['workplace.matchPercent', 9]))).toEqual({});
    expect(validateFields(FORM, getWith(['workplace.matchPercent', 9], ['workplace.has401k', true]))).toEqual({
      'workplace.matchPercent': 'Employer match must be between 0% and 200%.',
    });
  });

  it('limits validation to one screen when given', () => {
    const get = getWith(['person.age', 10], ['income.netPerPaycheck', -1]);
    expect(validateFields(FORM, get, { screen: SCREENS.pay })).toEqual({
      'income.netPerPaycheck': 'Take-home pay must be at least $0.',
    });
  });

  it('validates list rows by absolute row path, with row-scoped visibility', () => {
    const get = getWith([
      'debts',
      [
        { name: 'Credit card', balance: -1, interestRate: 0.9 },
        { name: '', balance: 100, interestRate: 0.9 },
      ],
    ]);
    expect(validateFields(FORM, get, { screen: SCREENS.debts })).toEqual({
      'debts.0.name': 'Name must be 10 characters or fewer.',
      'debts.0.balance': 'Balance must be at least $0.',
      // Row 0's rate is hidden (balance not above 0), so only row 1's is checked.
      'debts.1.name': 'Name is required.',
      'debts.1.interestRate': 'Interest rate must be between 0% and 50%.',
    });
  });

  it('reports the list error and still validates its rows', () => {
    const rows = [{ name: 'A', balance: -1 }, { name: 'B' }, { name: 'C' }];
    expect(validateFields(FORM, getWith(['debts', rows]), { screen: SCREENS.debts })).toEqual({
      debts: 'Debts allows at most 2 entries.',
      'debts.0.balance': 'Balance must be at least $0.',
    });
  });

  it('checks a strict relation: equal values fail', () => {
    const get = getWith(['person.retirementAge', 30]);
    expect(validateFields(FORM, get)).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
    expect(validateFields(FORM, getWith(['person.retirementAge', 31]))).toEqual({});
  });

  it('checks a non-strict relation: equal values pass, greater fail', () => {
    expect(validateFields(FORM, getWith(['income.netPerPaycheck', 3500]))).toEqual({});
    expect(validateFields(FORM, getWith(['income.netPerPaycheck', 3600]))).toEqual({
      'income.netPerPaycheck': 'Take-home pay is above gross pay.',
    });
  });

  it('checks a relation on a screen only when checkOn is on that screen', () => {
    const get = getWith(['person.retirementAge', 25]);
    // Age is on 'about', but the relation is checked on retirement age.
    expect(validateFields(FORM, get, { screen: SCREENS.about })).toEqual({});
    expect(validateFields(FORM, get, { screen: SCREENS.target })).toEqual({
      'person.retirementAge': 'Retirement age must be between 30 and 85.',
    });
    expect(relationErrors(FORM, get, { screen: SCREENS.target })).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
    expect(relationErrors(FORM, get, { screen: SCREENS.about })).toEqual({});
  });

  it('lets a field error win over a relation error on the same path', () => {
    const errors = validateFields(FORM, getWith(['person.retirementAge', 20]));
    expect(errors['person.retirementAge']).toBe('Retirement age must be between 30 and 85.');
  });

  it('skips a relation when an end is not a finite number or names a hidden field', () => {
    expect(relationErrors(FORM, getWith(['person.age', undefined], ['person.retirementAge', 20]))).toEqual({});
    expect(relationErrors(FORM, getWith(['income.netPerPaycheck', Number.POSITIVE_INFINITY]))).toEqual({});
    const hidden: FormSpec = {
      ...FORM,
      relations: [{ lower: 'workplace.matchPercent', upper: 'person.age', strict: false, checkOn: 'person.age', message: 'x' }],
    };
    const get = getWith(['workplace.matchPercent', 99]);
    expect(relationErrors(hidden, get)).toEqual({});
    expect(relationErrors(hidden, getWith(['workplace.matchPercent', 99], ['workplace.has401k', true]))).toEqual({
      'person.age': 'x',
    });
  });

  it('keeps the first relation message when two relations share checkOn', () => {
    const twice: FormSpec = {
      ...FORM,
      relations: [
        { lower: 'person.retirementAge', upper: 'person.age', strict: false, checkOn: 'person.age', message: 'first' },
        { lower: 'income.grossPerPaycheck', upper: 'person.age', strict: false, checkOn: 'person.age', message: 'second' },
      ],
    };
    expect(relationErrors(twice, getWith())).toEqual({ 'person.age': 'first' });
  });

  it('reports a relation keyed by a path that shares a name with an Object member', () => {
    const odd: FormSpec = {
      ...FORM,
      relations: [{ lower: 'person.retirementAge', upper: 'person.age', strict: false, checkOn: 'valueOf', message: 'odd' }],
    };
    expect(relationErrors(odd, getWith())).toEqual({ valueOf: 'odd' });
    expect(validateFields(odd, getWith())).toEqual({ valueOf: 'odd' });
  });

  it('accepts a nullable field holding null', () => {
    expect(validateFields(FORM, getWith(), { screen: SCREENS.healthcare })).toEqual({});
  });
});

describe('summarizeScreen', () => {
  it('joins the non-empty fragments of the visible fields in screen order', () => {
    expect(summarizeScreen(FORM, SCREENS.about, getWith())).toBe('age 30');
    expect(summarizeScreen(FORM, SCREENS.target, getWith())).toBe('retire at 60');
    expect(summarizeScreen(FORM, SCREENS.workplace, getWith(['workplace.has401k', true]))).toBe('401(k)');
  });

  it('returns an empty string when no field summarizes', () => {
    expect(summarizeScreen(FORM, SCREENS.pay, getWith())).toBe('');
    expect(summarizeScreen(FORM, SCREENS.about, getWith(['person.age', undefined]))).toBe('');
  });

  it('passes the value and get to the summary', () => {
    const form: FormSpec = {
      id: 's',
      fields: [
        AGE,
        { ...FILING, summary: (value, get) => `${String(value)} at ${String(get('person.age'))}` },
      ],
      screens: [SCREENS.about],
    };
    expect(summarizeScreen(form, SCREENS.about, getWith())).toBe('age 30, single at 30');
  });
});

describe('screenPaths', () => {
  it('lists the visible field paths in screen order', () => {
    expect(screenPaths(FORM, SCREENS.pay, getWith())).toEqual(['income.grossPerPaycheck', 'income.netPerPaycheck']);
  });

  it('leaves out hidden fields', () => {
    expect(screenPaths(FORM, SCREENS.workplace, getWith())).toEqual(['workplace.has401k']);
    expect(screenPaths(FORM, SCREENS.workplace, getWith(['workplace.has401k', true]))).toEqual([
      'workplace.has401k',
      'workplace.matchPercent',
    ]);
  });

  it('gives a list its list path only', () => {
    expect(screenPaths(FORM, SCREENS.debts, getWith())).toEqual(['debts']);
  });

  it('adds the covers of a custom field after its own path, deduplicated', () => {
    expect(screenPaths(FORM, SCREENS.holdings, getWith())).toEqual(['portfolio.holdings', 'portfolio.securities']);
  });
});
