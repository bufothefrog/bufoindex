'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { getChartTheme, subscribeToThemeChanges } from '@/lib/chart-theme';

interface MonteCarloChartProps {
  netWorthByAge: { [age: number]: number };
  withdrawalsByAge: { [age: number]: number };
}


export function MonteCarloChart({ netWorthByAge, withdrawalsByAge }: MonteCarloChartProps) {
  const [chartTheme, setChartTheme] = useState(() => getChartTheme());

  // Update theme when it changes
  useEffect(() => {
    const unsubscribe = subscribeToThemeChanges(() => {
      setChartTheme(getChartTheme());
    });
    return unsubscribe;
  }, []);

  // Format currency values for axis labels (K/M notation)
  const formatAxisCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  };

  // Convert data to Recharts format
  const chartData = useMemo(() => {
    const ages = Object.keys(netWorthByAge).map(Number).sort((a, b) => a - b);

    return ages.map(age => ({
      age,
      netWorth: netWorthByAge[age],
      // Only show withdrawals when they actually start (not null/undefined)
      withdrawals: withdrawalsByAge[age] !== undefined ? withdrawalsByAge[age] : null
    }));
  }, [netWorthByAge, withdrawalsByAge]);

  // Custom tooltip component
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      dataKey: string;
      value: number;
      color: string;
      name: string;
    }>;
    label?: number;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-foreground">
          <p className="text-foreground font-mono text-sm mb-2">
            Age {label}
          </p>
          <div className="space-y-1 text-xs">
            {payload.map((entry, index) => (
              <p key={index} className="text-muted-foreground">
                <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
                {entry.value !== null ? formatCurrency(entry.value) : 'N/A'}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} opacity={0.3} />
          <XAxis
            dataKey="age"
            stroke={chartTheme.muted}
            fontSize={12}
            fontFamily="IBM Plex Mono, monospace"
            tick={{ fill: chartTheme.muted }}
            label={{
              value: 'Age',
              position: 'insideBottom',
              offset: -10,
              style: { textAnchor: 'middle', fill: chartTheme.muted }
            }}
          />
          <YAxis
            yAxisId="left"
            stroke={chartTheme.muted}
            fontSize={12}
            fontFamily="IBM Plex Mono, monospace"
            tick={{ fill: chartTheme.muted }}
            tickFormatter={formatAxisCurrency}
            label={{
              value: 'Net Worth',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: chartTheme.muted }
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={chartTheme.success}
            fontSize={12}
            fontFamily="IBM Plex Mono, monospace"
            tick={{ fill: chartTheme.success }}
            tickFormatter={formatAxisCurrency}
            label={{
              value: 'Annual Withdrawals',
              angle: 90,
              position: 'insideRight',
              style: { textAnchor: 'middle', fill: chartTheme.success }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              fontSize: '12px',
              fontFamily: 'IBM Plex Mono, monospace',
              color: chartTheme.text
            }}
          />

          {/* Net Worth area with fill */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="netWorth"
            stroke={chartTheme.primary}
            fill={chartTheme.primary}
            fillOpacity={0.1}
            strokeWidth={2}
            name="Net Worth"
          />

          {/* Annual Withdrawals line */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="withdrawals"
            stroke={chartTheme.success}
            strokeWidth={2}
            dot={{ fill: chartTheme.success, strokeWidth: 2, r: 3 }}
            connectNulls={false}
            name="Annual Withdrawals"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}