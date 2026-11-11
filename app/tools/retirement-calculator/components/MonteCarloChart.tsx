'use client';

import React, { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  ChartTooltipCard,
  chartAxisProps,
  chartGridProps,
  useChartTheme,
} from '@/components/ui/charts';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import { formatCurrency } from '@/lib/format';

export interface MonteCarloChartProps {
  netWorthByAge: { [age: number]: number };
  withdrawalsByAge: { [age: number]: number };
  /** Sets the today's-dollars conversion (display only; the mode is the shared preference) */
  inflationRate: number;
  startingAge: number;
}

const AXIS_CURRENCY = { compact: 'axis' } as const;

const axisCurrency = (value: number) => formatCurrency(value, AXIS_CURRENCY);

interface ProjectionTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value: number | null; color?: string; name?: string }>;
  label?: number;
}

function ProjectionTooltip({ active, payload, label }: ProjectionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <ChartTooltipCard
      title={`Age ${label}`}
      rows={payload.map((entry) => ({
        label: entry.name,
        value: entry.value !== null ? formatCurrency(entry.value) : 'N/A',
        color: entry.color,
        muted: true,
      }))}
    />
  );
}

/**
 * Net worth by age (area, left axis) and annual withdrawals once they start
 * (line, right axis). Rendered inside a ChartFrame, which sizes it.
 */
function MonteCarloChart({ netWorthByAge, withdrawalsByAge, inflationRate, startingAge }: MonteCarloChartProps) {
  const theme = useChartTheme();
  const { fromNominal, axisSuffix } = useDollarDisplay(inflationRate);

  // Simulation output is nominal; in 'today' mode each age-keyed value is
  // deflated by the years elapsed since the start.
  const chartData = useMemo(() => {
    const ages = Object.keys(netWorthByAge).map(Number).sort((a, b) => a - b);
    return ages.map((age) => {
      const yearsFromNow = age - startingAge;
      return {
        age,
        netWorth: fromNominal(netWorthByAge[age], yearsFromNow),
        // Withdrawals show only from the year they start.
        withdrawals: withdrawalsByAge[age] !== undefined ? fromNominal(withdrawalsByAge[age], yearsFromNow) : null,
      };
    });
  }, [netWorthByAge, withdrawalsByAge, fromNominal, startingAge]);

  const axis = chartAxisProps(theme);
  const mutedLabel = { textAnchor: 'middle', fill: theme.muted } as const;
  const successLabel = { textAnchor: 'middle', fill: theme.success } as const;

  return (
    <ComposedChart data={chartData} margin={CHART_MARGINS.labeled}>
      <CartesianGrid {...chartGridProps(theme)} />
      <XAxis
        {...axis}
        dataKey="age"
        label={{ value: 'Age', position: 'insideBottom', offset: -10, style: mutedLabel }}
      />
      <YAxis
        {...axis}
        yAxisId="left"
        tickFormatter={axisCurrency}
        label={{ value: `Net Worth${axisSuffix}`, angle: -90, position: 'insideLeft', style: mutedLabel }}
      />
      <YAxis
        {...axis}
        yAxisId="right"
        orientation="right"
        stroke={theme.success}
        tick={{ fill: theme.success }}
        tickFormatter={axisCurrency}
        label={{
          value: `Annual Withdrawals${axisSuffix}`,
          angle: 90,
          position: 'insideRight',
          style: successLabel,
        }}
      />
      <Tooltip content={<ProjectionTooltip />} />
      <Legend
        wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontFamily: theme.fontMono, color: theme.text }}
      />
      <Area
        {...CHART_SERIES_DEFAULTS}
        yAxisId="left"
        type="monotone"
        dataKey="netWorth"
        stroke={theme.primary}
        fill={theme.primary}
        fillOpacity={0.1}
        strokeWidth={2}
        name="Net Worth"
      />
      <Line
        {...CHART_SERIES_DEFAULTS}
        yAxisId="right"
        type="monotone"
        dataKey="withdrawals"
        stroke={theme.success}
        strokeWidth={2}
        dot={{ fill: theme.success, strokeWidth: 2, r: 3 }}
        connectNulls={false}
        name="Annual Withdrawals"
      />
    </ComposedChart>
  );
}

export default MonteCarloChart;
