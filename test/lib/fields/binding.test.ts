import { describe, expect, it } from 'vitest';
import {
  engineErrorsToFields,
  fromEngineInputs,
  isDirectBinding,
  stableKey,
  toEngineInputs,
  type Binding,
} from '@/lib/fields/binding';
import { applyWrites, makeGet } from '@/lib/fields/paths';

interface Engine {
  age: number;
  taxes: { state: string; rate: number };
  contributions: { traditional: number; roth: number; total: number };
  debts: { balance: number }[];
  fixed: string;
}

const base = (): Engine => ({
  age: 0,
  taxes: { state: '', rate: 0.22 },
  contributions: { traditional: 0, roth: 0, total: 0 },
  debts: [],
  fixed: 'engine-only',
});

const profile = {
  person: { age: 30, state: 'TX' },
  workplace: { contributionType: 'split', contributionPercent: 0.1, rothContributionPercent: 0.04 },
  debts: [{ balance: 500 }],
};

const contribution = (get: (p: string) => unknown) => {
  const total = get('workplace.contributionPercent') as number;
  const rothPct = get('workplace.rothContributionPercent') as number;
  switch (get('workplace.contributionType')) {
    case 'roth':
      return { traditional: 0, roth: total, total };
    case 'split': {
      const roth = Math.min(rothPct, total);
      return { traditional: total - roth, roth, total };
    }
    default:
      return { traditional: total, roth: 0, total };
  }
};

const BINDINGS: Binding<Engine>[] = [
  { profile: 'person.age', engine: 'age' },
  { profile: 'person.state', engine: 'taxes.state' },
  { profile: 'debts', engine: 'debts' },
  {
    engine: 'contributions',
    read: contribution,
    errorPath: 'workplace.contributionPercent',
    write: (value) => {
      const { traditional, roth, total } = value as Engine['contributions'];
      const type = roth === 0 ? 'traditional' : traditional === 0 ? 'roth' : 'split';
      return [
        { path: 'workplace.contributionType', value: type },
        { path: 'workplace.contributionPercent', value: total },
        { path: 'workplace.rothContributionPercent', value: roth },
      ];
    },
  },
  { engine: 'taxes.rate', read: (_get, current) => (current.taxes.state === 'TX' ? 0.2 : undefined) },
];

describe('toEngineInputs', () => {
  it('applies direct and derived bindings over the base', () => {
    const engine = toEngineInputs(BINDINGS, base(), makeGet(profile));
    expect(engine).toEqual({
      age: 30,
      taxes: { state: 'TX', rate: 0.2 },
      contributions: { traditional: expect.closeTo(0.06, 12), roth: 0.04, total: 0.1 },
      debts: [{ balance: 500 }],
      fixed: 'engine-only',
    });
  });

  it('keeps base values where the profile has none and does not mutate the base', () => {
    const start = base();
    const engine = toEngineInputs(BINDINGS, start, makeGet({ person: { state: 'CA' } }));
    expect(engine.age).toBe(0);
    expect(engine.taxes).toEqual({ state: 'CA', rate: 0.22 });
    expect(start.taxes.state).toBe('');
  });

  it('supports a root derived binding', () => {
    const root: Binding<Engine>[] = [{ engine: '', read: (_get, current) => ({ ...current, fixed: 'replaced' }) }];
    expect(toEngineInputs(root, base(), makeGet({})).fixed).toBe('replaced');
  });

  it('truth-tables a derived coupling', () => {
    const run = (type: string, total: number, roth: number) =>
      toEngineInputs(BINDINGS, base(), makeGet({ workplace: { contributionType: type, contributionPercent: total, rothContributionPercent: roth } })).contributions;
    expect(run('traditional', 0.08, 0.05)).toEqual({ traditional: 0.08, roth: 0, total: 0.08 });
    expect(run('roth', 0.08, 0.05)).toEqual({ traditional: 0, roth: 0.08, total: 0.08 });
    expect(run('split', 0.03, 0.05)).toEqual({ traditional: 0, roth: 0.03, total: 0.03 });
  });
});

