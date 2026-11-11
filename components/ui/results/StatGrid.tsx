import React from 'react';
import { cn } from '@/lib/utils';
import { formatStat, type StatSpec } from '@/lib/design-system/stat';
import StatTile, { type StatTileAlign, type StatTileSize } from './StatTile';

export type StatGridColumns = 1 | 2 | 3 | 4;

export interface StatGridProps {
  /** Headline figures (from a calculator's `headline()`); rendered in order. */
  stats?: readonly StatSpec[];
  /** Extra tiles (or a custom layout) after the specs. */
  children?: React.ReactNode;
  columns?: StatGridColumns;
  size?: StatTileSize;
  align?: StatTileAlign;
  /** Every spec tile shows its label with a value placeholder. */
  loading?: boolean;
  /** The first tile spans the full row (the primary figure). */
  featureFirst?: boolean;
  /** Tints the tile with this spec id (e.g. the active strategy). */
  emphasisId?: string;
  /** Accessible name for the grid. */
  label?: string;
  className?: string;
  testId?: string;
}

/** One column below md (the rebuild's mobile rule), widening from there. */
const COLUMN_CLASSES: Record<StatGridColumns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

/** A responsive grid of StatTiles; numbers are formatted from each spec's FormatKind. */
export function StatGrid({
  stats = [],
  children,
  columns = 2,
  size = 'md',
  align = 'start',
  loading = false,
  featureFirst = false,
  emphasisId,
  label,
  className,
  testId,
}: StatGridProps) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      aria-busy={loading || undefined}
      data-testid={testId}
      className={cn('grid gap-3', COLUMN_CLASSES[columns], className)}
    >
      {stats.map((spec, index) => (
        <StatTile
          key={spec.id}
          testId={`stat-${spec.id}`}
          label={spec.label}
          value={formatStat(spec)}
          hint={spec.hint}
          badge={spec.badge}
          tone={spec.tone}
          emphasis={spec.id === emphasisId}
          size={size}
          align={align}
          loading={loading}
          className={featureFirst && index === 0 ? 'col-span-full' : undefined}
        />
      ))}
      {children}
    </div>
  );
}

export default StatGrid;
