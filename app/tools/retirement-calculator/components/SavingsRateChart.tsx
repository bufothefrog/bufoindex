'use client';

import React, { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  ChartTooltipCard,
  chartAxisProps,
  chartGridProps,
  useChartTheme,
} from '@/components/ui/charts';
import { requiredSavingsCurve, type SavingsRateInputs, type SavingsRatePoint } from '@/lib/calculations/savingsRate';
import { formatCurrency } from '@/lib/format';

export interface SavingsRateChartProps {
  inputs: SavingsRateInputs;
}

/** The curve's rates are already in percent (0 to 100). */
const percentTick = (value: number) => `${value.toFixed(0)}%`;

interface SavingsTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: SavingsRatePoint }>;
  accentColor: string;
}

function SavingsTooltip({ active, payload, accentColor }: SavingsTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <ChartTooltipCard
      title={`Retirement Age ${point.retirementAge}`}
      rows={[
        {
          label: 'Required Savings Rate',
          value: `${point.requiredSavingsRate.toFixed(1)}%`,
          color: accentColor,
          muted: true,
        },
        {
          label: "Monthly Savings (today's $)",
          value: formatCurrency(point.requiredMonthlySavings),
          color: accentColor,
          muted: true,
        },
      ]}
    />
  );
}

/**
 * The savings rate each retirement age from 45 (or ten years out) to 70
 * requires (lib/calculations/savingsRate). Rendered inside a ChartFrame,
 * which sizes it.
 */
function SavingsRateChart({ inputs }: SavingsRateChartProps) {
  const theme = useChartTheme();
  const { startingAge, targetIncome, startingBalance, accumulationReturn, currentIncome } = inputs;
  const data = useMemo(
    () => requiredSavingsCurve({ startingAge, targetIncome, startingBalance, accumulationReturn, currentIncome }),
    [startingAge, targetIncome, startingBalance, accumulationReturn, currentIncome]
  );

  const axis = chartAxisProps(theme);
  const mutedLabel = { textAnchor: 'middle', fill: theme.muted } as const;
  const accent = theme.tertiary;

  return (
    <ComposedChart data={data} margin={CHART_MARGINS.labeled}>
      <CartesianGrid {...chartGridProps(theme)} />
      <XAxis
        {...axis}
        dataKey="retirementAge"
        label={{ value: 'Retirement Age', position: 'insideBottom', offset: -10, style: mutedLabel }}
      />
      <YAxis
        {...axis}
        tickFormatter={percentTick}
        label={{ value: 'Required Savings Rate (%)', angle: -90, position: 'insideLeft', style: mutedLabel }}
      />
      <Tooltip content={<SavingsTooltip accentColor={accent} />} />
      <Area
        {...CHART_SERIES_DEFAULTS}
        type="monotone"
        dataKey="requiredSavingsRate"
        stroke={accent}
        fill={accent}
        fillOpacity={0.1}
        strokeWidth={2}
      />
      <Line
        {...CHART_SERIES_DEFAULTS}
        type="monotone"
        dataKey="requiredSavingsRate"
        stroke={accent}
        strokeWidth={2}
        dot={{ fill: accent, strokeWidth: 2, r: 3 }}
      />
    </ComposedChart>
  );
}

export default SavingsRateChart;
