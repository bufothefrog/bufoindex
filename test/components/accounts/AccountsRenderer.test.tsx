/**
 * The shared account list (renderer id 'accounts', the ACCOUNTS field of
 * lib/fields/shared.ts) on the default profile: the compact lines, a typed
 * balance written as one whole-list write, the emergency fund tick on
 * brokerage rows only, and a stored row that stays after its answer turns No.
 */

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_RENDERERS } from '@/components/calculators/renderers/accounts';
import { PORTFOLIO_RENDERERS } from '@/components/calculators/renderers/portfolio';
import { NEW_CASH, NEW_CASH_RENDERER } from '@/lib/calculators/portfolio/fields';
import { ACCOUNTS, ACCOUNTS_RENDERER } from '@/lib/fields/shared';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { FieldHarness, writeSpy } from '@/test/components/fields/harness';

const Editor = ACCOUNTS_RENDERERS[ACCOUNTS_RENDERER];

function renderList(profile: FinancialProfile = getDefaultFinancialProfile()) {
  const spy = writeSpy();
  let latest: Record<string, unknown> = {};
  render(
    <FieldHarness initial={profile as unknown as Record<string, unknown>} onWrite={spy}>
      {({ get, onWrite, values }) => {
        latest = values;
        return <Editor spec={ACCOUNTS} get={get} value={get(ACCOUNTS.path)} onWrite={onWrite} size="md" />;
      }}
    </FieldHarness>
  );
  return { spy, values: () => latest as unknown as FinancialProfile };
}

