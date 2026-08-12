'use client';

import React, { useMemo, useEffect, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { RetirementInputs, RetirementResults, calculateProjectedBalance } from '@/lib/calculations/retirement';
import { getChartTheme, getRechartsTheme, getSageVariants, subscribeToThemeChanges } from '@/lib/chart-theme';
import {
  DollarDisplayMode,
  DEFAULT_DOLLAR_DISPLAY_MODE,
  displayDollars,
} from '@/lib/utils/displayDollars';

export interface NetWorthData {
  age: number;
  year: number;
  netWorth: number;
  realValue: number; // Inflation-adjusted value
  phase: 'accumulation' | 'withdrawal';
  contributions: number; // Cumulative contributions
  growth: number; // Cumulative growth
}

export interface NetWorthProgressionProps {
  inputs: RetirementInputs;
  results: RetirementResults;
  /** Display-only: deflates nominal dollar series when set to 'today' */
  displayMode?: DollarDisplayMode;
  width?: number;
  height?: number;
  responsive?: boolean;
}

/**
 * NetWorthProgression Chart - Shows accumulation and withdrawal phases clearly
 */
export function NetWorthProgression({
  inputs,
  results,
  displayMode = DEFAULT_DOLLAR_DISPLAY_MODE,
  width = 800,
  height = 500,
  responsive = true
}: NetWorthProgressionProps) {
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
  
  // Generate net worth progression data
  const netWorthData = useMemo(() => {
    const data: NetWorthData[] = [];
    const currentYear = new Date().getFullYear();
    const maxAge = Math.min(inputs.lifeExpectancy, 95);
    
    let cumulativeContributions = inputs.startingBalance;
    let retirementBalance = 0;
    
    for (let age = inputs.startingAge; age <= maxAge; age++) {
      const yearsFromStart = age - inputs.startingAge;
      const year = currentYear + yearsFromStart;
      let netWorth = 0;
      const phase: 'accumulation' | 'withdrawal' = age <= inputs.retirementAge ? 'accumulation' : 'withdrawal';
      
      if (age <= inputs.retirementAge) {
        // Accumulation phase - use data from results or calculate
        if (results.netWorthByAge[age]) {
          netWorth = results.netWorthByAge[age];
        } else {
          // Calculate manually if not in results
          const testInputs = { ...inputs, retirementAge: age };
          netWorth = calculateProjectedBalance(testInputs);
        }
        
        // Update cumulative contributions
        if (age > inputs.startingAge) {
          cumulativeContributions += inputs.monthlySavings * 12;
        }
        
        // Store retirement balance for withdrawal phase calculations
        if (age === inputs.retirementAge) {
          retirementBalance = netWorth;
        }
      } else {
        // Withdrawal phase - simulate portfolio decline
        const yearsInRetirement = age - inputs.retirementAge;
        const annualWithdrawal = inputs.targetIncome;
        
        // Start with retirement balance and apply growth/withdrawals year by year
        netWorth = retirementBalance;
        for (let retireYear = 1; retireYear <= yearsInRetirement; retireYear++) {
          // Apply investment growth
          netWorth = netWorth * (1 + inputs.retirementReturn);
          
          // Subtract inflation-adjusted withdrawal
          const inflatedWithdrawal = annualWithdrawal * Math.pow(1 + inputs.inflationRate, retireYear - 1);
          netWorth = Math.max(0, netWorth - inflatedWithdrawal);
        }
      }
      
      // Calculate real (inflation-adjusted) value
      const realValue = netWorth / Math.pow(1 + inputs.inflationRate, yearsFromStart);
      
      // Calculate growth component (total - contributions)
      const growth = Math.max(0, netWorth - cumulativeContributions);
      
      data.push({
        age,
        year,
        netWorth,
        realValue,
        phase,
        contributions: cumulativeContributions,
        growth
      });
    }
    
    return data;
  }, [inputs, results]);

  // Display-only conversion: netWorth/contributions/growth are nominal; in
  // 'today' mode deflate each by the years elapsed since the starting age.
  // realValue is already today's dollars by construction.
  const displayData = useMemo(() => {
    if (displayMode !== 'today') return netWorthData;
    return netWorthData.map((d) => {
      const yearsFromStart = d.age - inputs.startingAge;
      return {
        ...d,
        netWorth: displayDollars(d.netWorth, displayMode, inputs.inflationRate, yearsFromStart),
        contributions: displayDollars(d.contributions, displayMode, inputs.inflationRate, yearsFromStart),
        growth: displayDollars(d.growth, displayMode, inputs.inflationRate, yearsFromStart),
      };
    });
  }, [netWorthData, displayMode, inputs.inflationRate, inputs.startingAge]);

  const modeAxisSuffix = displayMode === 'today' ? " (today's $)" : ' (future $)';

  // Find phase transition point
  const retirementPoint = displayData.find(d => d.age === inputs.retirementAge);

  // Custom tooltip
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      payload?: NetWorthData;
    }>;
  }
  
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as NetWorthData;
      if (!data) return null;

      const totalReturn = data.netWorth > 0 ? ((data.netWorth / data.contributions - 1) * 100) : 0;

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-foreground">
          <p className="text-foreground font-mono text-sm mb-2">
            Age {data.age} ({data.year}) - {data.phase.charAt(0).toUpperCase() + data.phase.slice(1)}
          </p>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Net Worth:</span>{' '}
              ${data.netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            {displayMode === 'nominal' && (
              <p className="text-muted-foreground">
                <span style={{ color: chartTheme.secondary }}>Today&apos;s Value:</span>{' '}
                ${data.realValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            )}
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Contributions:</span>{' '}
              ${data.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Growth:</span>{' '}
              ${data.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            {data.phase === 'accumulation' && (
              <p className="text-muted-foreground">
                <span style={{ color: chartTheme.secondary }}>Total Return:</span>{' '}
                {totalReturn.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Chart content
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
      <defs>
        {/* Gradient for accumulation phase */}
        <linearGradient id="accumulationGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={chartTheme.primary} stopOpacity={0.8}/>
          <stop offset="95%" stopColor={chartTheme.primary} stopOpacity={0.1}/>
        </linearGradient>
        {/* Gradient for withdrawal phase */}
        <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={chartTheme.secondary} stopOpacity={0.6}/>
          <stop offset="95%" stopColor={chartTheme.secondary} stopOpacity={0.1}/>
        </linearGradient>
      </defs>
      
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
        stroke={chartTheme.muted}
        fontSize={12}
        fontFamily="IBM Plex Mono, monospace"
        tick={{ fill: chartTheme.muted }}
        tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
        label={{
          value: `Net Worth${modeAxisSuffix}`,
          angle: -90,
          position: 'insideLeft',
          style: { textAnchor: 'middle', fill: chartTheme.muted }
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
      
      {/* Retirement age reference line */}
      <ReferenceLine 
        x={inputs.retirementAge} 
        stroke={chartTheme.tertiary} 
        strokeWidth={2}
        strokeDasharray="5 5" 
        label={{ 
          value: "Retirement", 
          position: "top",
          style: { fill: chartTheme.tertiary, fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }
        }}
      />
      
      {/* Net worth area - split by phase */}
      <Area
        type="monotone"
        dataKey="netWorth"
        stroke="transparent"
        fill="url(#accumulationGradient)"
        fillOpacity={1}
        name="Net Worth Progression"
      />
      
      {/* Main net worth line */}
      <Line
        type="monotone"
        dataKey="netWorth"
        stroke={chartTheme.primary}
        strokeWidth={3}
        dot={false}
        name="Total Net Worth"
      />
      
      {/* Real value line — redundant when the main line is already in today's dollars */}
      {displayMode === 'nominal' && (
        <Line
          type="monotone"
          dataKey="realValue"
          stroke={chartTheme.secondary}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Real Value (Today's $)"
        />
      )}
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
          Net Worth Progression Through Life
        </h3>
        <p className="text-sm text-sage-600 font-mono">
          Portfolio growth during accumulation phase (age {inputs.startingAge}-{inputs.retirementAge}) and
          decline during withdrawal phase (age {inputs.retirementAge}-{inputs.lifeExpectancy})
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          {displayMode === 'today' ? "Values shown in today's dollars." : 'Values shown in future dollars.'}
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        {chartContent}
      </ResponsiveContainer>
      
      {/* Phase summary cards */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="bg-sage-50 p-3 rounded border-l-4 border-sage-400">
          <div className="text-sage-700 font-semibold">Accumulation Phase</div>
          <div className="text-sage-900">
            Ages {inputs.startingAge} - {inputs.retirementAge} ({inputs.retirementAge - inputs.startingAge} years)
          </div>
          <div className="text-sage-500">
            Peak: ${Math.round(retirementPoint?.netWorth || 0).toLocaleString()}
          </div>
        </div>
        
        <div className="bg-slate-50 p-3 rounded border-l-4 border-sage-500">
          <div className="text-sage-700 font-semibold">Withdrawal Phase</div>
          <div className="text-sage-900">
            Ages {inputs.retirementAge} - {inputs.lifeExpectancy} ({inputs.lifeExpectancy - inputs.retirementAge} years)
          </div>
          <div className="text-sage-500">
            Annual withdrawal: ${inputs.targetIncome.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-slate-50 p-3 rounded border-l-4 border-sage-600">
          <div className="text-sage-700 font-semibold">Total Growth</div>
          <div className="text-sage-900">
            {retirementPoint ? 
              `${((retirementPoint.netWorth / retirementPoint.contributions - 1) * 100).toFixed(1)}%` : 
              'Calculating...'
            }
          </div>
          <div className="text-sage-500">
            From ${Math.round(retirementPoint?.contributions || 0).toLocaleString()} contributions
          </div>
        </div>
      </div>
      
      {/* Inflation impact notice — references the dashed real-value line, which only renders in nominal mode */}
      {displayMode === 'nominal' && (
      <div className="mt-4 bg-amber-50 border-l-4 border-amber-400 p-4">
        <div className="flex">
          <div className="shrink-0">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-mono font-semibold text-amber-800">
              Inflation Impact
            </h4>
            <p className="text-xs font-mono text-amber-700 mt-1">
              The dashed line shows purchasing power in today&apos;s dollars. 
              At {(inputs.inflationRate * 100).toFixed(1)}% inflation, $1M in {inputs.retirementAge + 20} years 
              equals ~${(1000000 / Math.pow(1 + inputs.inflationRate, 20)).toLocaleString()} today.
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

export default NetWorthProgression;