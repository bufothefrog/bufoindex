/**
 * Slider Field Component
 * A bounded number set by dragging a slider or by typing it. The typed box
 * is a NumberInput, so the label, help text and error come from BaseInput
 * and are linked to it; the slider carries the same accessible name and is
 * described by the same help or error.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { fieldMessageIds } from '@/components/ui/FieldMessages';
import { formatCount } from '@/lib/format';
import { Slider } from '@/components/ui/slider';
import { NumberInput } from './NumberInput';
import type { InputSize } from './BaseInput';
import type { BaseInputProps } from '@/lib/design-system/types';

export interface SliderFieldProps extends BaseInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Slider and arrow-key step (default 1); values are rounded to its decimals. */
  step?: number;
  /** Prints the bounds and the current value under the slider. */
  formatValue?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  /** xl is the intake wizard's size. */
  size?: InputSize;
}

/** The decimal places of a step: 0.1 -> 1, 0.005 -> 3, 1 -> 0. */
function stepDecimals(step: number): number {
  const [, fraction = ''] = String(step).split('.');
  return fraction.length;
}

export function SliderField({
  name,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue = formatCount,
  prefix,
  suffix,
  size = 'md',
  required = false,
  help,
  error,
  disabled = false,
  className,
  testId,
}: SliderFieldProps) {
  const decimals = stepDecimals(step);
  // Steps such as 0.1 accumulate binary noise (0.5 + 6 * 0.1); round it off.
  const commit = (next: number) => onChange(Number(next.toFixed(decimals)));
  // The ids BaseInput gives the NumberInput's help and error text.
  const { describedBy } = fieldMessageIds(`input-${name}`, help, error);

  return (
    <div className={cn('space-y-2', className)} data-testid={testId}>
      <NumberInput
        name={name}
        label={label}
        value={value}
        onChange={commit}
        min={min}
        max={max}
        step={step}
        allowDecimals={decimals > 0}
        precision={decimals}
        prefix={prefix}
        suffix={suffix}
        required={required}
        help={help}
        error={error}
        disabled={disabled}
        size={size}
      />
      <div className="px-3">
        <Slider
          value={[value]}
          onValueChange={([next]: number[]) => commit(next)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full"
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{formatValue(min)}</span>
          <span className="font-medium">{formatValue(value)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>
    </div>
  );
}

export default SliderField;
