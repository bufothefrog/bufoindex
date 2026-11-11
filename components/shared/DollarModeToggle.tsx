'use client';

import React from 'react';
import SegmentedControl, { type SegmentedControlOption } from '@/components/ui/segmented-control';
import type { DollarDisplayMode } from '@/lib/utils/displayDollars';

export interface DollarModeToggleProps {
  value: DollarDisplayMode;
  onChange: (mode: DollarDisplayMode) => void;
  className?: string;
}

const OPTIONS: readonly SegmentedControlOption<DollarDisplayMode>[] = [
  {
    value: 'today',
    label: "Today's dollars",
    description: 'Amounts adjusted for inflation to current purchasing power',
  },
  {
    value: 'nominal',
    label: 'Future dollars',
    description: 'Raw amounts in the year they occur, before inflation adjustment',
  },
];

/**
 * Segmented control switching result displays between today's (inflation
 * adjusted) and nominal future dollars. Display-only: it never changes
 * what the underlying simulation computes.
 */
export function DollarModeToggle({ value, onChange, className }: DollarModeToggleProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      options={OPTIONS}
      ariaLabel="Dollar display mode"
      size="sm"
      className={className}
    />
  );
}

export default DollarModeToggle;
