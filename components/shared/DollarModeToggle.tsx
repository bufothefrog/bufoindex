'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { DollarDisplayMode } from '@/lib/utils/displayDollars';

export interface DollarModeToggleProps {
  value: DollarDisplayMode;
  onChange: (mode: DollarDisplayMode) => void;
  className?: string;
}

const OPTIONS: { mode: DollarDisplayMode; label: string; help: string }[] = [
  {
    mode: 'today',
    label: "Today's dollars",
    help: 'Amounts adjusted for inflation to current purchasing power',
  },
  {
    mode: 'nominal',
    label: 'Future dollars',
    help: 'Raw amounts in the year they occur, before inflation adjustment',
  },
];

/**
 * Segmented control switching result displays between today's (inflation
 * adjusted) and nominal future dollars. Display-only: it never changes
 * what the underlying simulation computes.
 */
export function DollarModeToggle({ value, onChange, className }: DollarModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Dollar display mode"
      className={cn(
        'inline-flex rounded-lg border border-border bg-muted p-0.5 text-sm',
        className
      )}
    >
      {OPTIONS.map(({ mode, label, help }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          title={help}
          onClick={() => onChange(mode)}
          className={cn(
            'rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            value === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default DollarModeToggle;
