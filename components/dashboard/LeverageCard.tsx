'use client';

import React, { useMemo } from 'react';
import type { Route } from 'next';
import { Scale } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { DataTable, type DataTableColumn } from '@/components/ui/results';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import type { DcaComparisonInputs, DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { usesTaxableContribution } from '@/lib/calculators/leverage/bindings';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { leverageHeadline, leverageHorizonYears } from '@/lib/calculators/leverage/headline';
import { calculatorHref } from '@/lib/calculators/registry';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { formatStatValue } from '@/lib/design-system/stat';
import { makeGet } from '@/lib/fields/paths';
import { formatCurrency, formatMultiple, formatPercent, type FormatKind } from '@/lib/format';
import type { FinancialProfile } from '@/lib/profile/types';
import { DISPLAY_INFLATION_ASSUMPTION } from '@/lib/utils/displayDollars';
import { CardLinkButton } from './CardLinkButton';
import { SimulationRegion } from './SimulationRegion';
import { useDeferredResult } from './useDeferredResult';

export interface LeverageCardProps {
  profile: FinancialProfile;
}

/** The comparison the calculator runs, or null for inputs it rejects (nothing invested). */
function compare(inputs: DcaComparisonInputs): DcaComparisonResult | null {
  return Object.keys(LEVERAGE_CALCULATOR.validate(inputs)).length > 0 ? null : LEVERAGE_CALCULATOR.calculate(inputs);
}

interface ComparisonRow {
  id: string;
  label: string;
  format: FormatKind;
  index: number | null;
  leveraged: number | null;
}

function comparisonColumns(multiple: string): DataTableColumn<ComparisonRow>[] {
  return [
    { id: 'metric', header: 'Metric', hideHeader: true, rowHeader: true, cell: (row) => row.label },
    { id: 'index', header: 'Index', numeric: true, cell: (row) => formatStatValue(row.index, row.format) },
    {
      id: 'leveraged',
      header: `${multiple} fund`,
      numeric: true,
      cell: (row) => formatStatValue(row.leveraged, row.format),
    },
  ];
}

/**
 * The leverage comparison on the calculator's own inputs (engineInputsFor),
 * so its figures match the comparison page for the same profile. The
 * simulation is deferred until after the browser has painted, as on the
 * retirement card (audit H7).
 */
export function LeverageCard({ profile }: LeverageCardProps) {
  const inputs = useMemo(() => engineInputsFor(LEVERAGE_CALCULATOR, profile), [profile]);
  const result = useDeferredResult(inputs, compare);
  const nothingInvested = Object.keys(LEVERAGE_CALCULATOR.validate(inputs)).length > 0;

  const link = (
    <div className="mt-4">
      <CardLinkButton href={calculatorHref('leverage', { fromProfile: true }) as Route}>Open the comparison</CardLinkButton>
    </div>
  );

  if (nothingInvested) {
    return (
      <BaseCard title="Leverage, with cash flow" icon={Scale} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-leverage">
        <p className="text-sm text-muted-foreground">
          The profile has no monthly investing contribution yet, so there is no cash flow to compare. The full
          comparison works from any contribution and starting balance.
        </p>
        {link}
      </BaseCard>
    );
  }

  // The taxable contribution feeds the comparison only while no contribution override is set.
  const usesTaxable = profile.leverage.monthlyContribution === null && usesTaxableContribution(makeGet(profile));

  return (
    <BaseCard title="Leverage, with cash flow" icon={Scale} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-leverage">
      <SimulationRegion
        pending={result === null}
        paths={inputs.paths}
        placeholder={<div className="h-40 animate-pulse rounded-lg bg-muted" />}
      >
        {result && (
          <ComparisonFigures
            result={result}
            inputs={inputs}
            usesTaxable={usesTaxable}
          />
        )}
      </SimulationRegion>

      {link}
    </BaseCard>
  );
}

interface ComparisonFiguresProps {
  result: DcaComparisonResult;
  inputs: DcaComparisonInputs;
  usesTaxable: boolean;
}

function ComparisonFigures({ result, inputs, usesTaxable }: ComparisonFiguresProps) {
  // Display only: ending balances follow the shared dollar mode at the fixed
  // inflation assumption, as on the comparison page; contributions do not.
  const dollars = useDollarDisplay(DISPLAY_INFLATION_ASSUMPTION, { basis: 'fixed' });
  const atHorizon = (nominal: number) => dollars.fromNominal(nominal, leverageHorizonYears(inputs));
  const multiple = formatMultiple(inputs.leverageRatio);
  const headline = leverageHeadline(result, inputs, dollars.mode);
  const figure = (id: string) => headline.find((stat) => stat.id === id)?.value ?? null;
  const { years } = inputs;

  const rows: ComparisonRow[] = [
    {
      id: 'median',
      label: 'Median ending balance',
      format: 'currency',
      index: figure('index-median'),
      leveraged: figure('leveraged-median'),
    },
    {
      id: 'p10',
      label: '10th percentile',
      format: 'currency',
      index: atHorizon(result.index.dca.p10),
      leveraged: atHorizon(result.leveraged.dca.p10),
    },
    {
      id: 'p90',
      label: '90th percentile',
      format: 'currency',
      index: atHorizon(result.index.dca.p90),
      leveraged: atHorizon(result.leveraged.dca.p90),
    },
    {
      id: 'drawdown',
      label: 'Median max drawdown',
      format: 'percent',
      index: result.medianMaxDrawdown.index,
      leveraged: result.medianMaxDrawdown.leveraged,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="tabular-nums">{formatCurrency(inputs.monthlyContribution)}</span>/mo
        {usesTaxable ? ' of taxable contributions' : ' of contributions'} for {years} {years === 1 ? 'year' : 'years'} (
        <span className="tabular-nums">{formatCurrency(result.totalContributed)}</span> in total, starting from{' '}
        <span className="tabular-nums">{formatCurrency(inputs.startingBalance)}</span>), into an index fund or a{' '}
        {multiple} daily-reset fund on the same dates.
      </p>

      <DataTable
        caption={`Index fund versus ${multiple} leveraged fund, ${inputs.paths} simulated paths, balances ${dollars.chartCaption}`}
        columns={comparisonColumns(multiple)}
        rows={rows}
        rowKey={(row) => row.id}
        framed
      />

      <p className="text-sm text-muted-foreground">
        The {multiple} fund ended behind the index fund in{' '}
        <span className="font-medium tabular-nums text-foreground">{formatStatValue(figure('behind'), 'percent')}</span>{' '}
        of {inputs.paths} simulated paths. Estimated annual drag from volatility, financing, and fees:{' '}
        <span className="tabular-nums">{formatPercent(result.annualDragEstimate)}</span>.
      </p>

      <p className="text-xs text-muted-foreground">
        Assumes {formatPercent(inputs.indexMeanReturn)} mean index return, {formatPercent(inputs.indexVolatility)}{' '}
        volatility, and {formatPercent(inputs.financingRate)} financing, before taxes. {dollars.caption}{' '}
        Contributions and the starting balance are shown as entered. Simulated outcomes, not forecasts; a different
        random seed would move these figures by a few percentage points.
      </p>
    </div>
  );
}

export default LeverageCard;
