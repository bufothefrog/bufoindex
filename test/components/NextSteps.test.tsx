import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextSteps } from '@/components/guided/NextSteps';
import { intakePaths } from '@/lib/constants/intake';
import { PROFILE_FIELDS } from '@/lib/profile/defaults';
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

  it('offers to finish the profile and try another calculator when a partial profile exists', () => {
    useProfileStore
      .getState()
      .setFields({ person: { age: 41, state: 'CA' } }, ['person.age', 'person.state']);

    render(<NextSteps intent="paycheck" />);

    expect(screen.getByText('Your answers are saved in this browser.')).toBeInTheDocument();

    const finish = linkNamed(/Finish your profile/);
    expect(finish).toHaveAttribute('href', '/start/profile');
    expect(finish).toHaveTextContent(`2 of ${PROFILE_FIELDS.length} details answered.`);
    expect(finish).toHaveTextContent('Answer the rest once; every calculator and your overview use it.');

    expect(linkNamed(/Try another calculator/)).toHaveAttribute('href', '/start/choose');

    expect(screen.queryByRole('link', { name: /See your overview/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Answer a few quick questions/ })).not.toBeInTheDocument();
  });

  it('offers the overview once the profile questions run out, even with never-asked fields missing', () => {
    const asked = intakePaths('profile');
    useProfileStore.getState().setFields({}, asked);
    // The intake never asks a few fields, so /start/profile would only
    // redirect to the overview; link it directly instead.
    expect(asked.length).toBeLessThan(PROFILE_FIELDS.length);

    render(<NextSteps intent="retirement" />);

    expect(linkNamed(/See your overview/)).toHaveAttribute('href', '/overview');
    expect(linkNamed(/Try another calculator/)).toHaveAttribute('href', '/start/choose');
    expect(screen.queryByRole('link', { name: /Finish your profile/ })).not.toBeInTheDocument();
  });

  it('swaps "Finish your profile" for the overview once every field is answered', () => {
    useProfileStore.getState().setFields(
      {},
      PROFILE_FIELDS.map((field) => field.path)
    );

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
