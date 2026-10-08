'use client';

import React, { useMemo } from 'react';
import type { Route } from 'next';
import { Scale } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { formatCurrency, formatPercent } from '@/lib/calculations/core';
import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  simulateDcaComparison,
} from '@/lib/calculations/leverageComparison';
import { leverageLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';
import { CardLinkButton } from './CardLinkButton';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';
import { formatMultiple, leverageHorizonYears, leverageMonthlyContribution } from './derive';

export interface LeverageCardProps {
  profile: FinancialProfile;
}

/** Fewer paths than the full calculator (500) keep the dashboard light. */
const DASHBOARD_PATHS = 300;

export function LeverageCard({ profile }: LeverageCardProps) {
  const contribution = leverageMonthlyContribution(profile);
  const years = leverageHorizonYears(profile);
  const leverageRatio = profile.strategy.leverageRatio;
  const usesTaxable = profile.investing.taxableMonthlyContribution > 0;

  const result = useMemo(
    () =>
      contribution > 0
        ? simulateDcaComparison({
            ...DEFAULT_DCA_COMPARISON_INPUTS,
            monthlyContribution: contribution,
            years,
            startingBalance: 0,
            leverageRatio,
            paths: DASHBOARD_PATHS,
          })
        : null,
    [contribution, years, leverageRatio]
  );

  const multiple = formatMultiple(leverageRatio);
  const link = (
    <div className="mt-4">
      <CardLinkButton href={leverageLink(profile) as Route}>Open the comparison</CardLinkButton>
    </div>
  );

  if (!result) {
    return (
      <BaseCard title="Leverage, with cash flow" icon={Scale} {...DASHBOARD_CARD_LAYOUT} testId="overview-leverage">
        <p className="text-sm text-muted-foreground">
          The profile has no monthly investing contribution yet, so there is no cash flow to compare. The full
          comparison works from any contribution and starting balance.
        </p>
        {link}
      </BaseCard>
    );
  }

  const rows: { label: string; index: string; leveraged: string }[] = [
    {
      label: 'Median ending balance',
      index: formatCurrency(result.index.dca.p50),
      leveraged: formatCurrency(result.leveraged.dca.p50),
    },
    {
      label: '10th percentile',
      index: formatCurrency(result.index.dca.p10),
      leveraged: formatCurrency(result.leveraged.dca.p10),
    },
    {
      label: '90th percentile',
      index: formatCurrency(result.index.dca.p90),
      leveraged: formatCurrency(result.leveraged.dca.p90),
    },
    {
      label: 'Median max drawdown',
      index: formatPercent(result.medianMaxDrawdown.index),
      leveraged: formatPercent(result.medianMaxDrawdown.leveraged),
    },
  ];

  return (
    <BaseCard
      title="Leverage, with cash flow"
      icon={Scale}
      {...DASHBOARD_CARD_LAYOUT}
      testId="overview-leverage"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums">{formatCurrency(contribution)}</span>/mo
          {usesTaxable ? ' of taxable contributions' : ' of contributions'} for {years}{' '}
          {years === 1 ? 'year' : 'years'} (
          <span className="tabular-nums">{formatCurrency(result.totalContributed)}</span> in total, starting from
          $0), into an index fund or a {multiple} daily-reset fund on the same dates.{' '}
          {profile.strategy.preset === 'standard'
            ? 'The standard preset does not use leverage; the comparison is shown for reference.'
            : 'The cashflow-investor preset uses this comparison for taxable contributions.'}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Index fund versus {multiple} leveraged fund, {DASHBOARD_PATHS} simulated paths
            </caption>
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="p-2 text-left font-medium">
                  <span className="sr-only">Metric</span>
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Index
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  {multiple} fund
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="p-2 text-left text-xs font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  <td className="p-2 text-right tabular-nums text-foreground">{row.index}</td>
                  <td className="p-2 text-right tabular-nums text-foreground">{row.leveraged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">
          The {multiple} fund ended behind the index fund in{' '}
          <span className="font-medium tabular-nums text-foreground">
            {formatPercent(result.probLeveragedBehindDca)}
          </span>{' '}
          of {DASHBOARD_PATHS} simulated paths. Estimated annual drag from volatility, financing, and fees:{' '}
          <span className="tabular-nums">{formatPercent(result.annualDragEstimate)}</span>.
        </p>

        <p className="text-xs text-muted-foreground">
          Assumes {formatPercent(DEFAULT_DCA_COMPARISON_INPUTS.indexMeanReturn)} mean index return,{' '}
          {formatPercent(DEFAULT_DCA_COMPARISON_INPUTS.indexVolatility)} volatility, and{' '}
          {formatPercent(DEFAULT_DCA_COMPARISON_INPUTS.financingRate)} financing, before taxes. Simulated outcomes,
          not forecasts; a different random seed would move these figures by a few percentage points.
        </p>
      </div>

      {link}
    </BaseCard>
  );
}

export default LeverageCard;
