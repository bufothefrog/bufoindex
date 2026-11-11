/**
 * Tests for the dot-path helpers. setAt must copy only the containers along
 * the path, keep untouched branches by reference, and address list rows by
 * numeric segments.
 */

import { describe, expect, it } from 'vitest';
import { applyWrites, getAt, joinPath, makeGet, setAt, splitPath, toDotPath } from '@/lib/fields/paths';

const profile = {
  person: { age: 30, state: 'TX' },
  debts: [
    { id: 'a', balance: 1000 },
    { id: 'b', balance: 2500 },
  ],
  leverage: { years: null as number | null },
};

describe('splitPath and joinPath', () => {
  it('splits on dots and treats the empty path as the root', () => {
    expect(splitPath('debts.0.balance')).toEqual(['debts', '0', 'balance']);
    expect(splitPath('')).toEqual([]);
  });

  it('joins parts, numbers included, and skips empty parts', () => {
    expect(joinPath('debts', 1, 'balance')).toBe('debts.1.balance');
    expect(joinPath('', 'person', 'age')).toBe('person.age');
  });
});

describe('toDotPath', () => {
  it('rewrites bracket indexes and keys as dot segments', () => {
    expect(toDotPath('accounts[0].deposit')).toBe('accounts.0.deposit');
    expect(toDotPath('classTargets[acct-1].sum')).toBe('classTargets.acct-1.sum');
    expect(toDotPath('[2].name')).toBe('2.name');
    expect(toDotPath('person.age')).toBe('person.age');
  });
});

describe('getAt', () => {
  it('reads nested values and list rows', () => {
    expect(getAt(profile, 'person.age')).toBe(30);
    expect(getAt(profile, 'debts.1.balance')).toBe(2500);
    expect(getAt(profile, 'debts.1')).toEqual({ id: 'b', balance: 2500 });
  });

  it('returns the root for the empty path', () => {
    expect(getAt(profile, '')).toBe(profile);
  });

  it('returns undefined for missing segments, past-the-end rows and primitives', () => {
    expect(getAt(profile, 'person.missing')).toBeUndefined();
    expect(getAt(profile, 'debts.5.balance')).toBeUndefined();
    expect(getAt(profile, 'person.age.value')).toBeUndefined();
    expect(getAt(undefined, 'person')).toBeUndefined();
    expect(getAt(null, 'person')).toBeUndefined();
  });

  it('keeps null as a value, distinct from missing', () => {
    expect(getAt(profile, 'leverage.years')).toBeNull();
  });

  it('never resolves inherited members', () => {
    expect(getAt(profile, 'person.constructor')).toBeUndefined();
    expect(getAt(profile, 'person.toString')).toBeUndefined();
    expect(getAt(profile, 'debts.map')).toBeUndefined();
  });
});

describe('setAt', () => {
  it('replaces a nested value and shares every untouched branch', () => {
    const next = setAt(profile, 'person.age', 41);
    expect(next.person).toEqual({ age: 41, state: 'TX' });
    expect(next).not.toBe(profile);
    expect(next.person).not.toBe(profile.person);
    expect(next.debts).toBe(profile.debts);
    expect(next.leverage).toBe(profile.leverage);
    expect(profile.person.age).toBe(30);
  });

  it('writes a list row field by index, copying only that row and the list', () => {
    const next = setAt(profile, 'debts.1.balance', 3000);
    expect(Array.isArray(next.debts)).toBe(true);
    expect(next.debts).toEqual([
      { id: 'a', balance: 1000 },
      { id: 'b', balance: 3000 },
    ]);
    expect(next.debts).not.toBe(profile.debts);
    expect(next.debts[0]).toBe(profile.debts[0]);
    expect(next.debts[1]).not.toBe(profile.debts[1]);
    expect(next.person).toBe(profile.person);
    expect(profile.debts[1].balance).toBe(2500);
  });

  it('appends a row when the index equals the list length', () => {
    const next = setAt(profile, 'debts.2', { id: 'c', balance: 50 });
    expect(next.debts).toHaveLength(3);
    expect(next.debts[2]).toEqual({ id: 'c', balance: 50 });
    expect(profile.debts).toHaveLength(2);
  });

  it('refuses an index that would leave a hole, and a non-index segment on a list', () => {
    expect(() => setAt(profile, 'debts.4', {})).toThrow(RangeError);
    expect(() => setAt(profile, 'debts.first', {})).toThrow(RangeError);
  });

  it('returns the same reference when the value is unchanged', () => {
    expect(setAt(profile, 'person.age', 30)).toBe(profile);
    expect(setAt(profile, 'debts.0.balance', 1000)).toBe(profile);
    expect(setAt(profile, 'leverage.years', null)).toBe(profile);
  });

  it('writes even when the new value is undefined on a missing key', () => {
    const next = setAt(profile, 'person.nickname', undefined);
    expect(next).not.toBe(profile);
    expect(Object.keys(next.person)).toEqual(['age', 'state', 'nickname']);
  });

  it('creates missing containers: a list before a numeric segment, an object otherwise', () => {
    const next = setAt({} as Record<string, unknown>, 'portfolio.accounts.0.name', 'Roth IRA');
    expect(next).toEqual({ portfolio: { accounts: [{ name: 'Roth IRA' }] } });
    expect(Array.isArray(getAt(next, 'portfolio.accounts'))).toBe(true);
  });

  it('replaces null containers along the path', () => {
    const next = setAt({ a: null } as Record<string, unknown>, 'a.b', 1);
    expect(next).toEqual({ a: { b: 1 } });
  });

  it('replaces the root for the empty path', () => {
    expect(setAt(profile, '', 7)).toBe(7);
  });

  it('refuses to write through a primitive', () => {
    expect(() => setAt(profile, 'person.age.value', 1)).toThrow(TypeError);
  });

  it('refuses prototype-polluting segments', () => {
    expect(() => setAt({}, '__proto__.polluted', true)).toThrow(/unsafe segment/);
    expect(() => setAt({}, 'a.constructor', true)).toThrow(/unsafe segment/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('applyWrites', () => {
  it('applies writes in order, the later write to a path winning', () => {
    const next = applyWrites(profile, [
      { path: 'person.age', value: 35 },
      { path: 'debts.0.balance', value: 0 },
      { path: 'person.age', value: 36 },
    ]);
    expect(next.person.age).toBe(36);
    expect(next.debts[0].balance).toBe(0);
    expect(next.debts[1]).toBe(profile.debts[1]);
    expect(profile.person.age).toBe(30);
  });

  it('returns the input when there are no writes', () => {
    expect(applyWrites(profile, [])).toBe(profile);
  });
});

describe('makeGet', () => {
  it('reads paths from the bound values', () => {
    const get = makeGet(profile);
    expect(get('person.state')).toBe('TX');
    expect(get('debts.0.id')).toBe('a');
    expect(get('nope')).toBeUndefined();
  });
});
