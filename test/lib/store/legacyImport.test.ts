/**
 * importLegacyCalculatorStorage against a fake calculator whose old store
 * persisted `{ state: { inputs }, version }` under 'fake-calculator'.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatorDefinition, LegacyStorage } from '@/lib/calculators/types';
import { getDefaultFinancialProfile } from '@/lib/profile';
import { importLegacyCalculatorStorage } from '@/lib/store/legacyImport';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

interface Debt {
  id: string;
  name: string;
  balance: number;
}

interface Engine {
  age: number;
  state: string;
  retireIn: number;
  debts: Debt[];
}

const KEY = 'fake-calculator';

/** The old store's frozen defaults. */
const OLD_DEFAULTS: Engine = { age: 25, state: 'TX', retireIn: 35, debts: [] };

function readStorage(raw: unknown): Engine | null {
  const inputs = (raw as { state?: { inputs?: unknown } } | null)?.state?.inputs;
  if (typeof inputs !== 'object' || inputs === null) return null;
  return { ...OLD_DEFAULTS, ...(inputs as Partial<Engine>) };
}

const LEGACY: LegacyStorage<Engine> = { storageKey: KEY, readStorage, storageDefaults: () => ({ ...OLD_DEFAULTS }) };

const DEFINITION: CalculatorDefinition<Engine, number> = {
  id: 'retirement',
  form: { id: 'fake', fields: [], screens: [] },
  bindings: [
    { profile: 'person.age', engine: 'age' },
    { profile: 'person.state', engine: 'state' },
    {
      engine: 'retireIn',
      read: (get) => (get('person.retirementAge') as number) - (get('person.age') as number),
      write: (value, engine) => [{ path: 'person.retirementAge', value: (value as number) + engine.age }],
    },
    { profile: 'debts', engine: 'debts' },
  ],
  engineBase: () => ({ ...OLD_DEFAULTS }),
  validate: () => ({}),
  calculate: (inputs) => inputs.age,
  debounceMs: 0,
  legacy: LEGACY,
};

function store(inputs: Partial<Engine>, version = 3): void {
  window.localStorage.setItem(KEY, JSON.stringify({ state: { inputs, showAdvanced: true }, version }));
}

const profile = () => useProfileStore.getState().profile;

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

describe('importLegacyCalculatorStorage', () => {
  it('writes only the values that differ from the old defaults, marks them provided, then removes the key', () => {
    // age changed (25 -> 40); state left at the old default; retireIn 35 is the
    // old default but, with age 40, writes retirementAge 75, which differs.
    store({ age: 40, state: 'TX', retireIn: 35 });
    const written = importLegacyCalculatorStorage(DEFINITION);
    expect(written).toEqual(['person.age', 'person.retirementAge']);
    expect(profile().person.age).toBe(40);
    expect(profile().person.retirementAge).toBe(75);
    expect(profile().person.state).toBe(getDefaultFinancialProfile().person.state);
    expect(profile().provided).toEqual(['person.age', 'person.retirementAge']);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('never overwrites a path the profile already provides', () => {
    resetProfileStore({ profile: { person: { age: 52 } } });
    store({ age: 40, state: 'CA', debts: [{ id: 'd1', name: 'Card', balance: 900 }] });
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual(['person.state', 'person.retirementAge', 'debts']);
    expect(profile().person.age).toBe(52);
    expect(profile().person.state).toBe('CA');
    expect(profile().debts).toEqual([
      { id: 'd1', name: 'Card', balance: 900, interestRate: 0, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
    ]);
    expect(profile().provided).toEqual(['person.age', 'person.state', 'person.retirementAge', 'debts']);
  });

  it('is a no-op the second time', () => {
    store({ age: 40 });
    importLegacyCalculatorStorage(DEFINITION);
    const after = profile();
    const setValues = vi.spyOn(useProfileStore.getState(), 'setValues');
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual([]);
    expect(setValues).not.toHaveBeenCalled();
    expect(profile()).toBe(after);
  });

  it('writes nothing when every stored value is an old default, and still removes the key', () => {
    store({ ...OLD_DEFAULTS });
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual([]);
    expect(profile().provided).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('leaves values the profile refuses unwritten and unprovided', () => {
    // A number where the profile holds a state code.
    store({ age: 40, state: 42 as unknown as string });
    importLegacyCalculatorStorage(DEFINITION);
    expect(profile().person.state).toBe('TX');
    expect(profile().provided).toEqual(['person.age', 'person.retirementAge']);
  });

  it('does nothing without a stored key', () => {
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual([]);
    expect(profile().provided).toEqual([]);
  });

  it.each([
    ['corrupt JSON', '{"state":'],
    ['a foreign payload', JSON.stringify({ something: 'else' })],
    ['JSON null', 'null'],
  ])('drops %s without throwing or writing', (_, raw) => {
    window.localStorage.setItem(KEY, raw);
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual([]);
    expect(profile().provided).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('drops a payload its reader throws on', () => {
    const throwing: CalculatorDefinition<Engine, number> = {
      ...DEFINITION,
      legacy: {
        ...LEGACY,
        readStorage: () => {
          throw new TypeError('unexpected shape');
        },
      },
    };
    store({ age: 40 });
    expect(importLegacyCalculatorStorage(throwing)).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('waits for the profile store to hydrate, keeping the key', () => {
    resetProfileStore({ hydrated: false });
    store({ age: 40 });
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual([]);
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    useProfileStore.setState({ hasHydrated: true });
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual(['person.age', 'person.retirementAge']);
  });

  it('does nothing for a calculator without legacy storage', () => {
    store({ age: 40 });
    expect(importLegacyCalculatorStorage({ ...DEFINITION, legacy: undefined })).toEqual([]);
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
  });

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(importLegacyCalculatorStorage(DEFINITION)).toEqual([]);
    vi.restoreAllMocks();
  });
});
