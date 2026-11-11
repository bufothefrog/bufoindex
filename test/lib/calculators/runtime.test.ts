import { describe, expect, it } from 'vitest';
import { engineInputsFor, prepareRun, profileWritesFor, scenarioFrom, validateFor } from '@/lib/calculators/runtime';
import { CALCULATOR_IDS, isCalculatorId, type CalculatorDefinition } from '@/lib/calculators/types';
import { setAt } from '@/lib/fields/paths';
import type { FieldErrors } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';

interface Engine {
  age: number;
  retireAt: number;
  label: string;
  span: number;
}

const definition: CalculatorDefinition<Engine, number> = {
  id: 'retirement',
  form: {
    id: 'fake',
    fields: [
      { path: 'person.age', kind: 'number', label: 'Age', tier: 'core', min: 18, max: 100 },
      { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', tier: 'core', min: 30, max: 100 },
    ],
    screens: [{ id: 'basics', title: 'Basics', tier: 'core', fields: ['person.age', 'person.retirementAge'] }],
  },
  bindings: [
    { profile: 'person.age', engine: 'age' },
    { profile: 'person.retirementAge', engine: 'retireAt' },
    {
      engine: 'span',
      read: (_get, current) => current.retireAt - current.age,
      write: (value, engine) => [{ path: 'person.retirementAge', value: engine.age + (value as number) }],
      errorPath: 'person.retirementAge',
    },
  ],
  engineBase: () => ({ age: 0, retireAt: 0, label: 'base', span: 0 }),
  validate: (inputs): FieldErrors => (inputs.span <= 0 ? { span: 'Retire after your current age.' } : {}),
  calculate: (inputs) => inputs.span,
  debounceMs: 0,
};

const profile = (age: number, retirementAge: number): FinancialProfile =>
  setAt(setAt(getDefaultFinancialProfile(), 'person.age', age), 'person.retirementAge', retirementAge);

describe('calculator ids', () => {
  it('lists the four calculators and guards unknown ids', () => {
    expect(CALCULATOR_IDS).toEqual(['paycheck', 'retirement', 'portfolio', 'leverage']);
    expect(isCalculatorId('leverage')).toBe(true);
    expect(isCalculatorId('budget')).toBe(false);
    expect(isCalculatorId(3)).toBe(false);
  });
});

describe('engineInputsFor', () => {
  it('applies bindings over engineBase in order', () => {
    expect(engineInputsFor(definition, profile(40, 65))).toEqual({ age: 40, retireAt: 65, label: 'base', span: 25 });
  });
});

describe('validateFor / prepareRun', () => {
  it('returns no errors for valid values', () => {
    expect(validateFor(definition, profile(40, 65))).toEqual({});
  });

  it('maps engine errors onto the binding error path', () => {
    expect(validateFor(definition, profile(70, 65))).toEqual({
      'person.retirementAge': 'Retire after your current age.',
    });
  });

  it("lets a field's own error win over an engine error on the same path", () => {
    const { inputs, errors } = prepareRun(definition, profile(40, 20));
    expect(inputs.retireAt).toBe(20);
    expect(errors['person.retirementAge']).toMatch(/30/);
    expect(errors['person.retirementAge']).not.toBe('Retire after your current age.');
  });

  it('reports field bounds on their own paths', () => {
    expect(Object.keys(validateFor(definition, profile(10, 65)))).toEqual(['person.age']);
  });
});

describe('profileWritesFor / scenarioFrom', () => {
  it('reverses the bindings', () => {
    const engine: Engine = { age: 35, retireAt: 60, label: 'x', span: 30 };
    expect(profileWritesFor(definition, engine)).toEqual([
      { path: 'person.age', value: 35 },
      { path: 'person.retirementAge', value: 60 },
      { path: 'person.retirementAge', value: 65 },
    ]);
  });

  it('builds a normalized profile without marking anything provided', () => {
    const base = getDefaultFinancialProfile();
    const scenario = scenarioFrom(definition, base, { age: 35, retireAt: 60, label: 'x', span: 30 });
    expect(scenario.person.age).toBe(35);
    expect(scenario.person.retirementAge).toBe(65);
    expect(scenario.provided).toEqual(base.provided);
    expect(base.person.age).toBe(30);
  });
});
