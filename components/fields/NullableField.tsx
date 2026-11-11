'use client';

import React from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import type { FieldSize } from './types';

type Source = 'auto' | 'custom';

const SOURCE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'custom', label: 'Custom' },
] as const;

export interface NullableFieldProps {
  label: string;
  /** True while the stored value is null ("derive it"). */
  isAuto: boolean;
  /** Where the auto value comes from ("Estimated from your income"). */
  autoLabel?: string;
  /** The auto value as the field displays it ("15%"); omitted when unknown. */
  autoValue?: string;
  /** Switches to auto: the caller writes null. */
  onAuto(): void;
  /** Switches to custom: the caller writes the override default. */
  onCustom(): void;
  size?: FieldSize;
  testId?: string;
  /** The field's input, shown while the value is custom. */
  children: React.ReactNode;
}

/**
 * An auto/override switch around a nullable field. Auto shows where the
 * value comes from and what it is; Custom shows the input. The switch stays
 * mounted in both states, so focus stays on it when the body swaps.
 */
export function NullableField({
  label,
  isAuto,
  autoLabel,
  autoValue,
  onAuto,
  onCustom,
  size = 'md',
  testId,
  children,
}: NullableFieldProps) {
  const large = size === 'lg';
  return (
    <div role="group" aria-label={label} className="space-y-2" data-testid={testId}>
      {isAuto ? (
        <div className="space-y-2">
          <p className={cn('font-medium leading-none', large ? 'text-base' : 'text-sm')}>{label}</p>
          <p className={cn('text-muted-foreground', large ? 'text-base' : 'text-sm')}>
            {autoLabel}
            {autoLabel && autoValue ? ': ' : null}
            {autoValue && <span className="font-mono tabular-nums text-foreground">{autoValue}</span>}
          </p>
        </div>
      ) : (
        children
      )}
      <SegmentedControl<Source>
        label={`${label}: auto or custom`}
        hideLabel
        options={SOURCE_OPTIONS}
        value={isAuto ? 'auto' : 'custom'}
        onChange={(next) => {
          // Re-selecting the current source must not reset a custom value.
          if ((next === 'auto') === isAuto) return;
          if (next === 'auto') onAuto();
          else onCustom();
        }}
        size={large ? 'md' : 'sm'}
      />
    </div>
  );
}

export default NullableField;
