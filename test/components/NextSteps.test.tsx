import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextSteps } from '@/components/guided/NextSteps';
import { intakePaths } from '@/test/utils/intakeFixture';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';

beforeEach(() => {
  localStorage.clear();
  useProfileStore.getState().reset();
  useProfileStore.setState({ hasHydrated: true });
});

function linkNamed(name: RegExp) {
  return screen.getByRole('link', { name });
}

/**
 * The "Try another calculator" list: [name, href] for each link, in order.
 * Each link's name starts with the calculator name, then its description.
 */
function otherCalculators() {
  const list = screen.getByRole('list', { name: 'Try another calculator' });
  const names = ['Paycheck Allocator', 'Retirement Calculator', 'Portfolio Rebalancer', 'Leverage Comparison'];
  return within(list)
    .getAllByRole('link')
    .map((link) => [
      names.find((name) => (link.textContent ?? '').startsWith(name)) ?? link.textContent,
      link.getAttribute('href'),
    ]);
}

describe('NextSteps', () => {
  it('renders nothing before the persisted profile hydrates', () => {
    useProfileStore.setState({ hasHydrated: false });
    const { container } = render(<NextSteps intent="retirement" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the shared core questions, returning to this calculator, when no profile exists', () => {
    render(<NextSteps intent="retirement" />);

    expect(screen.getByRole('heading', { name: 'What next?' })).toBeInTheDocument();
    expect(screen.getByText('Answer once and the answers carry across every calculator.')).toBeInTheDocument();
    expect(linkNamed(/Answer a few quick questions/)).toHaveAttribute('href', '/start?next=retirement');

    expect(screen.queryByText('Your answers are saved in this browser.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Try another calculator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Finish your profile/ })).not.toBeInTheDocument();
  });

  it('uses the calculator it sits on for the intake link', () => {
    render(<NextSteps intent="leverage" />);
    expect(linkNamed(/Answer a few quick questions/)).toHaveAttribute('href', '/start?next=leverage');
  });

  it('sends the no-profile portfolio link straight to its intake and the other calculators through the core (O5)', () => {
    const cases = [
      ['portfolio', '/start/portfolio'],
      ['retirement', '/start?next=retirement'],
      ['paycheck', '/start?next=paycheck'],
      ['leverage', '/start?next=leverage'],
    ] as const;
    for (const [intent, href] of cases) {
      const { unmount } = render(<NextSteps intent={intent} />);
      expect.soft(linkNamed(/Answer a few quick questions/)).toHaveAttribute('href', href);
      unmount();
    }
  });

  it('offers to finish the profile and links the other calculators directly when a partial profile exists', () => {
    useProfileStore
      .getState()
      .setFields({ person: { age: 41, state: 'CA' } }, ['person.age', 'person.state', 'person.filingStatus']);

    render(<NextSteps intent="paycheck" />);

    expect(screen.getByText('Your answers are saved in this browser.')).toBeInTheDocument();

    const finish = linkNamed(/Finish your profile/);
    expect(finish).toHaveAttribute('href', '/start/profile');
    // Counted by topic screen (O14): age, state and filing status make one topic.
    expect(finish).toHaveTextContent('1 of 17 topics answered.');
    expect(finish).toHaveTextContent('Answer the rest once; every calculator and your overview use it.');

    expect(screen.getByText('Try another calculator')).toBeInTheDocument();
    expect(otherCalculators()).toEqual([
      ['Retirement Calculator', '/tools/retirement-calculator'],
      ['Portfolio Rebalancer', '/tools/portfolio-rebalancing-calculator'],
      ['Leverage Comparison', '/tools/leverage-comparison'],
    ]);
    expect(screen.queryByRole('link', { name: /Paycheck Allocator/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Try another calculator/ })).not.toBeInTheDocument();

    expect(screen.queryByRole('link', { name: /See your overview/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Answer a few quick questions/ })).not.toBeInTheDocument();
  });

  it('offers the overview once the profile questions run out, even with never-asked fields missing', () => {
    const asked = intakePaths('profile');
    useProfileStore.getState().setFields({}, asked);
    // The intake never asks a few fields, so /start/profile would only
    // redirect to the overview; link it directly instead.
    expect(PROFILE_LEAF_PATHS.filter((path) => !asked.includes(path)).length).toBeGreaterThan(0);

    render(<NextSteps intent="retirement" />);

    expect(linkNamed(/See your overview/)).toHaveAttribute('href', '/overview');
    expect(otherCalculators()).toEqual([
      ['Paycheck Allocator', '/tools/paycheck-allocator'],
      ['Portfolio Rebalancer', '/tools/portfolio-rebalancing-calculator'],
      ['Leverage Comparison', '/tools/leverage-comparison'],
    ]);
    expect(screen.queryByRole('link', { name: /Finish your profile/ })).not.toBeInTheDocument();
  });

  it('swaps "Finish your profile" for the overview once every field is answered', () => {
    useProfileStore.getState().setFields({}, [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS]);

    render(<NextSteps intent="portfolio" />);

    expect(linkNamed(/See your overview/)).toHaveAttribute('href', '/overview');
    expect(otherCalculators()).toEqual([
      ['Paycheck Allocator', '/tools/paycheck-allocator'],
      ['Retirement Calculator', '/tools/retirement-calculator'],
      ['Leverage Comparison', '/tools/leverage-comparison'],
    ]);
    expect(screen.queryByRole('link', { name: /Finish your profile/ })).not.toBeInTheDocument();
  });

  it('keeps every link at the 44px minimum tap target', () => {
    useProfileStore.getState().setFields({ person: { age: 41 } }, ['person.age']);
    render(<NextSteps intent="paycheck" />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-\[64px\]/);
    }
  });
});
