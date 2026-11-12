import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HomePage from '@/app/page';
import sitemap from '@/app/sitemap';
import { EmptyOverview } from '@/components/dashboard/EmptyOverview';
import { ProfileCompletenessCard } from '@/components/dashboard/ProfileCompletenessCard';
import { ContinueProfileCard } from '@/components/guided/ContinueProfileCard';
import { profileCompleteness } from '@/lib/calculators/forms';
import { CORE_PATHS } from '@/lib/constants/intake';
import { intakePaths } from '@/test/utils/intakeFixture';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';

// The ways in: "Get started" answers the shared core at /start first,
// returning visitors go to the /start/choose chooser, and the calculator
// previews and the empty overview link straight to each calculator.

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useProfileStore.getState().reset();
  useProfileStore.setState({ hasHydrated: true });
});

describe('landing page', () => {
  it('has one primary Get started link to the shared core intake', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'BufoIndex' })).toBeInTheDocument();
    const started = screen.getAllByRole('link', { name: /Get started/ });
    expect(started).toHaveLength(1);
    expect(started[0]).toHaveAttribute('href', '/start');
  });

  it('previews each calculator and links straight to it, not into the guided questions', () => {
    render(<HomePage />);
    const section = screen.getByRole('region', { name: 'What you can learn' });
    const hrefs = within(section)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/tools/paycheck-allocator',
      '/tools/retirement-calculator',
      '/tools/portfolio-rebalancing-calculator',
      '/tools/leverage-comparison',
      '/tools',
    ]);
    expect(within(section).getByRole('heading', { name: 'Where should each paycheck go?' })).toBeInTheDocument();
    expect(within(section).getAllByText('Open the calculator')).toHaveLength(4);
    expect(within(section).queryByText('Start with the basics')).not.toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /Just show me the tools/ })).toHaveAttribute('href', '/tools');
  });

  it('keeps the disclaimer', () => {
    render(<HomePage />);
    expect(
      screen.getByText(/Educational tools only\. Results depend on the assumptions you enter/)
    ).toBeInTheDocument();
  });

  it('shows Continue with my profile only when answers are saved', () => {
    const { unmount } = render(<HomePage />);
    expect(screen.queryByRole('link', { name: /Continue with my profile/ })).not.toBeInTheDocument();
    unmount();

    useProfileStore.getState().setFields({}, [...CORE_PATHS]);
    render(<HomePage />);
    expect(screen.getByRole('link', { name: /Continue with my profile/ })).toHaveAttribute('href', '/start/choose');
  });
});

describe('ContinueProfileCard', () => {
  it('renders nothing before hydration or without saved answers', () => {
    useProfileStore.setState({ hasHydrated: false });
    useProfileStore.getState().setFields({}, [...CORE_PATHS]);
    const first = render(<ContinueProfileCard />);
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();

    useProfileStore.getState().reset();
    useProfileStore.setState({ hasHydrated: true });
    const second = render(<ContinueProfileCard />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it('leads to the chooser with the core summary and how much is saved', () => {
    useProfileStore.getState().setFields({}, [...CORE_PATHS]);
    render(<ContinueProfileCard />);

    const link = screen.getByRole('link', { name: /Continue with my profile/ });
    expect(link).toHaveAttribute('href', '/start/choose');
    // Default core values, all marked as answered (take-home is not summarized).
    expect(link).toHaveTextContent(
      '30, TX, single, $3,500 every 2 weeks, $3,000/mo must-pay. 3 of 17 topics answered, saved in this browser.'
    );
  });

  it('drops the summary when no summarized answer is saved', () => {
    useProfileStore.getState().setFields({}, ['investing.investedBalance']);
    render(<ContinueProfileCard />);
    const link = screen.getByRole('link', { name: /Continue with my profile/ });
    // One invested-balance answer completes no topic (O14).
    expect(link).toHaveTextContent('0 of 17 topics answered, saved in this browser.');
    expect(link).not.toHaveTextContent('must-pay');
  });
});

describe('EmptyOverview', () => {
  it('starts with the basics, then links each calculator directly', () => {
    render(<EmptyOverview />);
    expect(screen.getByRole('link', { name: /Start with the basics/ })).toHaveAttribute('href', '/start');
    expect(screen.getByText('Or open a calculator directly')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Or open a calculator directly' });
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/tools/paycheck-allocator',
      '/tools/retirement-calculator',
      '/tools/portfolio-rebalancing-calculator',
      '/tools/leverage-comparison',
    ]);
    expect(within(list).getByRole('link', { name: /^Paycheck Allocator/ })).toHaveAttribute('href', '/tools/paycheck-allocator');
    expect(within(list).getByRole('link', { name: /^Retirement Calculator/ })).toHaveAttribute(
      'href',
      '/tools/retirement-calculator'
    );
    expect(within(list).getByRole('link', { name: /^Portfolio Rebalancer/ })).toHaveAttribute(
      'href',
      '/tools/portfolio-rebalancing-calculator'
    );
    expect(within(list).getByRole('link', { name: /^Leverage Comparison/ })).toHaveAttribute(
      'href',
      '/tools/leverage-comparison'
    );
    expect(screen.queryByText('Or answer the basics, then go straight to one calculator')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Then a paycheck/ })).not.toBeInTheDocument();
  });
});

describe('ProfileCompletenessCard (overview)', () => {
  const withProvided = (provided: string[]) => ({ ...getDefaultFinancialProfile(), provided });

  it('fills in the rest through /start/profile while profile questions remain', () => {
    render(<ProfileCompletenessCard profile={withProvided([...CORE_PATHS])} />);
    expect(screen.getByRole('link', { name: /Fill in the rest/ })).toHaveAttribute('href', '/start/profile');
    expect(screen.queryByRole('link', { name: /Edit the basics/ })).not.toBeInTheDocument();
  });

  it('edits the basics once no profile question is left, instead of bouncing back to the overview', () => {
    // Counted by topic screen (O14): every topic the profile intake asks is
    // answered. The never-asked emergency-fund target months are no topic,
    // and the v1 new cash (now the accounts' deposits) is no profile path, so
    // neither is listed.
    const { unmount } = render(<ProfileCompletenessCard profile={withProvided(intakePaths('profile'))} />);
    const { total } = profileCompleteness(withProvided([]));
    expect(screen.getByText(`${total} of ${total}`)).toBeInTheDocument();
    expect(screen.getByText('Every topic has an answer from you.')).toBeInTheDocument();
    expect(screen.queryByText(/Emergency fund target/)).not.toBeInTheDocument();
    expect(screen.queryByText('New cash to invest this month')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit the basics/ })).toHaveAttribute('href', '/start');
    expect(screen.queryByRole('link', { name: /Fill in the rest/ })).not.toBeInTheDocument();
    unmount();

    render(<ProfileCompletenessCard profile={withProvided([...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS])} />);
    expect(screen.getByText('Every topic has an answer from you.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit the basics/ })).toHaveAttribute('href', '/start');
  });
});

describe('sitemap', () => {
  it('lists the landing page and the calculators but not the noindex guided-flow steps', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain('https://bufoindex.com');
    expect(urls).toContain('https://bufoindex.com/tools/leverage-comparison');
    expect(urls.filter((url) => url.includes('/start'))).toEqual([]);
    expect(urls.filter((url) => url.includes('/overview'))).toEqual([]);
  });
});
