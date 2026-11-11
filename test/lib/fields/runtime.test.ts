import { describe, expect, it } from 'vitest';
import { makeGet } from '@/lib/fields/paths';
import {
  CALCULATION_ERROR_KEY,
  fieldMap,
  findField,
  formatFieldNumber,
  formatFieldValue,
  isFieldVisible,
  isScreenComplete,
  resolveOptions,
  resolveOverrideDefault,
  resolveText,
  screenErrors,
  screenPaths,
  screensFor,
  summarizeScreen,
  validateFields,
  visibleScreenFields,
} from '@/lib/fields/runtime';
import type { FieldSpec, FormSpec, Get } from '@/lib/fields/types';

const FIELDS: FieldSpec[] = [
  { path: 'person.age', kind: 'number', label: 'Age', min: 16, max: 100, required: true, tier: 'core' },
  { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', min: 30, max: 85, tier: 'details' },
  { path: 'person.name', kind: 'text', label: 'Name', maxLength: 5, tier: 'details' },
  { path: 'income.gross', kind: 'money', label: 'Gross pay', min: 0, tier: 'core' },
  { path: 'income.net', kind: 'money', label: 'Take-home pay', min: 0, tier: 'core' },
  {
    path: 'income.frequency',
    kind: 'select',
    label: 'Pay frequency',
    tier: 'core',
    options: [
      { value: 'weekly', label: 'Every week' },
      { value: 'monthly', label: 'Once a month' },
    ],
  },
  { path: 'workplace.has401k', kind: 'boolean', label: 'Has a 401(k)', tier: 'details' },
  {
    path: 'workplace.matchPercent',
    kind: 'percent',
    label: 'Match',
    min: 0,
    max: 2,
    tier: 'details',
    visibleWhen: (get) => get('workplace.has401k') === true,
  },
  {
    path: 'assumptions.mix',
    kind: 'choice',
    label: 'Mix',
    tier: 'assumption',
    options: (get) =>
      get('workplace.has401k') ? [{ value: 'a', label: 'Plan A' }] : [{ value: 'b', label: 'Plan B' }],
  },
  {
    path: 'assumptions.taxRate',
    kind: 'percent',
    label: 'Tax rate',
    min: 0,
    max: 0.5,
    tier: 'assumption',
    nullable: { autoLabel: (get) => `Auto (${get('person.age')})`, overrideDefault: (get) => (get('person.age') as number) / 100 },
  },
  {
    path: 'debts',
    kind: 'list',
    label: 'Debts',
    tier: 'details',
    maxRows: 2,
    row: [
      { path: 'name', kind: 'text', label: 'Name', required: true, tier: 'details' },
      { path: 'balance', kind: 'money', label: 'Balance', min: 0, tier: 'details' },
      {
        path: 'rate',
        kind: 'percent',
        label: 'Rate',
        min: 0,
        max: 0.5,
        tier: 'details',
        visibleWhen: (get) => (get('balance') as number) > 0,
      },
    ],
  },
  {
    path: 'portfolio.holdings',
    kind: 'custom',
    label: 'Holdings',
    tier: 'details',
    renderer: 'holdings',
    covers: ['portfolio.securities', 'portfolio.holdings'],
    summary: (value) => `${(value as unknown[]).length} holdings`,
  },
  { path: 'state', kind: 'state', label: 'State', tier: 'core', summary: () => null },
];

const FORM: FormSpec = {
  id: 'fixture',
  fields: FIELDS,
  screens: [
    { id: 'about', title: 'About you', tier: 'core', fields: ['person.age', 'state'] },
    { id: 'pay', title: 'Pay', tier: 'core', fields: ['income.gross', 'income.net', 'income.frequency'] },
    { id: 'retire', title: 'Retirement', tier: 'details', surface: 'intake', fields: ['person.retirementAge', 'person.name'] },
    { id: '401k', title: '401(k)', tier: 'details', fields: ['workplace.has401k', 'workplace.matchPercent'] },
    { id: 'match-only', title: 'Match only', tier: 'details', surface: 'calculator', fields: ['workplace.matchPercent'] },
    { id: 'debts', title: 'Debts', tier: 'details', fields: ['debts'] },
    { id: 'holdings', title: 'Holdings', tier: 'details', fields: ['portfolio.holdings'] },
    { id: 'assumptions', title: 'Assumptions', tier: 'assumption', fields: ['assumptions.mix', 'assumptions.taxRate'] },
  ],
  relations: [
    {
      lower: 'person.age',
      upper: 'person.retirementAge',
      strict: true,
      checkOn: 'person.retirementAge',
      message: 'Retirement age must be above your age.',
    },
    {
      lower: 'income.net',
      upper: 'income.gross',
      strict: false,
      checkOn: 'income.net',
      message: 'Take-home is above gross.',
    },
  ],
};

function baseValues() {
  return {
    person: { age: 30, retirementAge: 60, name: 'Ana' },
    income: { gross: 3500, net: 2600, frequency: 'weekly' },
    workplace: { has401k: true, matchPercent: 0.5 },
    assumptions: { mix: 'a', taxRate: null as number | null },
    debts: [
      { name: 'Card', balance: 1200, rate: 0.2 },
      { name: 'Loan', balance: 0, rate: 0.9 },
    ],
    portfolio: { holdings: [1, 2, 3], securities: [] },
    state: 'TX',
  };
}

const screen = (id: string) => {
  const found = FORM.screens.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('fieldMap / findField', () => {
  it('maps fields by path and caches per form', () => {
    const map = fieldMap(FORM);
    expect(map.get('person.age')?.label).toBe('Age');
    expect(fieldMap(FORM)).toBe(map);
  });

  it('throws on duplicate paths and unknown screen fields', () => {
    const dup: FormSpec = { id: 'dup', fields: [FIELDS[0], FIELDS[0]], screens: [] };
    expect(() => fieldMap(dup)).toThrow(/twice/);
    const unknown: FormSpec = { id: 'u', fields: [FIELDS[0]], screens: [{ id: 's', title: 'S', tier: 'core', fields: ['nope'] }] };
    expect(() => fieldMap(unknown)).toThrow(/unknown field 'nope'/);
  });

  it('finds list row specs by absolute path', () => {
    expect(findField(FORM, 'debts.1.balance')?.label).toBe('Balance');
    expect(findField(FORM, 'debts.1.missing')).toBeUndefined();
    expect(findField(FORM, 'person.unknown')).toBeUndefined();
    expect(findField(FORM, 'person.age.0.x')).toBeUndefined();
  });
});

describe('text, options, nullable defaults, visibility', () => {
  const get = makeGet(baseValues());

  it('resolves static and computed text', () => {
    expect(resolveText('Hello', get)).toBe('Hello');
    expect(resolveText((g) => `Age ${g('person.age')}`, get)).toBe('Age 30');
    expect(resolveText(undefined, get)).toBeUndefined();
  });

  it('resolves static, computed, and missing options', () => {
    expect(resolveOptions(FIELDS[5], get)).toHaveLength(2);
    expect(resolveOptions(FIELDS[8], get)[0].value).toBe('a');
    expect(resolveOptions(FIELDS[0], get)).toEqual([]);
  });

  it('resolves the nullable override default', () => {
    expect(resolveOverrideDefault(FIELDS[9], get)).toBe(0.3);
    expect(resolveOverrideDefault({ ...FIELDS[9], nullable: { autoLabel: 'Auto', overrideDefault: 0.15 } }, get)).toBe(0.15);
    expect(resolveOverrideDefault(FIELDS[0], get)).toBeUndefined();
  });

  it('follows visibleWhen', () => {
    expect(isFieldVisible(FIELDS[7], get)).toBe(true);
    expect(isFieldVisible(FIELDS[7], makeGet({ workplace: { has401k: false } }))).toBe(false);
    expect(isFieldVisible(FIELDS[0], get)).toBe(true);
  });
});

describe('visibleScreenFields / screenPaths', () => {
  it('keeps screen order and drops hidden fields', () => {
    const get = makeGet({ ...baseValues(), workplace: { has401k: false, matchPercent: 0.5 } });
    expect(visibleScreenFields(FORM, screen('401k'), get).map((s) => s.path)).toEqual(['workplace.has401k']);
  });

  it('includes covered sibling paths once', () => {
    expect(screenPaths(FORM, screen('holdings'), makeGet(baseValues()))).toEqual([
      'portfolio.holdings',
      'portfolio.securities',
    ]);
  });
});

describe('screensFor', () => {
  const get = makeGet(baseValues());
  const ids = (screens: { id: string }[]) => screens.map((s) => s.id);

  it('returns every screen with a visible field in all mode', () => {
    expect(ids(screensFor(FORM, get))).toEqual([
      'about',
      'pay',
      'retire',
      '401k',
      'match-only',
      'debts',
      'holdings',
      'assumptions',
    ]);
  });

  it('drops screens whose fields are all hidden', () => {
    const hidden = makeGet({ ...baseValues(), workplace: { has401k: false } });
    expect(ids(screensFor(FORM, hidden))).not.toContain('match-only');
    expect(ids(screensFor(FORM, hidden))).toContain('401k');
  });

  it('filters by surface and tier', () => {
    expect(ids(screensFor(FORM, get, { surface: 'intake' }))).not.toContain('match-only');
    expect(ids(screensFor(FORM, get, { surface: 'intake' }))).toContain('retire');
    expect(ids(screensFor(FORM, get, { surface: 'calculator' }))).not.toContain('retire');
    expect(ids(screensFor(FORM, get, { tiers: ['assumption'] }))).toEqual(['assumptions']);
  });

  it('remaining mode drops all-provided screens and keeps partly provided ones whole', () => {
    const provided = ['person.age', 'state', 'income.gross', 'workplace.has401k'];
    const remaining = screensFor(FORM, get, { mode: 'remaining', provided });
    expect(ids(remaining)).not.toContain('about');
    expect(ids(remaining)).toContain('pay');
    expect(ids(remaining)).toContain('401k');
    const pay = remaining.find((s) => s.id === 'pay');
    expect(pay && visibleScreenFields(FORM, pay, get)).toHaveLength(3);
  });

  it('remaining mode counts only visible fields and accepts a Set', () => {
    const noPlan = makeGet({ ...baseValues(), workplace: { has401k: false } });
    const remaining = screensFor(FORM, noPlan, { mode: 'remaining', provided: new Set(['workplace.has401k']) });
    expect(ids(remaining)).not.toContain('401k');
    expect(ids(screensFor(FORM, noPlan, { mode: 'remaining' }))).toContain('401k');
  });

  it('isScreenComplete matches remaining mode', () => {
    expect(isScreenComplete(FORM, screen('about'), get, ['person.age', 'state'])).toBe(true);
    expect(isScreenComplete(FORM, screen('about'), get, new Set(['person.age']))).toBe(false);
  });
});

describe('validateFields', () => {
  it('passes valid values', () => {
    expect(validateFields(FORM, makeGet(baseValues()))).toEqual({});
  });

  it('checks required, min/max, maxLength, options, booleans and numbers', () => {
    const values = baseValues() as Record<string, unknown> & ReturnType<typeof baseValues>;
    const get: Get = makeGet({
      ...values,
      person: { age: undefined, retirementAge: 90, name: 'Alexandra' },
      income: { gross: -1, net: Number.NaN, frequency: 'daily' },
      workplace: { has401k: 'yes', matchPercent: 3 },
      assumptions: { mix: 'b', taxRate: 0.6 },
      state: 7,
    });
    expect(validateFields(FORM, get)).toEqual({
      'person.age': 'Enter a value.',
      'person.retirementAge': 'Enter a value between 30 and 85.',
      'person.name': 'Use at most 5 characters.',
      'income.gross': 'Enter a value of at least $0.',
      'income.net': 'Enter a number.',
      'income.frequency': 'Choose one of the listed options.',
      'workplace.has401k': 'Choose yes or no.',
      'assumptions.mix': 'Choose one of the listed options.',
      'assumptions.taxRate': 'Enter a value between 0% and 50%.',
      state: 'Enter text.',
    });
  });

  it('uses at-most messages and rejects non-numbers in numeric fields', () => {
    const only = (spec: FieldSpec, value: unknown) =>
      validateFields({ id: 'x', fields: [spec], screens: [] }, makeGet({ v: value }));
    expect(only({ path: 'v', kind: 'money', label: 'V', max: 10, tier: 'core' }, 11)).toEqual({ v: 'Enter a value of at most $10.' });
    expect(only({ path: 'v', kind: 'number', label: 'V', min: 1, tier: 'core' }, 'x')).toEqual({ v: 'Enter a number.' });
    expect(only({ path: 'v', kind: 'number', label: 'V', tier: 'core' }, Infinity)).toEqual({ v: 'Enter a number.' });
    expect(only({ path: 'v', kind: 'number', label: 'V', tier: 'core' }, undefined)).toEqual({});
    expect(only({ path: 'v', kind: 'text', label: 'V', required: true, tier: 'core' }, '  ')).toEqual({ v: 'Enter a value.' });
    expect(only({ path: 'v', kind: 'list', label: 'V', required: true, tier: 'core' }, null)).toEqual({ v: 'Add at least one item.' });
    expect(only({ path: 'v', kind: 'list', label: 'V', tier: 'core' }, 'x')).toEqual({ v: 'Expected a list.' });
    expect(only({ path: 'v', kind: 'list', label: 'V', minRows: 1, tier: 'core' }, [])).toEqual({ v: 'Add at least one item.' });
    expect(only({ path: 'v', kind: 'list', label: 'V', minRows: 2, tier: 'core' }, [1])).toEqual({ v: 'Add at least 2 items.' });
    expect(only({ path: 'v', kind: 'custom', label: 'V', tier: 'core' }, { a: 1 })).toEqual({});
  });

  it('allows null on nullable fields', () => {
    const errors = validateFields(FORM, makeGet({ ...baseValues(), assumptions: { mix: 'a', taxRate: null } }));
    expect(errors['assumptions.taxRate']).toBeUndefined();
  });

  it('validates list bounds and visible row fields by absolute path', () => {
    const values = {
      ...baseValues(),
      debts: [
        { name: '', balance: -5, rate: 0.9 },
        { name: 'Loan', balance: 0, rate: 0.9 },
        { name: 'Car', balance: 10, rate: 0.1 },
      ],
    };
    expect(validateFields(FORM, makeGet(values))).toEqual({
      debts: 'Use at most 2 items.',
      'debts.0.name': 'Enter a value.',
      'debts.0.balance': 'Enter a value of at least $0.',
    });
    const hiddenRateRow = { ...baseValues(), debts: [{ name: 'Loan', balance: 1, rate: 0.9 }] };
    expect(validateFields(FORM, makeGet(hiddenRateRow))).toEqual({
      'debts.0.rate': 'Enter a value between 0% and 50%.',
    });
  });

  it('skips hidden fields', () => {
    const get = makeGet({
      ...baseValues(),
      workplace: { has401k: false, matchPercent: 99 },
      assumptions: { mix: 'b', taxRate: null },
    });
    expect(validateFields(FORM, get)).toEqual({});
  });

  it('checks strict and non-strict relations', () => {
    const atEqual = makeGet({ ...baseValues(), person: { age: 60, retirementAge: 60, name: 'A' }, income: { gross: 100, net: 100, frequency: 'weekly' } });
    expect(validateFields(FORM, atEqual)).toEqual({ 'person.retirementAge': 'Retirement age must be above your age.' });
    const netAbove = makeGet({ ...baseValues(), income: { gross: 100, net: 101, frequency: 'weekly' } });
    expect(validateFields(FORM, netAbove)).toEqual({ 'income.net': 'Take-home is above gross.' });
  });

  it('checks a relation only on the screen that shows checkOn', () => {
    const get = makeGet({ ...baseValues(), person: { age: 70, retirementAge: 65, name: 'A' } });
    expect(validateFields(FORM, get, { screen: screen('about') })).toEqual({});
    expect(validateFields(FORM, get, { screen: screen('retire') })).toEqual({
      'person.retirementAge': 'Retirement age must be above your age.',
    });
  });

  it('lets a field error win over a relation error and skips non-numeric relations', () => {
    const get = makeGet({ ...baseValues(), person: { age: 70, retirementAge: 20, name: 'A' } });
    expect(validateFields(FORM, get, { screen: screen('retire') })).toEqual({
      'person.retirementAge': 'Enter a value between 30 and 85.',
    });
    const missing = makeGet({ ...baseValues(), income: { gross: undefined, net: 5, frequency: 'weekly' } });
    expect(validateFields(FORM, missing, { screen: screen('pay') })).toEqual({});
    const nan = makeGet({ ...baseValues(), income: { gross: Number.NaN, net: 5, frequency: 'weekly' } });
    expect(validateFields(FORM, nan, { screen: screen('pay') })).toEqual({ 'income.gross': 'Enter a number.' });
  });
});

describe('screenErrors', () => {
  it('keeps errors on the screen paths and inside them', () => {
    const errors = { 'debts.0.name': 'x', debts: 'y', 'person.age': 'z', [CALCULATION_ERROR_KEY]: 'c', 'debtsExtra': 'no' };
    expect(screenErrors(FORM, screen('debts'), makeGet(baseValues()), errors)).toEqual({ 'debts.0.name': 'x', debts: 'y' });
  });
});

describe('formatting and summaries', () => {
  const get = makeGet(baseValues());

  it('formats numbers by kind', () => {
    expect(formatFieldNumber(FIELDS[3], 1234567.4)).toBe('$1,234,567');
    expect(formatFieldNumber(FIELDS[3], -50)).toBe('-$50');
    expect(formatFieldNumber(FIELDS[7], 0.065)).toBe('6.5%');
    expect(formatFieldNumber(FIELDS[0], 30)).toBe('30');
    expect(formatFieldNumber({ path: 'x', kind: 'slider', label: 'X', tier: 'core', unit: { suffix: 'x' } }, 2.25)).toBe('2.25x');
    expect(formatFieldNumber({ path: 'x', kind: 'number', label: 'X', tier: 'core', unit: { prefix: '~' } }, -1500.5)).toBe('~-1,500.5');
  });

  it('formats values for display', () => {
    expect(formatFieldValue(FIELDS[5], 'monthly', get)).toBe('Once a month');
    expect(formatFieldValue(FIELDS[6], false, get)).toBe('No');
    expect(formatFieldValue(FIELDS[9], null, get)).toBe('Auto (30)');
    expect(formatFieldValue(FIELDS[10], [1], get)).toBe('1 item');
    expect(formatFieldValue(FIELDS[10], [1, 2], get)).toBe('2 items');
    expect(formatFieldValue(FIELDS[2], 'Ana', get)).toBe('Ana');
    expect(formatFieldValue(FIELDS[2], '', get)).toBeNull();
    expect(formatFieldValue(FIELDS[11], { a: 1 }, get)).toBeNull();
    expect(formatFieldValue({ ...FIELDS[9], nullable: { autoLabel: () => undefined, overrideDefault: 0 } }, null, get)).toBeNull();
  });

  it('joins fragments and honours custom summaries', () => {
    expect(summarizeScreen(FORM, screen('pay'), get)).toBe('Gross pay: $3,500 · Take-home pay: $2,600 · Pay frequency: Every week');
    expect(summarizeScreen(FORM, screen('about'), get)).toBe('Age: 30');
    expect(summarizeScreen(FORM, screen('holdings'), get)).toBe('3 holdings');
    expect(summarizeScreen(FORM, screen('assumptions'), get)).toBe('Mix: Plan A · Tax rate: Auto (30)');
    const blank = makeGet({ ...baseValues(), income: { gross: undefined, net: 1, frequency: 'weekly' } });
    expect(summarizeScreen(FORM, screen('pay'), blank)).toBe('Take-home pay: $1 · Pay frequency: Every week');
  });
});
