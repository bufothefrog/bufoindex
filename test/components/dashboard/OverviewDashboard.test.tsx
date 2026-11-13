/**
 * The overview page around the cards: nothing profile-dependent before the
 * profile store has hydrated, the empty state, no strategy preset (removed in
 * slice c1), the rebalancer line, the completeness card counted by topic
 * (O14) and the disclaimer.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import OverviewDashboard from '@/components/dashboard/OverviewDashboard';
import { ProfileCompletenessCard } from '@/components/dashboard/ProfileCompletenessCard';
import { profileCompleteness } from '@/lib/calculators/forms';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetProfileStore } from '@/test/utils/stores';

describe('before the profile store has hydrated', () => {
  it('shows only the loading skeleton, even with answers in the store', () => {
    resetProfileStore({ hydrated: false, profile: { person: { age: 41 }, strategy: { leverageRatio: 3 } } });
    render(<OverviewDashboard />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your overview' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading your overview' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset profile/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-empty')).not.toBeInTheDocument();
    for (const id of ['paycheck', 'retirement', 'cash', 'leverage', 'automation', 'completeness']) {
      expect(screen.queryByTestId(`overview-${id}`)).not.toBeInTheDocument();
    }
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});

describe('without a saved profile', () => {
  it('shows the empty state and no strategy control', () => {
    resetProfileStore();
    render(<OverviewDashboard />);
    expect(screen.getByTestId('overview-empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start with the basics/ })).toHaveAttribute('href', '/start');
    expect(screen.getByRole('link', { name: /^Leverage Comparison/ })).toHaveAttribute('href', '/tools/leverage-comparison');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-paycheck')).not.toBeInTheDocument();
  });
});

describe('with a saved profile', () => {
  it('has no strategy switch and no preset summary: nothing names a starting point or a 1-month fund', () => {
    resetProfileStore({ profile: { person: { age: 30 } } });
    render(<OverviewDashboard />);
    expect(screen.queryByRole('radiogroup', { name: 'Strategy' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Cash-flow investor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Standard/)).not.toBeInTheDocument();
    expect(screen.queryByText(/preset/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 month/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset profile/ })).toBeInTheDocument();
  });

  it('measures the cash buffer against the stored months, also an entered 1 month', () => {
    // An answered 1 is the visitor's own; only an unanswered stored 1 loads as 3 (lib/profile/defaults.ts).
    resetProfileStore({ profile: { person: { age: 30 }, cash: { targetMonths: 1 } } });
    render(<OverviewDashboard />);
    expect(useProfileStore.getState().profile.cash.targetMonths).toBe(1);
    expect(within(screen.getByTestId('overview-cash')).getByText('$3,000')).toBeInTheDocument();
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
      '-Fun money and bonuses',
      '-Emergency fund',
    ]);
    expect(screen.getByText(`and ${total - 1 - 6} more.`)).toBeInTheDocument();
  });

  it('leaves the optional Social Security and healthcare screen out of the count, answered or not', () => {
    const optional = ['retirementIncome.socialSecurityBenefit', 'retirementIncome.annualHealthcareCost'];
    const rest = [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS].filter((path) => !optional.includes(path));
    const { total } = profileCompleteness(withProvided([]));
    for (const provided of [rest, [...rest, ...optional]]) {
      const { unmount } = render(<ProfileCompletenessCard profile={withProvided(provided)} />);
      expect(screen.getByText(`${total} of ${total}`)).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: 'Profile topics answered' })).toHaveAttribute('aria-valuenow', String(total));
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
      unmount();
    }
    // With only the basics answered, the optional screen is not listed as missing either.
    render(<ProfileCompletenessCard profile={withProvided(['person.age', 'person.state', 'person.filingStatus'])} />);
    expect(screen.queryByText('Social Security and healthcare')).not.toBeInTheDocument();
  });

  it('is complete for a visitor who answered every profile path', () => {
    const answered = [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS];
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
