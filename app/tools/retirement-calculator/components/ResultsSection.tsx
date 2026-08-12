'use client';

import React from 'react';
import { useRetirementResults, useRetirementStore } from '@/lib/store/retirementStore';
import { ResultCard, MetricCard } from '@/components/calculators/shared/ResultCard';
import { ExpandableListCard, CardVariant } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { displayDollars } from '@/lib/utils/displayDollars';
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

// Grade the plan's implied withdrawal rate against the 4% guideline: at or
// below it is comfortable, within one point is marginal, beyond that is risky.
function mapWithdrawalRateToVariant(rate: number): CardVariant {
  if (rate <= 0.04) return 'success';
  if (rate <= 0.05) return 'warning';
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
  const displayMode = useRetirementStore(state => state.displayMode);
  const setDisplayMode = useRetirementStore(state => state.setDisplayMode);
  const [expandedScenario, setExpandedScenario] = React.useState<string | null>(null);

  if (!results) {
    return null;
  }

  // Display-only conversion: deflate a nominal future-dollar amount back to
  // today's purchasing power when the 'today' mode is active.
  const toDisplay = (nominalAmount: number, yearsFromNow: number) =>
    displayDollars(nominalAmount, displayMode, inputs.inflationRate, yearsFromNow);

  return (
    <div className="space-y-4">
      {/* Results Header - Dollar display mode */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {displayMode === 'today'
            ? "Amounts adjusted to today's dollars using your inflation rate"
            : 'Amounts in future dollars, as of the year they occur'}
        </p>
        <DollarModeToggle value={displayMode} onChange={setDisplayMode} />
      </div>

      {/* Results Header - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          label="Implied Withdrawal Rate"
          value={formatPercent(results.initialWithdrawalRate)}
          icon={Target}
          variant={mapWithdrawalRateToVariant(results.initialWithdrawalRate)}
          subtext={
            results.initialWithdrawalRate <= 0.04
              ? 'at or below the 4% guideline'
              : 'above the 4% guideline'
          }
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
          // Balance-at-retirement figures are nominal as of this scenario's
          // retirement year.
          const yearsToRetirement = scenario.retirementAge - inputs.startingAge;

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
                  <div className="font-semibold">{formatCurrency(toDisplay(scenario.requiredBalance, yearsToRetirement))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Projected Balance</div>
                  <div className="font-semibold">{formatCurrency(toDisplay(scenario.projectedBalance, yearsToRetirement))}</div>
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
          displayMode={displayMode}
          inflationRate={inputs.inflationRate}
          startingAge={inputs.startingAge}
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