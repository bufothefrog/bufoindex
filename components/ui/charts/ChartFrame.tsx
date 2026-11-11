'use client';

import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { CHART_HEIGHT_CLASS, CHART_MODE_NOTE_CLASS, type ChartHeight } from './sizes';

export interface ChartFrameProps {
  /** One Recharts chart element (ComposedChart, LineChart, ...). */
  children: React.ReactElement;
  /** Figure caption below the plot: what the series are and how to read them. */
  caption?: React.ReactNode;
  /** Short note above the plot, e.g. "in today's dollars". */
  modeNote?: React.ReactNode;
  /** compact = h-72 md:h-96; tall = h-96 md:h-[28rem]. */
  height?: ChartHeight;
  className?: string;
}

/**
 * The one chart scaffold: figure, optional mode note, a fixed-height plot area
 * with a ResponsiveContainer, and a caption. It imports Recharts, so load the
 * chart module that renders it with next/dynamic and a ChartPlaceholder of the
 * same `height` (see ChartPlaceholder.tsx). Pass `modeNote` / `caption` to the
 * placeholder as well when the frame renders them, so the swap does not shift.
 *
 * Inside, use useChartTheme() for colors, chartAxisProps / chartGridProps /
 * CHART_MARGINS for shared props, spread CHART_SERIES_DEFAULTS into each series
 * (animation off), thin long series with thinPoints(), and wrap the chart
 * component in React.memo so it re-renders only when its data changes.
 */
export function ChartFrame({
  children,
  caption,
  modeNote,
  height = 'compact',
  className,
}: ChartFrameProps) {
  return (
    <figure className={cn('space-y-2', className)}>
      {modeNote != null && <p className={CHART_MODE_NOTE_CLASS}>{modeNote}</p>}
      <div className={CHART_HEIGHT_CLASS[height]} data-chart-frame="">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {caption != null && <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

export default ChartFrame;
