import React from 'react';
import { clamp, cn } from '@/lib/utils';
import { TONE_FILL, type Tone } from '@/lib/design-system/tone';

export interface ProgressBarProps {
  /** Clamped to [min, max]; a non-finite value shows as min. */
  value: number;
  min?: number;
  /** A max at or below min gives an empty bar, with aria-valuemax = min. */
  max?: number;
  /** The accessible name, e.g. "Profile fields answered". */
  label: string;
  /** Read instead of the raw number, e.g. "3 of 8 steps". */
  valueText?: string;
  tone?: Tone;
  className?: string;
}

/** A thin determinate bar with role="progressbar" and its aria-value range. */
export function ProgressBar({
  value,
  min = 0,
  max = 100,
  label,
  valueText,
  tone = 'brand',
  className,
}: ProgressBarProps) {
  // A range with max <= min is empty; a non-finite value counts as min.
  const top = Math.max(min, max);
  const clamped = Number.isFinite(value) ? clamp(value, min, top) : min;
  const share = top > min ? (clamped - min) / (top - min) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={top}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      className={cn('h-2 w-full rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-2 rounded-full transition-all duration-300', TONE_FILL[tone])}
        style={{ width: `${Math.round(share * 100)}%` }}
      />
    </div>
  );
}

export default ProgressBar;
