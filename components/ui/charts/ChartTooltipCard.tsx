import React from 'react';
import { cn } from '@/lib/utils';

export interface ChartTooltipRow {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Series color for the label, usually a ChartTheme entry. */
  color?: string;
  /** A secondary line (a range or a note) in the muted text color. */
  muted?: boolean;
}

export interface ChartTooltipCardProps {
  /** The hovered point, e.g. "Age 45". */
  title: React.ReactNode;
  rows: ChartTooltipRow[];
  className?: string;
}

/** The card a chart passes to Recharts' Tooltip `content`. */
export function ChartTooltipCard({ title, rows, className }: ChartTooltipCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-3 text-xs text-foreground shadow-lg',
        className
      )}
    >
      <p className="mb-2 font-mono text-sm">{title}</p>
      <div className="space-y-1">
        {rows.map((row, index) => (
          <p key={index} className={cn('tabular-nums', row.muted && 'text-muted-foreground')}>
            <span style={row.color ? { color: row.color } : undefined}>{row.label}:</span>{' '}
            {row.value}
          </p>
        ))}
      </div>
    </div>
  );
}

export default ChartTooltipCard;
