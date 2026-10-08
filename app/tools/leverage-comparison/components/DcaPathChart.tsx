'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getChartTheme, subscribeToThemeChanges } from '@/lib/chart-theme';
import type { MedianPathPoint } from '@/lib/calculations/leverageComparison';
import { formatCurrency } from '@/lib/utils';
import { formatCompactCurrency, formatLeverage } from './format';

export interface DcaPathChartProps {
  points: MedianPathPoint[];
  leverageRatio: number;
  paths: number;
}

interface ChartRow {
  years: number;
  indexBand: [number, number];
  leveragedBand: [number, number];
  indexMedian: number;
  leveragedMedian: number;
}

/** Keep the chart light on phones: at most ~120 plotted points. */
const MAX_POINTS = 120;

function toRows(points: MedianPathPoint[]): ChartRow[] {
  if (points.length === 0) return [];
  const lastIndex = points.length - 1;
  const step = Math.max(1, Math.ceil(lastIndex / MAX_POINTS));
  const rows: ChartRow[] = [];
  for (let i = 0; i <= lastIndex; i += step) rows.push(toRow(points[i]));
  if (lastIndex % step !== 0) rows.push(toRow(points[lastIndex]));
  return rows;
}

function toRow(p: MedianPathPoint): ChartRow {
  return {
    years: p.month / 12,
    indexBand: [p.indexDcaP10, p.indexDcaP90],
    leveragedBand: [p.leveragedDcaP10, p.leveragedDcaP90],
    indexMedian: p.indexDca,
    leveragedMedian: p.leveragedDca,
  };
}

function yearTicks(maxYears: number): number[] {
  const span = Math.max(1, Math.ceil(maxYears));
  const step = span <= 5 ? 1 : span <= 15 ? 3 : span <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = 0; y <= span; y += step) ticks.push(y);
  return ticks;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  leverageLabel: string;
  indexColor: string;
  leveragedColor: string;
}

function ChartTooltip({ active, payload, leverageLabel, indexColor, leveragedColor }: ChartTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const month = Math.round(row.years * 12);
  const label = month % 12 === 0 ? `Year ${month / 12}` : `Year ${Math.floor(month / 12)}, month ${month % 12}`;
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-xs text-foreground shadow-lg">
      <p className="mb-2 font-mono text-sm">{label}</p>
      <p className="tabular-nums">
        <span style={{ color: indexColor }}>Index fund median:</span> {formatCurrency(row.indexMedian)}
      </p>
      <p className="mb-1 text-muted-foreground tabular-nums">
        10th to 90th: {formatCompactCurrency(row.indexBand[0])} to {formatCompactCurrency(row.indexBand[1])}
      </p>
      <p className="tabular-nums">
        <span style={{ color: leveragedColor }}>{leverageLabel} fund median:</span>{' '}
        {formatCurrency(row.leveragedMedian)}
      </p>
      <p className="text-muted-foreground tabular-nums">
        10th to 90th: {formatCompactCurrency(row.leveragedBand[0])} to{' '}
        {formatCompactCurrency(row.leveragedBand[1])}
      </p>
    </div>
  );
}

export function DcaPathChart({ points, leverageRatio, paths }: DcaPathChartProps) {
  const [theme, setTheme] = useState(() => getChartTheme());

  useEffect(() => subscribeToThemeChanges(() => setTheme(getChartTheme())), []);

  const rows = useMemo(() => toRows(points), [points]);
  const maxYears = rows.length > 0 ? rows[rows.length - 1].years : 1;
  const ticks = useMemo(() => yearTicks(maxYears), [maxYears]);
  const leverageLabel = formatLeverage(leverageRatio);

  const indexColor = theme.primary;
  const leveragedColor = theme.warning;

  return (
    <figure className="space-y-2">
      <div className="h-72 md:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} opacity={0.4} />
            <XAxis
              dataKey="years"
              type="number"
              domain={[0, ticks[ticks.length - 1] ?? maxYears]}
              ticks={ticks}
              tickFormatter={(value: number) => `${value}y`}
              stroke={theme.muted}
              tick={{ fill: theme.muted, fontSize: 12 }}
            />
            <YAxis
              width={56}
              tickFormatter={(value: number) => formatCompactCurrency(value)}
              stroke={theme.muted}
              tick={{ fill: theme.muted, fontSize: 12 }}
            />
            <Tooltip
              content={
                <ChartTooltip
                  leverageLabel={leverageLabel}
                  indexColor={indexColor}
                  leveragedColor={leveragedColor}
                />
              }
            />
            <Legend
              verticalAlign="bottom"
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, color: theme.text, paddingTop: 8 }}
            />
            <Area
              dataKey="leveragedBand"
              stroke="none"
              fill={leveragedColor}
              fillOpacity={0.2}
              legendType="none"
              isAnimationActive={false}
              activeDot={false}
              name={`${leverageLabel} fund 10th to 90th`}
            />
            <Area
              dataKey="indexBand"
              stroke="none"
              fill={indexColor}
              fillOpacity={0.2}
              legendType="none"
              isAnimationActive={false}
              activeDot={false}
              name="Index fund 10th to 90th"
            />
            <Line
              dataKey="indexMedian"
              stroke={indexColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Index fund (median)"
            />
            <Line
              dataKey="leveragedMedian"
              stroke={leveragedColor}
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              name={`${leverageLabel} fund (median)`}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Lines are the median balance across {paths} simulated paths; shaded bands span the 10th to
        90th percentile. Both funds receive the same contributions on the same dates.
      </figcaption>
    </figure>
  );
}

export default DcaPathChart;
