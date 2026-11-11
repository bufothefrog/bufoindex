'use client';

import React, { useId, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT } from '@/lib/design-system/tone';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  /** A second line under the label (cards appearance only). */
  description?: string;
  /** Shown before the label (cards appearance only). */
  icon?: LucideIcon;
  /** Native tooltip, e.g. what the option means. */
  title?: string;
  testId?: string;
}

export type SegmentedControlAppearance = 'track' | 'cards';
export type SegmentedControlSize = 'sm' | 'md';

export interface SegmentedControlProps<T extends string> {
  /** The group's accessible name; shown above the control unless hideLabel. */
  label: string;
  hideLabel?: boolean;
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * track: a compact pill switch on a muted track.
   * cards: one bordered card per option, with an icon and a description.
   */
  appearance?: SegmentedControlAppearance;
  /** Track height: sm fits a toolbar, md is a 44px touch target. Default sm. */
  size?: SegmentedControlSize;
  /** Track only: stretch across the container with equal segments. */
  fullWidth?: boolean;
  className?: string;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

const CARD_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

/**
 * A single choice among a few options, as a radio group. Only the selected
 * option is in the tab order; the arrow keys (and Home / End) move the
 * selection and the focus together, as in the WAI-ARIA radio group pattern.
 */
export function SegmentedControl<T extends string>({
  label,
  hideLabel = false,
  options,
  value,
  onChange,
  appearance = 'track',
  size = 'sm',
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;
  const cards = appearance === 'cards';

  const select = (index: number) => {
    onChange(options[index].value);
    buttons.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    let next: number;
    if (NEXT_KEYS.has(event.key)) next = index === last ? 0 : index + 1;
    else if (PREVIOUS_KEYS.has(event.key)) next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    select(next);
  };

  const group = (
    <div
      role="radiogroup"
      aria-label={hideLabel ? label : undefined}
      aria-labelledby={hideLabel ? undefined : labelId}
      className={cn(
        cards
          ? cn('grid gap-2', CARD_COLUMNS[options.length] ?? 'grid-cols-1 sm:grid-cols-2')
          : cn(
              'rounded-lg border border-border bg-muted p-0.5 text-sm',
              fullWidth ? 'flex w-full' : 'inline-flex'
            ),
        hideLabel && className
      )}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const Icon = option.icon;
        const optionId = `${labelId}-${index}`;
        const described = cards && option.description !== undefined;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            title={option.title}
            aria-labelledby={cards ? optionId : undefined}
            aria-describedby={described ? `${optionId}-description` : undefined}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
              cards
                ? cn(
                    'rounded-lg border p-3 text-left focus-visible:ring-offset-2',
                    checked
                      ? cn(TONE_BORDER.brand, TONE_SURFACE.brand)
                      : 'border-border bg-background hover:border-sage-300 dark:hover:border-sage-600'
                  )
                : cn(
                    'rounded-md px-3 font-medium focus-visible:ring-offset-1',
                    size === 'md' ? 'min-h-11' : 'py-1',
                    fullWidth && 'flex-1',
                    checked
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )
            )}
          >
            {cards ? (
              <>
                <span
                  id={optionId}
                  className={cn(
                    'flex items-center gap-2 text-sm font-medium',
                    checked ? TONE_TEXT.brand : 'text-foreground'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  {option.label}
                </span>
                {described && (
                  <span id={`${optionId}-description`} className="mt-1 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </div>
  );

  if (hideLabel) return group;

  return (
    <div className={className}>
      <span id={labelId} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {group}
    </div>
  );
}

export default SegmentedControl;
