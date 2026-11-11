/**
 * engineInputsFor and validateFor (prepareRun) against a small fake
 * calculator: two 1:1 bindings, one derived binding with an errorPath, a
 * form with a calculator screen, an intake-only screen and a relation.
 */

import { describe, expect, it, vi } from 'vitest';
import { engineInputsFor, prepareRun, validateFor } from '@/lib/calculators/runtime';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { setAt } from '@/lib/fields/paths';
import type { FieldErrors, FormSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile';
import type { FinancialProfile } from '@/lib/profile';

interface Engine {
  age: number;
  years: number;
  state: string;
  untouched: string;
}

const FORM: FormSpec = {
  id: 'fake',
  fields: [
    { path: 'person.age', kind: 'number', label: 'Age', min: 18, max: 90, tier: 'core', required: true },
    { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', min: 30, max: 100, tier: 'core' },
    { path: 'person.lifeExpectancy', kind: 'number', label: 'Life expectancy', min: 200, tier: 'assumption' },
  ],
  screens: [
    { id: 'basics', title: 'Basics', tier: 'core', fields: ['person.age', 'person.retirementAge'] },
    // Intake-only and impossible to satisfy: proves validateFor skips it.
    { id: 'intake', title: 'Intake', tier: 'assumption', surface: 'intake', fields: ['person.lifeExpectancy'] },
  ],
  relations: [
    {
      lower: 'person.age',
      upper: 'person.retirementAge',
      strict: true,
      checkOn: 'person.retirementAge',
      message: 'Retirement age must be after your age.',
    },
  ],
};

function engineChecks(inputs: Engine): FieldErrors {
  const errors: FieldErrors = {};
  if (inputs.age > 80) errors.age = 'The engine models ages up to 80.';
  if (inputs.years > 40) errors.years = 'At most 40 years.';
  if (inputs.state === 'XX') errors.state = 'Unknown state.';
  return errors;
}

const DEFINITION: CalculatorDefinition<Engine, number> = {
  id: 'retirement',
  form: FORM,
  bindings: [
    { profile: 'person.age', engine: 'age' },
    { profile: 'person.state', engine: 'state' },
    {
      engine: 'years',
      read: (get) => (get('person.retirementAge') as number) - (get('person.age') as number),
      errorPath: 'person.retirementAge',
    },
  ],
  engineBase: () => ({ age: 0, years: 0, state: '', untouched: 'base' }),
  validate: engineChecks,
  calculate: (inputs) => inputs.years,
  debounceMs: 0,
};

function profileWith(values: Record<string, unknown>): FinancialProfile {
  let profile = getDefaultFinancialProfile();
  for (const [path, value] of Object.entries(values)) profile = setAt(profile, path, value);
  return profile;
}

describe('engineInputsFor', () => {
  it('applies the bindings to the engine base and keeps unbound paths', () => {
    // Defaults: age 30, retirementAge 60, state TX.
    expect(engineInputsFor(DEFINITION, getDefaultFinancialProfile())).toEqual({
      age: 30,
      years: 30,
      state: 'TX',
      untouched: 'base',
    });
    expect(engineInputsFor(DEFINITION, profileWith({ 'person.age': 45, 'person.retirementAge': 67 }))).toEqual({
      age: 45,
      years: 22,
      state: 'TX',
      untouched: 'base',
    });
  });

  it('starts from a fresh engine base on every call', () => {
    const engineBase = vi.fn(DEFINITION.engineBase);
    engineInputsFor({ ...DEFINITION, engineBase }, getDefaultFinancialProfile());
    engineInputsFor({ ...DEFINITION, engineBase }, getDefaultFinancialProfile());
    expect(engineBase).toHaveBeenCalledTimes(2);
  });
});

describe('validateFor', () => {
  it('returns no errors for valid values, ignoring intake-only screens', () => {
    // lifeExpectancy 85 fails its min of 200, but only the intake shows it.
    expect(validateFor(DEFINITION, getDefaultFinancialProfile())).toEqual({});
  });

  it('reports form bounds and relations on profile paths', () => {
    expect(validateFor(DEFINITION, profileWith({ 'person.age': 12, 'person.retirementAge': 10 }))).toEqual({
      'person.age': 'Age must be between 18 and 90.',
      'person.retirementAge': 'Retirement age must be between 30 and 100.',
    });
    expect(validateFor(DEFINITION, profileWith({ 'person.age': 50, 'person.retirementAge': 45 }))).toEqual({
      'person.retirementAge': 'Retirement age must be after your age.',
    });
  });

  it('maps engine errors back through the bindings', () => {
    // years = 75 - 30 = 45 > 40, reported on the derived binding's errorPath.
    expect(validateFor(DEFINITION, profileWith({ 'person.retirementAge': 75 }))).toEqual({
      'person.retirementAge': 'At most 40 years.',
    });
    // age 85 passes the form (max 90) but not the engine (max 80); state XX is not a form field.
    expect(
      validateFor(DEFINITION, profileWith({ 'person.age': 85, 'person.retirementAge': 86, 'person.state': 'XX' }))
    ).toEqual({
      'person.age': 'The engine models ages up to 80.',
      'person.state': 'Unknown state.',
    });
  });

  it('keeps the form message when the form and the engine flag the same path', () => {
    // age 95 fails both the form (max 90) and the engine (max 80).
    expect(validateFor(DEFINITION, profileWith({ 'person.age': 95, 'person.retirementAge': 96 }))).toEqual({
      'person.age': 'Age must be between 18 and 90.',
    });
  });

  it('sends unmapped engine errors to calculation', () => {
    const definition: CalculatorDefinition<Engine, number> = {
      ...DEFINITION,
      validate: () => ({ untouched: 'Something else went wrong.' }),
    };
    expect(validateFor(definition, getDefaultFinancialProfile())).toEqual({
      calculation: 'Something else went wrong.',
    });
  });
});

describe('prepareRun', () => {
  it('returns the engine inputs and the errors from one pass', () => {
    const validate = vi.fn(engineChecks);
    const run = prepareRun({ ...DEFINITION, validate }, profileWith({ 'person.retirementAge': 75 }));
    expect(run.inputs).toEqual({ age: 30, years: 45, state: 'TX', untouched: 'base' });
    expect(run.errors).toEqual({ 'person.retirementAge': 'At most 40 years.' });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledWith(run.inputs);
  });
});
