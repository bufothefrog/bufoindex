import React from 'react';
import { cn } from '@/lib/utils';

export type DataTableAlign = 'start' | 'center' | 'end';

export interface DataTableColumn<Row> {
  id: string;
  header: React.ReactNode;
  cell: (row: Row, rowIndex: number) => React.ReactNode;
  /** Defaults to 'end' for numeric columns and 'start' otherwise. */
  align?: DataTableAlign;
  /** Tabular numerals, no wrapping, end-aligned by default. */
  numeric?: boolean;
  /** Render this column's cells as row headers (th scope="row"). Defaults to the first column only. */
  rowHeader?: boolean;
  /** Footer cell for this column (a total, say); a tfoot renders when any column has one. */
  footer?: React.ReactNode;
  className?: string;
}

export interface DataTableProps<Row> {
  /** Required: names the table for assistive tech. */
  caption: string;
  /** Show the caption on screen; by default it is visually hidden. */
  showCaption?: boolean;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, rowIndex: number) => string;
  /** Shown in a single full-width row when `rows` is empty. */
  emptyMessage?: React.ReactNode;
  className?: string;
  testId?: string;
}

const ALIGN: Record<DataTableAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

function columnAlign<Row>(column: DataTableColumn<Row>): string {
  return ALIGN[column.align ?? (column.numeric ? 'end' : 'start')];
}

function isRowHeader<Row>(column: DataTableColumn<Row>, index: number): boolean {
  return column.rowHeader ?? index === 0;
}

/**
 * A compact table that fits a 390px phone: labels wrap, numbers never do,
 * and the wrapper scrolls on its own rather than the page if a value is
 * unexpectedly wide. Headers carry scope; the caption is always present.
 */
export function DataTable<Row>({
  caption,
  showCaption = false,
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nothing to show yet.',
  className,
  testId,
}: DataTableProps<Row>) {
  const hasFooter = columns.some((column) => column.footer !== undefined);

  return (
    <div className={cn('-mx-1 overflow-x-auto', className)} data-testid={testId}>
      <table className="w-full border-collapse text-sm">
        <caption className={showCaption ? 'mb-2 text-left text-sm font-medium text-foreground' : 'sr-only'}>
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn('px-1 py-2 font-medium', columnAlign(column), column.numeric && 'whitespace-nowrap')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-1 py-4 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)} className="border-b border-border last:border-b-0">
                {columns.map((column, columnIndex) => {
                  const className = cn(
                    'px-1 py-2 align-top text-foreground',
                    columnAlign(column),
                    column.numeric && 'whitespace-nowrap tabular-nums',
                    column.className
                  );
                  return isRowHeader(column, columnIndex) ? (
                    <th key={column.id} scope="row" className={cn(className, 'font-medium')}>
                      {column.cell(row, rowIndex)}
                    </th>
                  ) : (
                    <td key={column.id} className={className}>
                      {column.cell(row, rowIndex)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {hasFooter && (
          <tfoot>
            <tr className="border-t border-border font-semibold">
              {columns.map((column, columnIndex) =>
                isRowHeader(column, columnIndex) ? (
                  <th key={column.id} scope="row" className={cn('px-1 py-2 text-foreground', columnAlign(column))}>
                    {column.footer}
                  </th>
                ) : (
                  <td
                    key={column.id}
                    className={cn(
                      'px-1 py-2 text-foreground',
                      columnAlign(column),
                      column.numeric && 'whitespace-nowrap tabular-nums'
                    )}
                  >
                    {column.footer}
                  </td>
                )
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default DataTable;
