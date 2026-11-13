'use client';

import React, { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  useChartWidth,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
} from 'recharts';
import {
  CHART_MARGINS,
  CHART_SERIES_DEFAULTS,
  ChartTooltipCard,
  chartAxisProps,
  chartGridProps,
  useChartTheme,
} from '@/components/ui/charts';
import type { SavingsRatePoint } from '@/lib/calculations/savingsRate';
import { formatCurrency, formatPercent } from '@/lib/format';
import {
  MARKER_DOT_RADIUS,
  MARKER_LABEL_FONT_SIZE,
  savingsRateLabelPositions,
  savingsRateMarkers,
  type PlacedLabel,
  type SavingsRateMarkerInputs,
} from './savingsRateMarkers';

export interface SavingsRateChartProps {
  /**
   * The curve's inputs plus monthlySavings, yearStartSavings and retirementAge
   * for the visitor's markers.
   */
  inputs: SavingsRateMarkerInputs;
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

interface MarkerLabelsProps {
  currentSavingsRate: number | null;
  plannedPoint: SavingsRatePoint | null;
  rateText: string;
  dotText: string;
  fill: string;
}

/**
 * The two marker labels, drawn inside the chart so they can read its pixel
 * geometry; where they go is decided by savingsRateLabelPositions.
 */
function MarkerLabels({ currentSavingsRate, plannedPoint, rateText, dotText, fill }: MarkerLabelsProps) {
  const svgWidth = useChartWidth();
  const plot = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (svgWidth === undefined || !plot || !xScale || !yScale) return null;

  const lineY = currentSavingsRate === null ? null : (yScale(currentSavingsRate) ?? null);
  const dotX = plannedPoint ? xScale(plannedPoint.retirementAge) : undefined;
  const dotY = plannedPoint ? yScale(plannedPoint.requiredSavingsRate) : undefined;
  const dot = dotX === undefined || dotY === undefined ? null : { x: dotX, y: dotY };

  const { rateLabel, dotLabel } = savingsRateLabelPositions({ svgWidth, plot, dot, lineY, dotText, rateText });
  const draw = (label: PlacedLabel | null, text: string, className: string) =>
    label && (
      <text
        className={className}
        x={label.x}
        y={label.y}
        textAnchor={label.textAnchor}
        fill={fill}
        fontSize={MARKER_LABEL_FONT_SIZE}
      >
        {text}
      </text>
    );
  return (
    <g className="savings-rate-marker-labels">
      {draw(rateLabel, rateText, 'savings-rate-label')}
      {draw(dotLabel, dotText, 'planned-age-label')}
    </g>
  );
}

/**
 * The savings rate each retirement age from 45 (or ten years out) to 70
 * requires (lib/calculations/savingsRate), with the visitor's current savings
 * rate as a dashed line and their planned retirement age as a dot on the
 * curve when it is plotted (./savingsRateMarkers, which also builds the
 * caption's sentence). Rendered inside a ChartFrame, which sizes it.
 */
function SavingsRateChart({ inputs }: SavingsRateChartProps) {
  const theme = useChartTheme();
  const {
    startingAge,
    targetIncome,
    startingBalance,
    accumulationReturn,
    currentIncome,
    monthlySavings,
    yearStartSavings,
    retirementAge,
  } = inputs;
  const { curve: data, currentSavingsRate, plannedPoint } = useMemo(
    () =>
      savingsRateMarkers({
        startingAge,
        targetIncome,
        startingBalance,
        accumulationReturn,
        currentIncome,
        monthlySavings,
        yearStartSavings,
        retirementAge,
      }),
    [
      startingAge,
      targetIncome,
      startingBalance,
      accumulationReturn,
      currentIncome,
      monthlySavings,
      yearStartSavings,
      retirementAge,
    ]
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
      {currentSavingsRate !== null && (
        <ReferenceLine
          y={currentSavingsRate}
          stroke={theme.warning}
          strokeDasharray="6 4"
          strokeWidth={2}
          ifOverflow="extendDomain"
        />
      )}
      {plannedPoint && (
        <ReferenceDot
          x={plannedPoint.retirementAge}
          y={plannedPoint.requiredSavingsRate}
          r={MARKER_DOT_RADIUS}
          fill={theme.primary}
          stroke={theme.background}
          strokeWidth={2}
        />
      )}
      <MarkerLabels
        currentSavingsRate={currentSavingsRate}
        plannedPoint={plannedPoint}
        rateText={
          currentSavingsRate === null
            ? ''
            : `Your savings rate: ${formatPercent(currentSavingsRate / 100, { digits: 0 })}`
        }
        dotText={plannedPoint ? `Retire at ${plannedPoint.retirementAge}` : ''}
        fill={theme.text}
      />
    </ComposedChart>
  );
}

export default SavingsRateChart;
