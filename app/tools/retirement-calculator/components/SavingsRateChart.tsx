'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { RetirementInputs, calculateRequiredBalance, futureValue } from '@/lib/calculations/retirement';
import { getChartTheme, subscribeToThemeChanges } from '@/lib/chart-theme';

interface SavingsRateChartProps {
  inputs: RetirementInputs;
}

interface SavingsRateData {
  retirementAge: number;
  requiredSavingsRate: number;
  requiredMonthlySavings: number;
}

export function SavingsRateChart({ inputs }: SavingsRateChartProps) {
  const [chartTheme, setChartTheme] = useState(() => getChartTheme());

  // Update theme when it changes
  useEffect(() => {
    const unsubscribe = subscribeToThemeChanges(() => {
      setChartTheme(getChartTheme());
    });
    return unsubscribe;
  }, []);

  // Calculate required savings rates for different retirement ages
  const savingsData = useMemo((): SavingsRateData[] => {
    const data: SavingsRateData[] = [];
    const requiredBalance = calculateRequiredBalance(inputs.targetIncome);

    // Test retirement ages from current age + 10 to 70
    const minAge = Math.max(inputs.startingAge + 10, 45);
    const maxAge = 70;

    for (let retirementAge = minAge; retirementAge <= maxAge; retirementAge++) {
      const yearsToRetirement = retirementAge - inputs.startingAge;
      const monthsToRetirement = yearsToRetirement * 12;
      const monthlyRate = inputs.accumulationReturn / 12;

      // Calculate growth of starting balance
      const growthOfStartingBalance = futureValue(
        inputs.startingBalance,
        inputs.accumulationReturn,
        yearsToRetirement
      );

      // Calculate how much additional money we need from contributions
      const additionalNeeded = requiredBalance - growthOfStartingBalance;

      if (additionalNeeded <= 0) {
        // Already have enough, savings rate is 0
        data.push({
          retirementAge,
          requiredSavingsRate: 0,
          requiredMonthlySavings: 0
        });
      } else {
        // Calculate required monthly savings using future value of annuity formula
        let requiredMonthlySavings = 0;

        if (monthlyRate === 0) {
          requiredMonthlySavings = additionalNeeded / monthsToRetirement;
        } else {
          // FVA = PMT * [((1 + r)^n - 1) / r]
          // PMT = FVA / [((1 + r)^n - 1) / r]
          const denominator = (Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate;
          requiredMonthlySavings = additionalNeeded / denominator;
        }

        const requiredAnnualSavings = requiredMonthlySavings * 12;
        const requiredSavingsRate = Math.min(1, requiredAnnualSavings / inputs.currentIncome);

        data.push({
          retirementAge,
          requiredSavingsRate: requiredSavingsRate * 100, // Convert to percentage
          requiredMonthlySavings
        });
      }
    }

    return data;
  }, [inputs]);

  // Custom tooltip component
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
      color: string;
    }>;
    label?: number;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const dataPoint = savingsData.find(d => d.retirementAge === label);
      if (!dataPoint) return null;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-foreground">
          <p className="text-foreground font-mono text-sm mb-2">
            Retirement Age {label}
          </p>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.tertiary }}>Required Savings Rate:</span>{' '}
              {dataPoint.requiredSavingsRate.toFixed(1)}%
            </p>
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.tertiary }}>Monthly Savings:</span>{' '}
              {formatCurrency(dataPoint.requiredMonthlySavings)}
            </p>
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
          data={savingsData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} opacity={0.3} />
          <XAxis
            dataKey="retirementAge"
            stroke={chartTheme.muted}
            fontSize={12}
            fontFamily="IBM Plex Mono, monospace"
            tick={{ fill: chartTheme.muted }}
            label={{
              value: 'Retirement Age',
              position: 'insideBottom',
              offset: -10,
              style: { textAnchor: 'middle', fill: chartTheme.muted }
            }}
          />
          <YAxis
            stroke={chartTheme.muted}
            fontSize={12}
            fontFamily="IBM Plex Mono, monospace"
            tick={{ fill: chartTheme.muted }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            label={{
              value: 'Required Savings Rate (%)',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: chartTheme.muted }
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Savings Rate area with gradient fill */}
          <Area
            type="monotone"
            dataKey="requiredSavingsRate"
            stroke={chartTheme.tertiary}
            fill={chartTheme.tertiary}
            fillOpacity={0.1}
            strokeWidth={2}
          />

          {/* Savings Rate line */}
          <Line
            type="monotone"
            dataKey="requiredSavingsRate"
            stroke={chartTheme.tertiary}
            strokeWidth={2}
            dot={{ fill: chartTheme.tertiary, strokeWidth: 2, r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}