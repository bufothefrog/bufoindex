/**
 * FieldList edits a list of rows through Write[] against canonical list
 * paths: row fields are relative to the row, add appends newRow, remove
 * writes the list without the row (after an optional confirm) followed by
 * the removeRow cascade. minRows and maxRows gate the buttons, test ids
 * follow the '{i}' pattern, and errors arrive keyed by absolute path.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { FieldInput, FieldList } from '@/components/fields';
import type { CustomRenderers, FieldListProps } from '@/components/fields';
import { makeGet } from '@/lib/fields/paths';
import type { FieldErrors, FieldSpec } from '@/lib/fields/types';
import { PROFILE_LIST_ROW_DEFAULTS } from '@/lib/profile';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetProfileStore } from '@/test/utils/stores';
import { FieldHarness, writeSpy } from './harness';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ACCOUNTS: FieldSpec = {
  path: 'portfolio.accounts',
  kind: 'list',
  label: 'Accounts',
  help: 'Every account you rebalance',
  tier: 'details',
  minRows: 1,
  maxRows: 3,
  addLabel: 'Add account',
  emptyText: 'No accounts yet.',
  itemLabel: (row, index) => String(row.name || `Account ${index + 1}`),
  newRow: (get) => ({
    id: `acc-${(get('portfolio.accounts') as unknown[]).length + 1}`,
    name: '',
    accountType: 'taxable',
    deposit: 0,
  }),
  confirmRemove: (row) => `Delete ${String(row.name || 'this account')}? Its holdings will be removed too.`,
  removeRow: (get, index) => {
    const id = get(`portfolio.accounts.${index}.id`);
    const holdings = get('portfolio.holdings') as { accountId: string }[];
    return [{ path: 'portfolio.holdings', value: holdings.filter((holding) => holding.accountId !== id) }];
  },
  testId: 'account-section-{i}',
  row: [
    { path: 'name', kind: 'text', label: 'Account name', tier: 'details', maxLength: 40, testId: 'account-name-{i}' },
    {
      path: 'accountType',
      kind: 'select',
      label: 'Type',
      tier: 'details',
      options: [
        { value: 'taxable', label: 'Taxable' },
        { value: 'tax-free', label: 'Tax-Free' },
      ],
    },
    {
      path: 'deposit',
      kind: 'money',
      label: 'New cash',
      tier: 'details',
      precision: 2,
      visibleWhen: (get) => get('accountType') === 'taxable',
      onChange: (value) => [{ path: 'touched', value: Number(value) > 0 }],
    },
  ],
};

const INITIAL = {
  portfolio: {
    accounts: [
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 1000 },
    ],
    holdings: [
      { id: 'h1', accountId: 'acc-roth' },
      { id: 'h2', accountId: 'acc-brok' },
    ],
  },
};

function renderList(
  spec: FieldSpec = ACCOUNTS,
  initial: Record<string, unknown> = INITIAL,
  extra: Partial<FieldListProps> = {},
  onWrite = writeSpy()
) {
  let latest: Record<string, unknown> = initial;
  render(
    <FieldHarness initial={initial} onWrite={onWrite}>
      {({ get, onWrite: write, values }) => {
        latest = values;
        return <FieldList spec={spec} get={get} onWrite={write} errors={{}} {...extra} />;
      }}
    </FieldHarness>
  );
  return { onWrite, values: () => latest };
}

describe('FieldList', () => {
  it('is a group named by its label and described by its help, one named group per row', () => {
    renderList();
    const list = screen.getByRole('group', { name: 'Accounts' });
    expect(list).toHaveAccessibleDescription('Every account you rebalance');
    expect(within(list).getByRole('group', { name: 'Roth IRA' })).toBeInTheDocument();
    expect(within(list).getByRole('group', { name: 'Brokerage' })).toBeInTheDocument();
  });

  it('renders row fields relative to the row, with linked labels and row visibleWhen', () => {
    renderList();
    const roth = screen.getByRole('group', { name: 'Roth IRA' });
    const brokerage = screen.getByRole('group', { name: 'Brokerage' });
    expect(within(roth).getByRole('textbox', { name: 'Account name' })).toHaveValue('Roth IRA');
    expect(within(roth).getByRole('combobox', { name: 'Type' })).toHaveValue('tax-free');
    expect(within(roth).queryByRole('textbox', { name: 'New cash' })).not.toBeInTheDocument();
    expect(within(brokerage).getByRole('textbox', { name: 'New cash' })).toHaveValue('1,000');
  });

  it('applies the test id pattern to each row and each row field', () => {
    renderList();
    expect(screen.getByTestId('account-section-0')).toHaveAccessibleName('Roth IRA');
    expect(screen.getByTestId('account-section-1')).toHaveAccessibleName('Brokerage');
    expect(screen.getByTestId('account-name-1')).toContainElement(
      within(screen.getByRole('group', { name: 'Brokerage' })).getByRole('textbox', { name: 'Account name' })
    );
  });

  it('writes a row field at its absolute path, with the row onChange writes in the same call', () => {
    const { onWrite } = renderList();
    const brokerage = screen.getByRole('group', { name: 'Brokerage' });
    fireEvent.change(within(brokerage).getByRole('textbox', { name: 'New cash' }), { target: { value: '250.5' } });
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledWith([
      { path: 'portfolio.accounts.1.deposit', value: 250.5 },
      { path: 'portfolio.accounts.1.touched', value: true },
    ]);

    fireEvent.change(within(brokerage).getByRole('textbox', { name: 'Account name' }), { target: { value: 'Taxable' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'portfolio.accounts.1.name', value: 'Taxable' }]);
    expect(screen.getByRole('group', { name: 'Taxable' })).toBeInTheDocument();
  });

  it('appends newRow at the next index', async () => {
    const user = userEvent.setup();
    const { onWrite, values } = renderList();
    await user.click(screen.getByRole('button', { name: 'Add account' }));
    expect(onWrite).toHaveBeenLastCalledWith([
      { path: 'portfolio.accounts.2', value: { id: 'acc-3', name: '', accountType: 'taxable', deposit: 0 } },
    ]);
    expect(screen.getByRole('group', { name: 'Account 3' })).toBeInTheDocument();
    expect((values().portfolio as { accounts: unknown[] }).accounts).toHaveLength(3);
  });

  it('stops adding at maxRows', async () => {
    const user = userEvent.setup();
    renderList();
    const add = screen.getByRole('button', { name: 'Add account' });
    await user.click(add);
    expect(add).toBeDisabled();

    // Removing a row enables it again and moves focus there.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Remove Account 3' }));
    expect(add).toBeEnabled();
    expect(add).toHaveFocus();
  });

  it('asks before removing, and keeps the row when the visitor cancels', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onWrite } = renderList();
    await user.click(screen.getByRole('button', { name: 'Remove Roth IRA' }));
    expect(confirm).toHaveBeenCalledWith('Delete Roth IRA? Its holdings will be removed too.');
    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Roth IRA' })).toBeInTheDocument();
  });

  it('removes the row and runs the removeRow cascade in the same call, then keeps focus in the list', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onWrite, values } = renderList();
    await user.click(screen.getByRole('button', { name: 'Remove Roth IRA' }));
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledWith([
      { path: 'portfolio.accounts', value: [INITIAL.portfolio.accounts[1]] },
      { path: 'portfolio.holdings', value: [{ id: 'h2', accountId: 'acc-brok' }] },
    ]);
    expect(screen.queryByRole('group', { name: 'Roth IRA' })).not.toBeInTheDocument();
    expect(screen.getByTestId('account-section-0')).toHaveAccessibleName('Brokerage');
    expect((values().portfolio as { holdings: unknown[] }).holdings).toEqual([{ id: 'h2', accountId: 'acc-brok' }]);
    expect(screen.getByRole('button', { name: 'Add account' })).toHaveFocus();
  });

  it('removes without asking when confirmRemove returns null, and stops at minRows', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    renderList({ ...ACCOUNTS, confirmRemove: () => null, removeRow: undefined });
    await user.click(screen.getByRole('button', { name: 'Remove Roth IRA' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove Brokerage' })).toBeDisabled();
  });

  it('shows the empty text and a default add label with no rows', async () => {
    const user = userEvent.setup();
    const debts: FieldSpec = {
      path: 'debts',
      kind: 'list',
      label: 'Debts',
      tier: 'details',
      emptyText: 'No debts added yet.',
      row: [{ path: 'balance', kind: 'money', label: 'Balance', tier: 'details' }],
    };
    const { onWrite } = renderList(debts, { debts: [] });
    expect(screen.getByText('No debts added yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to debts' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'debts.0', value: { id: 'debts-1' } }]);
    expect(screen.getByRole('group', { name: 'Debts 1' })).toBeInTheDocument();
  });

  it('shows the list error and each row field error from the absolute paths', () => {
    const errors: FieldErrors = {
      'portfolio.accounts': 'Accounts allows at most 3 entries.',
      'portfolio.accounts.1.name': 'Account name must be 40 characters or fewer.',
    };
    renderList(ACCOUNTS, INITIAL, { errors });
    const list = screen.getByRole('group', { name: 'Accounts' });
    expect(list).toHaveAccessibleDescription(expect.stringContaining('Accounts allows at most 3 entries.'));
    const name = within(screen.getByRole('group', { name: 'Brokerage' })).getByRole('textbox', { name: 'Account name' });
    expect(name).toBeInvalid();
    expect(name).toHaveAccessibleDescription(expect.stringContaining('must be 40 characters or fewer'));
    expect(within(screen.getByRole('group', { name: 'Roth IRA' })).getByRole('textbox', { name: 'Account name' })).not.toBeInvalid();
  });

  it('renders the row adornment and footer renderers in their scopes', async () => {
    const user = userEvent.setup();
    const renderers: CustomRenderers = {
      rate: ({ get, onWrite }) => (
        <button type="button" onClick={() => onWrite([{ path: 'name', value: 'Renamed' }])}>
          {`Rate badge ${String(get('accountType'))}`}
        </button>
      ),
      totals: ({ value }) => <p>{`${(value as unknown[]).length} accounts`}</p>,
    };
    const { onWrite } = renderList({ ...ACCOUNTS, rowAdornment: 'rate', footer: 'totals' }, INITIAL, { renderers });
    expect(screen.getByText('2 accounts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rate badge taxable' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'portfolio.accounts.1.name', value: 'Renamed' }]);
  });

  it('is what FieldInput renders for a list kind, with row errors passed through', () => {
    render(
      <FieldHarness initial={INITIAL}>
        {({ get, onWrite }) => (
          <FieldInput
            spec={ACCOUNTS}
            get={get}
            onWrite={onWrite}
            errors={{ 'portfolio.accounts.0.name': 'Account name is required.' }}
          />
        )}
      </FieldHarness>
    );
    expect(screen.getByRole('group', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Account name is required.');
  });

  it("writes what the profile store's setValues accepts: add, edit and remove rows of a profile list", async () => {
    const user = userEvent.setup();
    resetProfileStore();
    const debts: FieldSpec = {
      path: 'debts',
      kind: 'list',
      label: 'Debts',
      tier: 'details',
      addLabel: 'Add a debt',
      itemLabel: (row, index) => String(row.name || `Debt ${index + 1}`),
      newRow: (get) => ({ ...PROFILE_LIST_ROW_DEFAULTS.debts, id: `debt-${(get('debts') as unknown[]).length + 1}` }),
      row: [
        { path: 'name', kind: 'text', label: 'Name', tier: 'details' },
        { path: 'balance', kind: 'money', label: 'Balance', tier: 'details' },
      ],
    };
    function ProfileDebts() {
      const profile = useProfileStore((state) => state.profile);
      return (
        <FieldList
          spec={debts}
          get={makeGet(profile)}
          onWrite={(writes) => useProfileStore.getState().setValues(writes)}
          errors={{}}
        />
      );
    }
    render(<ProfileDebts />);

    await user.click(screen.getByRole('button', { name: 'Add a debt' }));
    await user.click(screen.getByRole('button', { name: 'Add a debt' }));
    fireEvent.change(within(screen.getByRole('group', { name: 'Debt 2' })).getByRole('textbox', { name: 'Balance' }), {
      target: { value: '4500' },
    });
    fireEvent.change(within(screen.getByRole('group', { name: 'Debt 2' })).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Car loan' },
    });
    await user.click(screen.getByRole('button', { name: 'Remove Debt 1' }));

    const { profile } = useProfileStore.getState();
    expect(profile.debts).toEqual([{ ...PROFILE_LIST_ROW_DEFAULTS.debts, id: 'debt-2', name: 'Car loan', balance: 4500 }]);
    expect(profile.provided).toContain('debts');
    expect(screen.getByRole('group', { name: 'Car loan' })).toBeInTheDocument();
  });

  it('without newRow, adds a row the profile store accepts, with an id no other row has', async () => {
    const user = userEvent.setup();
    resetProfileStore({
      profile: { debts: [{ ...PROFILE_LIST_ROW_DEFAULTS.debts, id: 'debts-2', name: 'Card' }] },
    });
    const debts: FieldSpec = {
      path: 'debts',
      kind: 'list',
      label: 'Debts',
      tier: 'details',
      row: [{ path: 'balance', kind: 'money', label: 'Balance', tier: 'details' }],
    };
    function ProfileDebts() {
      const profile = useProfileStore((state) => state.profile);
      return (
        <FieldList
          spec={debts}
          get={makeGet(profile)}
          onWrite={(writes) => useProfileStore.getState().setValues(writes)}
          errors={{}}
        />
      );
    }
    render(<ProfileDebts />);
    await user.click(screen.getByRole('button', { name: 'Add to debts' }));
    await user.click(screen.getByRole('button', { name: 'Add to debts' }));
    expect(useProfileStore.getState().profile.debts.map((debt) => debt.id)).toEqual(['debts-2', 'debts-3', 'debts-4']);
  });

  it.each([
    ['portfolio.accounts', true],
    ['portfolio.securities', true],
    ['portfolio.customAssetClasses', true],
    ['portfolio.holdings', false],
    ['portfolio.classTargets', false],
  ] as const)('without newRow, %s offers Add only when the store keeps a bare row (%s)', async (path, addable) => {
    const user = userEvent.setup();
    resetProfileStore();
    const spec: FieldSpec = { path, kind: 'list', label: 'Rows', addLabel: 'Add row', tier: 'details', row: [] };
    function ProfileRows() {
      const profile = useProfileStore((state) => state.profile);
      return (
        <FieldList
          spec={spec}
          get={makeGet(profile)}
          onWrite={(writes) => useProfileStore.getState().setValues(writes)}
          errors={{}}
        />
      );
    }
    render(<ProfileRows />);
    const count = () => (makeGet(useProfileStore.getState().profile)(path) as unknown[]).length;
    const before = count();
    if (addable) {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Add row' }));
      expect(count()).toBe(before + 1);
    } else {
      expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(`The list "${path}" needs a newRow`);
    }
  });

  it('keeps Add for a list outside the profile without newRow', () => {
    const spec: FieldSpec = { path: 'fixture.rows', kind: 'list', label: 'Rows', addLabel: 'Add row', tier: 'details', row: [] };
    render(<FieldList spec={spec} get={() => []} onWrite={() => undefined} errors={{}} />);
    expect(screen.getByRole('button', { name: 'Add row' })).toBeInTheDocument();
  });
});
