import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HomePage from '@/app/page';
import sitemap from '@/app/sitemap';
import { EmptyOverview } from '@/components/dashboard/EmptyOverview';
import { ProfileCompletenessCard } from '@/components/dashboard/ProfileCompletenessCard';
import { ContinueProfileCard } from '@/components/guided/ContinueProfileCard';
import { CORE_PATHS, intakePaths } from '@/lib/constants/intake';
import { PROFILE_FIELDS, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';

// The ways into the guided flow: every path answers the shared core at
// /start first, and returning visitors go to the /start/choose chooser.

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

  it('previews each calculator and routes it through the core first', () => {
    render(<HomePage />);
    const section = screen.getByRole('region', { name: 'What you can learn' });
    const hrefs = within(section)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/start?next=paycheck',
      '/start?next=retirement',
      '/start?next=portfolio',
      '/start?next=leverage',
      '/tools',
    ]);
    expect(within(section).getByRole('heading', { name: 'Where should each paycheck go?' })).toBeInTheDocument();
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
      `30, TX, single, $3,500 every 2 weeks, $3,000/mo must-pay. ${CORE_PATHS.length} of ${PROFILE_FIELDS.length} details saved in this browser.`
    );
  });

  it('drops the summary when no summarized answer is saved', () => {
    useProfileStore.getState().setFields({}, ['investing.investedBalance']);
    render(<ContinueProfileCard />);
    const link = screen.getByRole('link', { name: /Continue with my profile/ });
    expect(link).toHaveTextContent(`1 of ${PROFILE_FIELDS.length} details saved in this browser.`);
    expect(link).not.toHaveTextContent('must-pay');
  });
});

describe('EmptyOverview', () => {
  it('starts with the basics, then offers each calculator through the core', () => {
    render(<EmptyOverview />);
    expect(screen.getByRole('link', { name: /Start with the basics/ })).toHaveAttribute('href', '/start');
    expect(screen.getByRole('link', { name: /Then a paycheck/ })).toHaveAttribute('href', '/start?next=paycheck');
    expect(screen.getByRole('link', { name: /Then retirement/ })).toHaveAttribute('href', '/start?next=retirement');
    expect(screen.getByRole('link', { name: /Then a portfolio/ })).toHaveAttribute('href', '/start?next=portfolio');
    expect(screen.getByRole('link', { name: /Then the leverage comparison/ })).toHaveAttribute(
      'href',
      '/start?next=leverage'
    );
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
    const { unmount } = render(<ProfileCompletenessCard profile={withProvided(intakePaths('profile'))} />);
    // Four fields are never asked by the intake, so they stay listed.
    expect(screen.getByText(`${intakePaths('profile').length} of ${PROFILE_FIELDS.length}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit the basics/ })).toHaveAttribute('href', '/start');
    expect(screen.queryByRole('link', { name: /Fill in the rest/ })).not.toBeInTheDocument();
    unmount();

    render(<ProfileCompletenessCard profile={withProvided(PROFILE_FIELDS.map((field) => field.path))} />);
    expect(screen.getByText('Every field has an answer from you.')).toBeInTheDocument();
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
