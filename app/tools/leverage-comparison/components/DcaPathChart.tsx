'use client';

import React, { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  ChartTooltipCard,
  chartAxisProps,
  chartGridProps,
  thinPoints,
  useChartTheme,
} from '@/components/ui/charts';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import type { MedianPathPoint } from '@/lib/calculations/leverageComparison';
import { COMPACT } from '@/lib/calculators/leverage/narrative';
import { formatCurrency, formatMultiple } from '@/lib/format';
import { DISPLAY_INFLATION_ASSUMPTION } from '@/lib/utils/displayDollars';

export interface DcaPathChartProps {
  points: readonly MedianPathPoint[];
  leverageRatio: number;
}

export interface ChartRow {
  years: number;
  indexBand: [number, number];
  leveragedBand: [number, number];
  indexMedian: number;
  leveragedMedian: number;
}

/** Keep the chart light on phones: about 120 steps plus the last point. */
const MAX_POINTS = 121;

/**
 * One chart row per path point, every balance converted for display by
 * `convert(nominal, yearsFromNow)` at that point's own month. Display only.
 */
export function toChartRow(p: MedianPathPoint, convert: (nominal: number, yearsFromNow: number) => number): ChartRow {
  const years = p.month / 12;
  const c = (value: number) => convert(value, years);
  return {
    years,
    indexBand: [c(p.indexDcaP10), c(p.indexDcaP90)],
    leveragedBand: [c(p.leveragedDcaP10), c(p.leveragedDcaP90)],
    indexMedian: c(p.indexDca),
    leveragedMedian: c(p.leveragedDca),
  };
}

function yearTicks(maxYears: number): number[] {
  const span = Math.max(1, Math.ceil(maxYears));
  const step = span <= 5 ? 1 : span <= 15 ? 3 : span <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let y = 0; y <= span; y += step) ticks.push(y);
  return ticks;
}

function band([low, high]: [number, number]): string {
  return `${formatCurrency(low, COMPACT)} to ${formatCurrency(high, COMPACT)}`;
}

interface PathTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ChartRow }>;
  leverageLabel: string;
  /** " (today's $)" or " (future $)", from the shared display mode. */
  suffix: string;
  indexColor: string;
  leveragedColor: string;
}

function PathTooltip({ active, payload, leverageLabel, suffix, indexColor, leveragedColor }: PathTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const month = Math.round(row.years * 12);
  const title = month % 12 === 0 ? `Year ${month / 12}` : `Year ${Math.floor(month / 12)}, month ${month % 12}`;
  return (
    <ChartTooltipCard
      title={title}
      rows={[
        { label: `Index fund median${suffix}`, value: formatCurrency(row.indexMedian), color: indexColor },
        { label: '10th to 90th', value: band(row.indexBand), muted: true },
        { label: `${leverageLabel} fund median${suffix}`, value: formatCurrency(row.leveragedMedian), color: leveragedColor },
        { label: '10th to 90th', value: band(row.leveragedBand), muted: true },
      ]}
    />
  );
}

/**
 * Median balance paths with 10th to 90th percentile bands for the index fund
 * and the leveraged fund. Rendered inside a ChartFrame, which sizes it.
 * Balances follow the shared dollar display mode at the fixed inflation
 * assumption (the engine has no inflation input); the caller's caption
 * names the basis.
 */
function DcaPathChart({ points, leverageRatio }: DcaPathChartProps) {
  const theme = useChartTheme();
  const { fromNominal, axisSuffix } = useDollarDisplay(DISPLAY_INFLATION_ASSUMPTION, { basis: 'fixed' });
  const rows = useMemo(
    () => thinPoints(points, MAX_POINTS).map((p) => toChartRow(p, fromNominal)),
    [points, fromNominal]
  );
  const maxYears = rows.length > 0 ? rows[rows.length - 1].years : 1;
  const ticks = useMemo(() => yearTicks(maxYears), [maxYears]);
  const leverageLabel = formatMultiple(leverageRatio);

  const indexColor = theme.primary;
  const leveragedColor = theme.warning;
  const axis = chartAxisProps(theme);

  return (
    <ComposedChart data={rows} margin={CHART_MARGINS.compact}>
      <CartesianGrid {...chartGridProps(theme)} />
      <XAxis
        {...axis}
        dataKey="years"
        type="number"
        domain={[0, ticks[ticks.length - 1] ?? maxYears]}
        ticks={ticks}
        tickFormatter={(value: number) => `${value}y`}
      />
      <YAxis {...axis} width={56} tickFormatter={(value: number) => formatCurrency(value, COMPACT)} />
      <Tooltip
        content={
          <PathTooltip
            leverageLabel={leverageLabel}
            suffix={axisSuffix}
            indexColor={indexColor} leveragedColor={leveragedColor} />
        }
      />
      <Legend
        verticalAlign="bottom"
        iconType="plainline"
        wrapperStyle={{ fontSize: 12, color: theme.text, paddingTop: 8 }}
      />
      <Area
        {...CHART_SERIES_DEFAULTS}
        dataKey="leveragedBand"
        stroke="none"
        fill={leveragedColor}
        fillOpacity={0.2}
        legendType="none"
        activeDot={false}
        name={`${leverageLabel} fund 10th to 90th`}
      />
      <Area
        {...CHART_SERIES_DEFAULTS}
        dataKey="indexBand"
        stroke="none"
        fill={indexColor}
        fillOpacity={0.2}
        legendType="none"
        activeDot={false}
        name="Index fund 10th to 90th"
      />
      <Line
        {...CHART_SERIES_DEFAULTS}
        dataKey="indexMedian"
        stroke={indexColor}
        strokeWidth={2}
        dot={false}
        name={`Index fund (median)${axisSuffix}`}
      />
      <Line
        {...CHART_SERIES_DEFAULTS}
        dataKey="leveragedMedian"
        stroke={leveragedColor}
        strokeWidth={2.5}
        strokeDasharray="6 3"
        dot={false}
        name={`${leverageLabel} fund (median)${axisSuffix}`}
      />
    </ComposedChart>
  );
}

/**
 * Memoized: the chart re-renders only when its points, the ratio or the
 * shared dollar display mode change (audit H3).
 */
export default React.memo(DcaPathChart);
