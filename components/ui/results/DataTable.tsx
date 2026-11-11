import React from 'react';
import { cn } from '@/lib/utils';
import type { FormatKind } from '@/lib/format';
import { formatStatValue } from '@/lib/design-system/stat';
import { TONE_TEXT, type Tone } from '@/lib/design-system/tone';

export type DataTableAlign = 'left' | 'center' | 'right';

interface DataTableColumnBase<T> {
  /** Stable key, unique within the table. */
  id: string;
  header: React.ReactNode;
  /** Keeps the header for screen readers but hides it on screen. */
  hideHeader?: boolean;
  /** Default: right for numeric columns, left otherwise. */
  align?: DataTableAlign;
  /** Figures: tabular numerals that never wrap, aligned right by default. */
  numeric?: boolean;
  /** Cells are row headers (th scope="row"), usually the first column. */
  rowHeader?: boolean;
  /** Text tone for one cell; neutral when it returns undefined. */
  tone?: (row: T) => Tone | undefined;
  /** This column's cell in the footer row. */
  footer?: React.ReactNode;
}

/**
 * A column renders each cell either with `cell`, or from a number formatted
 * through formatValue (`value` plus `format`; null prints a dash).
 */
export type DataTableColumn<T> = DataTableColumnBase<T> &
  (
    | { cell: (row: T, index: number) => React.ReactNode; value?: never; format?: never }
    | { value: (row: T) => number | null; format: FormatKind; cell?: never }
  );

export interface DataTableProps<T> {
  /** Names the table for screen readers; visually hidden unless showCaption. */
  caption: string;
  showCaption?: boolean;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  rowTestId?: (row: T) => string;
  /** The single full-width row shown when there are no rows. */
  empty?: React.ReactNode;
  /** Framed: a rounded border and a tinted header, for a table on its own. */
  framed?: boolean;
  className?: string;
  testId?: string;
}

const ALIGN: Record<DataTableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function alignOf<T>(column: DataTableColumn<T>): string {
  return ALIGN[column.align ?? (column.numeric ? 'right' : 'left')];
}

function renderCell<T>(column: DataTableColumn<T>, row: T, index: number): React.ReactNode {
  return column.cell ? column.cell(row, index) : formatStatValue(column.value(row), column.format);
}

/**
 * A compact table that fits a 390px-wide phone: labels wrap, figures never
 * do, and the wrapper scrolls on its own rather than the page when a value is
 * unexpectedly wide. The footer row shows only when there are rows to total.
 */
export function DataTable<T>({
  caption,
  showCaption = false,
  columns,
  rows,
  rowKey,
  rowTestId,
  empty = 'No rows to show.',
  framed = false,
  className,
  testId,
}: DataTableProps<T>) {
  const cellPad = framed ? 'p-2' : 'px-1 py-2';
  const hasFooter = rows.length > 0 && columns.some((column) => column.footer !== undefined);

  return (
    <div
      className={cn(
        'overflow-x-auto',
        framed ? 'rounded-lg border border-border' : '-mx-1',
        className
      )}
      data-testid={testId}
    >
      <table className="w-full border-collapse text-sm">
        <caption
          className={
            showCaption ? 'pb-2 text-left text-sm font-medium text-foreground' : 'sr-only'
          }
        >
          {caption}
        </caption>
        <thead className={cn('text-xs text-muted-foreground', framed && 'bg-muted/60')}>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(cellPad, 'font-medium', alignOf(column), column.numeric && 'whitespace-nowrap')}
              >
                {column.hideHeader ? <span className="sr-only">{column.header}</span> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-b border-border last:border-b-0"
                data-testid={rowTestId?.(row)}
              >
                {columns.map((column) => {
                  const className = cn(
                    cellPad,
                    'align-top',
                    alignOf(column),
                    column.numeric && 'whitespace-nowrap tabular-nums',
                    column.rowHeader && 'font-medium',
                    TONE_TEXT[column.tone?.(row) ?? 'neutral']
                  );
                  return column.rowHeader ? (
                    <th key={column.id} scope="row" className={className}>
                      {renderCell(column, row, index)}
                    </th>
                  ) : (
                    <td key={column.id} className={className}>
                      {renderCell(column, row, index)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {hasFooter && (
          <tfoot>
            <tr className="border-t-2 border-border">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    cellPad,
                    'font-medium text-foreground',
                    alignOf(column),
                    column.numeric && 'whitespace-nowrap tabular-nums'
                  )}
                >
                  {column.footer}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default DataTable;
