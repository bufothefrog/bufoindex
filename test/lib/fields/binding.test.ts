/**
 * Tests for profile <-> engine bindings: the forward mapping, the reverse
 * mapping used by the legacy storage import, the round trip for 1:1 and
 * derived bindings, engine-error mapping, and stableKey.
 */

import { describe, expect, it } from 'vitest';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import {
  engineErrorsToFields,
  fromEngineInputs,
  isDerivedBinding,
  stableKey,
  toEngineInputs,
} from '@/lib/fields/binding';
import type { Binding } from '@/lib/fields/binding';

interface Engine {
  age: number;
  taxes: { state: string; federalBracket: number };
  debts: { balance: number }[];
  years: number;
  hasIRA: boolean;
  label: string;
}

const engineBase = (): Engine => ({
  age: 0,
  taxes: { state: '', federalBracket: 0.22 },
  debts: [],
  years: 0,
  hasIRA: false,
  label: 'base',
});

const profile = {
  person: { age: 40, state: 'CA', retirementAge: 65 },
  debts: [{ balance: 900 }],
  leverage: { years: null as number | null },
  ira: { traditional: false, roth: true },
};

/** Clamped years from the ages unless overridden, as in plan section 2.5. */
const YEARS: Binding<Engine> = {
  engine: 'years',
  read: (get) => {
    const override = get('leverage.years');
    if (typeof override === 'number') return override;
    const span = Math.round((get('person.retirementAge') as number) - (get('person.age') as number));
    return Math.min(60, Math.max(1, span));
  },
  write: (value) => [{ path: 'leverage.years', value }],
  errorPath: 'leverage.years',
};

const BINDINGS: Binding<Engine>[] = [
  { profile: 'person.age', engine: 'age' },
  { profile: 'person.state', engine: 'taxes.state' },
  { profile: 'debts', engine: 'debts' },
  YEARS,
  {
    engine: 'hasIRA',
    read: (get) => get('ira.traditional') === true || get('ira.roth') === true,
  },
];

describe('isDerivedBinding', () => {
  it('tells derived bindings from 1:1 bindings', () => {
    expect(isDerivedBinding(BINDINGS[0])).toBe(false);
    expect(isDerivedBinding(YEARS)).toBe(true);
  });
});

describe('toEngineInputs', () => {
  it('copies 1:1 values, computes derived ones and keeps unbound base values', () => {
    expect(toEngineInputs(BINDINGS, engineBase(), makeGet(profile))).toEqual({
      age: 40,
      taxes: { state: 'CA', federalBracket: 0.22 },
      debts: [{ balance: 900 }],
      years: 25,
      hasIRA: true,
      label: 'base',
    });
  });

  it('uses a derived override when set and clamps the derived value otherwise', () => {
    const overridden = applyWrites(profile, [{ path: 'leverage.years', value: 7 }]);
    expect(toEngineInputs(BINDINGS, engineBase(), makeGet(overridden)).years).toBe(7);
    const late = applyWrites(profile, [{ path: 'person.age', value: 70 }]);
    expect(toEngineInputs(BINDINGS, engineBase(), makeGet(late)).years).toBe(1);
  });

  it('keeps the base value when a 1:1 profile value is undefined, and copies null', () => {
    const get = makeGet({ person: { age: null } });
    const engine = toEngineInputs([BINDINGS[0], BINDINGS[1]], engineBase(), get);
    expect(engine.age).toBeNull();
    expect(engine.taxes.state).toBe('');
  });

  it('does not mutate the base', () => {
    const base = engineBase();
    toEngineInputs(BINDINGS, base, makeGet(profile));
    expect(base).toEqual(engineBase());
  });

  it('lets a later binding to the same engine path win', () => {
    const bindings: Binding<Engine>[] = [
      { profile: 'person.age', engine: 'age' },
      { engine: 'age', read: () => 99 },
    ];
    expect(toEngineInputs(bindings, engineBase(), makeGet(profile)).age).toBe(99);
  });
});

describe('fromEngineInputs', () => {
  it('produces 1:1 writes and derived writes, skipping one-way bindings', () => {
    const engine: Engine = { ...engineBase(), age: 52, taxes: { state: 'NY', federalBracket: 0.22 }, years: 12 };
    expect(fromEngineInputs(BINDINGS, engine)).toEqual([
      { path: 'person.age', value: 52 },
      { path: 'person.state', value: 'NY' },
      { path: 'debts', value: [] },
      { path: 'leverage.years', value: 12 },
    ]);
  });

  it('skips 1:1 bindings whose engine value is undefined', () => {
    const partial = { age: 33 } as unknown as Engine;
    expect(fromEngineInputs([BINDINGS[0], BINDINGS[1]], partial)).toEqual([{ path: 'person.age', value: 33 }]);
  });

  it('passes the whole engine to a derived write', () => {
    const binding: Binding<Engine> = {
      engine: 'years',
      read: () => 0,
      write: (value, engine) => [{ path: 'note', value: `${String(value)} for ${engine.label}` }],
    };
    expect(fromEngineInputs([binding], { ...engineBase(), years: 3 })).toEqual([{ path: 'note', value: '3 for base' }]);
  });
});

