'use client';

import React, { useId, useRef } from 'react';
import { OptionCard } from '@/components/guided/OptionCard';
import type { FieldOption } from '@/lib/fields/types';
import { cn } from '@/lib/utils';
import { FieldMessages, fieldMessageIds } from './FieldMessages';
import type { FieldSize } from './types';

export type ChoiceGroupLayout = 'stack' | 'grid';

export interface ChoiceGroupProps {
  label: string;
  options: readonly FieldOption[];
  /** The selected option's value; anything else selects nothing. */
  value: unknown;
  onChange(value: FieldOption['value']): void;
  /**
   * Enter on an option selects it and advances in one step. The value is
   * passed along because the parent's state has not updated yet.
   */
  onChooseAndAdvance?(value: FieldOption['value']): void;
  help?: string;
  error?: string;
  /** Visually hide the label (it still names the group). */
  hideLabel?: boolean;
  /** stack: one card per row (the wizard); grid: two columns from sm up. */
  layout?: ChoiceGroupLayout;
  size?: FieldSize;
  testId?: string;
}

/**
 * Radio group of OptionCards with the standard keyboard model: Tab enters
 * the group on the selected option, arrow keys (and Home / End) move and
 * select, Space selects, Enter selects and advances.
 */
export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  onChooseAndAdvance,
  help,
  error,
  hideLabel = false,
  layout = 'stack',
  size = 'md',
  testId,
}: ChoiceGroupProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const { describedBy } = fieldMessageIds(id, help, error);
  const groupRef = useRef<HTMLDivElement>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []
    );
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
    <div className="space-y-2" data-testid={testId}>
      <p
        id={labelId}
        className={cn(
          'font-medium',
          size === 'lg' ? 'text-base' : 'text-sm leading-none',
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
        aria-describedby={describedBy}
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
      <FieldMessages id={id} help={help} error={error} />
    </div>
  );
}

export default ChoiceGroup;
