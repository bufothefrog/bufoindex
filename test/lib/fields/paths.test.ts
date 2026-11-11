import { describe, expect, it } from 'vitest';
import {
  applyWrites,
  formatTestId,
  getAt,
  joinPath,
  makeGet,
  rowFieldPath,
  rowGet,
  setAt,
  splitPath,
} from '@/lib/fields/paths';

const values = {
  person: { age: 30, state: 'TX' },
  debts: [
    { id: 'a', balance: 1000 },
    { id: 'b', balance: 2500 },
  ],
  empty: null,
};

describe('splitPath / joinPath', () => {
  it('splits on dots and treats the empty path as the root', () => {
    expect(splitPath('debts.0.balance')).toEqual(['debts', '0', 'balance']);
    expect(splitPath('')).toEqual([]);
  });

  it('joins segments and skips empty ones', () => {
    expect(joinPath('debts', 2, 'balance')).toBe('debts.2.balance');
    expect(joinPath('', 'person', 'age')).toBe('person.age');
  });
});

describe('getAt', () => {
  it('reads nested object and array paths', () => {
    expect(getAt(values, 'person.age')).toBe(30);
    expect(getAt(values, 'debts.1.balance')).toBe(2500);
    expect(getAt(values, 'debts.0')).toEqual({ id: 'a', balance: 1000 });
    expect(getAt(values, '')).toBe(values);
  });

  it('returns undefined for missing steps, primitives, and non-index array keys', () => {
    expect(getAt(values, 'person.missing')).toBeUndefined();
    expect(getAt(values, 'debts.5.balance')).toBeUndefined();
    expect(getAt(values, 'person.age.value')).toBeUndefined();
    expect(getAt(values, 'empty.x')).toBeUndefined();
    expect(getAt(values, 'debts.length')).toBeUndefined();
    expect(getAt(values, 'person.toString')).toBeUndefined();
    expect(getAt(undefined, 'a')).toBeUndefined();
  });
});

describe('setAt', () => {
  it('writes immutably and shares untouched branches', () => {
    const next = setAt(values, 'debts.1.balance', 3000);
    expect(next.debts[1].balance).toBe(3000);
    expect(values.debts[1].balance).toBe(2500);
    expect(next).not.toBe(values);
    expect(next.debts).not.toBe(values.debts);
    expect(Array.isArray(next.debts)).toBe(true);
    expect(next.debts[0]).toBe(values.debts[0]);
    expect(next.person).toBe(values.person);
  });

  it('returns the same reference when the value is unchanged', () => {
    expect(setAt(values, 'person.age', 30)).toBe(values);
    expect(setAt(values, 'debts.0.balance', 1000)).toBe(values);
  });

  it('creates missing containers, arrays for index segments', () => {
    const next = setAt({} as Record<string, unknown>, 'a.0.b', 1);
    expect(next).toEqual({ a: [{ b: 1 }] });
    expect(Array.isArray(next.a)).toBe(true);
    expect(setAt({ x: 5 } as Record<string, unknown>, 'x.y', 2)).toEqual({ x: { y: 2 } });
  });

  it('appends at the end of an array and writes undefined explicitly', () => {
    const next = setAt(values, 'debts.2', { id: 'c', balance: 0 });
    expect(next.debts).toHaveLength(3);
    const cleared = setAt({ a: 1, b: 2 }, 'b', undefined);
    expect(cleared).toEqual({ a: 1, b: undefined });
    expect('b' in cleared).toBe(true);
  });

  it('replaces the root for the empty path', () => {
    expect(setAt(values, '', 7)).toBe(7);
  });
});

describe('applyWrites', () => {
  it('applies in order with later writes winning', () => {
    const next = applyWrites(values, [
      { path: 'person.age', value: 40 },
      { path: 'debts.0.balance', value: 0 },
      { path: 'person.age', value: 41 },
    ]);
    expect(next.person.age).toBe(41);
    expect(next.debts[0].balance).toBe(0);
    expect(values.person.age).toBe(30);
  });

  it('returns the input for no writes', () => {
    expect(applyWrites(values, [])).toBe(values);
  });
});

describe('makeGet / rowGet', () => {
  it('reads through a getter', () => {
    const get = makeGet(values);
    expect(get('person.state')).toBe('TX');
  });

  it('resolves row-relative paths and falls back to the root', () => {
    const get = rowGet(makeGet(values), 'debts', 1);
    expect(get('balance')).toBe(2500);
    expect(get('id')).toBe('b');
    expect(get('person.age')).toBe(30);
    expect(get('nothing')).toBeUndefined();
  });

  it('builds row paths and test ids', () => {
    expect(rowFieldPath('portfolio.accounts', 0, 'name')).toBe('portfolio.accounts.0.name');
    expect(formatTestId('account-name-{i}', 3)).toBe('account-name-3');
    expect(formatTestId('row-{i}-of-{i}', 2)).toBe('row-2-of-2');
    expect(formatTestId('plain', 1)).toBe('plain');
  });
});
