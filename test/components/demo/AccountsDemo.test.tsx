/**
 * The /demo Accounts tab: the shared account list, the rebalancer's
 * new-cash card and the overview Accounts card on a synthetic sample
 * profile kept in the tab's own state.
 *
 * Default sample (the default profile): 401(k) typed 16,225; brokerage
 * 20 VTI x 375 + 15 VXUS x 85 + 0 BND x 70 = 8,775; invested 25,000; the
 * brokerage takes the taxable 500 a month as new cash.
 *
 * Emergency fund sample: an added empty brokerage ticked "Holds my
 * emergency fund" copies the 9,000 emergency fund (3 x the 3,000 must-pay)
 * into its balance; it is left out of the invested total and the rebalancer.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountsSection, { SAMPLE_EMERGENCY_FUND_NAME, accountsSample } from '@/app/demo/sections/AccountsSection';
import { DemoClient } from '@/app/demo/DemoClient';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';

const ACCOUNTS_TITLE = 'What do you have saved and invested?';
const NEW_CASH_TITLE = 'New cash this month';
const region = (name: string) => screen.getByRole('region', { name });
const overviewCard = () => screen.getByTestId('overview-accounts');
const line = (id: string) => within(region(ACCOUNTS_TITLE)).getByTestId(`account-${id}`);

beforeEach(() => {
  localStorage.clear();
  useProfileStore.setState({ profile: getDefaultFinancialProfile(), hasProfile: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the /demo Accounts section, default sample', () => {
  it('shows the compact account list without opening an editor', () => {
    render(<AccountsSection />);
    expect(within(line('acc-401k')).getByText('401(k) or similar')).toBeInTheDocument();
    expect(within(line('acc-401k')).getByRole('textbox', { name: '401(k) or similar balance' })).toHaveValue('16,225');
    expect(within(line('acc-brok')).getByText('Brokerage (taxable)')).toBeInTheDocument();
    expect(within(line('acc-brok')).getByText('$8,775 from 3 holdings')).toBeInTheDocument();
    expect(within(line('acc-brok')).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the new-cash card with the brokerage on Auto at $500 and the not-rebalanced note', () => {
    render(<AccountsSection />);
    const newCash = region(NEW_CASH_TITLE);
    const brokerage = within(newCash).getByRole('group', { name: 'Brokerage (taxable)' });
    expect(brokerage).toHaveTextContent('$500');
    expect(within(brokerage).getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
    expect(newCash).toHaveTextContent('Not rebalanced: 401(k) or similar (no holdings entered).');
  });

  it('shows the overview card: the account lines and $25,000 invested', () => {
    render(<AccountsSection />);
    const card = overviewCard();
    expect(card).toHaveTextContent('401(k) or similar $16,225');
    expect(card).toHaveTextContent('Brokerage (taxable) $8,775 (3 holdings)');
    expect(card).toHaveTextContent('Invested $25,000');
    expect(within(card).queryByText(/Emergency fund:/)).not.toBeInTheDocument();
  });

  it('edits the sample in place and never writes to the visitor profile', () => {
    render(<AccountsSection />);
    const before = useProfileStore.getState().profile;
    fireEvent.change(within(region(ACCOUNTS_TITLE)).getByRole('textbox', { name: '401(k) or similar balance' }), {
      target: { value: '30000' },
    });
    // 30,000 typed + 8,775 of holdings.
    expect(overviewCard()).toHaveTextContent('Invested $38,775');
    expect(useProfileStore.getState().profile).toBe(before);
    expect(useProfileStore.getState().profile.provided).toEqual([]);
  });

  it('shows the collapsed account card as the one-line summary', async () => {
    const user = userEvent.setup();
    render(<AccountsSection />);
    const accounts = region(ACCOUNTS_TITLE);
    await user.click(within(accounts).getByRole('button', { name: /Hide/ }));
    expect(accounts).toHaveTextContent('401(k) or similar $16,225; Brokerage (taxable) $8,775 (3 holdings)');
    expect(within(accounts).queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('the /demo Accounts section, emergency fund sample', () => {
  it('builds the sample with the account actions: a ticked brokerage holding the copied 9,000', () => {
    const sample = accountsSample('emergency-fund');
    expect(sample.portfolio.accounts.map((a) => [a.id, a.kind, a.name, a.balance, a.holdsEmergencyFund])).toEqual([
      ['acc-401k', '401k', '', 16225, false],
      ['acc-brok', 'brokerage', '', 0, false],
      ['acc-3', 'brokerage', SAMPLE_EMERGENCY_FUND_NAME, 9000, true],
    ]);
    expect(sample.provided).toContain('portfolio.accounts');
    // Fresh objects each call: the default sample is not the emergency fund one.
    expect(accountsSample('example').portfolio.accounts).toHaveLength(2);
  });

  it('tags the account, leaves it out of the invested total and the rebalancer', async () => {
    const user = userEvent.setup();
    render(<AccountsSection />);
    await user.click(screen.getByRole('radio', { name: 'Emergency fund account' }));

    expect(line('acc-3')).toHaveTextContent(SAMPLE_EMERGENCY_FUND_NAME);
    expect(within(line('acc-3')).getByText('Emergency fund')).toBeInTheDocument();

    const newCash = region(NEW_CASH_TITLE);
    expect(within(newCash).queryByRole('group', { name: SAMPLE_EMERGENCY_FUND_NAME })).not.toBeInTheDocument();
    expect(newCash).toHaveTextContent(
      `Not rebalanced: 401(k) or similar (no holdings entered), ${SAMPLE_EMERGENCY_FUND_NAME} (emergency fund).`
    );

    const card = overviewCard();
    expect(card).toHaveTextContent('Invested $25,000');
    expect(card).toHaveTextContent(`Emergency fund: ${SAMPLE_EMERGENCY_FUND_NAME} $9,000`);

    // Back to the default sample.
    await user.click(screen.getByRole('radio', { name: 'Example profile' }));
    expect(within(region(ACCOUNTS_TITLE)).queryByTestId('account-acc-3')).not.toBeInTheDocument();
  });
});

describe('the gallery', () => {
  it('lists an Accounts tab that shows the section in the light and the dark theme', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <DemoClient />
      </ThemeProvider>
    );
    const nav = screen.getByRole('navigation', { name: 'Gallery sections' });
    await user.click(within(nav).getByRole('button', { name: 'Accounts' }));
    expect(within(nav).getByRole('button', { name: 'Accounts' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('region', { name: ACCOUNTS_TITLE })).toHaveLength(2);
    expect(screen.getAllByText('$8,775 from 3 holdings')).toHaveLength(2);
  });
});
