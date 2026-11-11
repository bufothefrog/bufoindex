'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Calculator, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards';
import { ChartFrame } from '@/components/ui/charts';
import { KeyValueList, StatGrid } from '@/components/ui/results';
import { ExpandableListCard } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import type { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { scenarioCountStat, successTone, withdrawalRateStat } from '@/lib/calculators/retirement/headline';
import { formatCurrency, formatPercent } from '@/lib/format';

// Loaded on demand (audit H1): Recharts stays out of the page's first chunk.
const MonteCarloChart = dynamic(() => import('./MonteCarloChart'), { ssr: false });
const SavingsRateChart = dynamic(() => import('./SavingsRateChart'), { ssr: false });

export interface ResultsSectionProps {
  results: RetirementResults;
  /** The engine inputs that produced `results`. */
  inputs: RetirementInputs;
  /**
   * The results predate the latest values. The calculator page already marks
   * stale results, so nothing here changes with it.
   */
  stale: boolean;
}

function scenarioIcon(successProbability: number): LucideIcon {
  if (successProbability >= 0.9) return Target;
  if (successProbability >= 0.7) return Calculator;
  return AlertTriangle;
}

/** Savings Rate Impact: contributions start today, so the caption does not follow the toggle. */
const SAVINGS_RATE_CAPTION = "contributions start today \u2014 shown in today's dollars in either display mode";

export function ResultsSection({ results, inputs }: ResultsSectionProps) {
  // Display-only conversions (CLAUDE.md display-dollar boundary): nominal
  // figures deflate to today's dollars, and figures already in today's
  // dollars inflate in the future-dollar mode.
  const dollars = useDollarDisplay(inputs.inflationRate);
  const [expandedScenario, setExpandedScenario] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{dollars.caption}</p>
        <DollarModeToggle value={dollars.mode} onChange={dollars.setMode} />
      </div>

      <StatGrid
        stats={[withdrawalRateStat(results), scenarioCountStat(results)]}
        columns={1}
        size="lg"
        align="center"
        className="gap-4 md:grid-cols-2"
      />

      <div className="space-y-3">
        {results.scenarios.map((scenario) => {
          const tone = successTone(scenario.successProbability);
          const success = formatPercent(scenario.successProbability);
          // Balance-at-retirement figures are nominal as of this scenario's
          // retirement year; the monthly withdrawal is in today's dollars and
          // first lands in that same year. Both convert over this horizon.
          const yearsToRetirement = scenario.retirementAge - inputs.startingAge;
          const highRisk = tone === 'negative';

          return (
            <ExpandableListCard
              key={scenario.id}
              icon={scenarioIcon(scenario.successProbability)}
              title={scenario.name}
              subtitle={`Retire at ${scenario.retirementAge} \u2022 ${success} success rate`}
              value={formatCurrency(dollars.fromReal(scenario.monthlyWithdrawal, yearsToRetirement))}
              valueSubtext="monthly"
              tone={tone}
              expanded={expandedScenario === scenario.id}
              onToggle={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
            >
              <KeyValueList
                layout="grid"
                items={[
                  {
                    id: 'required',
                    label: 'Required Balance',
                    value: dollars.fromNominal(scenario.requiredBalance, yearsToRetirement),
                    format: 'currency',
                  },
                  {
                    id: 'projected',
                    label: 'Projected Balance',
                    value: dollars.fromNominal(scenario.projectedBalance, yearsToRetirement),
                    format: 'currency',
                  },
                  { id: 'years', label: 'Years of Income', value: `${scenario.yearsOfIncome} years` },
                  { id: 'success', label: 'Success Probability', value: success },
                ]}
              />

              {scenario.successProbability < 0.8 && (
                <StatusAlert
                  tone={highRisk ? 'negative' : 'caution'}
                  icon={AlertTriangle}
                  title={highRisk ? 'High Risk' : 'Consider Adjustments'}
                >
                  This scenario has a {formatPercent(1 - scenario.successProbability)} chance of running out of money.
                  {highRisk ? ' This is a very risky plan.' : ' Consider increasing savings or delaying retirement.'}
                </StatusAlert>
              )}
            </ExpandableListCard>
          );
        })}
      </div>

      <ResultCard title="Portfolio Projections" icon={TrendingUp}>
        <ChartFrame height="tall" deferUntilVisible caption={dollars.chartCaption}>
          <MonteCarloChart
            netWorthByAge={results.netWorthByAge}
            withdrawalsByAge={results.withdrawalsByAge}
            inflationRate={inputs.inflationRate}
            startingAge={inputs.startingAge}
          />
        </ChartFrame>
      </ResultCard>

      <ResultCard title="Savings Rate Impact" icon={TrendingUp}>
        <ChartFrame height="tall" deferUntilVisible caption={SAVINGS_RATE_CAPTION}>
          <SavingsRateChart inputs={inputs} />
        </ChartFrame>
      </ResultCard>
    </div>
  );
}

export default ResultsSection;
