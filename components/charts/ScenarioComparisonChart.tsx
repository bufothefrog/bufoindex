'use client';

import React, { useMemo, useEffect, useState } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { RetirementInputs, calculateRequiredBalance } from '@/lib/calculations/retirement';
import { analyzeRetirementScenarios, ScenarioAnalysis } from '@/lib/calculations/scenarioAnalysis';
import { getChartTheme, getRechartsTheme, getSageVariants, subscribeToThemeChanges } from '@/lib/chart-theme';
import {
  DollarDisplayMode,
  DEFAULT_DOLLAR_DISPLAY_MODE,
  displayDollars,
} from '@/lib/utils/displayDollars';

export interface ScenarioData {
  name: string;
  scenario: 'current' | '+$500' | '+$1000';
  monthlyContribution: number;
  projectedBalance: number;
  retirementAge: number;
  additionalIncome: number;
  surplusShortfall: number;
  feasible: boolean;
}

export interface ScenarioComparisonProps {
  inputs: RetirementInputs;
  scenarioAnalysis?: ScenarioAnalysis;
  /** Display-only: deflates nominal dollar figures when set to 'today' */
  displayMode?: DollarDisplayMode;
  width?: number;
  height?: number;
  responsive?: boolean;
}

/**
 * ScenarioComparisonChart - Compare current vs +$500 vs +$1000 scenarios
 */
