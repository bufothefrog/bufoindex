'use client';

import React from 'react';
import { useRetirementResults } from '@/lib/store/retirementStore';
import { Card, CardContent } from '@/components/ui/card';
import { ResultCard, MetricCard } from '@/components/calculators/shared/ResultCard';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { 
  TrendingUp, 
  ChevronDown,
  ChevronUp,
  Calculator,
  AlertTriangle,
  Target
} from 'lucide-react';
import { MonteCarloChart } from './MonteCarloChart';
import { SavingsRateChart } from './SavingsRateChart';
import { useRetirementInputs } from '@/lib/store/retirementStore';

export function ResultsSection() {
  const results = useRetirementResults();
  const inputs = useRetirementInputs();
  const [expandedScenario, setExpandedScenario] = React.useState<string | null>(null);
  
  // Helper function to determine scenario styling based on success probability
  const getScenarioStyling = (successProbability: number) => {
    if (successProbability >= 0.9) {
      return {
        cardClass: 'border-sage-300 bg-sage-50/50 dark:border-sage-600 dark:bg-sage-800/20',
        textColor: 'text-sage-700 dark:text-sage-300',
        icon: Target
      };
    } else if (successProbability >= 0.7) {
      return {
        cardClass: 'border-accent/30 bg-accent/10 dark:border-accent/30 dark:bg-accent/5',
        textColor: 'text-accent-foreground',
        icon: Calculator
      };
    } else if (successProbability >= 0.5) {
      return {
        cardClass: 'border-orange-300 bg-orange-50/50 dark:border-orange-600 dark:bg-orange-800/20',
        textColor: 'text-orange-700 dark:text-orange-300',
        icon: AlertTriangle
      };
    } else {
      return {
        cardClass: 'border-destructive/30 bg-destructive/10 dark:border-destructive/30 dark:bg-destructive/5',
        textColor: 'text-destructive',
        icon: AlertTriangle
      };
    }
  };
  
  if (!results) {
    return null;
  }


  return (
    <div className="space-y-4">
      {/* Results Header - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          label="Safe Withdrawal Rate"
          value={formatPercent(results.safeWithdrawalRate)}
          icon={Target}
          variant="success"
          trend="up"
        />
        <MetricCard
          label="Scenarios Analyzed"
          value={results.scenarios.length.toString()}
          icon={Calculator}
          variant="info"
          subtext="retirement options"
        />
      </div>

      {/* Retirement Scenarios */}
      <div className="space-y-3">
        {results.scenarios.map((scenario) => {
          const isExpanded = expandedScenario === scenario.id;
          const styling = getScenarioStyling(scenario.successProbability);
          
          return (
            <Card key={scenario.id} className={styling.cardClass}>
              <CardContent className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedScenario(isExpanded ? null : scenario.id)}
                >
                  <div className="flex items-center space-x-3">
                    {React.createElement(styling.icon, { className: `w-5 h-5 ${styling.textColor}` })}
                    <div>
                      <h4 className="font-semibold">{scenario.name}</h4>
                      <div className="text-sm text-muted-foreground">
                        Retire at {scenario.retirementAge} • {formatPercent(scenario.successProbability)} success rate
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(scenario.monthlyWithdrawal)}</div>
                      <div className="text-sm text-muted-foreground">monthly</div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Required Balance</div>
                        <div className="font-semibold">{formatCurrency(scenario.requiredBalance)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Projected Balance</div>
                        <div className="font-semibold">{formatCurrency(scenario.projectedBalance)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Years of Income</div>
                        <div className="font-semibold">{scenario.yearsOfIncome} years</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Success Probability</div>
                        <div className={`font-semibold ${styling.textColor}`}>
                          {formatPercent(scenario.successProbability)}
                        </div>
                      </div>
                    </div>

                    {scenario.successProbability < 0.8 && (
                      <div className={`flex items-start space-x-2 p-3 rounded-lg ${
                        scenario.successProbability < 0.5 ? 'bg-destructive/10 dark:bg-destructive/5' : 'bg-orange-50/50 dark:bg-orange-800/20'
                      }`}>
                        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          scenario.successProbability < 0.5 ? 'text-destructive' : 'text-orange-600 dark:text-orange-400'
                        }`} />
                        <div className="text-sm">
                          <div className={`font-medium ${
                            scenario.successProbability < 0.5 ? 'text-destructive-foreground' : 'text-orange-800 dark:text-orange-200'
                          }`}>
                            {scenario.successProbability < 0.5 ? 'High Risk' : 'Consider Adjustments'}
                          </div>
                          <div className={scenario.successProbability < 0.5 ? 'text-destructive' : 'text-orange-700 dark:text-orange-300'}>
                            This scenario has a {formatPercent(1 - scenario.successProbability)} chance of running out of money. 
                            {scenario.successProbability < 0.5 ? 
                              ' This is a very risky plan.' : 
                              ' Consider increasing savings or delaying retirement.'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monte Carlo Chart */}
      <ResultCard 
        title="Portfolio Projections" 
        icon={TrendingUp}
      >
        <MonteCarloChart 
          netWorthByAge={results.netWorthByAge}
          withdrawalsByAge={results.withdrawalsByAge}
        />
      </ResultCard>

      {/* Savings Rate Impact Chart */}
      <ResultCard 
        title="Savings Rate Impact" 
        icon={TrendingUp}
      >
        <SavingsRateChart inputs={inputs} />
      </ResultCard>

    </div>
  );
}