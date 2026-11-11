/**
 * DataTable must express both the leverage comparison table (row headers
 * with a sublabel, numeric value columns) and the rebalancer plan tables
 * (an empty row, a footer, per-row test ids and per-cell tones).
 */

import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DataTable, type DataTableColumn } from '@/components/ui/results';

afterEach(() => {
  cleanup();
});

interface PlanRow {
  id: string;
  ticker: string;
  action: 'buy' | 'sell' | 'hold';
  dollars: number | null;
  valueAfter: number;
}

const planRows: PlanRow[] = [
  { id: 'h1', ticker: 'VTI', action: 'buy', dollars: 1250.4, valueAfter: 10_250 },
  { id: 'h2', ticker: 'BND', action: 'sell', dollars: -300, valueAfter: 4_700 },
  { id: 'h3', ticker: 'VXUS', action: 'hold', dollars: null, valueAfter: 3_000 },
];

const planColumns: DataTableColumn<PlanRow>[] = [
  { id: 'holding', header: 'Holding', rowHeader: true, cell: (row) => row.ticker, footer: 'Deposit' },
  {
    id: 'action',
    header: 'Action',
    align: 'right',
    cell: (row) => row.action,
    tone: (row) => (row.action === 'sell' ? 'caution' : undefined),
  },
  { id: 'dollars', header: 'Dollars', numeric: true, value: (row) => row.dollars, format: 'currency', footer: '$1,250' },
  { id: 'after', header: 'Value After', numeric: true, value: (row) => row.valueAfter, format: 'currency' },
];

describe('DataTable', () => {
  it('is a table named by its caption, with column headers scoped to columns', () => {
    render(<DataTable caption="Plan for Brokerage" columns={planColumns} rows={planRows} rowKey={(row) => row.id} />);

    const table = screen.getByRole('table', { name: 'Plan for Brokerage' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Holding', 'Action', 'Dollars', 'Value After']);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('renders row headers scoped to rows and formats numeric columns through formatValue', () => {
    render(<DataTable caption="Plan" columns={planColumns} rows={planRows} rowKey={(row) => row.id} />);

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((header) => header.textContent)).toEqual(['VTI', 'BND', 'VXUS']);
    for (const header of rowHeaders) {
      expect(header).toHaveAttribute('scope', 'row');
    }

    const vti = screen.getByRole('row', { name: /VTI/ });
    expect(within(vti).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['buy', '$1,250', '$10,250']);
    const vxus = screen.getByRole('row', { name: /VXUS/ });
    expect(within(vxus).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['hold', '\u2014', '$3,000']);
  });

  it('renders the footer row after the body', () => {
    render(<DataTable caption="Plan" columns={planColumns} rows={planRows} rowKey={(row) => row.id} />);

    const rows = screen.getAllByRole('row');
    const footer = rows[rows.length - 1];
    expect(within(footer).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Deposit', '', '$1,250', '']);
  });

  it('shows one full-width empty row, and no footer, when there are no rows', () => {
    render(
      <DataTable
        caption="Plan"
        columns={planColumns}
        rows={[]}
        rowKey={(row) => row.id}
        empty="No holdings in this account."
      />
    );

    const cell = screen.getByRole('cell', { name: 'No holdings in this account.' });
    expect(cell).toHaveAttribute('colspan', '4');
    expect(screen.queryByText('Deposit')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('falls back to a default empty message', () => {
    render(<DataTable caption="Plan" columns={planColumns} rows={[]} rowKey={(row) => row.id} />);
    expect(screen.getByRole('cell', { name: 'No rows to show.' })).toBeInTheDocument();
  });

  it('tags rows with test ids', () => {
    render(
      <DataTable
        caption="Plan"
        columns={planColumns}
        rows={planRows}
        rowKey={(row) => row.id}
        rowTestId={(row) => `plan-row-${row.id}`}
        testId="plan-table"
      />
    );

    expect(within(screen.getByTestId('plan-table')).getByTestId('plan-row-h2')).toHaveTextContent('BND');
  });

  it('expresses the leverage comparison: hidden label header, sublabels and a visible caption', () => {
    interface Metric {
      label: string;
      sublabel?: string;
      index: string;
      leveraged: string;
    }
    const metrics: Metric[] = [
      { label: 'Median ending balance', sublabel: '50th percentile', index: '$578k', leveraged: '$633k' },
      { label: 'Median max drawdown', index: '34%', leveraged: '71%' },
    ];

    render(
      <DataTable<Metric>
        caption="Index fund versus 2x fund"
        showCaption
        framed
        columns={[
          {
            id: 'metric',
            header: 'Metric',
            hideHeader: true,
            rowHeader: true,
            cell: (row) => (
              <>
                <span className="block">{row.label}</span>
                {row.sublabel && <span className="block">{row.sublabel}</span>}
              </>
            ),
          },
          { id: 'index', header: 'Index', numeric: true, cell: (row) => row.index },
          { id: 'leveraged', header: '2x fund', numeric: true, cell: (row) => row.leveraged },
        ]}
        rows={metrics}
        rowKey={(row) => row.label}
      />
    );

    expect(screen.getByRole('table', { name: 'Index fund versus 2x fund' })).toBeInTheDocument();
    expect(screen.getByText('Index fund versus 2x fund')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Metric' })).toBeInTheDocument();
    const median = screen.getByRole('rowheader', { name: 'Median ending balance50th percentile' });
    expect(median).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Median max drawdown/ })).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '34%',
      '71%',
    ]);
  });
});
