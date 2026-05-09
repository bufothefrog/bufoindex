'use client';

import React, { useState, useMemo } from 'react';
import { RetirementInputs, RetirementResults as RetirementResultsType } from '@/lib/calculations/retirement';
import { analyzeRetirementScenarios } from '@/lib/calculations/scenarioAnalysis';
import { calculateCoastFire } from '@/lib/calculations/coastFire';
import { adjustForInflation } from '@/lib/calculations/inflationAdjustment';
import { formatCurrency } from '@/lib/utils';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { Button } from '@/components/ui/button';
import { Share2, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

// Import our new components
import ScenarioAnalyzer from './ScenarioAnalyzer';
import InsightsDisplay from './InsightsDisplay';
import { RetirementCharts } from '@/components/charts/RetirementCharts';

interface RetirementResultsProps {
  inputs: RetirementInputs;
  results: RetirementResultsType;
  onShare?: () => void;
}

/**
 * RetirementResults - Main results display component
 * Orchestrates scenario analysis, charts, and insights into cohesive user experience
 */
export function RetirementResults({ inputs, results, onShare }: RetirementResultsProps) {
  const [showCharts, setShowCharts] = useState(false);
  const [showDetailedInsights, setShowDetailedInsights] = useState(false);

  // Calculate scenario analysis
  const scenarioAnalysis = useMemo(() => analyzeRetirementScenarios(inputs), [inputs]);

  // Calculate inflation-adjusted values for insights
  const inflationAdjustedValues = useMemo(() => {
    const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
    const targetIncomeAdjusted = adjustForInflation(inputs.targetIncome, inputs.inflationRate, yearsToRetirement);
    const currentIncomeAdjusted = adjustForInflation(inputs.currentIncome, inputs.inflationRate, yearsToRetirement);
    const monthlySavingsAdjusted = adjustForInflation(inputs.monthlySavings * 12, inputs.inflationRate, yearsToRetirement);
    
    return {
      currentIncome: currentIncomeAdjusted.currentDollars,
      targetIncome: targetIncomeAdjusted.currentDollars,
      monthlySavings: monthlySavingsAdjusted.currentDollars / 12
    };
  }, [inputs]);

  // Coast FIRE calculation
  const coastFire = useMemo(() => calculateCoastFire(inputs), [inputs]);

  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  const currentIncome = results.scenarios[0]?.projectedBalance * 0.04 || 0;

  return (
    <div className="retirement-results space-y-6">
      {/* Header Card with Share */}
      <InputCard 
        title="Retirement Analysis Results" 
        color="success"
        actions={onShare && (
          <Button
            onClick={onShare}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </Button>
        )}
      >
        <div className="space-y-4">
          {/* Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-sage-600 dark:text-sage-300 font-mono tabular-nums">
                {yearsToRetirement}
              </div>
              <div className="text-sm text-muted-foreground">Years to Retirement</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-sage-600 dark:text-sage-300 font-mono tabular-nums">
                {(results.safeWithdrawalRate * 100).toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Safe Withdrawal Rate</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-sage-600 dark:text-sage-300 font-mono tabular-nums">
                {formatCurrency(currentIncome)}
              </div>
              <div className="text-sm text-muted-foreground">Projected Annual Income</div>
            </div>
          </div>
        </div>
      </InputCard>

      {/* Scenario Analyzer - The star of the show */}
      <ScenarioAnalyzer 
        inputs={inputs}
        scenarioAnalysis={scenarioAnalysis}
      />

      {/* Coast FIRE Highlight */}
      {coastFire.isAchievable && coastFire.ageAchievable && (
        <InputCard title="Coast FIRE Analysis" color="info">
          <div className="bg-purple-50 dark:bg-purple-800/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-purple-800 dark:text-purple-100">🏖️ Coast FIRE Status</h4>
              <span className="text-purple-600 dark:text-purple-300 text-sm font-mono tabular-nums">
                Age {coastFire.ageAchievable}
              </span>
            </div>
            
            {coastFire.ageAchievable <= inputs.startingAge ? (
              <p className="text-purple-700 dark:text-purple-200 text-sm">
                <strong>Already Achieved!</strong> Your current balance will grow to meet your retirement target 
                without additional contributions. You have maximum financial flexibility.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-purple-700 dark:text-purple-200">
                  Coast FIRE achievable in <strong>{coastFire.ageAchievable - inputs.startingAge} years</strong>. 
                  After that, contributions become optional while your investments grow.
                </p>
                {coastFire.monthlyContributionsUntilCoast && (
                  <p className="text-purple-600 dark:text-purple-300">
                    Need {formatCurrency(coastFire.monthlyContributionsUntilCoast)}/month until age {coastFire.ageAchievable}, 
                    then coast to retirement.
                  </p>
                )}
              </div>
            )}
          </div>
        </InputCard>
      )}

      {/* Charts Section - Collapsible */}
      <InputCard 
        title="Visual Analysis" 
        actions={
          <Button
            onClick={() => setShowCharts(!showCharts)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1"
          >
            <BarChart3 className="w-4 h-4" />
            <span>{showCharts ? 'Hide' : 'Show'} Charts</span>
            {showCharts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        }
      >
        {showCharts ? (
          <div className="mt-4">
            <RetirementCharts 
              inputs={inputs}
              results={results}
              scenarioAnalysis={scenarioAnalysis}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click &quot;Show Charts&quot; to view detailed visualizations</p>
            <p className="text-xs mt-1">Includes withdrawal timeline, savings rate impact, net worth progression, and scenario comparisons</p>
          </div>
        )}
      </InputCard>

      {/* Detailed Insights - Collapsible */}
      <InputCard 
        title="Detailed Insights & Philosophy"
        actions={
          <Button
            onClick={() => setShowDetailedInsights(!showDetailedInsights)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-1"
          >
            <span>{showDetailedInsights ? 'Hide' : 'Show'} Insights</span>
            {showDetailedInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        }
      >
        {showDetailedInsights ? (
          <div className="mt-4">
            <InsightsDisplay 
              inputs={inputs}
              scenarioAnalysis={scenarioAnalysis}
              inflationAdjustedValues={inflationAdjustedValues}
            />
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Click &quot;Show Insights&quot; for detailed opportunity cost analysis and BufoIndex philosophy</p>
            <p className="text-xs mt-1">Includes inflation impact, time vs money trade-offs, and actionable recommendations</p>
          </div>
        )}
      </InputCard>

      {/* Traditional Scenarios Summary for comparison */}
      <InputCard title="Scenario Summary">
        <div className="space-y-4">
          {results.scenarios.map((scenario) => (
            <div key={scenario.id} className="border border-border rounded-lg p-4 hover:bg-muted transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sage-800 dark:text-sage-100">{scenario.name}</h3>
                <div className="text-right">
                  <div className="text-sm font-medium text-sage-600 dark:text-sage-300 font-mono tabular-nums">
                    {(scenario.successProbability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Projected Balance</div>
                  <div className="font-medium font-mono tabular-nums">{formatCurrency(scenario.projectedBalance)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Required Balance</div>
                  <div className="font-medium font-mono tabular-nums">{formatCurrency(scenario.requiredBalance)}</div>
                </div>
              </div>
              
              {scenario.projectedBalance >= scenario.requiredBalance ? (
                <div className="mt-2 text-xs text-green-600 dark:text-green-300">
                  ✅ On track - surplus of {formatCurrency(scenario.projectedBalance - scenario.requiredBalance)}
                </div>
              ) : (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                  ⚠️ Shortfall of {formatCurrency(scenario.requiredBalance - scenario.projectedBalance)}
                </div>
              )}
            </div>
          ))}
        </div>
      </InputCard>

      {/* Key Insights from Results */}
      {results.insights.length > 0 && (
        <InputCard title="Traditional Planning Insights">
          <div className="space-y-2">
            {results.insights.map((insight, index) => (
              <div key={index} className="text-sm p-3 bg-muted rounded-lg border-l-4 border-border">
                {insight}
              </div>
            ))}
          </div>
        </InputCard>
      )}

      {/* Mobile Optimization Notice */}
      <div className="block md:hidden bg-blue-50 dark:bg-blue-800/50 p-3 rounded text-xs text-blue-700 dark:text-blue-200">
        💡 Tip: Use the chart selector buttons to focus on specific visualizations on mobile. 
        All sections are collapsible to optimize for your screen size.
      </div>

      {/* Data Freshness */}
      <div className="text-xs text-slate-500 dark:text-slate-300 text-center font-mono tabular-nums">
        Results generated at {new Date().toLocaleTimeString()} • 
        Update inputs to recalculate • 
        Analysis includes Monte Carlo simulation and scenario modeling
      </div>
    </div>
  );
}

export default RetirementResults;