/**
 * The paycheck allocator on the platform: generated sections over the
 * shared profile, live allocation results from the real engine with no
 * Calculate button, no results before hydration, write-through edits, the
 * fun-money relation keeping stale results, the tax note stating the
 * computed federal bracket, the retirement bracket select, the debt rate badge and totals, the ?from=profile strip, the reload regression (bug 1) and the shared
 * dollar-display preference.
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaycheckAllocator } from '@/components/paycheck-allocator/PaycheckAllocator';
import { calculatorMeta } from '@/lib/calculators/registry';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { usePaycheckStore } from '@/lib/store/paycheckStore';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { PROFILE_STORAGE_KEY, useProfileStore } from '@/lib/store/profileStore';
import { renderWithProfile } from '@/test/utils/render';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const meta = calculatorMeta('paycheck');

const TAX_NOTE = 'Tax savings use your 22% federal bracket and one 2026 state rate.';

/** Waits for the first results (the bootstrap submits immediately once hydrated). */
const findResults = () => screen.findByText('Long-Term Impact');

/**
 * An old handoff link: the deleted paycheckLink built it for the default
 * profile, with the profile in the hash (captured before slice x1 deleted
 * the builder and its codec).
 */
const OLD_HANDOFF_LINK =
  '/tools/paycheck-allocator?from=profile#eyJ2IjoyLCJwIjp7ImlnIjo3NTgzLjMzMzMzMzMzMzMzMywiaW4iOjU2MzMuMzMzMzMzMzMzMzMzLCJpZiI6ImJpLXdlZWtseSIsImlwZyI6MzUwMCwiaXBuIjoyNjAwLCJ0cyI6IlRYIiwiYjQwMSI6eyJhIjp0cnVlLCJtcCI6MC41LCJtbCI6MC4wNiwiY2MiOjAuMDYsInRjIjowLjA2fSwicHIiOnsibmUiOjMwMDAsImVmbSI6MywiZWYiOjUwMDAsImZtbiI6MzAwLCJmbXgiOjYwMCwiYWdlIjozMCwiaHRhIjp0cnVlLCJ0YWMiOjUwMH19fQ';

const CARD = { id: 'd1', name: 'Card', balance: 3000, interestRate: 0.22, minimumPayment: 90, extraPayment: 10, taxDeductible: false };
const CAR = { id: 'd2', name: 'Car', balance: 9000, interestRate: 0.05, minimumPayment: 250, extraPayment: 0, taxDeductible: false };

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  usePaycheckStore.getState().reset();
  usePreferencesStore.setState({ displayMode: 'today' });
  window.history.replaceState(null, '', '/tools/paycheck-allocator');
});

