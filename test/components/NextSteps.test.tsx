import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextSteps } from '@/components/guided/NextSteps';
import { PROFILE_FORM, profileCompleteness } from '@/lib/calculators/forms';
import { CORE_PATHS, intakePaths } from '@/lib/constants/intake';
import { useProfileStore } from '@/lib/store/profileStore';

beforeEach(() => {
  localStorage.clear();
  useProfileStore.getState().reset();
  useProfileStore.setState({ hasHydrated: true });
});

function linkNamed(name: RegExp) {
  return screen.getByRole('link', { name });
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
    expect(screen.queryByRole('link', { name: /Try another calculator/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Finish your profile/ })).not.toBeInTheDocument();
  });

  it('uses the calculator it sits on for the intake link', () => {
    render(<NextSteps intent="leverage" />);
    expect(linkNamed(/Answer a few quick questions/)).toHaveAttribute('href', '/start?next=leverage');
  });

  it('sends the rebalancer straight to its own intake, skipping the core basics (O5)', () => {
    render(<NextSteps intent="portfolio" />);
    const link = linkNamed(/Answer a few quick questions/);
    expect(link).toHaveAttribute('href', '/start/portfolio');
    expect(link).toHaveTextContent(/accounts, holdings, and target mix/);
    expect(link).not.toHaveTextContent(/filing status/);
  });

  it('offers to finish the profile and try another calculator when a partial profile exists', () => {
    useProfileStore.getState().setValues(
      [
        { path: 'person.age', value: 41 },
        { path: 'person.state', value: 'CA' },
      ],
      { provide: ['person.age', 'person.state', 'spending.necessaryMonthly'] }
    );
    const { total } = profileCompleteness(useProfileStore.getState().profile);

    render(<NextSteps intent="paycheck" />);

    expect(screen.getByText('Your answers are saved in this browser.')).toBeInTheDocument();

    const finish = linkNamed(/Finish your profile/);
    expect(finish).toHaveAttribute('href', '/start/profile');
    // Counted by topic: only the must-pay screen is fully answered.
    expect(finish).toHaveTextContent(`1 of ${total} topics answered.`);
    expect(finish).toHaveTextContent('Answer the rest once; every calculator and your overview use it.');

    expect(linkNamed(/Try another calculator/)).toHaveAttribute('href', '/start/choose');

    expect(screen.queryByRole('link', { name: /See your overview/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Answer a few quick questions/ })).not.toBeInTheDocument();
  });

  it('offers the overview once the profile questions run out, even with skipped basics', () => {
    const asked = intakePaths('profile').filter((path) => !CORE_PATHS.includes(path));
    useProfileStore.getState().setValues([], { provide: asked });
    // Skipped basics are not asked by /start/profile, which would only
    // redirect to the overview; link it directly instead.
    expect(profileCompleteness(useProfileStore.getState().profile).missing.length).toBeGreaterThan(0);

    render(<NextSteps intent="retirement" />);

    expect(linkNamed(/See your overview/)).toHaveAttribute('href', '/overview');
    expect(linkNamed(/Try another calculator/)).toHaveAttribute('href', '/start/choose');
    expect(screen.queryByRole('link', { name: /Finish your profile/ })).not.toBeInTheDocument();
  });

  it('swaps "Finish your profile" for the overview once every topic is answered', () => {
    useProfileStore.getState().setValues([], { provide: PROFILE_FORM.screens.flatMap((s) => s.fields) });

    render(<NextSteps intent="portfolio" />);

    expect(linkNamed(/See your overview/)).toHaveAttribute('href', '/overview');
    expect(linkNamed(/Try another calculator/)).toHaveAttribute('href', '/start/choose');
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
