import React from 'react';
import { cn } from '@/lib/utils';
import type { StatSpec } from '@/lib/design-system/stat';
import StatTile, { type StatTileAlign, type StatTileSize } from './StatTile';

export type StatGridColumns = 1 | 2 | 3 | 4;

export interface StatGridProps {
  stats: readonly StatSpec[];
  /** Columns at full width; 3 and 4 fall back to 2 on a phone. Default 2. */
  columns?: StatGridColumns;
  /** Ids of stats that span the whole row, e.g. the one figure that leads. */
  fullWidth?: readonly string[];
  size?: StatTileSize;
  align?: StatTileAlign;
  /** Every tile shows its loading placeholder; the grid keeps its height. */
  loading?: boolean;
  className?: string;
}

const COLUMNS: Record<StatGridColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

/** A grid of StatTiles rendered from StatSpec data (a calculator's headline). */
export function StatGrid({
  stats,
  columns = 2,
  fullWidth = [],
  size,
  align,
  loading = false,
  className,
}: StatGridProps) {
  return (
    <div aria-busy={loading || undefined} className={cn('grid gap-3', COLUMNS[columns], className)}>
      {stats.map(({ id, ...stat }) => (
        <StatTile
          key={id}
          {...stat}
          size={size}
          align={align}
          loading={loading}
          className={fullWidth.includes(id) ? 'col-span-full' : undefined}
        />
      ))}
    </div>
  );
}

export default StatGrid;
