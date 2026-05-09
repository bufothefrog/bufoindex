'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { ScenarioAnalysis } from '@/lib/calculations/scenarioAnalysis';

// Import individual chart components
import WithdrawalTimeline from './WithdrawalTimeline';
import NetWorthProgression from './NetWorthProgression';
import ScenarioComparisonChart from './ScenarioComparisonChart';

export interface RetirementChartsProps {
  inputs: RetirementInputs;
  results: RetirementResults;
  scenarioAnalysis?: ScenarioAnalysis;
  className?: string;
}

type ChartType = 'withdrawal' | 'netWorth' | 'scenarios' | 'all';

/**
 * Main RetirementCharts component - Orchestrates all retirement visualization charts
 * Provides responsive, mobile-friendly interface with chart selection
 */
export function RetirementCharts({ 
  inputs, 
  results, 
  scenarioAnalysis,
  className = ''
}: RetirementChartsProps) {
  
  const [activeChart, setActiveChart] = useState<ChartType>('all');
  const [performanceMetrics, setPerformanceMetrics] = useState<{[key: string]: number}>({});

  // Track chart rendering performance
  const trackPerformance = useCallback((chartName: string, renderTime: number) => {
    setPerformanceMetrics(prev => ({ ...prev, [chartName]: renderTime }));
  }, []);

  // Chart metadata for navigation
  const chartConfigs = useMemo(() => [
    {
      id: 'withdrawal' as ChartType,
      name: 'Withdrawal Timeline',
      description: 'Annual withdrawals during retirement',
      icon: '📊',
      mobile: true
    },
    {
      id: 'netWorth' as ChartType,
      name: 'Net Worth Progression',
      description: 'Accumulation and withdrawal phases',
      icon: '💹',
      mobile: true
    },
    {
      id: 'scenarios' as ChartType,
      name: 'Scenario Comparison',
      description: 'Current vs +$500 vs +$1000/month',
      icon: '⚖️',
      mobile: true
    }
  ], []);

  // Performance measurement wrapper
  const withPerformanceTracking = useCallback((
    chartName: string, 
    component: React.ReactElement
  ) => {
    const startTime = performance.now();
    
    // Wrap component to measure render time
    return React.cloneElement(component, {
      ...component.props,
      onRenderComplete: () => {
        const endTime = performance.now();
        trackPerformance(chartName, endTime - startTime);
      }
    });
  }, [trackPerformance]);

  // Chart components with performance tracking
  const chartComponents = useMemo(() => ({
    withdrawal: (
      <WithdrawalTimeline
        inputs={inputs}
        results={results}
        responsive={true}
        height={400}
      />
    ),
    netWorth: (
      <NetWorthProgression
        inputs={inputs}
        results={results}
        responsive={true}
        height={500}
      />
    ),
    scenarios: (
      <ScenarioComparisonChart
        inputs={inputs}
        scenarioAnalysis={scenarioAnalysis}
        responsive={true}
        height={400}
      />
    )
  }), [inputs, results, scenarioAnalysis]);

  // Mobile-first chart selector
  const ChartSelector = () => (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveChart('all')}
          className={`px-3 py-2 text-xs font-mono rounded transition-colors ${
            activeChart === 'all'
              ? 'bg-sage-600 text-white'
              : 'bg-sage-100 dark:bg-sage-800 text-sage-700 dark:text-sage-300 hover:bg-sage-200 dark:hover:bg-sage-700'
          }`}
        >
          📊 All Charts
        </button>
        {chartConfigs.map(chart => (
          <button
            key={chart.id}
            onClick={() => setActiveChart(chart.id)}
            className={`px-3 py-2 text-xs font-mono rounded transition-colors ${
              activeChart === chart.id
                ? 'bg-sage-600 text-white'
                : 'bg-sage-100 dark:bg-sage-800 text-sage-700 dark:text-sage-300 hover:bg-sage-200 dark:hover:bg-sage-700'
            }`}
          >
            {chart.icon} {chart.name}
          </button>
        ))}
      </div>
      
      {/* Active chart description */}
      {activeChart !== 'all' && (
        <div className="text-xs text-sage-600 dark:text-sage-400 font-mono">
          {chartConfigs.find(c => c.id === activeChart)?.description}
        </div>
      )}
    </div>
  );

  // Performance indicator
  const PerformanceIndicator = () => {
    const totalRenderTime = Object.values(performanceMetrics).reduce((sum, time) => sum + time, 0);
    
    if (totalRenderTime === 0) return null;
    
    return (
      <div className="mt-4 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
        <div className="flex justify-between items-center">
          <span>Chart Performance:</span>
          <span className={totalRenderTime < 500 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
            {totalRenderTime.toFixed(1)}ms total
          </span>
        </div>
        {Object.entries(performanceMetrics).map(([chart, time]) => (
          <div key={chart} className="flex justify-between text-xs opacity-75">
            <span>{chart}:</span>
            <span>{time.toFixed(1)}ms</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`retirement-charts ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-mono font-bold text-sage-800 dark:text-sage-200 mb-2">
          Retirement Analysis Charts
        </h2>
        <p className="text-sm text-sage-600 dark:text-sage-400 font-mono">
          Interactive visualizations of your retirement planning scenarios. 
          Charts optimized for mobile and desktop viewing.
        </p>
      </div>

      {/* Chart selector for mobile */}
      <div className="block md:hidden">
        <ChartSelector />
      </div>

      {/* Chart grid */}
      <div className="space-y-8">
        
        {/* Withdrawal Timeline - STARTS AT RETIREMENT ONLY */}
        {(activeChart === 'all' || activeChart === 'withdrawal') && (
          <div className="chart-container">
            <div className="bg-card rounded-lg shadow-xs border border-border p-4">
              {withPerformanceTracking('withdrawal', chartComponents.withdrawal)}
            </div>
          </div>
        )}


        {/* Net Worth Progression */}
        {(activeChart === 'all' || activeChart === 'netWorth') && (
          <div className="chart-container">
            <div className="bg-card rounded-lg shadow-xs border border-border p-4">
              {withPerformanceTracking('netWorth', chartComponents.netWorth)}
            </div>
          </div>
        )}

        {/* Scenario Comparison */}
        {(activeChart === 'all' || activeChart === 'scenarios') && (
          <div className="chart-container">
            <div className="bg-card rounded-lg shadow-xs border border-border p-4">
              {withPerformanceTracking('scenarios', chartComponents.scenarios)}
            </div>
          </div>
        )}
        
      </div>

      {/* Desktop chart selector */}
      <div className="hidden md:block mt-6">
        <ChartSelector />
      </div>

      {/* Performance metrics (dev mode) */}
      {process.env.NODE_ENV === 'development' && <PerformanceIndicator />}

      {/* Chart usage instructions */}
      <div className="mt-6 bg-sage-50 dark:bg-sage-900/30 p-4 rounded-lg">
        <h3 className="font-mono font-semibold text-sage-800 dark:text-sage-200 text-sm mb-2">
          Chart Interaction Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-sage-700 dark:text-sage-300">
          <div>
            <h4 className="font-semibold mb-1">Desktop:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Hover over data points for details</li>
              <li>Click legend items to hide/show lines</li>
              <li>Charts auto-resize with window</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Mobile:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Tap data points for tooltips</li>
              <li>Use chart selector above for focused view</li>
              <li>Swipe on tablets for easier navigation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Chart data freshness indicator */}
      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 font-mono text-center">
        Charts generated at {new Date().toLocaleTimeString()} using current inputs.
        Update inputs to refresh visualizations.
      </div>
    </div>
  );
}

export default RetirementCharts;

// Performance optimization: Memoized chart wrapper for expensive calculations
export const MemoizedRetirementCharts = React.memo(RetirementCharts, (prevProps, nextProps) => {
  // Only re-render if inputs or results actually changed
  return (
    JSON.stringify(prevProps.inputs) === JSON.stringify(nextProps.inputs) &&
    JSON.stringify(prevProps.results) === JSON.stringify(nextProps.results) &&
    JSON.stringify(prevProps.scenarioAnalysis) === JSON.stringify(nextProps.scenarioAnalysis)
  );
});