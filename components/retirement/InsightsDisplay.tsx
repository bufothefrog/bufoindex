'use client';

import React from 'react';
import { RetirementInputs } from '@/lib/calculations/retirement';
import { ScenarioAnalysis } from '@/lib/calculations/scenarioAnalysis';
import { formatCurrency } from '@/lib/utils';
import { Lightbulb, Scale, Target, Zap } from 'lucide-react';

interface InsightsDisplayProps {
  inputs: RetirementInputs;
  scenarioAnalysis: ScenarioAnalysis;
  inflationAdjustedValues?: {
    currentIncome: number;
    targetIncome: number;
    monthlySavings: number;
  };
}

/**
 * InsightsDisplay - Shows BufoIndex contrarian philosophy insights
 * Emphasizes opportunity cost, time vs money trade-offs, and actionable recommendations
 */
export function InsightsDisplay({ 
  inputs, 
  scenarioAnalysis, 
  inflationAdjustedValues 
}: InsightsDisplayProps) {
  const { status, recommendations, current, coastFire } = scenarioAnalysis;
  
  const savingsRate = (inputs.monthlySavings * 12) / inputs.currentIncome;
  const yearsToRetirement = inputs.retirementAge - inputs.startingAge;
  
  const generateOpportunityCostAnalysis = () => {
    const totalContributions = inputs.monthlySavings * 12 * yearsToRetirement;
    const daysOfRetirement = (inputs.lifeExpectancy - inputs.retirementAge) * 365;
    const costPerRetirementDay = totalContributions / daysOfRetirement;
    
    return {
      totalContributions,
      daysOfRetirement,
      costPerRetirementDay,
      yearsWorking: yearsToRetirement,
      yearsRetired: inputs.lifeExpectancy - inputs.retirementAge
    };
  };

  const opportunityCost = generateOpportunityCostAnalysis();

  const renderOpportunityCostInsight = () => (
    <div className="bg-sage-50 border border-sage-200 p-4 rounded-lg">
      <h4 className="font-semibold text-sage-800 mb-3 flex items-center">
        <Scale className="w-4 h-4 mr-2" />
        Opportunity Cost Analysis
      </h4>
      
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sage-600">Total retirement savings:</span>
            <span className="font-mono">{formatCurrency(opportunityCost.totalContributions)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sage-600">Working years:</span>
            <span className="font-mono">{opportunityCost.yearsWorking} years</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sage-600">Retirement years:</span>
            <span className="font-mono">{opportunityCost.yearsRetired} years</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sage-600">Cost per retirement day:</span>
            <span className="font-mono">${opportunityCost.costPerRetirementDay.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sage-600">Savings rate:</span>
            <span className="font-mono">{(savingsRate * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 p-3 bg-white border border-sage-200 rounded text-sm">
        <strong>BufoIndex Perspective:</strong> You&apos;re investing {formatCurrency(inputs.monthlySavings * 12)} 
        annually for {opportunityCost.yearsWorking} years to fund {opportunityCost.yearsRetired} retirement years. 
        Each retirement day costs ${opportunityCost.costPerRetirementDay.toFixed(2)} in foregone present-day spending.
      </div>
    </div>
  );

  const renderTimeVsMoneyTradeoff = () => {
    const currentProjected = current.projectedBalance * 0.04; // 4% withdrawal
    const currentRequirement = inputs.targetIncome;
    const surplus = currentProjected - currentRequirement;
    
    return (
      <div className="bg-accent/10 border border-accent/30 p-4 rounded-lg dark:bg-accent/5 dark:border-accent/20">
        <h4 className="font-semibold text-accent-foreground mb-3 flex items-center">
          <Target className="w-4 h-4 mr-2" />
          Time vs Money Trade-offs
        </h4>
        
        {status === 'exceeding' ? (
          <div className="text-sm space-y-2">
            <p>
              <strong>You have choices:</strong> Your projected retirement income 
              ({formatCurrency(currentProjected)}) exceeds your target ({formatCurrency(currentRequirement)}).
            </p>
            <div className="bg-white p-3 rounded border">
              <strong>Option 1:</strong> Maintain savings rate, retire with {formatCurrency(surplus)} extra annually<br/>
              <strong>Option 2:</strong> Reduce savings rate, use extra for present experiences<br/>
              <strong>Option 3:</strong> Retire earlier with same income level
            </div>
            <p className="text-accent-foreground">
              <strong>BufoIndex Philosophy:</strong> More money in retirement has diminishing returns. 
              Consider if additional years of freedom are worth more than additional dollars.
            </p>
          </div>
        ) : status === 'onTrack' ? (
          <div className="text-sm space-y-2">
            <p>Your current trajectory meets your target. Small optimizations can provide meaningful benefits:</p>
            <div className="bg-white p-3 rounded border">
              <strong>+$500/month trade-off:</strong> {inputs.monthlySavings * 6} less in present spending 
              for potentially 2+ years earlier retirement<br/>
              <strong>Status quo trade-off:</strong> Current lifestyle maintained, retirement at target age
            </div>
          </div>
        ) : (
          <div className="text-sm space-y-2">
            <p>Current trajectory falls short. Here&apos;s the reality check:</p>
            <div className="bg-white p-3 rounded border">
              <strong>Current path:</strong> Retire later or with less income<br/>
              <strong>Bridge the gap:</strong> Increase savings or work longer<br/>
              <strong>Reduce target:</strong> Consider if less retirement income enables earlier freedom
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInflationImpact = () => {
    if (!inflationAdjustedValues) return null;
    
    const inflationLoss = inputs.targetIncome - inflationAdjustedValues.targetIncome;
    const inflationRate = inputs.inflationRate * 100;
    
    return (
      <div className="bg-destructive/10 border border-destructive/30 p-4 rounded-lg dark:bg-destructive/5 dark:border-destructive/20">
        <h4 className="font-semibold text-destructive-foreground mb-3 flex items-center">
          <Zap className="w-4 h-4 mr-2" />
          Inflation Reality Check
        </h4>
        
        <div className="text-sm space-y-2">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-destructive">Today&apos;s purchasing power:</div>
              <div className="font-mono">{formatCurrency(inputs.targetIncome)}/year</div>
            </div>
            <div>
              <div className="text-destructive">In retirement (inflation-adjusted):</div>
              <div className="font-mono">{formatCurrency(inflationAdjustedValues.targetIncome)}/year</div>
            </div>
          </div>
          
          <div className="bg-background p-3 rounded border border-destructive/30">
            <strong>Inflation tax:</strong> At {inflationRate}% annually, you lose 
            {formatCurrency(inflationLoss)} in purchasing power over {yearsToRetirement} years. 
            Your {formatCurrency(inputs.targetIncome)} target becomes equivalent to 
            {formatCurrency(inflationAdjustedValues.targetIncome)} in today&apos;s money.
          </div>
          
          <p className="text-destructive">
            <strong>BufoIndex Insight:</strong> Inflation is the silent killer of retirement plans. 
            Focus on real (inflation-adjusted) returns, not nominal numbers.
          </p>
        </div>
      </div>
    );
  };

  const renderActionableRecommendations = () => (
    <div className="bg-sage-50 border border-sage-200 p-4 rounded-lg dark:bg-sage-800/20 dark:border-sage-600">
      <h4 className="font-semibold text-sage-800 dark:text-sage-200 mb-3 flex items-center">
        <Lightbulb className="w-4 h-4 mr-2" />
        Actionable Recommendations
      </h4>
      
      <div className="space-y-3 text-sm">
        {recommendations.slice(0, 3).map((rec, index) => (
          <div key={index} className="bg-background p-3 rounded border border-sage-200 dark:border-sage-600">
            {rec}
          </div>
        ))}
        
        {/* Additional BufoIndex-specific recommendations */}
        <div className="bg-sage-100 dark:bg-sage-800/30 p-3 rounded border border-sage-200 dark:border-sage-600">
          <strong>BufoIndex Priority Framework:</strong>
          <div className="mt-2 space-y-1 text-xs">
            <div>1. Pay off debt above 7% interest rate (guaranteed return)</div>
            <div>2. Build 3-month emergency fund maximum (not 6-12 months)</div>
            <div>3. Max employer 401k match (free money)</div>
            <div>4. Optimize for tax-advantaged accounts</div>
            <div>5. Consider investment real estate or side business for diversification</div>
          </div>
        </div>
        
        {coastFire?.isAchievable && coastFire.ageAchievable && (
          <div className="bg-purple-100 p-3 rounded border">
            <strong>Coast FIRE Strategy:</strong> Focus intensively until age {coastFire.ageAchievable}, 
            then shift to lifestyle optimization. This provides maximum optionality with minimal time commitment.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="insights-display space-y-6">
      {/* Core insights */}
      {renderOpportunityCostInsight()}
      {renderTimeVsMoneyTradeoff()}
      {renderInflationImpact()}
      {renderActionableRecommendations()}
      
      {/* Philosophy footer */}
      <div className="bg-sage-100 p-4 rounded-lg border-l-4 border-sage-400">
        <h5 className="font-semibold text-sage-800 mb-2">BufoIndex Philosophy</h5>
        <p className="text-sm text-sage-700">
          Traditional retirement advice optimizes for maximum dollars in retirement. 
          BufoIndex optimizes for maximum life optionality. Sometimes retiring with less money 
          but more years of freedom creates better life outcomes than working longer for marginal gains. 
          <strong>Always consider the opportunity cost of your time.</strong>
        </p>
      </div>
    </div>
  );
}

export default InsightsDisplay;