/**
 * A small fake calculator for the shell tests: two core fields and one
 * assumption, an engine that returns the years until retirement, and a
 * results renderer that prints them.
 */

import React from 'react';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import type { FieldErrors } from '@/lib/fields/types';
import { setAt } from '@/lib/fields/paths';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { createCalculatorStore } from '@/lib/store/createCalculatorStore';
import type { CalculatorResultsArgs } from '@/components/calculators/shared/CalculatorPage';

export interface FakeEngine {
  age: number;
  retireAt: number;
  apy: number;
}

export interface FakeResult {
  years: number;
}

export const FAKE_DEFINITION: CalculatorDefinition<FakeEngine, FakeResult> = {
  id: 'retirement',
  form: {
    id: 'fake',
    fields: [
      { path: 'person.age', kind: 'number', label: 'Age', tier: 'core', min: 18, max: 100 },
      { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', tier: 'core', min: 30, max: 100 },
      { path: 'cash.emergencyFundApy', kind: 'percent', label: 'Savings APY', tier: 'assumption', max: 0.2 },
    ],
    screens: [
      { id: 'basics', title: 'Basics', tier: 'core', fields: ['person.age', 'person.retirementAge'] },
      { id: 'assumptions', title: 'Assumptions', tier: 'assumption', fields: ['cash.emergencyFundApy'] },
    ],
  },
  bindings: [
    { profile: 'person.age', engine: 'age' },
    { profile: 'person.retirementAge', engine: 'retireAt' },
    { profile: 'cash.emergencyFundApy', engine: 'apy' },
  ],
  engineBase: () => ({ age: 0, retireAt: 0, apy: 0 }),
  validate: (inputs): FieldErrors =>
    inputs.retireAt <= inputs.age ? { retireAt: 'Retire after your current age.' } : {},
  calculate: (inputs) => ({ years: inputs.retireAt - inputs.age }),
  debounceMs: 0,
};

export function createFakeStore() {
  return createCalculatorStore({ definition: FAKE_DEFINITION });
}

export function fakeProfile(age: number, retirementAge: number, provided: string[] = []): FinancialProfile {
  const base = setAt(setAt(getDefaultFinancialProfile(), 'person.age', age), 'person.retirementAge', retirementAge);
  return { ...base, provided };
}

export function renderFakeResults({ results, inputs, stale }: CalculatorResultsArgs<FakeEngine, FakeResult>) {
  return (
    <div data-testid="fake-results">
      Years to go: {results.years} (from age {inputs.age}){stale ? ' [stale]' : ''}
    </div>
  );
}
