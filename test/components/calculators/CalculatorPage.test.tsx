import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CalculatorPage from '@/components/calculators/shared/CalculatorPage';
import { STALE_RESULTS_MESSAGE } from '@/components/calculators/shared/CalculatorPage';
import { DISCLAIMERS } from '@/lib/constants/disclaimers';
import { CALCULATORS } from '@/lib/calculators/registry';
import { useProfileStore } from '@/lib/store/profileStore';
import { renderWithProfile } from '@/test/utils/render';
import { clearBrowserState } from '@/test/utils/stores';
import { createFakeStore, FAKE_DEFINITION, fakeProfile, renderFakeResults } from './fakeCalculator';

function renderPage(options: Parameters<typeof renderWithProfile>[1] = {}, extra: { afterLayout?: React.ReactNode } = {}) {
  const store = createFakeStore();
  const utils = renderWithProfile(
    <CalculatorPage
      definition={FAKE_DEFINITION}
      store={store}
      renderResults={renderFakeResults}
      afterLayout={extra.afterLayout}
    />,
    options
  );
  return { ...utils, store };
}

beforeEach(() => {
  clearBrowserState();
  window.history.replaceState(null, '', '/tools/retirement-calculator');
});

afterEach(() => {
  clearBrowserState();
});

describe('CalculatorPage', () => {
  it('renders title, description and disclaimer from the registry, and afterLayout', async () => {
    renderPage({ profile: fakeProfile(40, 65) }, { afterLayout: <p>How these numbers are computed</p> });
    expect(screen.getByRole('heading', { level: 1, name: CALCULATORS.retirement.title })).toBeInTheDocument();
    expect(screen.getByText(CALCULATORS.retirement.description)).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Disclaimer' })).toHaveTextContent(DISCLAIMERS.retirement);
    expect(screen.getByText('How these numbers are computed')).toBeInTheDocument();
    expect(await screen.findByTestId('fake-results')).toBeInTheDocument();
  });

  it('shows the results placeholder until the profile has hydrated', async () => {
    renderPage({ profile: fakeProfile(40, 65), hydrated: false });
    // Inputs render from the (default-shaped) profile right away.
    expect(screen.getByRole('textbox', { name: /^Age/ })).toBeInTheDocument();
    expect(screen.queryByTestId('fake-results')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: CALCULATORS.retirement.liveResultsLabel })).toBeInTheDocument();

    act(() => useProfileStore.setState({ hasHydrated: true }));
    expect(await screen.findByTestId('fake-results')).toHaveTextContent('Years to go: 25');
  });

  it('reads the profile when the URL has no hand-off marker, and leaves the URL alone', async () => {
    window.history.replaceState(null, '', '/tools/retirement-calculator?tab=x#keep');
    renderPage({ profile: fakeProfile(30, 62) });
    expect(await screen.findByTestId('fake-results')).toHaveTextContent('Years to go: 32 (from age 30)');
    expect(window.location.search).toBe('?tab=x');
    expect(window.location.hash).toBe('#keep');
    expect(screen.getByRole('tab', { name: 'Inputs' })).toHaveAttribute('aria-selected', 'true');
  });

  it('strips ?from=profile and opens the mobile view on Results', async () => {
    window.history.replaceState(null, '', '/tools/retirement-calculator?from=profile#old-hash');
    renderPage({ profile: fakeProfile(40, 65) });
    expect(await screen.findByTestId('fake-results')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/tools/retirement-calculator');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    await waitFor(() => expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true'));
  });

  it('writes edits through to the profile, marks them provided, and recalculates live', async () => {
    const user = userEvent.setup();
    renderPage({ profile: fakeProfile(40, 65) });
    expect(await screen.findByTestId('fake-results')).toHaveTextContent('Years to go: 25');

    const age = screen.getByRole('textbox', { name: /^Age/ });
    await user.clear(age);
    await user.type(age, '45');

    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(45);
    expect(profile.provided).toContain('person.age');
    await waitFor(() => expect(screen.getByTestId('fake-results')).toHaveTextContent('Years to go: 20'));
  });

  it('has no Calculate button; the mobile bar toggles See results / Edit inputs', async () => {
    const user = userEvent.setup();
    renderPage({ profile: fakeProfile(40, 65) });
    await screen.findByTestId('fake-results');
    expect(screen.queryByRole('button', { name: /calculate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /See results/ }));
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /Edit inputs/ })).toBeInTheDocument();
  });

  it('keeps the last results visible and marked stale when the inputs become invalid', async () => {
    renderPage({ profile: fakeProfile(40, 65) });
    expect(await screen.findByTestId('fake-results')).toHaveTextContent('Years to go: 25');

    act(() => useProfileStore.getState().setValues([{ path: 'person.retirementAge', value: 35 }]));
    await waitFor(() => expect(screen.getByTestId('stale-results')).toHaveTextContent(STALE_RESULTS_MESSAGE));
    expect(screen.getByTestId('fake-results')).toHaveTextContent('Years to go: 25 (from age 40) [stale]');
    // The field error shows inline (and in the error list).
    expect(screen.getAllByText('Retire after your current age.').length).toBeGreaterThan(0);

    act(() => useProfileStore.getState().setValues([{ path: 'person.retirementAge', value: 70 }]));
    await waitFor(() => expect(screen.queryByTestId('stale-results')).not.toBeInTheDocument());
    expect(screen.getByTestId('fake-results')).toHaveTextContent('Years to go: 30');
  });

  it('shows the empty state when the inputs are invalid before any result', async () => {
    renderPage({ profile: fakeProfile(40, 35) });
    await waitFor(() => expect(screen.getByText('Results appear here')).toBeInTheDocument());
    expect(screen.queryByTestId('fake-results')).not.toBeInTheDocument();
  });

  it('collapses the core screen once every core field is provided', async () => {
    renderPage({ profile: fakeProfile(40, 65, ['person.age', 'person.retirementAge']) });
    await screen.findByTestId('fake-results');
    expect(screen.getByRole('button', { name: 'Edit basics' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Age/ })).not.toBeInTheDocument();
  });

  it('restores an assumption screen to its defaults and un-marks it', async () => {
    const user = userEvent.setup();
    const profile = { ...fakeProfile(40, 65, ['cash.emergencyFundApy']), cash: { ...fakeProfile(40, 65).cash, emergencyFundApy: 0.1 } };
    renderPage({ profile });
    await screen.findByTestId('fake-results');
    await user.click(screen.getByRole('button', { name: 'Edit assumptions' }));
    await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
    const next = useProfileStore.getState().profile;
    expect(next.cash.emergencyFundApy).toBe(0.04);
    expect(next.provided).not.toContain('cash.emergencyFundApy');
  });

  it('renders the What next? card only with results', async () => {
    renderPage({ profile: fakeProfile(40, 65) });
    const results = await screen.findByTestId('fake-results');
    const panel = results.closest('[id$="-results"]') as HTMLElement;
    expect(within(panel).getByText('What next?')).toBeInTheDocument();
  });
});