export function ScenarioComparisonChart({
  inputs,
  scenarioAnalysis,
  displayMode = DEFAULT_DOLLAR_DISPLAY_MODE,
  width = 800,
  height = 400,
  responsive = true
}: ScenarioComparisonProps) {
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
  
  // Generate scenario comparison data
  const scenarioData = useMemo(() => {
    const data: ScenarioData[] = [];
    const requiredBalance = calculateRequiredBalance(inputs.targetIncome);
    
    // Get or calculate scenario analysis
    const analysis = scenarioAnalysis || analyzeRetirementScenarios(inputs);
    
    // Current scenario
    const currentBalance = analysis.current.projectedBalance;
    const currentSurplus = currentBalance - requiredBalance;
    const currentRetirementAge = currentSurplus >= 0 ? inputs.retirementAge : 
      (analysis.current.canRetireAtAge || inputs.retirementAge + 5);
    
    data.push({
      name: 'Current',
      scenario: 'current',
      monthlyContribution: inputs.monthlySavings,
      projectedBalance: currentBalance,
      retirementAge: currentRetirementAge,
      additionalIncome: analysis.current.incomeAtTargetAge || 0,
      surplusShortfall: currentSurplus,
      feasible: currentSurplus >= 0
    });
    
    // +$500 scenario
    const plus500Balance = analysis.withExtra500.projectedBalance;
    const plus500Surplus = plus500Balance - requiredBalance;
    const plus500RetirementAge = analysis.withExtra500.earlierRetirementAge || 
      analysis.withExtra500.canRetireAtAge || inputs.retirementAge;
    
    data.push({
      name: '+$500/mo',
      scenario: '+$500',
      monthlyContribution: inputs.monthlySavings + 500,
      projectedBalance: plus500Balance,
      retirementAge: plus500RetirementAge,
      additionalIncome: analysis.withExtra500.additionalIncome || 
        analysis.withExtra500.incomeAtTargetAge || 0,
      surplusShortfall: plus500Surplus,
      feasible: plus500Surplus >= 0
    });
    
    // +$1000 scenario
    const plus1000Balance = analysis.withExtra1000.projectedBalance;
    const plus1000Surplus = plus1000Balance - requiredBalance;
    const plus1000RetirementAge = analysis.withExtra1000.earlierRetirementAge || 
      analysis.withExtra1000.canRetireAtAge || inputs.retirementAge;
    
    data.push({
      name: '+$1K/mo',
      scenario: '+$1000',
      monthlyContribution: inputs.monthlySavings + 1000,
      projectedBalance: plus1000Balance,
      retirementAge: plus1000RetirementAge,
      additionalIncome: analysis.withExtra1000.additionalIncome || 
        analysis.withExtra1000.incomeAtTargetAge || 0,
      surplusShortfall: plus1000Surplus,
      feasible: plus1000Surplus >= 0
    });
    
    return data;
  }, [inputs, scenarioAnalysis]);

  // Display-only conversion. Every projected/required balance here is a
  // balance at the target retirement age, so a single deflation horizon
  // applies: retirementAge - startingAge. additionalIncome is an annual
  // amount as of the same year. monthlyContribution is current-year money
  // and is never converted.
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const toDisplay = (nominalAmount: number) =>
    displayDollars(nominalAmount, displayMode, inputs.inflationRate, yearsToRetirement);

  const displayScenarioData = useMemo(() => {
    if (displayMode !== 'today') return scenarioData;
    return scenarioData.map((d) => ({
      ...d,
      projectedBalance: displayDollars(d.projectedBalance, displayMode, inputs.inflationRate, yearsToRetirement),
      additionalIncome: displayDollars(d.additionalIncome, displayMode, inputs.inflationRate, yearsToRetirement),
      surplusShortfall: displayDollars(d.surplusShortfall, displayMode, inputs.inflationRate, yearsToRetirement),
    }));
  }, [scenarioData, displayMode, inputs.inflationRate, yearsToRetirement]);

  const modeAxisSuffix = displayMode === 'today' ? " (today's $)" : ' (future $)';

  // Custom tooltip
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      payload?: ScenarioData;
    }>;
  }
  
  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as ScenarioData;
      if (!data) return null;

      const yearsEarlier = inputs.retirementAge - data.retirementAge;
      const savingsRate = ((data.monthlyContribution * 12) / inputs.currentIncome * 100);

      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-foreground">
          <p className="text-foreground font-mono text-sm mb-2">
            {data.name} Scenario
          </p>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Monthly:</span>{' '}
              ${data.monthlyContribution.toLocaleString()}
            </p>
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Savings Rate:</span>{' '}
              {savingsRate.toFixed(1)}%
            </p>
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Projected Balance:</span>{' '}
              ${data.projectedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-muted-foreground">
              <span style={{ color: chartTheme.accent }}>Retirement Age:</span>{' '}
              {data.retirementAge}
              {yearsEarlier > 0 && (
                <span className="text-muted-foreground"> ({yearsEarlier} yrs earlier)</span>
              )}
            </p>
            {data.additionalIncome > 0 && (
              <p className="text-muted-foreground">
                <span style={{ color: chartTheme.secondary }}>Extra Income:</span>{' '}
                +${data.additionalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year
              </p>
            )}
            <div className={`text-xs ${data.feasible ? 'text-success' : 'text-destructive'}`}>
              {data.feasible ? '✓ Meets target' : '⚠ Below target'}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Chart content
  const chartContent = (
    <ComposedChart
      data={displayScenarioData}
      margin={{
        top: 20,
        right: 30,
        left: 20,
        bottom: 60,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} opacity={0.3} />
      <XAxis 
        dataKey="name"
        stroke={chartTheme.muted}
        fontSize={12}
        fontFamily="IBM Plex Mono, monospace"
        tick={{ fill: chartTheme.muted }}
        label={{ 
          value: 'Contribution Scenario', 
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
        tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
        label={{
          value: `Projected Balance${modeAxisSuffix}`,
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
        domain={[50, 70]}
        label={{ 
          value: 'Retirement Age', 
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
      
      {/* Target balance reference line */}
      <ReferenceLine
        yAxisId="left"
        y={toDisplay(calculateRequiredBalance(inputs.targetIncome))}
        stroke={chartTheme.grid} 
        strokeDasharray="5 5" 
        label={{ 
          value: "Target Balance", 
          position: "left",
          style: { fill: chartTheme.accent, fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }
        }}
      />
      
      {/* Target retirement age reference line */}
      <ReferenceLine 
        yAxisId="right"
        y={inputs.retirementAge} 
        stroke={chartTheme.grid} 
        strokeDasharray="5 5" 
        label={{ 
          value: "Target Age", 
          position: "right",
          style: { fill: chartTheme.secondary, fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace' }
        }}
      />
      
      {/* Projected balance bars */}
      <Bar
        yAxisId="left"
        dataKey="projectedBalance"
        name="Projected Balance"
        fill={chartTheme.primary}
        stroke={chartTheme.tertiary}
        strokeWidth={1}
      />
      
      {/* Retirement age line */}
      <Line
        yAxisId="right"
        type="monotone"
        dataKey="retirementAge"
        stroke={chartTheme.secondary}
        strokeWidth={3}
        dot={{ fill: chartTheme.secondary, strokeWidth: 2, r: 5 }}
        name="Retirement Age"
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
          Contribution Scenario Comparison
        </h3>
        <p className="text-sm text-sage-600 font-mono">
          Impact of increasing monthly contributions by $500 and $1,000 on retirement age and income potential
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          {displayMode === 'today' ? "Balances shown in today's dollars." : 'Balances shown in future dollars.'}
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        {chartContent}
      </ResponsiveContainer>
      
      {/* Comparison metrics */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        {scenarioData.map((scenario, index) => (
          <div 
            key={scenario.name}
            className={`p-3 rounded border-l-4 ${
              index === 0 ? 'bg-muted border-sage-400' :
              index === 1 ? 'bg-sage-50 border-sage-500' :
              'bg-success/10 border-sage-600'
            }`}
          >
            <div className="text-sage-700 font-semibold">{scenario.name}</div>
            <div className="text-sage-900">
              ${scenario.monthlyContribution.toLocaleString()}/mo
            </div>
            <div className="text-sage-600 text-xs">
              Retire at {scenario.retirementAge}
              {index > 0 && scenarioData[0] && (
                <span className="text-sage-500">
                  {' '}({scenarioData[0].retirementAge - scenario.retirementAge > 0 ? 
                    `-${scenarioData[0].retirementAge - scenario.retirementAge}` : 
                    '+' + (scenario.retirementAge - scenarioData[0].retirementAge)
                  } yrs)
                </span>
              )}
            </div>
            <div className={`text-xs ${scenario.feasible ? 'text-success' : 'text-destructive'}`}>
              {scenario.feasible ? '✓ Achieves goal' : '⚠ Falls short'}
            </div>
          </div>
        ))}
      </div>
      
      {/* Opportunity cost analysis */}
      <div className="mt-4 bg-sage-50 p-4 rounded-lg">
        <h4 className="font-mono font-semibold text-sage-800 text-sm mb-2">
          Opportunity Cost Analysis:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-sage-700">
          <div>
            <strong>+$500/month Impact:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Total additional investment: ${((500 * 12) * (inputs.retirementAge - inputs.startingAge)).toLocaleString()}</li>
              <li>Retirement age change: {scenarioData[0] && scenarioData[1] ? 
                (scenarioData[0].retirementAge - scenarioData[1].retirementAge > 0 ?
                  `${scenarioData[0].retirementAge - scenarioData[1].retirementAge} years earlier` :
                  'No change') : 'Calculating...'
              }</li>
              <li>Trade-off: $6,000/year less spending now</li>
            </ul>
          </div>
          
          <div>
            <strong>+$1,000/month Impact:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Total additional investment: ${((1000 * 12) * (inputs.retirementAge - inputs.startingAge)).toLocaleString()}</li>
              <li>Retirement age change: {scenarioData[0] && scenarioData[2] ? 
                (scenarioData[0].retirementAge - scenarioData[2].retirementAge > 0 ?
                  `${scenarioData[0].retirementAge - scenarioData[2].retirementAge} years earlier` :
                  'No change') : 'Calculating...'
              }</li>
              <li>Trade-off: $12,000/year less spending now</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Scenario insight */}
      <div className="mt-4 bg-warning/10 border-l-4 border-warning p-4">
        <div className="flex">
          <div className="shrink-0">
            <svg className="h-5 w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-mono font-semibold text-warning">
              BufoIndex Reality Check
            </h4>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              Before automatically saving more, consider: Are you over-optimizing for retirement at the expense of present experiences? 
              Each additional dollar saved is a dollar not spent on current life satisfaction. Make conscious trade-offs based on your time preference.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScenarioComparisonChart;