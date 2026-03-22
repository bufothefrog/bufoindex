'use client';

import React from 'react';
import { useRetirementResults } from '@/lib/store/retirementStore';
import { ResultCard, MetricCard } from '@/components/calculators/shared/ResultCard';
import { ExpandableListCard, CardVariant } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  Calculator,
  AlertTriangle,
  Target
} from 'lucide-react';
import { MonteCarloChart } from './MonteCarloChart';
import { SavingsRateChart } from './SavingsRateChart';
import { useRetirementInputs } from '@/lib/store/retirementStore';

function mapProbabilityToVariant(successProbability: number): CardVariant {
  if (successProbability >= 0.7) return 'success';
  if (successProbability >= 0.5) return 'warning';
  return 'danger';
}

function getScenarioIcon(successProbability: number) {
  if (successProbability >= 0.9) return Target;
  if (successProbability >= 0.7) return Calculator;
  return AlertTriangle;
}

export function ResultsSection() {
  const results = useRetirementResults();
  const inputs = useRetirementInputs();
  const [expandedScenario, setExpandedScenario] = React.useState<string | null>(null);

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
          const variant = mapProbabilityToVariant(scenario.successProbability);
          const icon = getScenarioIcon(scenario.successProbability);

          return (
            <ExpandableListCard
              key={scenario.id}
              icon={icon}
              title={scenario.name}
              subtitle={`Retire at ${scenario.retirementAge} • ${formatPercent(scenario.successProbability)} success rate`}
              value={formatCurrency(scenario.monthlyWithdrawal)}
              valueSubtext="monthly"
              variant={variant}
              expanded={expandedScenario === scenario.id}
              onToggle={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
            >
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
                  <div className="font-semibold">{formatPercent(scenario.successProbability)}</div>
                </div>
              </div>

              {scenario.successProbability < 0.8 && (
                <StatusAlert
                  variant={scenario.successProbability < 0.5 ? 'danger' : 'warning'}
                  icon={AlertTriangle}
                  title={scenario.successProbability < 0.5 ? 'High Risk' : 'Consider Adjustments'}
                >
                  This scenario has a {formatPercent(1 - scenario.successProbability)} chance of running out of money.
                  {scenario.successProbability < 0.5 ?
                    ' This is a very risky plan.' :
                    ' Consider increasing savings or delaying retirement.'}
                </StatusAlert>
              )}
            </ExpandableListCard>
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