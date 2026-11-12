/**
 * The overview page around the cards: nothing profile-dependent before the
 * profile store has hydrated, the empty state, the strategy control (a radio
 * group over the shared preset labels), the strategy summary, the rebalancer
 * line, the completeness card counted by topic (O14) and the disclaimer.
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import OverviewDashboard from '@/components/dashboard/OverviewDashboard';
import { ProfileCompletenessCard } from '@/components/dashboard/ProfileCompletenessCard';
import { profileCompleteness } from '@/lib/calculators/forms';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetProfileStore } from '@/test/utils/stores';

afterEach(() => {
  cleanup();
});

describe('before the profile store has hydrated', () => {
  it('shows only the loading skeleton, even with answers in the store', () => {
    resetProfileStore({ hydrated: false, profile: { person: { age: 41 }, strategy: { preset: 'standard' } } });
    render(<OverviewDashboard />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your overview' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading your overview' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset profile/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-empty')).not.toBeInTheDocument();
    for (const id of ['paycheck', 'retirement', 'cash', 'leverage', 'automation', 'completeness']) {
      expect(screen.queryByTestId(`overview-${id}`)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Standard:/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});

describe('without a saved profile', () => {
  it('shows the empty state and no strategy control', () => {
    resetProfileStore();
    render(<OverviewDashboard />);
    expect(screen.getByTestId('overview-empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start with the basics/ })).toHaveAttribute('href', '/start');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-paycheck')).not.toBeInTheDocument();
  });
});

describe('with a saved profile', () => {
  it('summarizes the active preset with the shared label', () => {
    resetProfileStore({ profile: { person: { age: 30 } } });
    render(<OverviewDashboard />);
    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'P' && (element.textContent ?? '').startsWith('Cash-flow investor:')
      )
    ).toHaveTextContent(
      'Cash-flow investor: 1 month of necessary expenses in cash, with steady income as the backstop, and a 2x daily-reset fund compared for taxable contributions. Switch the preset above to see the alternative; the cash buffer card shows both targets either way.'
    );
  });

  it('switches the preset in a radio group; the cash target follows it unless the visitor set one', () => {
    resetProfileStore({ profile: { person: { age: 30 } } });
    render(<OverviewDashboard />);
    const strategy = screen.getByRole('radiogroup', { name: 'Strategy' });
    const radios = within(strategy).getAllByRole('radio');
    expect(radios.map((radio) => [radio.textContent, radio.getAttribute('aria-checked')])).toEqual([
      ['Cash-flow investor', 'true'],
      ['Standard', 'false'],
    ]);

    fireEvent.click(within(strategy).getByRole('radio', { name: 'Standard' }));
    let { profile } = useProfileStore.getState();
    expect(profile.strategy.preset).toBe('standard');
    expect(profile.cash.targetMonths).toBe(3);
    expect(profile.provided).toContain('strategy.preset');
    expect(profile.provided).not.toContain('cash.targetMonths');
    expect(within(strategy).getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/^Standard:/)).toBeInTheDocument();

    cleanup();
    resetProfileStore({ profile: { cash: { targetMonths: 2 } } });
    render(<OverviewDashboard />);
    fireEvent.click(screen.getByRole('radio', { name: 'Standard' }));
    ({ profile } = useProfileStore.getState());
    expect(profile.strategy.preset).toBe('standard');
    expect(profile.cash.targetMonths).toBe(2);
  });

  it.each([
    ['60-40', 'with the 60% stocks, 40% bonds target mix'],
    ['100-0', 'with the 100% stocks target mix'],
    ['custom', 'with the custom target mix'],
  ] as const)('names the %s target mix in the rebalancer line', (targetMix, text) => {
    resetProfileStore({ profile: { investing: { targetMix } } });
    render(<OverviewDashboard />);
    expect(screen.getByText(/Also seeded from this profile/)).toHaveTextContent(
      `Also seeded from this profile: the portfolio rebalancer, ${text} and this month's new cash.`
    );
    expect(screen.getByRole('link', { name: /Open the rebalancer/ })).toHaveAttribute(
      'href',
      '/tools/portfolio-rebalancing-calculator?from=profile'
    );
  });

  it('ends with the overview disclaimer', () => {
    resetProfileStore();
    render(<OverviewDashboard />);
    expect(
      screen.getByText(
        'This overview provides educational information only and should not be considered personalized financial advice. Every figure is a model output from the inputs and assumptions shown; the profile is stored only in this browser. Consider consulting with a qualified financial advisor before making significant financial decisions.'
      )
    ).toBeInTheDocument();
  });
});

describe('ProfileCompletenessCard', () => {
  const withProvided = (provided: string[]) => ({ ...getDefaultFinancialProfile(), provided });

  it('counts topics and lists the unanswered ones by title', () => {
    render(<ProfileCompletenessCard profile={withProvided(['person.age', 'person.state', 'person.filingStatus'])} />);
    const { total } = profileCompleteness(withProvided([]));
    expect(screen.getByText(`1 of ${total}`)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Profile topics answered' })).toHaveAttribute('aria-valuenow', '1');
    const missing = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(missing).toEqual([
      '-What does a typical paycheck look like?',
      '-What do you have to pay each month?',
      '-What are you investing today?',
      '-When would you like to retire?',
      '-Social Security and healthcare',
      '-Fun money and bonuses',
    ]);
    expect(screen.getByText(`and ${total - 1 - 6} more.`)).toBeInTheDocument();
  });

  it('is complete for a visitor who answered everything but the deprecated new cash', () => {
    const answered = [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS].filter((path) => path !== 'investing.newCashThisMonth');
    render(<ProfileCompletenessCard profile={withProvided(answered)} />);
    const { total } = profileCompleteness(withProvided([]));
    expect(screen.getByText(`${total} of ${total}`)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Every topic has an answer from you.')).toBeInTheDocument();
    expect(screen.queryByText(/New cash to invest this month/)).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit the basics/ })).toHaveAttribute('href', '/start');
  });
});
