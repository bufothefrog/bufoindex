'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Native tooltip text (a short explanation of the option). */
  description?: string;
  disabled?: boolean;
}

/** md: 44px tall everywhere; sm: 44px on touch layouts, compact from md up. */
export type SegmentedControlSize = 'sm' | 'md';

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  /** Accessible name; use this or `ariaLabelledBy`. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  size?: SegmentedControlSize;
  /** Stretch to the container with equal-width segments. */
  fullWidth?: boolean;
  className?: string;
  testId?: string;
}

const SIZE_CLASSES: Record<SegmentedControlSize, string> = {
  md: 'min-h-11 px-3',
  sm: 'min-h-11 px-3 md:min-h-8 md:py-1',
};

/**
 * A single-choice segmented control: a radiogroup of buttons with a roving
 * tab stop. Arrow keys move and select, Home and End jump to the ends.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  ariaLabelledBy,
  size = 'md',
  fullWidth = false,
  className,
  testId,
}: SegmentedControlProps<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : (enabled[0]?.index ?? -1);

  const select = (index: number) => {
    const option = options[index];
    buttons.current[index]?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (enabled.length === 0) return;
    const position = enabled.findIndex((entry) => entry.index === index);
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = enabled[(position + 1) % enabled.length].index;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = enabled[(position - 1 + enabled.length) % enabled.length].index;
        break;
      case 'Home':
        next = enabled[0].index;
        break;
      case 'End':
        next = enabled[enabled.length - 1].index;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
      className={cn(
        'rounded-lg border border-border bg-muted p-0.5 text-sm',
        fullWidth ? 'grid w-full auto-cols-fr grid-flow-col' : 'inline-flex',
        className
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            tabIndex={index === tabStop ? 0 : -1}
            title={option.description}
            onClick={() => select(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'rounded-md font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
              SIZE_CLASSES[size],
              checked ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
