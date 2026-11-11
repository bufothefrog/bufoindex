/**
 * CalculatorPage with a fake definition registered under the retirement id:
 * the registry heading and disclaimer, inputs from the profile (defaults
 * before hydration), write-through edits, a results skeleton until the first
 * run after hydration, stale results kept and marked, the URL handoff, and
 * live results (no Calculate button).
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import CalculatorPage from '@/components/calculators/shared/CalculatorPage';
import { calculatorDisclaimer, calculatorMeta } from '@/lib/calculators/registry';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import type { FieldErrors, FormSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { createCalculatorStore, type CalculatorStore } from '@/lib/store/createCalculatorStore';
import { useProfileStore } from '@/lib/store/profileStore';
import { renderWithProfile } from '@/test/utils/render';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

interface Engine {
  age: number;
  retirementAge: number;
}

interface Results {
  yearsLeft: number;
}

const FORM: FormSpec = {
  id: 'fake',
  fields: [
    { path: 'person.age', kind: 'number', label: 'Age', min: 18, max: 90, required: true, tier: 'details' },
    { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', min: 30, max: 100, tier: 'details' },
  ],
  screens: [{ id: 'about', title: 'About you', tier: 'details', fields: ['person.age', 'person.retirementAge'] }],
};

function fakeDefinition(calculate?: (inputs: Engine) => Results): CalculatorDefinition<Engine, Results> {
  return {
    id: 'retirement',
    form: FORM,
    bindings: [
      { profile: 'person.age', engine: 'age' },
      { profile: 'person.retirementAge', engine: 'retirementAge' },
    ],
    engineBase: () => ({ age: 30, retirementAge: 60 }),
    validate: (inputs): FieldErrors =>
      inputs.retirementAge > inputs.age ? {} : { retirementAge: 'Retirement age must be after your age.' },
    calculate: calculate ?? ((inputs) => ({ yearsLeft: inputs.retirementAge - inputs.age })),
    debounceMs: 0,
  };
}

let definition: CalculatorDefinition<Engine, Results>;
let store: CalculatorStore<Engine, Results>;

function page(afterLayout?: React.ReactNode) {
  return (
    <CalculatorPage
      definition={definition}
      store={store}
      renderResults={({ results, inputs, stale }) => (
        <p>
          {results.yearsLeft} years left from age {inputs.age}
          {stale ? ' (stale)' : ''}
        </p>
      )}
      afterLayout={afterLayout}
    />
  );
}

const ageBox = () => screen.getByRole('textbox', { name: 'Age' });
const retirementAgeBox = () => screen.getByRole('textbox', { name: 'Retirement age' });
const meta = calculatorMeta('retirement');

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  definition = fakeDefinition();
  store = createCalculatorStore({ definition });
});

describe('CalculatorPage', () => {
  it('renders the registry heading, the form, the results, NextSteps and the disclaimer', () => {
    renderWithProfile(page(<p>Methodology link</p>), { profile: { person: { age: 40, retirementAge: 65 } } });
    expect(screen.getByRole('heading', { level: 1, name: meta.title })).toBeInTheDocument();
    expect(screen.getByText(meta.description)).toBeInTheDocument();
    expect(ageBox()).toHaveValue('40');
    expect(screen.getByText('25 years left from age 40')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: meta.liveResultsLabel })).toHaveTextContent('25 years left');
    expect(screen.getByText('What next?')).toBeInTheDocument();
    expect(screen.getByText(calculatorDisclaimer('retirement'))).toBeInTheDocument();
    expect(screen.getByText('Methodology link')).toBeInTheDocument();
  });

  it('has live results: no Calculate button, and See results on the mobile bar', () => {
    renderWithProfile(page());
    expect(screen.queryByRole('button', { name: /Calculate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /See results/ })).toBeInTheDocument();
  });

  it('shows defaults and no results before hydration, a skeleton until the first run', () => {
    resetProfileStore({ hydrated: false });
    render(page());
    expect(ageBox()).toHaveValue('30');
    expect(screen.getByRole('status', { name: 'Loading results' })).toBeInTheDocument();
    expect(screen.queryByText(/years left/)).not.toBeInTheDocument();
    expect(store.getState().hasCalculatedOnce).toBe(false);

    act(() => useProfileStore.setState({ hasHydrated: true }));
    expect(screen.queryByRole('status', { name: 'Loading results' })).not.toBeInTheDocument();
    expect(screen.getByText('30 years left from age 30')).toBeInTheDocument();
  });

  it('keeps the skeleton while a worker run is in flight', async () => {
    let resolve: (results: Results) => void = () => {};
    store = createCalculatorStore({
      definition,
      runner: () => new Promise<Results>((done) => (resolve = done)),
    });
    renderWithProfile(page());
    expect(screen.getByRole('status', { name: 'Loading results' })).toBeInTheDocument();
    await act(async () => resolve({ yearsLeft: 7 }));
    expect(screen.getByText('7 years left from age 30')).toBeInTheDocument();
  });

  it('writes an edit through to the profile, marks it provided and recalculates', () => {
    renderWithProfile(page());
    expect(useProfileStore.getState().profile.provided).not.toContain('person.age');
    fireEvent.change(ageBox(), { target: { value: '35' } });
    expect(useProfileStore.getState().profile.person.age).toBe(35);
    expect(useProfileStore.getState().profile.provided).toContain('person.age');
    expect(screen.getByText('25 years left from age 35')).toBeInTheDocument();
  });

  it('keeps the last results, marked stale, while a field is invalid', () => {
    renderWithProfile(page(), { profile: { person: { age: 40, retirementAge: 65 } } });
    fireEvent.change(retirementAgeBox(), { target: { value: '35' } });
    expect(screen.getByText('Results out of date')).toBeInTheDocument();
    expect(screen.getByText('25 years left from age 40 (stale)')).toBeInTheDocument();
    expect(retirementAgeBox()).toBeInvalid();
    expect(retirementAgeBox()).toHaveAccessibleDescription(/Retirement age must be after your age\./);

    fireEvent.change(retirementAgeBox(), { target: { value: '70' } });
    expect(screen.queryByText('Results out of date')).not.toBeInTheDocument();
    expect(screen.getByText('30 years left from age 40')).toBeInTheDocument();
  });

  it('shows the live empty state when the first run has invalid values', () => {
    renderWithProfile(page(), { profile: { person: { age: 70, retirementAge: 65 } } });
    expect(screen.queryByRole('status', { name: 'Loading results' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No results yet' })).toBeInTheDocument();
  });

  it('shows a failed run in place of the results', () => {
    definition = fakeDefinition(() => {
      throw new Error('Engine exploded');
    });
    store = createCalculatorStore({ definition });
    renderWithProfile(page());
    expect(screen.getByRole('alert')).toHaveTextContent('Engine exploded');
    expect(screen.queryByRole('status', { name: 'Loading results' })).not.toBeInTheDocument();
  });

  it('opens on Results after a profile handoff and strips ?from=profile', () => {
    window.history.replaceState(null, '', '/tools/retirement-calculator?from=profile');
    renderWithProfile(page());
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.search).toBe('');
  });

  it('ignores a stray hash or legacy query and shows the visitor\'s own profile', () => {
    window.history.replaceState(null, '', '/tools/retirement-calculator?c=900&y=5#eyJhZ2UiOjk5fQ');
    renderWithProfile(page(), { profile: { person: { age: 40, retirementAge: 65 } } });
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(ageBox()).toHaveValue('40');
    expect(screen.getByText('25 years left from age 40')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inputs/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('restores an assumption screen to the default values and unmarks them', () => {
    definition = {
      ...fakeDefinition(),
      form: {
        ...FORM,
        fields: [
          ...FORM.fields,
          { path: 'assumptions.retirement.inflationRate', kind: 'percent', label: 'Inflation', min: 0, max: 0.1, tier: 'assumption' },
        ],
        screens: [
          ...FORM.screens,
          { id: 'assume', title: 'Assumptions', tier: 'assumption', fields: ['assumptions.retirement.inflationRate'] },
        ],
      },
    };
    store = createCalculatorStore({ definition });
    renderWithProfile(page(), {
      profile: { person: { age: 40 }, assumptions: { retirement: { inflationRate: 0.05 } } },
    });
    const restore = screen.getByRole('button', { name: 'Restore defaults for assumptions' });
    expect(screen.queryByRole('button', { name: 'Restore defaults for about you' })).not.toBeInTheDocument();

    fireEvent.click(restore);
    const { profile } = useProfileStore.getState();
    expect(profile.assumptions.retirement.inflationRate).toBe(
      getDefaultFinancialProfile().assumptions.retirement.inflationRate
    );
    expect(profile.assumptions.retirement.inflationRate).not.toBe(0.05);
    expect(profile.provided).not.toContain('assumptions.retirement.inflationRate');
    expect(profile.person.age).toBe(40);
    expect(profile.provided).toContain('person.age');
  });

  it('reads the profile when the URL is clean, and resubmits when it changes elsewhere', () => {
    renderWithProfile(page(), { profile: { person: { age: 50 } } });
    expect(screen.getByText('10 years left from age 50')).toBeInTheDocument();
    act(() => useProfileStore.getState().setValues([{ path: 'person.retirementAge', value: 70 }]));
    expect(screen.getByText('20 years left from age 50')).toBeInTheDocument();
  });
});