describe('PaycheckAllocator', () => {
  it('renders the registry heading, every section and live results, with no Calculate button', async () => {
    renderWithProfile(<PaycheckAllocator />);

    expect(screen.getByRole('heading', { level: 1, name: meta.title })).toBeInTheDocument();
    for (const title of [
      'A little about you',
      'What does a typical paycheck look like?',
      'What do you have to pay each month?',
      'Fun money and bonuses',
      'Emergency fund',
      '401(k) or similar plan',
      'Health savings account',
      'IRAs and taxable investing',
      'Debts',
      'Assumptions',
    ]) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Calculate/ })).not.toBeInTheDocument();

    expect(await findResults()).toBeInTheDocument();
    expect(usePaycheckStore.getState().results!.allocations.length).toBeGreaterThan(0);
  });

  it('renders inputs from the profile and no results before hydration', () => {
    resetProfileStore({ hydrated: false, profile: { person: { age: 47 } } });
    render(<PaycheckAllocator />);

    expect(screen.getByRole('textbox', { name: 'Your age' })).toHaveValue('47');
    expect(screen.getByRole('status', { name: 'Loading results' })).toBeInTheDocument();
    expect(screen.queryByText('Long-Term Impact')).not.toBeInTheDocument();
    expect(usePaycheckStore.getState().results).toBeNull();
  });

  it('runs on the visitor\'s own profile once hydrated', async () => {
    renderWithProfile(<PaycheckAllocator />, { profile: { spending: { necessaryMonthly: 2750 } } });
    await findResults();
    expect(usePaycheckStore.getState().inputs?.preferences.necessaryExpenses).toBe(2750);
  });

  it('writes an edit through to the profile, marks it answered and reruns', async () => {
    renderWithProfile(<PaycheckAllocator />);
    await findResults();

    fireEvent.change(screen.getByRole('textbox', { name: 'Your age' }), { target: { value: '52' } });

    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(52);
    expect(profile.provided).toContain('person.age');
    await usePaycheckStore.getState().flush();
    expect(usePaycheckStore.getState().inputs?.preferences.age).toBe(52);
  });

  it('keeps the last results, out of date, while the fun-money minimum is above the maximum', async () => {
    renderWithProfile(<PaycheckAllocator />);
    await findResults();

    fireEvent.change(screen.getByRole('textbox', { name: 'At least, per month' }), { target: { value: '900' } });

    expect(screen.getByText('Results out of date')).toBeInTheDocument();
    expect(screen.getByText('Long-Term Impact')).toBeInTheDocument();
    expect(usePaycheckStore.getState().stale).toBe(true);
    expect(screen.getByRole('textbox', { name: 'At most, per month' })).toHaveAccessibleDescription(
      /The minimum is above the maximum\. Adjust one of them\./
    );
  });

  it('states the federal bracket computed from pay, and nowhere that brackets are calculated automatically', async () => {
    renderWithProfile(<PaycheckAllocator />);
    await findResults();

    expect(screen.getByText(TAX_NOTE)).toBeInTheDocument();
    expect(usePaycheckStore.getState().inputs?.taxes.federalBracket).toBe(0.22);
    expect(document.body.textContent).not.toMatch(/automatically/i);
  });

  it('follows a pay edit into the note and the engine bracket', async () => {
    renderWithProfile(<PaycheckAllocator />);
    await findResults();

    // 2,000 every two weeks: 52,000 - 4,160 (8% traditional) - 16,100 = 31,740: 12%.
    fireEvent.change(screen.getByRole('textbox', { name: 'Take-home pay per paycheck' }), { target: { value: '1500' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Gross pay per paycheck' }), { target: { value: '2000' } });

    expect(screen.getByText('Tax savings use your 12% federal bracket and one 2026 state rate.')).toBeInTheDocument();
    await usePaycheckStore.getState().flush();
    expect(usePaycheckStore.getState().inputs?.taxes.federalBracket).toBe(0.12);
  });

  it('offers the retirement bracket as a select of the real brackets, following state and filing status', async () => {
    const user = userEvent.setup();
    renderWithProfile(<PaycheckAllocator />);
    await findResults();
    await user.click(screen.getByRole('button', { name: 'Show assumptions' }));

    const select = () => screen.getByRole('combobox', { name: 'Expected tax bracket in retirement' });
    const optionNames = () => within(select()).getAllByRole('option').map((option) => option.textContent);
    expect(optionNames()).toContain('12% federal + 9.3% CA (taxable $12,400 to $50,400)');
    expect(screen.getByText("Compared with today's 22% federal bracket; state rate assumed equal in both.")).toBeInTheDocument();

    await user.selectOptions(select(), '24% federal + 9.3% CA (taxable $105,700 to $201,775)');
    expect(useProfileStore.getState().profile.assumptions.paycheck.expectedRetirementBracket).toBe(0.24);
    await usePaycheckStore.getState().flush();
    expect(usePaycheckStore.getState().inputs?.preferences.expectedRetirementBracket).toBe(0.24);

    useProfileStore.getState().setValues([
      { path: 'person.state', value: 'TX' },
      { path: 'person.filingStatus', value: 'marriedJoint' },
    ]);
    expect(await screen.findByRole('option', { name: '24% federal (taxable $211,400 to $403,550)' })).toBeInTheDocument();
    expect(optionNames().some((name) => name?.includes('CA'))).toBe(false);
  });

  it('badges each debt by its rate and totals the debts', async () => {
    renderWithProfile(<PaycheckAllocator />, { profile: { debts: [CARD, CAR] } });
    await findResults();

    const debts = screen.getByRole('region', { name: 'Debts' });
    expect(within(debts).getByText('High-interest (over 7%)')).toBeInTheDocument();
    expect(within(debts).getByText('7% or less')).toBeInTheDocument();
    expect(within(debts).getByText('Total debt')).toBeInTheDocument();
    expect(within(debts).getByText('$12,000')).toBeInTheDocument();
    // 90 + 10 + 250 a month.
    expect(within(debts).getByText('$350')).toBeInTheDocument();
    // The intake's one-tap answer is not on the calculator page.
    expect(screen.queryByRole('button', { name: 'I have no debts' })).not.toBeInTheDocument();
    expect(usePaycheckStore.getState().inputs?.debts).toEqual([CARD, CAR]);
  });

  it('strips ?from=profile after a handoff and opens on the results', async () => {
    window.history.replaceState(null, '', '/tools/paycheck-allocator?from=profile');
    renderWithProfile(<PaycheckAllocator />);
    await findResults();

    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps edits made after a handoff across a reload (bug 1)', async () => {
    // The old handoff link carried the profile in its hash, and the old page
    // read that hash back on every load, undoing the edits made since.
    resetProfileStore({ profile: { person: { age: 35 } } });
    const link = OLD_HANDOFF_LINK;
    window.history.replaceState(null, '', link);
    expect(window.location.hash).not.toBe('');

    const first = render(<PaycheckAllocator />);
    await findResults();
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Your age' }), { target: { value: '41' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Must-pay costs per month' }), { target: { value: '3600' } });
    first.unmount();
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    expect(saved).not.toBeNull();

    // The reload, on the same handoff link: the in-memory profile starts from
    // the defaults, the run store empty, and the saved profile is read back.
    window.history.replaceState(null, '', link);
    useProfileStore.setState({ profile: getDefaultFinancialProfile(), hasHydrated: false });
    usePaycheckStore.getState().reset();
    localStorage.setItem(PROFILE_STORAGE_KEY, saved!);
    await act(() => useProfileStore.persist.rehydrate());
    render(<PaycheckAllocator />);
    await findResults();

    expect(screen.getByRole('textbox', { name: 'Your age' })).toHaveValue('41');
    expect(useProfileStore.getState().profile.person.age).toBe(41);
    expect(usePaycheckStore.getState().inputs?.preferences).toMatchObject({ age: 41, necessaryExpenses: 3600 });
  });

  it('switches the shared dollar-display preference from the results', async () => {
    renderWithProfile(<PaycheckAllocator />);
    await findResults();

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Future dollars' }));
    expect(usePreferencesStore.getState().displayMode).toBe('nominal');

    act(() => usePreferencesStore.setState({ displayMode: 'today' }));
    expect(screen.getByRole('radio', { name: "Today's dollars" })).toHaveAttribute('aria-checked', 'true');
  });
});
