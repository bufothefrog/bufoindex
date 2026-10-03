import React from 'react';
import type { StrategyPreset } from '@/lib/profile/types';
import { cn } from '@/lib/utils';
import { STRATEGY_LABELS, STRATEGY_ORDER } from './derive';

export interface StrategyToggleProps {
  value: StrategyPreset;
  onChange: (preset: StrategyPreset) => void;
  className?: string;
}

/**
 * Segmented control for the strategy preset. Both presets are always on
 * screen; switching only changes which one the cards measure against.
 */
export function StrategyToggle({ value, onChange, className }: StrategyToggleProps) {
  return (
    <div className={cn('w-full sm:w-auto', className)}>
      <span id="strategy-toggle-label" className="mb-1 block text-xs font-medium text-muted-foreground">
        Strategy
      </span>
      <div
        role="group"
        aria-labelledby="strategy-toggle-label"
        className="grid grid-cols-2 rounded-lg border border-border bg-muted p-0.5 text-sm"
      >
        {STRATEGY_ORDER.map((preset) => {
          const active = value === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(preset)}
              className={cn(
                'min-h-11 rounded-md px-3 font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {STRATEGY_LABELS[preset]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StrategyToggle;
