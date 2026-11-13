import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ProfileReview } from '@/components/guided/ProfileReview';
import { ReviewTopicRow } from '@/components/guided/ReviewTopicRow';
import { PROFILE_FORM, PROFILE_FORM_SECTION_LABELS, profileCompleteness, profileFormSection } from '@/lib/calculators/forms';
import { makeGet } from '@/lib/fields/paths';
import { screenPaths, screensFor } from '@/lib/fields/runtime';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
});

const shownScreens = () =>
  screensFor(PROFILE_FORM, makeGet(useProfileStore.getState().profile), { mode: 'all', surface: 'intake' });

const row = (id: string) => {
  const element = document.getElementById(`topic-${id}`);
  if (!element) throw new Error(`no row for ${id}`);
  return element;
};

function answerEverything() {
  const get = makeGet(useProfileStore.getState().profile);
  const paths = PROFILE_FORM.screens.flatMap((spec) => screenPaths(PROFILE_FORM, spec, get));
  useProfileStore.getState().setValues([], { provide: paths });
}

describe('ProfileReview, an empty profile', () => {
  it('lists every topic under its section as "Not answered", each with an Answer link to that topic', () => {
    render(<ProfileReview />);

    expect(screen.getByRole('heading', { level: 1, name: 'Review your answers' })).toBeInTheDocument();
    const topics = shownScreens();
    expect(screen.getAllByText('Not answered')).toHaveLength(topics.length);
    for (const topic of topics) {
      const link = screen.getByRole('link', { name: `Answer: ${topic.title}` });
      expect(link).toHaveTextContent(/^Answer$/);
      expect(link).toHaveAttribute('href', `/start/review/${topic.id}`);
      const section = profileFormSection(topic.id);
      if (!section) throw new Error(`no section for ${topic.id}`);
      const group = screen.getByRole('region', { name: PROFILE_FORM_SECTION_LABELS[section] });
      expect(within(group).getByRole('heading', { level: 3, name: topic.title })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: /^Edit:/ })).not.toBeInTheDocument();
  });

  it('shows the completeness line the dashboard card shows, and both links under the list', () => {
    render(<ProfileReview />);
    const { total } = profileCompleteness(useProfileStore.getState().profile);
    expect(screen.getByText(`0 of ${total} topics answered`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Answer the remaining questions' })).toHaveAttribute('href', '/start/profile');
    expect(screen.getByRole('link', { name: 'Go to your overview' })).toHaveAttribute('href', '/overview');
  });

  it('does not show a typical value as an answer', () => {
    render(<ProfileReview />);
    expect(row('about')).not.toHaveTextContent('30');
    expect(row('pay')).not.toHaveTextContent('$');
  });
});

describe('ProfileReview, a partly answered profile', () => {
  it('shows only the answered values, with an Edit link, and leaves the typical ones out', () => {
    useProfileStore.getState().setValues([{ path: 'income.grossPerPaycheck', value: 4200 }]);
    useProfileStore.getState().setValues([{ path: 'person.age', value: 41 }]);
    render(<ProfileReview />);

    const pay = row('pay');
    expect(within(pay).getByText('Gross pay per paycheck: $4,200')).toBeInTheDocument();
    // The typical pay frequency and take-home pay are not shown as answers.
    expect(pay).not.toHaveTextContent(/week|2,600/);
    expect(within(pay).getByRole('link', { name: 'Edit: What does a typical paycheck look like?' })).toHaveAttribute(
      'href',
      '/start/review/pay'
    );

    const about = row('about');
    expect(about).toHaveTextContent('41');
    expect(about).not.toHaveTextContent(/Single|Texas|TX/);

    expect(within(row('must-pay')).getByText('Not answered')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Answer the remaining questions' })).toBeInTheDocument();
  });
});

describe('ProfileReview, a full profile', () => {
  it('shows a summary and an Edit link on every topic, and no remaining-questions link', () => {
    answerEverything();
    render(<ProfileReview />);

    const topics = shownScreens();
    expect(screen.queryByText('Not answered')).not.toBeInTheDocument();
    for (const topic of topics) {
      expect(screen.getByRole('link', { name: `Edit: ${topic.title}` })).toHaveTextContent(/^Edit$/);
    }
    expect(screen.queryByRole('link', { name: 'Answer the remaining questions' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your overview' })).toBeInTheDocument();
    const { total } = profileCompleteness(useProfileStore.getState().profile);
    expect(screen.getByText(`${total} of ${total} topics answered`)).toBeInTheDocument();
  });
});

describe('ProfileReview, returning from a topic', () => {
  it('focuses the row the URL names', () => {
    window.history.replaceState(null, '', '#topic-pay');
    render(<ProfileReview />);
    expect(row('pay')).toHaveFocus();
  });

  it('renders a loading state until the profile store hydrates', () => {
    resetProfileStore({ hydrated: false });
    render(<ProfileReview />);
    expect(screen.getByLabelText('Loading your answers')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^(Edit|Answer):/ })).not.toBeInTheDocument();
  });
});

describe('ReviewTopicRow', () => {
  it('is one link per row, named with the topic, and no button', () => {
    render(
      <ReviewTopicRow anchorId="r" title="Debts" summary="2 debts" status="partial" href="/start/review/debts" />
    );
    expect(screen.getByRole('heading', { name: 'Debts' })).toBeInTheDocument();
    expect(screen.getByText('2 debts')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Edit: Debts' })).toHaveAttribute('href', '/start/review/debts');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads Answer for a topic without an answer', () => {
    render(<ReviewTopicRow anchorId="r" title="Debts" summary="Not answered" status="unanswered" href="/x" />);
    expect(screen.getByRole('link', { name: 'Answer: Debts' })).toHaveTextContent('Answer');
  });
});
