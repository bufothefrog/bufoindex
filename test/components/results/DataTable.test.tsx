import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable, type DataTableColumn } from '@/components/ui/results';

interface Row {
  name: string;
  amount: number;
}

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Account', cell: (row) => row.name, footer: 'Total' },
  { id: 'amount', header: 'Amount', numeric: true, cell: (row) => `$${row.amount}`, footer: '$30' },
];

describe('DataTable', () => {
  it('names the table by its caption and scopes headers', () => {
    render(
      <DataTable
        caption="Holdings by account"
        columns={columns}
        rows={[
          { name: 'Roth IRA', amount: 10 },
          { name: 'Taxable', amount: 20 },
        ]}
        rowKey={(row) => row.name}
      />
    );
    const table = screen.getByRole('table', { name: 'Holdings by account' });
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((h) => h.textContent)).toEqual(['Account', 'Amount']);
    columnHeaders.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    const rowHeaders = within(table).getAllByRole('rowheader');
    expect(rowHeaders.map((h) => h.textContent)).toEqual(['Roth IRA', 'Taxable', 'Total']);
    rowHeaders.forEach((header) => expect(header).toHaveAttribute('scope', 'row'));
    expect(within(table).getByRole('cell', { name: '$20' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '$30' })).toBeInTheDocument();
  });

  it('shows an empty row spanning every column', () => {
    render(
      <DataTable caption="Trades" showCaption columns={columns} rows={[]} rowKey={(row) => row.name} emptyMessage="No trades needed." />
    );
    const cell = screen.getByRole('cell', { name: 'No trades needed.' });
    expect(cell).toHaveAttribute('colspan', '2');
    expect(screen.getByText('Trades').tagName).toBe('CAPTION');
  });

  it('honours explicit row-header and alignment choices without a footer', () => {
    const plain: DataTableColumn<Row>[] = [
      { id: 'name', header: 'Name', rowHeader: false, align: 'center', cell: (row) => row.name },
      { id: 'amount', header: 'Amount', cell: (row) => row.amount },
    ];
    const { container } = render(
      <DataTable caption="Plain" columns={plain} rows={[{ name: 'A', amount: 1 }]} rowKey={(_, i) => String(i)} />
    );
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
    expect(container.querySelector('tfoot')).toBeNull();
  });
});
