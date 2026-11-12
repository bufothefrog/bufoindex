/**
 * importLegacyStorage against fake calculators whose old store persisted
 * `{ state: { inputs }, version }` under 'fake-calculator', and the real
 * LEGACY_IMPORTS list.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatorDefinition, LegacyImport, LegacyStorage } from '@/lib/calculators/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { getAt } from '@/lib/fields/paths';
import { LEGACY_IMPORTS } from '@/lib/calculators/legacyImports';
import { PAYCHECK_BINDINGS } from '@/lib/calculators/paycheck/bindings';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PAYCHECK_LEGACY } from '@/lib/calculators/paycheck/legacy';
import { RETIREMENT_BINDINGS } from '@/lib/calculators/retirement/bindings';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_LEGACY } from '@/lib/calculators/retirement/legacy';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { importLegacyStorage } from '@/lib/store/legacyImport';
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

const FAKE: LegacyImport<Engine> = {
  legacy: LEGACY,
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
};

/** Imports the fake calculator's key alone. */
const importFake = (item: LegacyImport<Engine> = FAKE) => importLegacyStorage([item]);

function store(inputs: Partial<Engine>, version = 3): void {
  window.localStorage.setItem(KEY, JSON.stringify({ state: { inputs, showAdvanced: true }, version }));
}

const profile = () => useProfileStore.getState().profile;

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

