'use client';

/**
 * NullableField
 * Wraps an input whose value may be null, meaning "derive it from the rest
 * of the profile". While automatic, it shows the label and the derived value
 * in words; unchecking "Use the automatic value" reveals the input, seeded
 * with the override default by the caller.
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface NullableFieldProps {
  /** Element id prefix; the toggle is `${id}-auto`. */
  id: string;
  label: string;
  /** Describes the derived value ("Estimated from your income and state"). */
  autoLabel?: string;
  /** True while the value is null (derived). */
  isAuto: boolean;
  /** Called with true to clear the override, false to start one. */
  onAutoChange: (auto: boolean) => void;
  /** The override input, rendered only while not automatic. */
  children: React.ReactNode;
  toggleLabel?: string;
  size?: 'md' | 'lg';
  className?: string;
  testId?: string;
}

export function NullableField({
  id,
  label,
  autoLabel,
  isAuto,
  onAutoChange,
  children,
  toggleLabel = 'Use the automatic value',
  size = 'md',
  className,
  testId,
}: NullableFieldProps) {
  return (
    <div className={cn('space-y-2', className)} data-testid={testId} data-auto={isAuto}>
      {isAuto ? (
        <div className="space-y-1">
          <p className={cn('font-medium leading-none', size === 'lg' ? 'text-base' : 'text-sm')}>{label}</p>
          {autoLabel && (
            <p id={`${id}-auto-value`} className="text-sm text-muted-foreground">
              {autoLabel}
            </p>
          )}
        </div>
      ) : (
        children
      )}
      <Checkbox
        id={`${id}-auto`}
        label={
          <>
            <span className="sr-only">{label}: </span>
            {toggleLabel}
          </>
        }
        checked={isAuto}
        onCheckedChange={onAutoChange}
        description={isAuto ? undefined : autoLabel}
      />
    </div>
  );
}

export default NullableField;
