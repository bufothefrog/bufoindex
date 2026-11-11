'use client';

/**
 * ChoiceGroup
 * A radio group of OptionCards with the standard keyboard model: Tab enters
 * the group on the selected option, arrow keys move and select, Home and End
 * jump to the ends, Space selects, and Enter selects and advances (when the
 * caller supplies onChooseAndAdvance, as the wizard does).
 */

import React, { useId, useRef } from 'react';
import { OptionCard } from '@/components/guided/OptionCard';
import type { FieldOption, FieldOptionValue } from '@/lib/fields/types';
import { cn } from '@/lib/utils';

export interface ChoiceGroupProps {
  label: string;
  options: readonly FieldOption[];
  value: unknown;
  onChange: (value: FieldOptionValue) => void;
  /**
   * Enter on an option selects it and advances in one step. The value is
   * passed along because the parent's state has not updated yet.
   */
  onChooseAndAdvance?: (value: FieldOptionValue) => void;
  /** Visually hide the label (a screen heading already asks the question). */
  hideLabel?: boolean;
  help?: React.ReactNode;
  error?: string;
  /** 'stack' is one card per row; 'grid' is two columns from the sm breakpoint. */
  layout?: 'stack' | 'grid';
  /** 'lg' uses a larger group label (guided intake). */
  size?: 'md' | 'lg';
  id?: string;
  className?: string;
  testId?: string;
}

export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  onChooseAndAdvance,
  hideLabel = false,
  help,
  error,
  layout = 'stack',
  size = 'md',
  id,
  className,
  testId,
}: ChoiceGroupProps) {
  const generated = useId();
  const baseId = id ?? generated;
  const labelId = `${baseId}-label`;
  const helpId = help && !error ? `${baseId}-help` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const groupRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);
    const current = radios.indexOf(event.target as HTMLButtonElement);
    if (current < 0 || options.length === 0) return;

    let next: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % options.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;

    if (next !== null) {
      event.preventDefault();
      onChange(options[next].value);
      radios[next]?.focus();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = options[current].value;
      if (onChooseAndAdvance) onChooseAndAdvance(chosen);
      else onChange(chosen);
    }
  };

  return (
    <div className={cn('space-y-2', className)} data-testid={testId}>
      <p
        id={labelId}
        className={cn(
          'font-medium',
          size === 'lg' ? 'text-base' : 'text-sm',
          error && 'text-destructive',
          hideLabel && 'sr-only'
        )}
      >
        {label}
      </p>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        onKeyDown={handleKeyDown}
        className={layout === 'grid' ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'space-y-2'}
      >
        {options.map((option, index) => (
          <OptionCard
            key={String(option.value)}
            title={option.label}
            description={option.description}
            selected={index === selectedIndex}
            onSelect={() => onChange(option.value)}
            tabIndex={index === tabStop ? 0 : -1}
          />
        ))}
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

export default ChoiceGroup;
