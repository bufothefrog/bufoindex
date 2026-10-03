import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressDotsProps {
  /** Number of screens. */
  total: number;
  /** Zero-based index of the current screen. */
  current: number;
  /** Optional context shown before the step count, e.g. a section name. */
  label?: string;
  className?: string;
}

/** Compact step indicator: one dot per screen plus a "Step x of y" caption. */
export function ProgressDots({ total, current, label, className }: ProgressDotsProps) {
  const safeTotal = Math.max(1, total);
  const step = Math.min(Math.max(current, 0), safeTotal - 1);

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <ol className="flex flex-wrap items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: safeTotal }, (_, index) => (
          <li
            key={index}
            className={cn(
              'h-2 rounded-full transition-all',
              index === step
                ? 'w-6 bg-sage-600 dark:bg-sage-300'
                : index < step
                  ? 'w-2 bg-sage-400 dark:bg-sage-500'
                  : 'w-2 bg-muted-foreground/30'
            )}
          />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {label ? `${label} · ` : ''}Step {step + 1} of {safeTotal}
      </p>
    </div>
  );
}

export default ProgressDots;