const line = (id: string) => screen.getByTestId(`account-${id}`);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The default profile with two unnamed empty brokerages and a cash account, answered. */
function twoUnnamedBrokerages(): FinancialProfile {
  const profile = getDefaultFinancialProfile();
  profile.portfolio.accounts = [
    { id: 'a1', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
    { id: 'a2', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
    { id: 'a3', kind: 'cash', name: '', balance: 9000, holdsEmergencyFund: false },
  ];
  profile.portfolio.holdings = [];
  profile.portfolio.securities = [];
  profile.portfolio.newCash = [];
  profile.provided = ['portfolio.accounts', 'portfolio.holdings', 'portfolio.securities'];
  return profile;
}

describe('the account list', () => {
  it('shows the example 401(k) as a typed balance and the brokerage as its holdings', () => {
    renderList();
    expect(screen.getByRole('group', { name: ACCOUNTS.label })).toBeInTheDocument();
    expect(within(line('acc-401k')).getByText('401(k) or similar')).toBeInTheDocument();
    expect(within(line('acc-401k')).getByRole('textbox', { name: '401(k) or similar balance' })).toHaveValue('16,225');
    expect(within(line('acc-brok')).getByText('Brokerage (taxable)')).toBeInTheDocument();
    expect(within(line('acc-brok')).getByText('$8,775 from 3 holdings')).toBeInTheDocument();
    expect(within(line('acc-brok')).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('writes a typed balance as one whole-list accounts write', async () => {
    const user = userEvent.setup();
    const { spy, values } = renderList();
    const input = screen.getByRole('textbox', { name: '401(k) or similar balance' });
    await user.clear(input);
    spy.mockClear();
    await user.type(input, '30000');

    const last = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(last.map((w) => w.path)).toEqual(['portfolio.accounts']);
    expect(values().portfolio.accounts.map((a) => [a.id, a.balance])).toEqual([
      ['acc-401k', 30000],
      ['acc-brok', 0],
    ]);
    expect(input).toHaveValue('30,000');
  });

  it('offers the emergency fund tick on brokerage rows only', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole('button', { name: 'Edit 401(k) or similar' }));
    expect(screen.queryByRole('checkbox', { name: 'Holds my emergency fund' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Brokerage (taxable)' }));
    expect(within(line('acc-brok')).getByRole('checkbox', { name: 'Holds my emergency fund' })).not.toBeChecked();
  });

  it('fills an empty brokerage with the typed emergency fund when ticked', async () => {
    const user = userEvent.setup();
    const profile = getDefaultFinancialProfile();
    profile.portfolio.accounts = [{ id: 'acc-1', kind: 'brokerage', name: 'Savings', balance: 0, holdsEmergencyFund: false }];
    profile.portfolio.holdings = [];
    profile.portfolio.securities = [];
    profile.provided = ['portfolio.accounts', 'portfolio.holdings', 'portfolio.securities'];
    const { values } = renderList(profile);

    await user.click(screen.getByRole('button', { name: 'Edit Savings' }));
    await user.click(screen.getByRole('checkbox', { name: 'Holds my emergency fund' }));

    // The default emergency fund: three months of $3,000 must-pay costs.
    expect(values().portfolio.accounts).toEqual([
      { id: 'acc-1', kind: 'brokerage', name: 'Savings', balance: 9000, holdsEmergencyFund: true },
    ]);
    expect(within(line('acc-1')).getByText('Emergency fund')).toBeInTheDocument();
    expect(within(line('acc-1')).getByRole('textbox', { name: 'Savings balance' })).toHaveValue('9,000');
  });

  it('keeps a stored 401(k) after the 401(k) answer turns No', () => {
    const profile = getDefaultFinancialProfile();
    profile.portfolio.accounts = [{ id: 'acc-401k', kind: '401k', name: '', balance: 18000, holdsEmergencyFund: false }];
    profile.portfolio.holdings = [];
    profile.portfolio.securities = [];
    profile.provided = ['portfolio.accounts', 'portfolio.holdings', 'portfolio.securities'];
    profile.workplace.has401k = false;
    renderList(profile);

    expect(screen.getByRole('textbox', { name: '401(k) or similar balance' })).toHaveValue('18,000');
  });

  it('shows no line for the example 401(k) while the 401(k) answer is No and the list is unanswered', () => {
    const profile = getDefaultFinancialProfile();
    profile.workplace.has401k = false;
    renderList(profile);
    expect(screen.queryByTestId('account-acc-401k')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-acc-brok')).toBeInTheDocument();
  });

  it('gives two rows that share a display name distinct accessible names', async () => {
    const user = userEvent.setup();
    renderList(twoUnnamedBrokerages());
    expect(within(line('a1')).getByRole('textbox', { name: 'Brokerage (taxable) 1 balance' })).toBeInTheDocument();
    expect(within(line('a2')).getByRole('textbox', { name: 'Brokerage (taxable) 2 balance' })).toBeInTheDocument();
    // A row whose display name is its own keeps it.
    expect(within(line('a3')).getByRole('textbox', { name: 'Cash or savings balance' })).toBeInTheDocument();
    expect(within(line('a1')).getByRole('button', { name: 'Edit Brokerage (taxable) 1' })).toBeInTheDocument();
    await user.click(within(line('a2')).getByRole('button', { name: 'Edit Brokerage (taxable) 2' }));
    expect(within(line('a2')).getByRole('button', { name: 'Remove Brokerage (taxable) 2' })).toBeInTheDocument();
  });

  it('names the open editor toggle with its visible text, Done', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole('button', { name: 'Edit 401(k) or similar' }));
    const toggle = screen.getByRole('button', { name: 'Done editing 401(k) or similar' });
    expect(toggle).toHaveTextContent('Done');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not offer cash as the kind of an account with holdings', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole('button', { name: 'Edit Brokerage (taxable)' }));
    const brokerageKinds = within(line('acc-brok')).getAllByRole('option').map((option) => option.textContent);
    expect(brokerageKinds).not.toContain('Cash or savings');
    expect(brokerageKinds).toContain('Roth IRA');
    await user.click(screen.getByRole('button', { name: 'Edit 401(k) or similar' }));
    expect(within(line('acc-401k')).getAllByRole('option').map((option) => option.textContent)).toContain('Cash or savings');
  });

  it('closes the editor when its account is removed, also when a suggested row of the same id takes its place', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const profile = getDefaultFinancialProfile();
    profile.portfolio.accounts = [{ id: 'acc-401k', kind: '401k', name: '', balance: 18000, holdsEmergencyFund: false }];
    profile.portfolio.holdings = [];
    profile.portfolio.securities = [];
    profile.provided = ['workplace.has401k', 'portfolio.accounts', 'portfolio.holdings', 'portfolio.securities'];
    profile.workplace.has401k = true;
    const { values } = renderList(profile);

    await user.click(screen.getByRole('button', { name: 'Edit 401(k) or similar' }));
    await user.click(screen.getByRole('button', { name: 'Remove 401(k) or similar' }));
    expect(values().portfolio.accounts).toEqual([]);
    // The 401(k) answer is still Yes, so an empty suggested row of the same id shows, closed.
    expect(screen.getByRole('button', { name: 'Edit 401(k) or similar' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Done editing/ })).not.toBeInTheDocument();
  });
});

describe('the new cash editor', () => {
  it('labels two unnamed brokerages distinctly', () => {
    const NewCash = PORTFOLIO_RENDERERS[NEW_CASH_RENDERER];
    render(
      <FieldHarness initial={twoUnnamedBrokerages() as unknown as Record<string, unknown>} onWrite={writeSpy()}>
        {({ get, onWrite }) => <NewCash spec={NEW_CASH} get={get} value={get(NEW_CASH.path)} onWrite={onWrite} size="md" />}
      </FieldHarness>
    );
    expect(screen.getByRole('group', { name: 'Brokerage (taxable) 1' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Brokerage (taxable) 2' })).toBeInTheDocument();
  });
});
