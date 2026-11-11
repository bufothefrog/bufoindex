/**
 * The leverage comparison page on the shared calculator page: default
 * inputs on the server and before hydration with no results until the
 * profile store has hydrated (plan section 5), live results from the
 * profile (the c, y, b and l query keys are stripped and ignored), edits
 * written through to the profile, and invalid inputs keeping the last
 * results, marked out of date.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LeverageComparisonPage, { metadata } from '@/app/tools/leverage-comparison/page';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useLeverageStore } from '@/lib/store/leverageStore';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

function page() {
  return (
    <ThemeProvider>
      <LeverageComparisonPage />
    </ThemeProvider>
  );
}

const tile = (name: string) => screen.getByRole('group', { name });
const results = () => screen.getByRole('region', { name: 'Leverage comparison results' });
const sourceSwitch = (label: string) => screen.getByRole('radiogroup', { name: `${label}: auto or custom` });

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  useLeverageStore.getState().reset();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LeverageComparison page', () => {
  it('takes its title and description from the registry', () => {
    expect(metadata).toEqual({
      title: 'Leverage Comparison',
      description:
        'Simulate monthly contributions into a plain index fund and a daily-reset leveraged fund on the same dates, with ending-balance percentiles, drawdowns, and the lump-sum framing shown side by side.',
    });
  });

  it('renders the default inputs on the server, with no results', () => {
    resetProfileStore({ hydrated: false });
    const html = renderToString(page());
    expect(html).toContain('Leverage Comparison');
    expect(html).toContain('Contributions');
    expect(html).toContain('Your monthly taxable contribution');
    expect(html).toContain('Loading results');
    expect(html).not.toContain('median ending balance');
  });

  it('shows no results before hydration, then the comparison for the profile', () => {
    resetProfileStore({ hydrated: false });
    render(page());
    expect(screen.getByRole('heading', { level: 1, name: 'Leverage Comparison' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading results' })).toBeInTheDocument();
    expect(screen.queryByText(/median ending balance/)).not.toBeInTheDocument();

    act(() => useProfileStore.setState({ hasHydrated: true }));
    expect(screen.queryByRole('status', { name: 'Loading results' })).not.toBeInTheDocument();
    // The default profile: $500 taxable a month for 30 years plus $25,000.
    expect(tile('Share of simulated paths where the 2x fund ends behind the index fund')).toHaveTextContent(
      '$205,000 contributed to each over 30 years, 500 paths'
    );
    expect(results()).toHaveTextContent('Index fund, median ending balance');
    expect(results()).toHaveTextContent('Cash flow vs lump sum');
    expect(
      screen.getByRole('figure', { name: /Lines are the median balance across 500 simulated paths/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /under monthly contributions and a lump sum/ })).toHaveTextContent(
      '$500/mo + $25.0k start'
    );
  });

  it('has live results and no Calculate button', () => {
    render(page());
    expect(screen.queryByRole('button', { name: /Calculate|Compare/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /See results/ })).toBeInTheDocument();
  });

  it('ignores the old c, y, b and l query and shows the profile', () => {
    window.history.replaceState(null, '', '/tools/leverage-comparison?c=100&y=5&b=0&l=3');
    render(page());
    expect(window.location.search).toBe('');
    expect(tile('2x fund, median ending balance')).toBeInTheDocument();
    expect(tile('Share of simulated paths where the 2x fund ends behind the index fund')).toHaveTextContent('over 30 years');
  });

  it('shows where each auto value comes from, and the ratio and assumptions it uses', () => {
    render(page());
    const contribution = screen.getByRole('group', { name: 'Monthly contribution' });
    expect(contribution).toHaveTextContent('Your monthly taxable contribution: $500');
    expect(screen.getByRole('group', { name: 'Years' })).toHaveTextContent(
      'From your age to the age you plan to stop contributing: 30 yrs'
    );
    expect(screen.getByRole('group', { name: 'Starting balance' })).toHaveTextContent(
      'What you already have invested: $25,000'
    );
    expect(screen.getByLabelText('Leverage ratio')).toHaveValue('2');
    // The assumptions start collapsed, summarized in one line.
    const market = screen.getByRole('region', { name: 'Assumptions' });
    expect(market).toHaveTextContent('10.0% return, 16.0% volatility, 4.50% financing');
  });

  it('writes an override through to the profile and recalculates', async () => {
    const user = userEvent.setup();
    render(page());
    await user.click(within(sourceSwitch('Years')).getByRole('radio', { name: 'Custom' }));
    const years = screen.getByRole('textbox', { name: 'Years' });
    expect(years).toHaveValue('30');
    fireEvent.change(years, { target: { value: '12' } });

    const { profile } = useProfileStore.getState();
    expect(profile.leverage.years).toBe(12);
    expect(profile.provided).toContain('leverage.years');
    await act(() => useLeverageStore.getState().flush());
    expect(tile('Share of simulated paths where the 2x fund ends behind the index fund')).toHaveTextContent(
      '$97,000 contributed to each over 12 years, 500 paths'
    );

    // Back to auto: the override is cleared and the horizon derives again.
    await user.click(within(sourceSwitch('Years')).getByRole('radio', { name: 'Auto' }));
    expect(useProfileStore.getState().profile.leverage.years).toBeNull();
  });

  it('saves the leverage ratio to the profile', async () => {
    const user = userEvent.setup();
    render(page());
    await user.selectOptions(screen.getByLabelText('Leverage ratio'), '3x (UPRO-like daily-reset fund)');
    expect(useProfileStore.getState().profile.strategy.leverageRatio).toBe(3);
    await act(() => useLeverageStore.getState().flush());
    expect(tile('3x fund, median ending balance')).toBeInTheDocument();
  });

  it('keeps the last results, marked out of date, while nothing is invested', async () => {
    const user = userEvent.setup();
    render(page());
    await user.click(within(sourceSwitch('Monthly contribution')).getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Monthly contribution' }), { target: { value: '0' } });
    await user.click(within(sourceSwitch('Starting balance')).getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Starting balance' }), { target: { value: '0' } });

    const status = screen.getAllByRole('status').find((node) => node.textContent?.includes('Results out of date'));
    expect(status).toHaveTextContent('Enter a monthly contribution or a starting balance.');
    expect(tile('2x fund, median ending balance')).toBeInTheDocument();
  });

  it('restores the default assumptions', async () => {
    const user = userEvent.setup();
    useProfileStore.getState().setValues([{ path: 'assumptions.leverage.indexMeanReturn', value: 0.02 }]);
    render(page());
    const market = screen.getByRole('region', { name: 'Assumptions' });
    expect(market).toHaveTextContent('2.0% return');
    await user.click(within(market).getByRole('button', { name: 'Restore defaults for assumptions' }));
    const { profile } = useProfileStore.getState();
    expect(profile.assumptions.leverage.indexMeanReturn).toBe(0.1);
    expect(profile.provided).not.toContain('assumptions.leverage.indexMeanReturn');
  });
});
