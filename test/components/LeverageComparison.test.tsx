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
const sections = () => [
  screen.getByRole('region', { name: 'Contributions' }),
  screen.getByRole('region', { name: 'What do you have saved and invested?' }),
  screen.getByRole('region', { name: 'Assumptions' }),
];
const toggleOf = (section: HTMLElement) =>
  within(within(section).getByRole('group', { name: /^Controls for / })).getByRole('button', { name: /^(Show|Hide|Edit|Done) / });

/** The input cards start collapsed: open Contributions to reach its fields. */
async function openContributions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(toggleOf(screen.getByRole('region', { name: 'Contributions' })));
}

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
        'Simulate monthly contributions into a plain index fund and a daily-reset leveraged fund on the same dates, with ending-balance percentiles, drawdowns, and the same yearly amount invested at the start of each year, side by side.',
    });
  });

  it('renders the default inputs on the server, collapsed to their summaries, with no results', () => {
    resetProfileStore({ hydrated: false });
    const html = renderToString(page());
    expect(html).toContain('Leverage Comparison');
    expect(html).toContain('Contributions');
    // The server render already shows every card collapsed (no fold after
    // hydration): the summary line, no field, no open card.
    expect(html).toContain('$500/mo, 40 years, $25,000 start, 2x fund');
    expect(html).not.toContain('Your monthly taxable contribution');
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    expect(html).not.toContain('aria-expanded="true"');
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
    // The default profile: $500 taxable a month for 40 years (age 25 to 65) plus $25,000.
    expect(tile('Share of simulated paths where the 2x fund ends behind the index fund')).toHaveTextContent(
      '$265,000 contributed to each over 40 years, 500 paths'
    );
    expect(results()).toHaveTextContent('Index fund, median ending balance');
    expect(results()).toHaveTextContent('Monthly vs start of each year');
    expect(
      screen.getByRole('figure', { name: /Lines are the median balance across 500 simulated paths/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /with the same yearly amount invested monthly or at the start of each year/ })
    ).toHaveTextContent('$500/mo + $25.0k start');
  });

  it('compares monthly with the same yearly amount at the start of each year, at the default profile', () => {
    render(page());
    const card = screen.getByRole('table', {
      name: "Median ending balances in today's dollars for the index fund and the 2x fund with the same yearly amount invested monthly or at the start of each year; contributions as entered",
    });
    expect(within(card).getByRole('columnheader', { name: 'Timing' })).toBeInTheDocument();
    const rows = within(card)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent ?? ''));
    // Today's dollars = nominal / 1.03^40 (3.26204). Monthly (unchanged):
    // 2,533,597.60 / 3,008,809.28 -> $776,692 / $922,371, gap +$145,679 (+18.8%).
    // Start of each year: 2,595,327.26 / 3,096,306.82 -> $795,615 / $949,194,
    // gap +$153,579 (+19.3%). The table prints compact figures.
    expect(rows).toEqual([
      ['Monthly$500/mo + $25.0k start', '$777k', '$922k', '+$146k+18.8%'],
      ['Start of each year$6.0k/yr + $25.0k start', '$796k', '$949k', '+$154k+19.3%'],
    ]);
    // The two relative gaps differ by 0.55 points, under the 5.66-point noise
    // threshold at 40 years (4 x sqrt(40 / 20)).
    expect(
      screen.getByText(
        "With monthly contributions the 2x fund's median ends above the index fund's median by $146k (+18.8% of the index median). " +
          'Investing the same $6.0k a year at the start of each year gives a gap of +$154k (+19.3%). ' +
          'The two relative gaps differ by 0.5 percentage points, which is within the sampling error of 500 simulated paths, ' +
          'so at these settings this run does not separate the two timings.'
      )
    ).toBeInTheDocument();
    expect(results()).toHaveTextContent(
      'Paths where the 2x fund ends behind: 40% with monthly contributions, 40% at the start of each year.'
    );
    expect(results()).toHaveTextContent(
      "Each year's amount goes in at the start of the year, before most of the monthly amounts, and at these settings that makes its median balance larger than the monthly median under both funds."
    );
  });

  it('renders no lump-sum wording anywhere on the page', () => {
    const { container } = render(page());
    expect(results()).toHaveTextContent('Monthly vs start of each year');
    expect(container.textContent ?? '').not.toMatch(/lump/i);
    expect(document.title).not.toMatch(/lump/i);
    expect(metadata.description ?? '').not.toMatch(/lump/i);
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
    expect(tile('Share of simulated paths where the 2x fund ends behind the index fund')).toHaveTextContent('over 40 years');
  });

  it('shows where each auto value comes from, and the ratio and assumptions it uses', async () => {
    const user = userEvent.setup();
    render(page());
    await openContributions(user);
    const contribution = screen.getByRole('group', { name: 'Monthly contribution' });
    expect(contribution).toHaveTextContent('Your monthly taxable contribution: $500');
    expect(screen.getByRole('group', { name: 'Years' })).toHaveTextContent(
      'From your age to the age you plan to stop contributing: 40 yrs'
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
    await openContributions(user);
    await user.click(within(sourceSwitch('Years')).getByRole('radio', { name: 'Custom' }));
    const years = screen.getByRole('textbox', { name: 'Years' });
    expect(years).toHaveValue('40');
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
    await openContributions(user);
    await user.selectOptions(screen.getByLabelText('Leverage ratio'), '3x (UPRO-like daily-reset fund)');
    expect(useProfileStore.getState().profile.strategy.leverageRatio).toBe(3);
    await act(() => useLeverageStore.getState().flush());
    expect(tile('3x fund, median ending balance')).toBeInTheDocument();
  });

  it('keeps the last results, marked out of date, while nothing is invested', async () => {
    const user = userEvent.setup();
    render(page());
    await openContributions(user);
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

  describe('the input cards', () => {
    // No matchMedia stub decides this: the cards start collapsed at every
    // width (the beforeEach stub matches no query).
    it('start collapsed, each showing its summary line', () => {
      render(page());
      const [contributions, accounts, market] = sections();
      for (const section of sections()) expect(toggleOf(section)).toHaveAttribute('aria-expanded', 'false');
      expect(contributions).toHaveTextContent('$500/mo, 40 years, $25,000 start, 2x fund');
      expect(within(contributions).queryByRole('textbox')).not.toBeInTheDocument();
      expect(accounts).toHaveTextContent('Brokerage');
      expect(market).toHaveTextContent('10.0% return, 16.0% volatility, 4.50% financing');
    });

    it('keep a card the visitor opened open while they edit it, and the others collapsed', async () => {
      const user = userEvent.setup();
      render(page());
      const [contributions, accounts, market] = sections();
      await user.click(toggleOf(contributions));
      expect(toggleOf(contributions)).toHaveAttribute('aria-expanded', 'true');

      await user.selectOptions(screen.getByLabelText('Leverage ratio'), '3x (UPRO-like daily-reset fund)');
      expect(useProfileStore.getState().profile.strategy.leverageRatio).toBe(3);
      expect(toggleOf(contributions)).toHaveAttribute('aria-expanded', 'true');
      expect(within(contributions).getByLabelText('Leverage ratio')).toBeInTheDocument();
      expect(toggleOf(accounts)).toHaveAttribute('aria-expanded', 'false');
      expect(toggleOf(market)).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
