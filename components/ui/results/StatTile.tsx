import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { formatStatValue, type StatSpec } from '@/lib/design-system/stat';
import { TONE_BORDER, TONE_SURFACE } from '@/lib/design-system/tone';

export type StatTileSize = 'md' | 'lg';
export type StatTileAlign = 'start' | 'center';

export interface StatTileProps extends Omit<StatSpec, 'id'> {
  size?: StatTileSize;
  align?: StatTileAlign;
  /**
   * Keeps the label and hint and swaps the figure for a pulse bar of the same
   * line height, so the tile does not change size when the value arrives.
   */
  loading?: boolean;
  className?: string;
}

const SIZE: Record<StatTileSize, { tile: string; label: string; value: string; placeholder: string }> = {
  md: {
    tile: 'p-3',
    label: 'text-xs',
    value: 'text-lg font-semibold',
    placeholder: 'h-7',
  },
  lg: {
    tile: 'p-4',
    label: 'text-sm',
    value: 'text-2xl font-bold',
    placeholder: 'h-8',
  },
};

/**
 * A labelled headline figure. The tile is a group named by its label, so a
 * screen reader announces the label with the figure. Values use tabular
 * numerals so tiles in a row line up.
 */
export function StatTile({
  label,
  value,
  format,
  tone = 'neutral',
  hint,
  badge,
  size = 'md',
  align = 'start',
  loading = false,
  className,
}: StatTileProps) {
  const labelId = useId();
  const sizing = SIZE[size];
  const centered = align === 'center';

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      className={cn(
        'min-w-0 rounded-lg border',
        TONE_BORDER[tone],
        TONE_SURFACE[tone],
        sizing.tile,
        centered && 'text-center',
        className
      )}
    >
      <div className={cn('flex items-start gap-2', centered ? 'justify-center' : 'justify-between')}>
        <div id={labelId} className={cn('text-muted-foreground', sizing.label)}>
          {label}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium leading-4 text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <div className={cn('mt-1 flex items-center', centered && 'justify-center', sizing.placeholder)}>
          <div className="h-2/3 w-24 max-w-full animate-pulse rounded bg-muted" />
          <span className="sr-only">Loading</span>
        </div>
      ) : (
        <div className={cn('mt-1 break-words tabular-nums text-foreground', sizing.value)}>
          {formatStatValue(value, format)}
        </div>
      )}
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default StatTile;
