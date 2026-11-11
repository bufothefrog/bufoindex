import React from 'react';
import { cn } from '@/lib/utils';

export interface ChartTooltipRow {
  /** Stable key; defaults to the label when it is a string. */
  id?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Series color (from the chart theme) used for the label swatch. */
  color?: string;
  /** Render the row in muted text, e.g. for a band under its median. */
  muted?: boolean;
}

export interface ChartTooltipCardProps {
  title: React.ReactNode;
  rows: ChartTooltipRow[];
  className?: string;
}

/** The card a Recharts `<Tooltip content={...}>` renders, in semantic tokens. */
export function ChartTooltipCard({ title, rows, className }: ChartTooltipCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-3 text-xs text-foreground shadow-lg',
        className
      )}
    >
      <p className="mb-2 font-mono text-sm">{title}</p>
      <dl className="space-y-1">
        {rows.map((row, index) => (
          <div
            key={row.id ?? (typeof row.label === 'string' ? row.label : index)}
            className={cn('flex flex-wrap gap-x-1 tabular-nums', row.muted && 'text-muted-foreground')}
          >
            <dt style={row.color ? { color: row.color } : undefined}>{row.label}:</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default ChartTooltipCard;
