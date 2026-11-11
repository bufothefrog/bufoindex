'use client';

/**
 * SliderField
 * A range slider with the same chrome as BaseInput: label, value readout,
 * help and error. Replaces PercentageSlider and the hand-built slider rows.
 * The slider thumb (role="slider") carries the accessible name; help and
 * error text are rendered beneath, and the error is announced as an alert.
 */

import React, { useId } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export interface SliderFieldProps {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Formats the readout and the min/max labels (defaults to String). */
  format?: (value: number) => string;
  help?: string;
  error?: string;
  disabled?: boolean;
  /** 'xl' is the guided-intake size (larger label and readout). */
  size?: 'md' | 'lg' | 'xl';
  /** Accessible name when the visible label is hidden or differs. */
  ariaLabel?: string;
  hideLabel?: boolean;
  className?: string;
  testId?: string;
}

/** Rounds away floating point noise from step arithmetic (0.1 + 0.2). */
function snap(value: number, step: number): number {
  const decimals = Math.max(0, Math.min(10, Math.ceil(-Math.log10(step))));
  return Number(value.toFixed(decimals + 2));
}

export function SliderField({
  name,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  help,
  error,
  disabled = false,
  size = 'md',
  ariaLabel,
  hideLabel = false,
  className,
  testId,
}: SliderFieldProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const helpId = help && !error ? `${baseId}-help` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const large = size === 'xl';

  return (
    <div className={cn('space-y-2', className)} data-testid={testId} data-name={name}>
      <div className="flex items-baseline justify-between gap-3">
        <span
          id={labelId}
          className={cn(
            'font-medium leading-none',
            large ? 'text-base' : 'text-sm',
            error && 'text-destructive',
            hideLabel && 'sr-only'
          )}
        >
          {label}
        </span>
        <output
          aria-live="polite"
          className={cn('font-mono font-semibold tabular-nums text-foreground', large ? 'text-lg' : 'text-sm')}
        >
          {format(safeValue)}
        </output>
      </div>
      {/* py-3 keeps the touch target at 44px around the 20px thumb. */}
      <div className="px-1 py-3">
        <Slider
          value={[safeValue]}
          onValueChange={([next]) => onChange(snap(next, step))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
          className="w-full"
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
      {helpId && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default SliderField;