describe('fromEngineInputs', () => {
  it('round-trips direct and derived bindings', () => {
    const engine = toEngineInputs(BINDINGS, base(), makeGet(profile));
    const writes = fromEngineInputs(BINDINGS, engine);
    const restored = applyWrites({}, writes);
    expect(restored).toEqual({
      person: { age: 30, state: 'TX' },
      debts: [{ balance: 500 }],
      workplace: { contributionType: 'split', contributionPercent: 0.1, rothContributionPercent: 0.04 },
    });
    expect(toEngineInputs(BINDINGS, base(), makeGet(restored))).toEqual(engine);
  });

  it('skips undefined engine values and derived bindings without write', () => {
    const partial = { age: 40 } as unknown as Engine;
    expect(fromEngineInputs(BINDINGS, partial)).toEqual([{ path: 'person.age', value: 40 }]);
  });
});

describe('engineErrorsToFields', () => {
  it('maps by the longest engine prefix, keeps row suffixes, and falls back to calculation', () => {
    expect(
      engineErrorsToFields(BINDINGS, {
        age: 'Age is out of range.',
        'debts.0.balance': 'Balance must be positive.',
        'contributions.total': 'Too high.',
        'taxes.rate': 'Rate error.',
        unknown: 'Something failed.',
        other: 'Another failure.',
        again: 'Something failed.',
      })
    ).toEqual({
      'person.age': 'Age is out of range.',
      'debts.0.balance': 'Balance must be positive.',
      'workplace.contributionPercent': 'Too high.',
      calculation: 'Rate error. Something failed. Another failure.',
    });
  });

  it('keeps the first message per field and maps through a root direct binding', () => {
    const rooted: Binding<Engine>[] = [{ profile: 'paycheck', engine: '' }, { profile: 'person.age', engine: 'age' }];
    expect(engineErrorsToFields(rooted, { age: 'a', 'taxes.rate': 'b', '': 'c' })).toEqual({
      'person.age': 'a',
      'paycheck.taxes.rate': 'b',
      paycheck: 'c',
    });
    expect(engineErrorsToFields(BINDINGS, { 'debts.0': 'first', debts: 'x', 'debts.0.balance': 'y' })).toEqual({
      'debts.0': 'first',
      debts: 'x',
      'debts.0.balance': 'y',
    });
    const twoDirect: Binding<Engine>[] = [{ profile: 'p', engine: 'a' }, { profile: 'p', engine: 'b' }];
    expect(engineErrorsToFields(twoDirect, { a: 'one', b: 'two' })).toEqual({ p: 'one' });
  });

  it('identifies direct bindings', () => {
    expect(isDirectBinding(BINDINGS[0])).toBe(true);
    expect(isDirectBinding(BINDINGS[3])).toBe(false);
  });
});

describe('stableKey', () => {
  it('is independent of key order at every depth', () => {
    expect(stableKey({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 'x' } })).toBe(
      stableKey({ a: { c: 'x', d: [1, { x: 1, y: 2 }] }, b: 1 })
    );
    expect(stableKey({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('distinguishes values JSON would conflate and drops undefined entries', () => {
    expect(stableKey({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableKey([undefined, () => 1])).toBe('[null,null]');
    expect(stableKey(Number.NaN)).toBe('"NaN"');
    expect(stableKey(Infinity)).not.toBe(stableKey(null));
    expect(stableKey(undefined)).toBe('undefined');
    expect(stableKey(Symbol('s'))).toBe('undefined');
    expect(stableKey(10n)).toBe('"10n"');
    expect(stableKey(true)).toBe('true');
    expect(stableKey('a"b')).toBe('"a\\"b"');
    expect(stableKey(new Date('2026-01-02T00:00:00Z'))).toBe('"2026-01-02T00:00:00.000Z"');
    expect(stableKey([1, 2])).not.toBe(stableKey([2, 1]));
  });
});
