'use client';

import React, { useMemo, useEffect, useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';
import { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { getChartTheme, getRechartsTheme, getSageVariants, subscribeToThemeChanges } from '@/lib/chart-theme';
import {
  DollarDisplayMode,
  DEFAULT_DOLLAR_DISPLAY_MODE,
  displayDollars,
} from '@/lib/utils/displayDollars';

export interface WithdrawalData {
  age: number;
  year: number;
  withdrawalAmount: number;
  inflatedAmount: number;
  portfolioBalance: number;
  currentDollars: number;
}

export interface WithdrawalTimelineProps {
  inputs: RetirementInputs;
  results: RetirementResults;
  /** Display-only: deflates nominal dollar series when set to 'today' */
  displayMode?: DollarDisplayMode;
  width?: number;
  height?: number;
  responsive?: boolean;
}

/**
 * WithdrawalTimeline Chart - Shows withdrawal timeline starting at retirement age only
 * CRITICAL: This chart MUST start at retirement age, not before
 */
export function WithdrawalTimeline({
  inputs,
  results,
  displayMode = DEFAULT_DOLLAR_DISPLAY_MODE,
  width = 800,
  height = 400,
  responsive = true
}: WithdrawalTimelineProps) {
  const [chartTheme, setChartTheme] = useState(() => getChartTheme());
  const [rechartsTheme, setRechartsTheme] = useState(() => getRechartsTheme());
  const sageVariants = getSageVariants();

  // Subscribe to theme changes
  useEffect(() => {
    const unsubscribe = subscribeToThemeChanges(() => {
      setChartTheme(getChartTheme());
      setRechartsTheme(getRechartsTheme());
    });
    return unsubscribe;
  }, []);
  
  // Generate withdrawal timeline data starting ONLY at retirement age
  const withdrawalData = useMemo(() => {
    const data: WithdrawalData[] = [];
    const retirementYears = inputs.lifeExpectancy - inputs.retirementAge;
    const baseWithdrawal = inputs.targetIncome;
    let currentBalance = results.netWorthByAge[inputs.retirementAge] || 0;
    
    // CRITICAL: Start loop at retirement age, not before
    for (let year = 0; year <= retirementYears; year++) {
      const currentAge = inputs.retirementAge + year;
      const currentYear = new Date().getFullYear() + (currentAge - inputs.startingAge);
      
      // Calculate inflation-adjusted withdrawal for this year
      const inflatedWithdrawal = baseWithdrawal * Math.pow(1 + inputs.inflationRate, year);
      
      // Apply investment growth and subtract withdrawal
      if (year > 0) {
        currentBalance = currentBalance * (1 + inputs.retirementReturn) - data[year - 1].inflatedAmount;
        currentBalance = Math.max(0, currentBalance); // Don't go negative
      }
      
      data.push({
        age: currentAge,
        year: currentYear,
        withdrawalAmount: baseWithdrawal, // Original target in today's dollars
        inflatedAmount: inflatedWithdrawal, // What you'll actually withdraw
        portfolioBalance: currentBalance,
        currentDollars: baseWithdrawal, // For display consistency
      });
    }
    
    return data;
  }, [inputs, results]);

  // Display-only conversion: the withdrawal and balance series are nominal;
  // in 'today' mode deflate each by the years elapsed since the starting age.
  // withdrawalAmount/currentDollars are already expressed in today's dollars.
  const displayData = useMemo(() => {
    if (displayMode !== 'today') return withdrawalData;
    return withdrawalData.map((d) => ({
      ...d,
      inflatedAmount: displayDollars(d.inflatedAmount, displayMode, inputs.inflationRate, d.age - inputs.startingAge),
      portfolioBalance: displayDollars(d.portfolioBalance, displayMode, inputs.inflationRate, d.age - inputs.startingAge),
    }));
  }, [withdrawalData, displayMode, inputs.inflationRate, inputs.startingAge]);

  const modeAxisSuffix = displayMode === 'today' ? " (today's $)" : ' (future $)';

  // Custom tooltip formatter
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      payload?: WithdrawalData;
    }>;
  }
  
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as WithdrawalData;
      if (!data) return null;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-foreground">
          <p className="text-foreground font-mono text-sm mb-2">
            Age {data.age} ({data.year})
          </p>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Withdrawal:</span>{' '}
              ${data.inflatedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            {displayMode === 'nominal' && (
              <p className="text-muted-foreground">
                <span style={{ color: chartTheme.secondary }}>Today&apos;s Value:</span>{' '}
                ${data.currentDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            )}
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Portfolio:</span>{' '}
              ${data.portfolioBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Responsive container content
  const chartContent = (
    <ComposedChart
      data={displayData}
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
        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        label={{
          value: `Annual Amount${modeAxisSuffix}`,
          angle: -90,
          position: 'insideLeft',
          style: { textAnchor: 'middle', fill: chartTheme.muted }
        }}
      />
      <YAxis 
        yAxisId="right" 
        orientation="right"
        stroke={chartTheme.secondary}
        fontSize={12}
        fontFamily="IBM Plex Mono, monospace"
        tick={{ fill: chartTheme.secondary }}
        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        label={{
          value: `Portfolio Balance${modeAxisSuffix}`,
          angle: 90,
          position: 'insideRight',
          style: { textAnchor: 'middle', fill: chartTheme.secondary }
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
      
      {/* Portfolio balance area (background) */}
      <Area
        yAxisId="right"
        type="monotone"
        dataKey="portfolioBalance"
        fill={chartTheme.primary.includes('hsl') 
          ? chartTheme.primary.replace('hsl(', 'hsla(').replace(')', ', 0.1)')
          : chartTheme.primary + '1A'}
        stroke="transparent"
        name="Portfolio Balance"
      />
      
      {/* Withdrawal line (deflated to today's dollars in 'today' mode) */}
      <Line
        yAxisId="left"
        type="monotone"
        dataKey="inflatedAmount"
        stroke={chartTheme.primary}
        strokeWidth={3}
        dot={{ fill: chartTheme.primary, strokeWidth: 2, r: 4 }}
        name={displayMode === 'today' ? "Annual Withdrawal (Today's $)" : 'Annual Withdrawal (Future $)'}
      />

      {/* Current dollars reference line — redundant when everything is already in today's dollars */}
      {displayMode === 'nominal' && (
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="currentDollars"
          stroke={chartTheme.secondary}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Equivalent Today's $"
        />
      )}

      {/* Portfolio balance line */}
      <Line
        yAxisId="right"
        type="monotone"
        dataKey="portfolioBalance"
        stroke={chartTheme.tertiary}
        strokeWidth={2}
        dot={{ fill: chartTheme.tertiary, strokeWidth: 2, r: 3 }}
        name="Remaining Balance"
      />
    </ComposedChart>
  );

  if (!responsive) {
    return (
      <div style={{ width, height }}>
        {chartContent}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 px-2">
        <h3 className="text-lg font-mono font-semibold text-sage-700 mb-2">
          Withdrawal Timeline (Retirement Years Only)
        </h3>
        <p className="text-sm text-sage-600 font-mono">
          Annual withdrawals from age {inputs.retirementAge} to {inputs.lifeExpectancy},
          adjusted for inflation. Portfolio balance shows expected decline over time.
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          {displayMode === 'today' ? "Values shown in today's dollars." : 'Values shown in future dollars.'}
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        {chartContent}
      </ResponsiveContainer>
      
      {/* Summary statistics */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="bg-muted p-3 rounded border-l-4 border-sage-400">
          <div className="text-sage-700 font-semibold">First Year Withdrawal</div>
          <div className="text-sage-900">
            ${Math.round(displayData[0]?.inflatedAmount || 0).toLocaleString()}
          </div>
          <div className="text-sage-500">
            {displayMode === 'nominal'
              ? `($${displayData[0]?.currentDollars.toLocaleString() || 0} today)`
              : "in today's dollars"}
          </div>
        </div>

        <div className="bg-muted p-3 rounded border-l-4 border-sage-500">
          <div className="text-sage-700 font-semibold">Final Year Withdrawal</div>
          <div className="text-sage-900">
            ${Math.round(displayData[displayData.length - 1]?.inflatedAmount || 0).toLocaleString()}
          </div>
          <div className="text-sage-500">
            {displayMode === 'nominal'
              ? `(${Math.pow(1 + inputs.inflationRate, displayData.length - 1).toFixed(1)}x inflation)`
              : "in today's dollars"}
          </div>
        </div>

        <div className="bg-muted p-3 rounded border-l-4 border-sage-600">
          <div className="text-sage-700 font-semibold">Portfolio Depletion</div>
          <div className="text-sage-900">
            {withdrawalData[withdrawalData.length - 1]?.portfolioBalance > 10000 ? 'Preserved' : 'Depleted'}
          </div>
          <div className="text-sage-500">
            Final: ${Math.round(Math.max(0, displayData[displayData.length - 1]?.portfolioBalance || 0)).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WithdrawalTimeline;