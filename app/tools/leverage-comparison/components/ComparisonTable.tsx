import React from 'react';
import { cn } from '@/lib/utils';

export interface ComparisonTableRow {
  label: string;
  sublabel?: string;
  values: React.ReactNode[];
}

export interface ComparisonTableProps {
  /** Accessible table caption (visually hidden). */
  caption: string;
  /** Header for the label column followed by one header per value column. */
  columns: string[];
  rows: ComparisonTableRow[];
  className?: string;
}

/**
 * Compact numeric table that fits a 390px-wide phone: labels wrap, numbers
 * never do, and the wrapper scrolls on its own rather than the page if a
 * value is unexpectedly wide.
 */
export function ComparisonTable({ caption, columns, rows, className }: ComparisonTableProps) {
  const [labelHeader, ...valueHeaders] = columns;
  return (
    <div className={cn('-mx-1 overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-1 py-2 text-left font-medium">
              {labelHeader}
            </th>
            {valueHeaders.map((header) => (
              <th key={header} scope="col" className="whitespace-nowrap px-1 py-2 text-right font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-1 py-2 text-left align-top font-medium text-foreground">
                <span className="block">{row.label}</span>
                {row.sublabel && (
                  <span className="block text-xs font-normal text-muted-foreground">{row.sublabel}</span>
                )}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={`${row.label}-${i}`}
                  className="whitespace-nowrap px-1 py-2 text-right align-top tabular-nums text-foreground"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ComparisonTable;
