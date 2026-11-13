/**
 * The retirement page on the platform: generated sections over the shared
 * profile, live results from the real engine (the worker runner's in-thread
 * fallback in jsdom), no results before hydration, write-through edits, the
 * risk-profile visibility rule, the auto/override tax rate, the filing-status
 * note (O10), the shared dollar-display preference and the methodology
 * link.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      'When to claim Social Security',
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
    // The derived 41,000 target, single: 2,740 of tax, 6.68%.
    expect(tax).toHaveTextContent('Estimated from your target income and filing status: 6.68%');
    await userEvent.setup().click(within(tax).getByRole('radio', { name: 'Custom' }));

    expect(useProfileStore.getState().profile.assumptions.retirement.effectiveTaxRate).toBeCloseTo(2740 / 41000, 10);
    expect(within(tax).getByRole('textbox', { name: 'Effective tax rate' })).toBeInTheDocument();
  });

  it('runs the Social Security estimate on auto, labeled as an estimate, and starts an override from it', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();

    const benefit = screen.getByRole('group', { name: 'Social Security benefit' });
    // 4,000 every two weeks = 104,000 a year: a $40,359 estimate at full retirement age.
    expect(benefit).toHaveTextContent('Estimate from your pay: $40,359');
    expect(within(benefit).queryByRole('textbox', { name: 'Social Security benefit' })).not.toBeInTheDocument();
    expect(useProfileStore.getState().profile.retirementIncome.socialSecurityBenefit).toBeNull();
    expect(useRetirementStore.getState().inputs?.socialSecurityBenefit).toBe(40359);

    await userEvent.setup().click(within(benefit).getByRole('radio', { name: 'Custom' }));
    expect(useProfileStore.getState().profile.retirementIncome.socialSecurityBenefit).toBe(40359);
    expect(within(benefit).getByRole('textbox', { name: 'Social Security benefit' })).toBeInTheDocument();
    expect(benefit).not.toHaveTextContent('Estimate from your pay');

    await userEvent.setup().click(within(benefit).getByRole('radio', { name: 'Auto' }));
    expect(useProfileStore.getState().profile.retirementIncome.socialSecurityBenefit).toBeNull();
  });

  it('keeps an entered Social Security benefit and follows a pay change on auto', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { retirementIncome: { socialSecurityBenefit: 18000 } } });
    await findResults();
    expect(within(screen.getByRole('group', { name: 'Social Security benefit' })).getByRole('radio', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
    expect(useRetirementStore.getState().inputs?.socialSecurityBenefit).toBe(18000);

    act(() => useProfileStore.getState().setValues([{ path: 'retirementIncome.socialSecurityBenefit', value: null }, { path: 'income.grossPerPaycheck', value: 2000 }]));
    // 2,000 x 26 = 52,000 a year; AIME 4,333.33: 1,157.40 + 0.32 x 3,047.33 = 2,132.55 a month, 25,590.60 a year.
    await waitFor(() => expect(useRetirementStore.getState().inputs?.socialSecurityBenefit).toBe(25591));
    expect(screen.getByRole('group', { name: 'Social Security benefit' })).toHaveTextContent('Estimate from your pay: $25,591');
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

describe('RetirementCalculator: the Social Security claiming age', () => {
  const claiming = () => screen.getByRole('radiogroup', { name: 'Social Security claiming age' });
  const radios = () =>
    within(claiming())
      .getAllByRole('radio')
      .map((radio) => [radio.textContent, radio.getAttribute('aria-checked')]);
  const ENTERED = 'Yearly Social Security benefit at each claiming age';
  const ESTIMATED = 'Estimated yearly Social Security benefit at each claiming age';
  const tableRows = (name: string = ENTERED) =>
    within(screen.getByRole('table', { name }))
      .getAllByRole('row')
      .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent));

  it('offers 62 (early), 67 (full) and 70 (late) next to the yearly benefit at each', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();

    expect(radios()).toEqual([
      ['62 (early)', 'false'],
      ['67 (full)', 'true'],
      ['70 (late)', 'false'],
    ]);
    // Auto by default: the estimate from 104,000 a year of pay is $40,359 at
    // 67 (test/lib/calculations/socialSecurityEstimate.test.ts); 30% less at
    // 62 (28,251.30) and 24% more at 70 (50,045.16), the engine's adjustment.
    expect(tableRows(ESTIMATED)).toEqual([
      ['Claiming age', 'Yearly benefit'],
      ['62 (early)', '$28,251'],
      ['67 (full)', '$40,359'],
      ['70 (late)', '$50,045'],
    ]);
    expect(useRetirementStore.getState().inputs?.socialSecurityBenefit).toBe(40359);
  });

  it('shows the entered benefit at each age, under the plain caption', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { retirementIncome: { socialSecurityBenefit: 30000 } } });
    await findResults();
    // $30,000 at 67: 30% less at 62, 24% more at 70 (the engine's adjustment).
    expect(tableRows()).toEqual([
      ['Claiming age', 'Yearly benefit'],
      ['62 (early)', '$21,000'],
      ['67 (full)', '$30,000'],
      ['70 (late)', '$37,200'],
    ]);
    expect(screen.queryByRole('table', { name: ESTIMATED })).not.toBeInTheDocument();
  });

  it('reruns the calculator with the chosen age, as any input does', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();
    expect(useRetirementStore.getState().inputs?.socialSecurityAge).toBe(67);

    await userEvent.setup().click(within(claiming()).getByRole('radio', { name: '70 (late)' }));

    const { profile } = useProfileStore.getState();
    expect(profile.retirementIncome.socialSecurityAge).toBe(70);
    expect(profile.provided).toContain('retirementIncome.socialSecurityAge');
    expect(radios()[2]).toEqual(['70 (late)', 'true']);
    await waitFor(() => expect(useRetirementStore.getState().inputs?.socialSecurityAge).toBe(70));
  });

  it('shows a stored age between the choices as the nearest one, without rewriting it', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { retirementIncome: { socialSecurityAge: 65 } } });
    await findResults();

    expect(radios()).toEqual([
      ['62 (early)', 'false'],
      ['67 (full)', 'true'],
      ['70 (late)', 'false'],
    ]);
    // Storage and the run keep 65 until the visitor picks a choice.
    expect(useProfileStore.getState().profile.retirementIncome.socialSecurityAge).toBe(65);
    expect(useRetirementStore.getState().inputs?.socialSecurityAge).toBe(65);
    // The note says which age the run uses, and the group is described by it.
    expect(claiming()).toHaveAccessibleDescription('Saved age 65 is used until you pick one.');
    await userEvent.setup().click(within(claiming()).getByRole('radio', { name: '62 (early)' }));
    expect(screen.queryByText(/Saved age/)).not.toBeInTheDocument();
  });

  it('follows the entered benefit in the table', async () => {
    renderWithProfile(<RetirementCalculator />, { profile: { retirementIncome: { socialSecurityBenefit: 20000 } } });
    await findResults();
    // $20,000 at 67: $14,000 at 62, $24,800 at 70.
    expect(tableRows().slice(1)).toEqual([
      ['62 (early)', '$14,000'],
      ['67 (full)', '$20,000'],
      ['70 (late)', '$24,800'],
    ]);
  });

  it('is not part of the Social Security and healthcare card any more', async () => {
    renderWithProfile(<RetirementCalculator />);
    await findResults();
    const card = screen.getByRole('region', { name: 'Social Security and healthcare' });
    expect(within(card).queryByRole('radiogroup', { name: 'Social Security claiming age' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('textbox', { name: 'Social Security age' })).not.toBeInTheDocument();
  });
});