describe('round trip', () => {
  it('1:1 bindings: engine -> profile writes -> engine reproduces the bound values', () => {
    const direct = BINDINGS.filter((binding) => !isDerivedBinding(binding));
    const engine: Engine = {
      ...engineBase(),
      age: 47,
      taxes: { state: 'WA', federalBracket: 0.22 },
      debts: [{ balance: 10 }, { balance: 20 }],
    };
    const next = applyWrites(profile, fromEngineInputs(direct, engine));
    expect(next.person).toEqual({ age: 47, state: 'WA', retirementAge: 65 });
    expect(toEngineInputs(direct, engineBase(), makeGet(next))).toEqual(engine);
  });

  it('derived binding with write: the engine value survives the trip through the profile', () => {
    const engine: Engine = { ...engineBase(), years: 18 };
    const next = applyWrites(profile, fromEngineInputs([YEARS], engine));
    expect(next.leverage.years).toBe(18);
    expect(toEngineInputs([YEARS], engineBase(), makeGet(next)).years).toBe(18);
  });

  it('profile -> engine -> profile writes leaves the profile unchanged for 1:1 bindings', () => {
    const direct = BINDINGS.filter((binding) => !isDerivedBinding(binding));
    const engine = toEngineInputs(direct, engineBase(), makeGet(profile));
    expect(applyWrites(profile, fromEngineInputs(direct, engine))).toBe(profile);
  });
});

describe('engineErrorsToFields', () => {
  it('maps 1:1 engine paths to profile paths', () => {
    expect(engineErrorsToFields(BINDINGS, { age: 'Too young.', 'taxes.state': 'Pick a state.' })).toEqual({
      'person.age': 'Too young.',
      'person.state': 'Pick a state.',
    });
  });

  it('keeps the row suffix under a 1:1 list binding, reading bracket keys as dot paths', () => {
    expect(engineErrorsToFields(BINDINGS, { 'debts[1].balance': 'Balance cannot be negative.' })).toEqual({
      'debts.1.balance': 'Balance cannot be negative.',
    });
  });

  it('maps derived bindings to errorPath, or to calculation without one', () => {
    expect(engineErrorsToFields(BINDINGS, { years: 'Too long.' })).toEqual({ 'leverage.years': 'Too long.' });
    expect(engineErrorsToFields(BINDINGS, { hasIRA: 'Bad.' })).toEqual({ calculation: 'Bad.' });
  });

  it('maps unbound paths, and segment-boundary near misses, to calculation, keeping the first message', () => {
    expect(
      engineErrorsToFields(BINDINGS, {
        'taxes.federalBracket': 'Bracket out of range.',
        ages: 'Not the age binding.',
      })
    ).toEqual({ calculation: 'Bracket out of range.' });
  });

  it('prefers the longest matching engine path', () => {
    const bindings: Binding<Engine>[] = [
      { profile: 'tax', engine: 'taxes' },
      { profile: 'person.state', engine: 'taxes.state' },
    ];
    expect(engineErrorsToFields(bindings, { 'taxes.state': 'a', 'taxes.federalBracket': 'b' })).toEqual({
      'person.state': 'a',
      'tax.federalBracket': 'b',
    });
  });

  it('sends an error to the binding whose value toEngineInputs keeps when two share an engine path', () => {
    const bindings: Binding<Engine>[] = [
      { profile: 'person.age', engine: 'age' },
      { engine: 'age', read: () => 99, errorPath: 'override.age' },
    ];
    expect(toEngineInputs(bindings, engineBase(), makeGet(profile)).age).toBe(99);
    expect(engineErrorsToFields(bindings, { age: 'bad' })).toEqual({ 'override.age': 'bad' });
  });

  it('keeps an error whose target path shares a name with an Object member', () => {
    const bindings: Binding<Engine>[] = [{ profile: 'toString', engine: 'age' }];
    expect(engineErrorsToFields(bindings, { age: 'Too young.' })).toEqual({ toString: 'Too young.' });
  });

  it('returns no errors for no input', () => {
    expect(engineErrorsToFields(BINDINGS, {})).toEqual({});
  });
});

describe('stableKey', () => {
  it('is independent of key order at every depth', () => {
    const a = { b: 1, a: { y: [1, { q: 2, p: 1 }], x: 'x' } };
    const b = { a: { x: 'x', y: [1, { p: 1, q: 2 }] }, b: 1 };
    expect(stableKey(a)).toBe(stableKey(b));
    expect(stableKey(a)).toBe('{"a":{"x":"x","y":[1,{"p":1,"q":2}]},"b":1}');
  });

  it('distinguishes different values and list order', () => {
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }));
    expect(stableKey([1, 2])).not.toBe(stableKey([2, 1]));
    expect(stableKey({ a: '1' })).not.toBe(stableKey({ a: 1 }));
  });

  it('follows JSON for undefined and functions, but keeps non-finite numbers distinct from null', () => {
    expect(stableKey({ a: undefined, b: () => 1, c: null })).toBe('{"c":null}');
    expect(stableKey([undefined, Symbol('s')])).toBe('[null,null]');
    expect(stableKey({ a: Number.NaN })).toBe('{"a":NaN}');
    expect(stableKey([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])).toBe('[Infinity,-Infinity]');
    expect(stableKey({ a: Number.NaN })).not.toBe(stableKey({ a: null }));
  });

  it('keeps -0 apart from 0, as setAt does, and writes holes as null', () => {
    expect(stableKey(-0)).toBe('-0');
    expect(stableKey({ a: -0 })).not.toBe(stableKey({ a: 0 }));
    expect(stableKey([, 1])).toBe('[null,1]');
  });

  it('serializes primitives', () => {
    expect(stableKey('x"y')).toBe('"x\\"y"');
    expect(stableKey(true)).toBe('true');
    expect(stableKey(0.1)).toBe('0.1');
    expect(stableKey(BigInt(5))).toBe('5n');
    expect(stableKey(null)).toBe('null');
    expect(stableKey(undefined)).toBe('undefined');
  });
});
