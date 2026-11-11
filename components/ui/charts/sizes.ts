/**
 * Chart heights shared by ChartFrame and ChartPlaceholder, so a lazily loaded
 * chart replaces a placeholder of exactly its own height (no layout shift).
 * Recharts-free on purpose: the placeholder ships on the critical path.
 */

export type ChartHeight = 'compact' | 'tall';

/** Plot-area height classes. compact = h-72 md:h-96 (section 2.11). */
export const CHART_HEIGHT_CLASS: Record<ChartHeight, string> = {
  compact: 'h-72 md:h-96',
  tall: 'h-96 md:h-[28rem]',
};

/** Line box reserved for the optional mode note above the plot (text-xs). */
export const CHART_MODE_NOTE_CLASS = 'min-h-4 text-right text-xs text-muted-foreground';
