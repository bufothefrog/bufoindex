'use client';

import React from 'react';
import { RetirementInputs } from '@/lib/calculations/retirement';
import { ScenarioAnalysis } from '@/lib/calculations/scenarioAnalysis';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

interface ScenarioAnalyzerProps {
  inputs: RetirementInputs;
  scenarioAnalysis: ScenarioAnalysis;
}

/**
 * ScenarioAnalyzer - Sophisticated scenario display with specific messaging
 * Shows the exact scenario format requested with dollar amounts and timeframes
 */
export function ScenarioAnalyzer({ inputs, scenarioAnalysis }: ScenarioAnalyzerProps) {
  const { status, current, withExtra500, withExtra1000, coastFire } = scenarioAnalysis;

  const renderExceedingGoals = () => {
    const currentIncome = Math.round(current.projectedBalance * 0.04); // 4% rule
    const earlierAge = withExtra500.earlierRetirementAge || inputs.retirementAge;
    const additionalIncome = Math.round((withExtra500.additionalIncome || 0) + inputs.targetIncome);

    return (
      <div className="bg-sage-50 border-l-4 border-sage-500 p-4 rounded-lg dark:bg-sage-800/20 dark:border-sage-400">
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-sage-500 dark:text-sage-400 mt-0.5 mr-3 shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-sage-800 dark:text-sage-200 mb-2">
              ✅ You&apos;re ahead of schedule!
            </h3>
            <p className="text-sage-700 dark:text-sage-300 mb-3">
              <strong>Current path:</strong> Retire with {formatCurrency(currentIncome)}/year at age {inputs.retirementAge}
            </p>
            
            <div className="bg-background p-3 rounded border border-sage-200 dark:border-sage-600">
              <h4 className="font-semibold text-sage-800 dark:text-sage-200 mb-2">Your options:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-start">
                  <span className="text-sage-600 dark:text-sage-300 mr-2">•</span>
                  <span>
                    <strong>Option A:</strong> Retire {inputs.retirementAge - earlierAge} years earlier (age {earlierAge}) with same income
                  </span>
                </div>
                <div className="flex items-start">
                  <span className="text-sage-600 dark:text-sage-300 mr-2">•</span>
                  <span>
                    <strong>Option B:</strong> Have {formatCurrency(additionalIncome)}/year instead at age {inputs.retirementAge}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOnTrack = () => {
    const extra500Years = withExtra500.earlierRetirementAge ? 
      inputs.retirementAge - withExtra500.earlierRetirementAge : 0;
    const extra500Income = Math.round((withExtra500.additionalIncome || 0) + inputs.targetIncome);
    
    const extra1000Years = withExtra1000.earlierRetirementAge ? 
      inputs.retirementAge - withExtra1000.earlierRetirementAge : 0;
    const extra1000Income = Math.round((withExtra1000.additionalIncome || 0) + inputs.targetIncome);

    return (
      <div className="bg-accent/10 border-l-4 border-accent p-4 rounded-lg dark:bg-accent/5">
        <div className="flex items-start">
          <TrendingUp className="h-5 w-5 text-accent dark:text-accent mt-0.5 mr-3 shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-accent-foreground mb-2">
              ✅ You&apos;re on track for your goals
            </h3>
            
            <div className="space-y-3">
              {extra500Years > 0 && (
                <div className="bg-background p-3 rounded border border-accent/30">
                  <p className="text-accent-foreground">
                    <strong>With +$500/month:</strong> Retire {extra500Years} years earlier OR have {formatCurrency(extra500Income)}/year
                  </p>
                </div>
              )}
              
              {extra1000Years > 0 && (
                <div className="bg-background p-3 rounded border border-accent/30">
                  <p className="text-accent-foreground">
                    <strong>With +$1,000/month:</strong> Retire {extra1000Years} years earlier OR have {formatCurrency(extra1000Income)}/year
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFallingShort = () => {
    const currentIncome = Math.round(current.projectedBalance * 0.04);
    const currentAge = current.canRetireAtAge || inputs.retirementAge + 5;
    
    const extra500Age = withExtra500.canRetireAtAge || currentAge;
    const extra500Income = Math.round((withExtra500.incomeAtTargetAge || currentIncome));
    
    const extra1000Age = withExtra1000.canRetireAtAge || currentAge;
    const extra1000Income = Math.round((withExtra1000.incomeAtTargetAge || currentIncome));

    return (
      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg dark:bg-orange-800/20 dark:border-orange-400">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-orange-500 dark:text-orange-400 mt-0.5 mr-3 shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
              ⚠️ Adjustments needed to meet your goals
            </h3>
            <p className="text-orange-700 dark:text-orange-300 mb-3">
              <strong>Current path:</strong> Retire at age {currentAge} for {formatCurrency(inputs.targetIncome)} OR have {formatCurrency(currentIncome)} at age {inputs.retirementAge}
            </p>
            
            <div className="bg-background p-3 rounded border border-orange-200 dark:border-orange-600">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Improvement with extra savings:</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>+$500/month:</strong> Retire at {extra500Age} OR have {formatCurrency(extra500Income)} at age {inputs.retirementAge}
                </div>
                <div>
                  <strong>+$1,000/month:</strong> Retire at {extra1000Age} OR have {formatCurrency(extra1000Income)} at age {inputs.retirementAge}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCoastFire = () => {
    if (!coastFire?.isAchievable || !coastFire.ageAchievable) {
      return null;
    }

    const yearsToCoast = coastFire.ageAchievable - inputs.startingAge;
    const isAlreadyAchieved = coastFire.ageAchievable <= inputs.startingAge;

    return (
      <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg mt-4">
        <h4 className="font-semibold text-purple-800 mb-2 flex items-center">
          🏖️ Coast FIRE Status
        </h4>
        {isAlreadyAchieved ? (
          <p className="text-purple-700 text-sm">
            <strong>Achieved!</strong> Your current balance will grow to meet your retirement target without additional contributions.
          </p>
        ) : (
          <p className="text-purple-700 text-sm">
            Coast FIRE achievable by age {coastFire.ageAchievable} ({yearsToCoast} years). 
            After that, contributions become optional while your money grows to retirement.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="scenario-analyzer mb-6">
      {/* Main scenario display */}
      {status === 'exceeding' && renderExceedingGoals()}
      {status === 'onTrack' && renderOnTrack()}
      {status === 'falling' && renderFallingShort()}
      
      {/* Coast FIRE status */}
      {renderCoastFire()}
    </div>
  );
}

export default ScenarioAnalyzer;