import React from 'react';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  /** Brand-tinted surface, e.g. the active strategy preset. */
  emphasis?: boolean;
  badge?: string;
  className?: string;
}

/** A small labelled figure. Values use tabular numerals so columns line up. */
export function StatTile({ label, value, hint, emphasis = false, badge, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border p-3',
        emphasis
          ? 'border-sage-400 bg-sage-50 dark:border-sage-500 dark:bg-sage-800/50'
          : 'border-border bg-muted/40',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {badge && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium leading-4 text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 break-words text-lg font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default StatTile;
