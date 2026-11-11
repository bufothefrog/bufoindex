import React from 'react';
import { cn } from '@/lib/utils';
import { TONE_FILL, type Tone } from '@/lib/design-system/tone';

export type ProgressBarSize = 'sm' | 'md';

export interface ProgressBarProps {
  value: number;
  max?: number;
  min?: number;
  /** Accessible name; use this or `labelledBy`. */
  label?: string;
  labelledBy?: string;
  /** Spoken value, e.g. '12 of 30 fields answered'. */
  valueText?: string;
  /** Fill color. Default brand. */
  tone?: Tone;
  size?: ProgressBarSize;
  className?: string;
  testId?: string;
}

const TRACK_SIZE: Record<ProgressBarSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
};

/** Share of [min, max] covered by value, clamped to 0..1. Non-finite input or an empty range reads as 0. */
export function progressShare(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** A determinate progress bar (role="progressbar") on semantic tokens. */
export function ProgressBar({
  value,
  max = 100,
  min = 0,
  label,
  labelledBy,
  valueText,
  tone = 'brand',
  size = 'md',
  className,
  testId,
}: ProgressBarProps) {
  const share = progressShare(value, min, max);
  const clamped = min + share * (max - min);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      data-testid={testId}
      className={cn('w-full overflow-hidden rounded-full bg-muted', TRACK_SIZE[size], className)}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300 motion-reduce:transition-none', TONE_FILL[tone])}
        style={{ width: `${Math.round(share * 1000) / 10}%` }}
      />
    </div>
  );
}

export default ProgressBar;
