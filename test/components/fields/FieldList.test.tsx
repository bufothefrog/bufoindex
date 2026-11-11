import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FieldList, type CustomRenderers } from '@/components/fields';
import { getAt } from '@/lib/fields/paths';
import type { FieldErrors, FieldSpec, Write } from '@/lib/fields/types';
import { DEBT_ROW, Harness } from './fixtures';

const ACCOUNTS: FieldSpec = {
  path: 'portfolio.accounts',
  kind: 'list',
  label: 'Accounts',
  tier: 'details',
  row: DEBT_ROW,
  addLabel: 'Add an account',
  emptyText: 'No accounts yet.',
  itemLabel: (row, index) => (typeof row.name === 'string' && row.name ? row.name : `Account ${index + 1}`),
  newRow: (get) => ({ id: 'new', name: '', balance: Number(get('defaults.balance') ?? 0) }),
  confirmRemove: (row) => (row.name === 'Roth' ? 'Remove Roth and its holdings?' : null),
  removeRow: (get, index) => {
    const id = get(`portfolio.accounts.${index}.id`);
    const holdings = (get('portfolio.holdings') as Array<{ accountId: string }>) ?? [];
    return [{ path: 'portfolio.holdings', value: holdings.filter((holding) => holding.accountId !== id) }];
  },
  testId: 'account-row-{i}',
  rowAdornment: 'badge',
  footer: 'total',
};

const INITIAL = {
  defaults: { balance: 50 },
  portfolio: {
    accounts: [
      { id: 'a1', name: 'Roth', balance: 100 },
      { id: 'a2', name: 'Brokerage', balance: 200 },
    ],
    holdings: [
      { accountId: 'a1', ticker: 'VTI' },
      { accountId: 'a2', ticker: 'BND' },
    ],
  },
};

const RENDERERS: CustomRenderers = {
  badge: ({ value, rowIndex }) => <span>Badge {rowIndex}: {String((value as { name: string }).name)}</span>,
  total: ({ value }) => <p>Total rows: {Array.isArray(value) ? value.length : 0}</p>,
};

function renderList(options: { spec?: FieldSpec; initial?: Record<string, unknown>; errors?: FieldErrors } = {}) {
  const onWrites = vi.fn<(writes: Write[]) => void>();
  let latest: Record<string, unknown> = options.initial ?? INITIAL;
  render(
    <Harness initial={options.initial ?? INITIAL} onWrites={onWrites}>
      {({ get, onWrite, values }) => {
        latest = values;
        return (
          <FieldList
            spec={options.spec ?? ACCOUNTS}
            get={get}
            onWrite={onWrite}
            errors={options.errors ?? {}}
            renderers={RENDERERS}
            idPrefix="p"
          />
        );
      }}
    </Harness>
  );
  return { onWrites, values: () => latest };
}

describe('FieldList', () => {
  it('renders one labelled row per item with row test ids, adornments and footer', () => {
    renderList();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName('Roth');
    expect(screen.getByTestId('account-row-0')).toBe(rows[0]);
    expect(screen.getByTestId('account-row-1')).toBe(rows[1]);
    expect(screen.getByTestId('debt-name-1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Badge 1: Brokerage')).toBeInTheDocument();
    expect(screen.getByText('Total rows: 2')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('textbox', { name: 'Name' })).toHaveAttribute('id', 'input-p-portfolio-accounts-0-name');
  });

  it('row edits write absolute row paths', async () => {
    const user = userEvent.setup();
    const { onWrites } = renderList();
    const second = screen.getAllByRole('listitem')[1];
    await user.type(within(second).getByRole('textbox', { name: 'Name' }), 'X');
    expect(onWrites).toHaveBeenLastCalledWith([{ path: 'portfolio.accounts.1.name', value: 'BrokerageX' }]);
  });

  it('add appends newRow(get) and focuses its first control', async () => {
    const user = userEvent.setup();
    const { onWrites, values } = renderList();
    await user.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(onWrites).toHaveBeenCalledTimes(1);
    const accounts = getAt(values(), 'portfolio.accounts') as Array<Record<string, unknown>>;
    expect(accounts).toHaveLength(3);
    expect(accounts[2]).toMatchObject({ name: '', balance: 50 });
    const third = screen.getAllByRole('listitem')[2];
    expect(third).toHaveAccessibleName('Account 3');
    expect(within(third).getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('remove without a confirmation message removes at once and cascades', async () => {
    const user = userEvent.setup();
    const { onWrites, values } = renderList();
    await user.click(screen.getByRole('button', { name: 'Remove Brokerage' }));
    expect(onWrites).toHaveBeenCalledWith([
      { path: 'portfolio.accounts', value: [INITIAL.portfolio.accounts[0]] },
      { path: 'portfolio.holdings', value: [INITIAL.portfolio.holdings[0]] },
    ]);
    expect(getAt(values(), 'portfolio.holdings')).toEqual([{ accountId: 'a1', ticker: 'VTI' }]);
  });

  it('remove with a confirmation message asks inline; cancel keeps the row', async () => {
    const user = userEvent.setup();
    const { onWrites } = renderList();
    await user.click(screen.getByRole('button', { name: 'Remove Roth' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Remove Roth and its holdings?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onWrites).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove Roth' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onWrites).toHaveBeenCalledWith([
      { path: 'portfolio.accounts', value: [INITIAL.portfolio.accounts[1]] },
      { path: 'portfolio.holdings', value: [INITIAL.portfolio.holdings[1]] },
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the empty text, row errors and the list error', () => {
    renderList({
      initial: { portfolio: { accounts: [], holdings: [] } },
      errors: { 'portfolio.accounts': 'Add at least one item.' },
    });
    expect(screen.getByText('No accounts yet.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one item.');
  });

  it('links a row field error by its absolute path', () => {
    renderList({ errors: { 'portfolio.accounts.1.balance': 'Enter a value of at least $0.' } });
    const second = screen.getAllByRole('listitem')[1];
    expect(within(second).getByRole('textbox', { name: /Balance/ })).toHaveAccessibleDescription(
      expect.stringContaining('Enter a value of at least $0.')
    );
  });

  it('respects minRows and maxRows', () => {
    renderList({ spec: { ...ACCOUNTS, minRows: 2, maxRows: 2 } });
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add an account' })).not.toBeInTheDocument();
  });

  it('defaults: generic labels, an empty new row, a list-level test id', async () => {
    const user = userEvent.setup();
    const plain: FieldSpec = { path: 'debts', kind: 'list', label: 'Debts', tier: 'details', row: DEBT_ROW, testId: 'debts' };
    const { values } = renderList({ spec: plain, initial: { debts: [] } });
    expect(screen.getByTestId('debts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(getAt(values(), 'debts')).toEqual([{}]);
    expect(screen.getByRole('listitem')).toHaveAccessibleName('Debts 1');
  });
});
