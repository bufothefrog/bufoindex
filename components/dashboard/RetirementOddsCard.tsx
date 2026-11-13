'use client';

import React, { useMemo } from 'react';
import type { Route } from 'next';
import { TrendingUp } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { StatGrid } from '@/components/ui/results';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import type { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { calculatorHref } from '@/lib/calculators/registry';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { retirementHeadline } from '@/lib/calculators/retirement/headline';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { RetirementConstants } from '@/lib/constants/retirement';
import { summarizeRetirement, type RetirementLever } from '@/lib/dashboard/derive';
import { formatStatValue, type StatSpec } from '@/lib/design-system/stat';
import { formatCount, formatCurrency, formatPercent } from '@/lib/format';
import type { FinancialProfile } from '@/lib/profile/types';
import type { DollarDisplayMode } from '@/lib/utils/displayDollars';
import { CardLinkButton } from './CardLinkButton';
import { SimulationRegion } from './SimulationRegion';
import { useDeferredResult } from './useDeferredResult';

export interface RetirementOddsCardProps {
  profile: FinancialProfile;
}

const RUNS = RetirementConstants.DEFAULT_MONTE_CARLO_RUNS;

/** The card's own labels for the headline figures it shows, in display order. */
const CARD_LABELS: Readonly<Record<string, string>> = {
  success: 'Simulated success rate',
  projected: 'Projected at retirement',
  required: 'Balance the 4% guideline implies',
};

function successHint(inputs: RetirementInputs): string {
  return `Share of ${formatCount(RUNS)} seeded paths with money left at age ${inputs.lifeExpectancy}, retiring at ${inputs.retirementAge}`;
}

/** The headline's success, projected and required figures (in the shared dollar mode), under the card's labels. */
function oddsStats(results: RetirementResults, inputs: RetirementInputs, mode: DollarDisplayMode): StatSpec[] {
  return retirementHeadline(results, inputs, mode)
    .filter((stat) => stat.id in CARD_LABELS)
    .map((stat) => ({
      ...stat,
      label: CARD_LABELS[stat.id],
      hint: stat.id === 'success' ? successHint(inputs) : stat.hint,
    }));
}

/** Label-only tiles that hold the figures' place while the simulation runs. */
function placeholderStats(inputs: RetirementInputs): StatSpec[] {
  return Object.entries(CARD_LABELS).map(([id, label]) => ({
    id,
    label,
    value: null,
    format: 'currency',
    hint: id === 'success' ? successHint(inputs) : undefined,
  }));
}

/**
 * The retirement calculator's analysis runs several 1,000-path Monte Carlo
 * simulations, so it is deferred until after the browser has painted the
 * loading state. The engine inputs come from the calculator's own bindings.
 */
export function RetirementOddsCard({ profile }: RetirementOddsCardProps) {
  const inputs = useMemo(() => engineInputsFor(RETIREMENT_CALCULATOR, profile), [profile]);
  const outcome = useDeferredResult(inputs, summarizeRetirement);

  return (
    <BaseCard title="Retirement odds" icon={TrendingUp} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-retirement">
      <SimulationRegion
        pending={outcome === null}
        paths={RUNS}
        placeholder={<StatGrid stats={placeholderStats(inputs)} fullWidth={['success']} loading />}
      >
        {outcome?.status === 'invalid' && (
          <div className="space-y-2 text-sm">
            <p className="text-foreground">The retirement inputs from the profile need attention:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {outcome.messages.slice(0, 3).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {outcome?.status === 'ok' && (
          <OddsFigures results={outcome.results} inputs={inputs} lever={outcome.lever} />
        )}
      </SimulationRegion>

      <div className="mt-4">
        <CardLinkButton href={calculatorHref('retirement', { fromProfile: true }) as Route}>
          Open the retirement calculator
        </CardLinkButton>
      </div>
    </BaseCard>
  );
}

interface OddsFiguresProps {
  results: RetirementResults;
  inputs: RetirementInputs;
  lever: RetirementLever;
}

function OddsFigures({ results, inputs, lever }: OddsFiguresProps) {
  // Display only: the shared today's / future dollars preference, at the
  // profile's own inflation rate (the retirement calculator's basis).
  const dollars = useDollarDisplay(inputs.inflationRate);
  const stats = oddsStats(results, inputs, dollars.mode);
  const success = stats.find((stat) => stat.id === 'success');
  const successText = formatStatValue(success?.value ?? null, 'percent');

  return (
    <div className="space-y-4">
      <StatGrid stats={stats} fullWidth={['success']} />
      <p className="text-sm text-muted-foreground">
        Saving{' '}
        <span className="font-medium tabular-nums text-foreground">{formatCurrency(lever.extraMonthly)}</span>{' '}
        more per month moves the simulated success rate from <span className="tabular-nums">{successText}</span> to{' '}
        <span className="font-medium tabular-nums text-foreground">
          {formatPercent(lever.successProbability)}
        </span>{' '}
        and the projected balance to{' '}
        <span className="tabular-nums">
          {formatCurrency(dollars.fromNominal(lever.projectedBalance, lever.yearsToRetirement))}
        </span>{' '}
        {dollars.chartCaption} (same simulated markets).
      </p>
    </div>
  );
}

export default RetirementOddsCard;
