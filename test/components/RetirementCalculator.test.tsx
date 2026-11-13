/**
 * The retirement page on the platform: generated sections over the shared
 * profile, live results from the real engine (the worker runner's in-thread
 * fallback in jsdom), no results before hydration, write-through edits, the
 * risk-profile visibility rule, the auto/override tax rate, the filing-status
 * note (O10), the shared dollar-display preference and the methodology
 * link.
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RetirementCalculator } from '@/app/tools/retirement-calculator/components/RetirementCalculator';
import { calculatorMeta } from '@/lib/calculators/registry';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { useProfileStore } from '@/lib/store/profileStore';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { renderWithProfile } from '@/test/utils/render';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const meta = calculatorMeta('retirement');

const FILING_NOTE =
  'Retirement estimates model only single and married filing jointly, so head of household runs here as single.';

/** Waits for the first results (the run resolves after the bootstrap's submit). */
const findResults = () => screen.findByText('Implied Withdrawal Rate');

const showAssumptions = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Show assumptions' }));

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  useRetirementStore.getState().reset();
  usePreferencesStore.setState({ displayMode: 'today' });
});

describe('RetirementCalculator', () => {
  it('renders the registry heading, every section, live results and the methodology link', async () => {
    renderWithProfile(<RetirementCalculator />);

    expect(screen.getByRole('heading', { level: 1, name: meta.title })).toBeInTheDocument();
    for (const title of [
      'A little about you',
      'What does a typical paycheck look like?',
      'What do you have to pay each month?',
      'What are you investing today?',
      'When would you like to retire?',
      'Social Security and healthcare',
      'Assumptions',
    ]) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Calculate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute(
      'href',
      '/tools/retirement-calculator/methodology'
    );

    expect(await findResults()).toBeInTheDocument();
    expect(screen.getByText('Portfolio Projections')).toBeInTheDocument();
    expect(screen.getByText("Amounts adjusted to today's dollars using your inflation rate")).toBeInTheDocument();
  });

  it('renders inputs from the default profile and no results before hydration', () => {
    resetProfileStore({ hydrated: false, profile: { person: { age: 47 } } });
    render(<RetirementCalculator />);

    expect(screen.getByRole('textbox', { name: 'Your age' })).toHaveValue('47');
    expect(screen.getByRole('status', { name: 'Loading results' })).toBeInTheDocument();
    expect(screen.queryByText('Implied Withdrawal Rate')).not.toBeInTheDocument();
    expect(useRetirementStore.getState().results).toBeNull();
  });

  it('runs on the visitor\'s own profile once hydrated', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { investing: { monthlyContribution: 2750 } } });
    await findResults();
    expect(useRetirementStore.getState().inputs?.monthlySavings).toBe(2750);
  });

  it('writes an edit through to the profile and marks it answered', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();

    fireEvent.change(screen.getByRole('textbox', { name: 'Life expectancy' }), { target: { value: '92' } });

    const { profile } = useProfileStore.getState();
    expect(profile.person.lifeExpectancy).toBe(92);
    expect(profile.provided).toContain('person.lifeExpectancy');
  });

  it('keeps the last results, out of date, while life expectancy is below the retirement age', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();

    fireEvent.change(screen.getByRole('textbox', { name: 'Life expectancy' }), { target: { value: '55' } });

    expect(screen.getByText('Results out of date')).toBeInTheDocument();
    expect(screen.getByText('Implied Withdrawal Rate')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Life expectancy' })).toHaveAccessibleDescription(
      /Life expectancy needs to be at least your retirement age\./
    );
  });

  it('hides the custom return inputs under the target-date fund and shows them for Custom', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();
    await showAssumptions();

    expect(screen.queryByRole('textbox', { name: 'Accumulation return' })).not.toBeInTheDocument();
    const risk = screen.getByRole('radiogroup', { name: 'Risk profile' });
    await userEvent.setup().click(within(risk).getByRole('radio', { name: /Custom/ }));

    expect(screen.getByRole('textbox', { name: 'Accumulation return' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Retirement return' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Portfolio volatility' })).toBeInTheDocument();
    expect(useProfileStore.getState().profile.assumptions.retirement.riskProfile).toBe('custom');
  });

  it('estimates the tax rate on auto and starts an override from the estimate', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();
    await showAssumptions();

    const tax = screen.getByRole('group', { name: 'Effective tax rate' });
    // 80,000 single: 8,770 of tax, 10.96%.
    expect(tax).toHaveTextContent('Estimated from your target income and filing status: 10.96%');
    await userEvent.setup().click(within(tax).getByRole('radio', { name: 'Custom' }));

    expect(useProfileStore.getState().profile.assumptions.retirement.effectiveTaxRate).toBeCloseTo(0.109625, 10);
    expect(within(tax).getByRole('textbox', { name: 'Effective tax rate' })).toBeInTheDocument();
  });

  it('notes a filing status the model runs as single, and drops the note once it is one it has (O10)', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { person: { filingStatus: 'headOfHousehold' } } });
    await findResults();

    // Once, with the filing status (not repeated in the results column).
    expect(screen.getAllByText(FILING_NOTE)).toHaveLength(1);
    act(() => useProfileStore.getState().setValues([{ path: 'person.filingStatus', value: 'single' }]));
    expect(screen.queryByText(FILING_NOTE)).not.toBeInTheDocument();
  });

  it('shows the O10 note while there are no results to show', async () => {
    // Retirement age equal to the age: no run, so no results at all.
    renderWithProfile(<RetirementCalculator />, {
      profile: { person: { filingStatus: 'headOfHousehold', age: 60, retirementAge: 60 } },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.queryByText('Implied Withdrawal Rate')).not.toBeInTheDocument();
    expect(screen.getByText(FILING_NOTE)).toBeInTheDocument();
  });

  it('names the O10 mapping in the collapsed basics card once they are all answered', async () => {
    renderWithProfile(<RetirementCalculator />, {
      profile: {
        person: { age: 41, state: 'TX', filingStatus: 'marriedSeparate' },
        income: { grossPerPaycheck: 4000, frequency: 'bi-weekly' },
      },
    });
    await findResults();
    const about = screen.getByRole('region', { name: 'A little about you' });
    expect(within(about).queryByText(/runs here as single/)).not.toBeInTheDocument();
    expect(within(about).getByText(/married filing separately, run here as single/)).toBeInTheDocument();
  });

  it('does not hold results back over take-home pay, which retirement does not read', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { income: { grossPerPaycheck: 3000, netPerPaycheck: 9000 } } });
    await findResults();
    expect(screen.queryByText('Results out of date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Take-home pay per paycheck')).not.toBeInTheDocument();
    expect(useRetirementStore.getState().errors).toEqual({});
  });

  it('strips ?from=profile after a handoff and opens on the results', async () => {
    window.history.replaceState(null, '', '/tools/retirement-calculator?from=profile');
    renderWithProfile(<RetirementCalculator />);
    await findResults();

    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches the shared dollar-display preference from the results', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Future dollars' }));

    expect(usePreferencesStore.getState().displayMode).toBe('nominal');
    expect(screen.getByText('Amounts in future dollars, as of the year they occur')).toBeInTheDocument();
    expect(screen.getByText('in future dollars')).toBeInTheDocument();
  });
});