describe('importLegacyStorage', () => {
  it('writes only the values that differ from the old defaults, marks them provided, then removes the key', () => {
    // age changed (25 -> 40); state left at the old default; retireIn 35 is the
    // old default but, with age 40, writes retirementAge 75, which differs.
    store({ age: 40, state: 'TX', retireIn: 35 });
    const written = importFake();
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
    expect(importFake()).toEqual(['person.state', 'person.retirementAge', 'debts']);
    expect(profile().person.age).toBe(52);
    expect(profile().person.state).toBe('CA');
    expect(profile().debts).toEqual([
      { id: 'd1', name: 'Card', balance: 900, interestRate: 0, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
    ]);
    expect(profile().provided).toEqual(['person.age', 'person.state', 'person.retirementAge', 'debts']);
  });

  it('is a no-op the second time', () => {
    store({ age: 40 });
    importFake();
    const after = profile();
    const setValues = vi.spyOn(useProfileStore.getState(), 'setValues');
    expect(importFake()).toEqual([]);
    expect(setValues).not.toHaveBeenCalled();
    expect(profile()).toBe(after);
  });

  it('answers nothing when every stored value is an old default, and still removes the key', () => {
    store({ ...OLD_DEFAULTS });
    expect(importFake()).toEqual([]);
    expect(profile().provided).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('carries an untouched old default the profile default differs from, unprovided', () => {
    // Old default age 25 against the profile's 30; the state (TX) and the
    // retirement age (25 + 35 = 60) match the profile's defaults.
    store({ ...OLD_DEFAULTS });
    importFake();
    expect(profile().person.age).toBe(25);
    expect(profile().person.retirementAge).toBe(60);
    expect(profile().provided).toEqual([]);
  });

  it('never writes an untouched old default over a path the profile already provides', () => {
    resetProfileStore({ profile: { person: { age: 41 } } });
    store({ ...OLD_DEFAULTS });
    importFake();
    expect(profile().person.age).toBe(41);
    expect(profile().provided).toEqual(['person.age']);
  });

  it('leaves values the profile refuses unwritten and unprovided', () => {
    // A number where the profile holds a state code.
    store({ age: 40, state: 42 as unknown as string });
    importFake();
    expect(profile().person.state).toBe('TX');
    expect(profile().provided).toEqual(['person.age', 'person.retirementAge']);
  });

  describe('a binding that writes coupled paths', () => {
    interface IncomeEngine {
      incomeAmount: number;
      incomePeriod: 'yearly' | 'monthly';
    }
    const INCOME_KEY = 'fake-income-calculator';
    const INCOME_DEFAULTS: IncomeEngine = { incomeAmount: 100000, incomePeriod: 'yearly' };
    // Modelled on the retirement income binding: the reverse write is an
    // amount per paycheck plus its frequency, which only make sense together.
    const INCOME: LegacyImport<IncomeEngine> = {
      bindings: [
        {
          engine: 'incomeAmount',
          read: (get) => (get('income.grossPerPaycheck') as number) * 12,
          write: (value) => [
            { path: 'income.grossPerPaycheck', value: (value as number) / 12 },
            { path: 'income.frequency', value: 'monthly' },
          ],
        },
      ],
      legacy: {
        storageKey: INCOME_KEY,
        readStorage: (raw) => ({ ...INCOME_DEFAULTS, ...((raw as { state: Partial<IncomeEngine> }).state ?? {}) }),
        storageDefaults: () => ({ ...INCOME_DEFAULTS }),
      },
    };
    const storeIncome = (state: Partial<IncomeEngine>) =>
      window.localStorage.setItem(INCOME_KEY, JSON.stringify({ state }));

    it('imports every write of a changed binding, including those equal to the old default', () => {
      storeIncome({ incomeAmount: 120000, incomePeriod: 'yearly' });
      expect(importLegacyStorage([INCOME])).toEqual(['income.grossPerPaycheck', 'income.frequency']);
      expect(profile().income.grossPerPaycheck).toBe(10000);
      expect(profile().income.frequency).toBe('monthly');
      expect(profile().provided).toEqual(['income.grossPerPaycheck', 'income.frequency']);
    });

    it('skips the whole binding when one of its paths is already provided', () => {
      resetProfileStore({ profile: { income: { frequency: 'weekly' } } });
      storeIncome({ incomeAmount: 120000 });
      expect(importLegacyStorage([INCOME])).toEqual([]);
      expect(profile().income.grossPerPaycheck).toBe(getDefaultFinancialProfile().income.grossPerPaycheck);
      expect(profile().income.frequency).toBe('weekly');
    });

    it('imports the rest of the binding when its provided paths already hold what it would write', () => {
      resetProfileStore({ profile: { income: { frequency: 'monthly' } } });
      storeIncome({ incomeAmount: 120000 });
      expect(importLegacyStorage([INCOME])).toEqual(['income.grossPerPaycheck']);
      expect(profile().income).toMatchObject({ grossPerPaycheck: 10000, frequency: 'monthly' });
    });
  });

  it('does nothing without a stored key', () => {
    expect(importFake()).toEqual([]);
    expect(profile().provided).toEqual([]);
  });

  it.each([
    ['corrupt JSON', '{"state":'],
    ['a foreign payload', JSON.stringify({ something: 'else' })],
    ['JSON null', 'null'],
  ])('drops %s without throwing or writing', (_, raw) => {
    window.localStorage.setItem(KEY, raw);
    expect(importFake()).toEqual([]);
    expect(profile().provided).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('drops a payload its reader throws on', () => {
    const throwing: LegacyImport<Engine> = {
      ...FAKE,
      legacy: {
        ...LEGACY,
        readStorage: () => {
          throw new TypeError('unexpected shape');
        },
      },
    };
    store({ age: 40 });
    expect(importFake(throwing)).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('waits for the profile store to hydrate, keeping the key', () => {
    resetProfileStore({ hydrated: false });
    store({ age: 40 });
    expect(importFake()).toEqual([]);
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    useProfileStore.setState({ hasHydrated: true });
    expect(importFake()).toEqual(['person.age', 'person.retirementAge']);
  });

  it('does nothing for an empty list, leaving every key in place', () => {
    store({ age: 40 });
    expect(importLegacyStorage([])).toEqual([]);
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
  });

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(importFake()).toEqual([]);
    vi.restoreAllMocks();
  });
});

describe('importLegacyStorage: several old keys in one call', () => {
  const OTHER_KEY = 'fake-other-calculator';
  /** A second old store that wrote the same profile paths (age, state). */
  const OTHER: LegacyImport<Engine> = {
    legacy: { ...LEGACY, storageKey: OTHER_KEY },
    bindings: [
      { profile: 'person.age', engine: 'age' },
      { profile: 'person.state', engine: 'state' },
    ],
  };
  const storeOther = (inputs: Partial<Engine>) =>
    window.localStorage.setItem(OTHER_KEY, JSON.stringify({ state: { inputs }, version: 3 }));

  it('imports the keys in list order, each against the profile the previous key left', () => {
    store({ age: 40 });
    storeOther({ age: 50, state: 'CA' });
    expect(importLegacyStorage([FAKE, OTHER])).toEqual(['person.age', 'person.retirementAge', 'person.state']);
    // The first key answered the age, so the second key's age is not written.
    expect(profile().person).toMatchObject({ age: 40, state: 'CA', retirementAge: 75 });
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(OTHER_KEY)).toBeNull();
  });

  it('imports the second key when the first one is corrupt', () => {
    window.localStorage.setItem(KEY, '{"state":');
    storeOther({ age: 50 });
    expect(importLegacyStorage([FAKE, OTHER])).toEqual(['person.age']);
    expect(profile().person.age).toBe(50);
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(OTHER_KEY)).toBeNull();
  });

  it('imports the second key when the first one throws, and keeps the first key', () => {
    const throwing: LegacyImport<Engine> = {
      ...FAKE,
      bindings: [
        {
          engine: 'age',
          read: () => 0,
          write: () => {
            throw new TypeError('unexpected shape');
          },
        },
      ],
    };
    store({ age: 40 });
    storeOther({ state: 'CA' });
    expect(importLegacyStorage([throwing, OTHER])).toEqual(['person.state']);
    expect(profile().person.state).toBe('CA');
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem(OTHER_KEY)).toBeNull();
  });
});

describe('LEGACY_IMPORTS', () => {
  it('lists the paycheck key first, then the retirement key, each with its own bindings', () => {
    expect(LEGACY_IMPORTS).toEqual([
      { legacy: PAYCHECK_LEGACY, bindings: PAYCHECK_BINDINGS },
      { legacy: RETIREMENT_LEGACY, bindings: RETIREMENT_BINDINGS },
    ]);
  });
});

describe('importLegacyStorage: an untouched old store keeps its inputs', () => {
  /** The engine values the old store ran with against those the imported profile runs with. */
  function expectSameRun<E, R>(def: CalculatorDefinition<E, R>, legacy: LegacyStorage<E>, skip: readonly string[] = []): void {
    const old = legacy.storageDefaults();
    const now = engineInputsFor(def, profile());
    for (const binding of def.bindings) {
      if (skip.includes(binding.engine)) continue;
      expect([binding.engine, getAt(now, binding.engine)]).toEqual([binding.engine, getAt(old, binding.engine)]);
    }
  }

  it("runs the retirement calculator on the old defaults (the yearly salary in the profile's frequency)", () => {
    window.localStorage.setItem(
      RETIREMENT_LEGACY.storageKey,
      JSON.stringify({ state: { inputs: RETIREMENT_LEGACY.storageDefaults() }, version: 3 })
    );
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(profile().provided).toEqual([]);
    // The profile holds pay per paycheck: 100,000 a year is 3,846.15 bi-weekly.
    expectSameRun(RETIREMENT_CALCULATOR, RETIREMENT_LEGACY, ['currentIncome', 'incomeAmount', 'incomePeriod']);
    const income = engineInputsFor(RETIREMENT_CALCULATOR, profile());
    expect(income).toMatchObject({ incomeAmount: 3846.15, incomePeriod: 'biweekly' });
    expect(income.currentIncome).toBeCloseTo(100000, 0);
  });

  it('runs the paycheck allocator on the old defaults (401(k) at 3%, no taxable account)', () => {
    window.localStorage.setItem(
      PAYCHECK_LEGACY.storageKey,
      JSON.stringify({ state: { profile: PAYCHECK_LEGACY.storageDefaults() }, version: 0 })
    );
    expect(importLegacyStorage(LEGACY_IMPORTS)).toEqual([]);
    expect(profile().provided).toEqual([]);
    expectSameRun(PAYCHECK_CALCULATOR, PAYCHECK_LEGACY, ['income']);
    const run = engineInputsFor(PAYCHECK_CALCULATOR, profile());
    expect(run.benefits.employer401k.currentContribution).toBe(0.03);
    expect(run.preferences).toMatchObject({ hasTaxableAccount: false, taxableAccountContribution: 0 });
  });
});
