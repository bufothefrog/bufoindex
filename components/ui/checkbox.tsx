'use client';

/**
 * Checkbox
 * A native checkbox with its label, optional description, help and error.
 * The whole row is the tap target (at least 44px tall). Replaces the
 * hand-rolled checkbox rows on the calculator pages.
 */

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Secondary text under the label, part of the accessible description. */
  description?: React.ReactNode;
  help?: React.ReactNode;
  error?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Visually hide the label (it stays the accessible name). */
  hideLabel?: boolean;
  className?: string;
  testId?: string;
}

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  description,
  help,
  error,
  id,
  name,
  disabled = false,
  hideLabel = false,
  className,
  testId,
}: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? `checkbox-${generated}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const helpId = help && !error ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1', className)} data-testid={testId}>
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input
          id={inputId}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-input accent-primary',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed'
          )}
        />
        <span
          className={cn(
            'min-w-0 text-sm font-medium leading-snug text-foreground',
            error && 'text-destructive',
            hideLabel && 'sr-only'
          )}
        >
          {label}
        </span>
      </label>
      {description && (
        <p id={descriptionId} className="-mt-2 pl-8 text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {helpId && (
        <p id={helpId} className="pl-8 text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="pl-8 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default Checkbox;
