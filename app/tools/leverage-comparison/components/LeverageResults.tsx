'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Info, LineChart, Scale, TrendingDown } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import { ChartFrame } from '@/components/ui/charts';
import { DataTable, KeyValueList, StatGrid, type DataTableColumn } from '@/components/ui/results';
import {
  horizonMonths,
  type DcaComparisonInputs,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';
import { leverageHeadline, leverageHorizonYears } from '@/lib/calculators/leverage/headline';
import {
  COMPACT,
  COMPACT_SIGNED,
  dcaEffectSentence,
  dragParts,
  recoveryGain,
  relativeGap,
  yearStartScaleSentence,
} from '@/lib/calculators/leverage/narrative';
import { formatCurrency, formatMultiple, formatPercent } from '@/lib/format';
import { DISPLAY_INFLATION_ASSUMPTION } from '@/lib/utils/displayDollars';

// Recharts loads only on the client and only once the chart frame nears the
// viewport (audit H1).
const DcaPathChart = dynamic(() => import('./DcaPathChart'), { ssr: false });

export interface LeverageResultsProps {
  result: DcaComparisonResult;
  /** The inputs that produced `result`. */
  inputs: DcaComparisonInputs;
}

const SIGNED_ONE_DECIMAL = { digits: 1, signed: true } as const;
const WHOLE = { digits: 0 } as const;
const TWO_DECIMALS = { digits: 2 } as const;

interface TimingRow {
  label: string;
  sublabel: string;
  index: number;
  leveraged: number;
  gap: number;
}

interface MeasureRow {
  label: string;
  sublabel: string;
  index: string;
  leveraged: string;
}

function RowLabel({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <>
      <span className="block">{label}</span>
      <span className="block text-xs font-normal text-muted-foreground">{sublabel}</span>
    </>
  );
}

function rowLabelColumn<T extends { label: string; sublabel: string }>(header: string): DataTableColumn<T> {
  return { id: 'label', header, rowHeader: true, cell: (row) => <RowLabel label={row.label} sublabel={row.sublabel} /> };
}

/** Shown beside converted balances: what was paid in is not converted. */
const AS_ENTERED = 'Contributions and the starting balance are shown as entered.';

export function LeverageResults({ result, inputs }: LeverageResultsProps) {
  // Display-only conversion (CLAUDE.md display-dollar boundary): the engine
  // runs in nominal dollars with no inflation input, so balances deflate at
  // the fixed assumption the paycheck allocator uses (registry 'fixed').
  const dollars = useDollarDisplay(DISPLAY_INFLATION_ASSUMPTION, { basis: 'fixed' });
  const horizonYears = leverageHorizonYears(inputs);
  const atHorizon = (nominal: number) => dollars.fromNominal(nominal, horizonYears);
  const L = formatMultiple(inputs.leverageRatio);
  const months = horizonMonths(inputs.years);
  const { index, leveraged } = result;
  const sigma = Math.max(0, inputs.indexVolatility);
  const multiple = Number(inputs.leverageRatio.toFixed(2));
  const { volatilityDrag, financing } = dragParts(inputs);
  const mddIndex = result.medianMaxDrawdown.index;
  const mddLeveraged = result.medianMaxDrawdown.leveraged;
  const monthsBehind = Math.round(result.medianMonthsBehind);

  const timingRows: TimingRow[] = [
    {
      label: 'Monthly',
      sublabel: `${formatCurrency(inputs.monthlyContribution, COMPACT)}/mo + ${formatCurrency(inputs.startingBalance, COMPACT)} start`,
      index: atHorizon(index.dca.p50),
      leveraged: atHorizon(leveraged.dca.p50),
      gap: atHorizon(result.dcaEffect.dcaGap),
    },
    {
      label: 'Start of each year',
      sublabel: `${formatCurrency(12 * inputs.monthlyContribution, COMPACT)}/yr + ${formatCurrency(inputs.startingBalance, COMPACT)} start`,
      index: atHorizon(index.yearStart.p50),
      leveraged: atHorizon(leveraged.yearStart.p50),
      gap: atHorizon(result.dcaEffect.yearStartGap),
    },
  ];
  const timingColumns: DataTableColumn<TimingRow>[] = [
    rowLabelColumn('Timing'),
    { id: 'index', header: 'Index', numeric: true, value: (row) => row.index, format: 'currency-compact' },
    { id: 'leveraged', header: L, numeric: true, value: (row) => row.leveraged, format: 'currency-compact' },
    {
      id: 'gap',
      header: 'Gap',
      numeric: true,
      cell: (row) => (
        <>
          <span className="block">{formatCurrency(row.gap, COMPACT_SIGNED)}</span>
          <span className="block text-xs text-muted-foreground">
            {formatPercent(relativeGap(row.gap, row.index), SIGNED_ONE_DECIMAL)}
          </span>
        </>
      ),
    },
  ];

  const measureRows: MeasureRow[] = [
    {
      label: 'Median max drawdown',
      sublabel: 'Worst peak-to-trough fall in fund price',
      index: formatPercent(mddIndex, WHOLE),
      leveraged: formatPercent(mddLeveraged, WHOLE),
    },
    {
      label: '10th percentile',
      sublabel: 'Ending balance; 1 in 10 paths end lower',
      index: formatCurrency(atHorizon(index.dca.p10), COMPACT),
      leveraged: formatCurrency(atHorizon(leveraged.dca.p10), COMPACT),
    },
    {
      label: '90th percentile',
      sublabel: 'Ending balance; 1 in 10 paths end higher',
      index: formatCurrency(atHorizon(index.dca.p90), COMPACT),
      leveraged: formatCurrency(atHorizon(leveraged.dca.p90), COMPACT),
    },
  ];
  const measureColumns: DataTableColumn<MeasureRow>[] = [
    rowLabelColumn('Measure'),
    { id: 'index', header: 'Index', numeric: true, cell: (row) => row.index },
    { id: 'leveraged', header: L, numeric: true, cell: (row) => row.leveraged },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {dollars.caption} {AS_ENTERED}
        </p>
        <DollarModeToggle value={dollars.mode} onChange={dollars.setMode} />
      </div>

      {/* Results recalculate on every edit; screen readers hear the headline
          figures, not the whole comparison. */}
      <div aria-live="polite" data-testid="leverage-headline">
        <StatGrid
          stats={leverageHeadline(result, inputs, dollars.mode)}
          columns={1}
          fullWidth={['behind']}
          size="lg"
          className="gap-4 md:grid-cols-2"
        />
      </div>

      <ResultCard title="Balance over time" icon={LineChart}>
        <ChartFrame
          deferUntilVisible
          caption={`Balances ${dollars.chartCaption}. Lines are the median balance across ${inputs.paths} simulated paths; shaded bands span the 10th to 90th percentile. Both funds receive the same contributions on the same dates.`}
        >
          <DcaPathChart points={result.medianPath} leverageRatio={inputs.leverageRatio} />
        </ChartFrame>
      </ResultCard>

      <ResultCard title="Monthly vs start of each year" icon={Scale}>
        <div className="space-y-4">
          <DataTable
            caption={`Median ending balances ${dollars.chartCaption} for the index fund and the ${L} fund with the same yearly amount invested monthly or at the start of each year; contributions as entered`}
            columns={timingColumns}
            rows={timingRows}
            rowKey={(row) => row.label}
          />
          <p className="text-sm text-muted-foreground">{dcaEffectSentence(result, L, inputs, atHorizon)}</p>
          <p className="text-sm text-muted-foreground">
            Paths where the {L} fund ends behind: {formatPercent(result.probLeveragedBehindDca, WHOLE)} with
            monthly contributions, {formatPercent(result.probLeveragedBehindYearStart, WHOLE)} at the
            start of each year. {yearStartScaleSentence(result, L)}
          </p>
        </div>
      </ResultCard>

      <ResultCard title="Tail and drawdown" icon={TrendingDown}>
        <div className="space-y-4">
          <DataTable
            caption={`Drawdown and low-percentile outcomes for the index fund and the ${L} fund, balances ${dollars.chartCaption}`}
            columns={measureColumns}
            rows={measureRows}
            rowKey={(row) => row.label}
          />
          <KeyValueList
            items={[
              {
                id: 'months-behind',
                label: `Months the ${L} balance trailed`,
                subtitle: `Median across paths, out of ${months} months`,
                value: `${monthsBehind} mo`,
              },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Recovering from the median {L} drawdown ({formatPercent(mddLeveraged, WHOLE)}) needs a gain of{' '}
            {recoveryGain(mddLeveraged)}; for the index fund ({formatPercent(mddIndex, WHOLE)}) it needs{' '}
            {recoveryGain(mddIndex)}. With monthly contributions, money added during a drawdown buys
            in at the lower price, which is part of why monthly and start-of-year contributions end at
            different balances.
          </p>
        </div>
      </ResultCard>

      <ResultCard title="Model and caveats" icon={Info}>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Each of the {inputs.paths} paths draws one index return per month from a lognormal
            distribution with a {formatPercent(inputs.indexMeanReturn, { digits: 1 })} expected annual return and{' '}
            {formatPercent(sigma, { digits: 1 })} annual volatility. Both funds, and both contribution
            timings, use the same draws, so the comparison is not distorted by comparing different
            random markets. With {inputs.paths} paths the summary figures (the share of paths behind,
            the medians, and the gaps between them) can still carry sampling error of a few
            percentage points; a different seed would move them.
          </p>
          <p>
            The {L} fund&apos;s monthly log return is {multiple} times the index&apos;s, minus a
            volatility drag, minus financing on the borrowed exposure, minus its expense ratio. At these
            settings those costs add up to roughly {formatPercent(result.annualDragEstimate, TWO_DECIMALS)} a year
            relative to {multiple} times the index return:
          </p>
          <KeyValueList
            items={[
              {
                id: 'volatility-drag',
                label: 'Volatility drag',
                subtitle: '(L\u00b2 \u2212 L) / 2 \u00d7 \u03c3\u00b2',
                value: formatPercent(volatilityDrag, TWO_DECIMALS),
              },
              {
                id: 'financing',
                label: 'Financing',
                subtitle: '(L \u2212 1) \u00d7 financing rate',
                value: formatPercent(financing, TWO_DECIMALS),
              },
              { id: 'expense-ratio', label: 'Expense ratio', value: formatPercent(inputs.expenseRatio, TWO_DECIMALS) },
              {
                id: 'total-drag',
                label: 'Total annual drag',
                value: formatPercent(result.annualDragEstimate, TWO_DECIMALS),
              },
            ]}
          />
          <p>
            The model assumes the same volatility every month. Real markets cluster their volatility,
            and a daily-reset fund loses more to decay in violent months (late 2008, March 2020) than a
            monthly constant-volatility model charges, so the leveraged left tail in real markets can be
            worse than shown here. Contributions are assumed to continue every month, including through
            drawdowns; pausing them during a drawdown changes the result.
          </p>
          <p>
            Not modeled in this version: a historical replay of monthly S&amp;P 500 returns,
            rolling-window win rates, fat-tailed returns, contribution growth, de-leveraging rules, and
            taxes.
          </p>
          <p>
            Default assumptions: ProShares SSO expense ratio (0.89%), broad index ETF expense ratio
            (0.03%), financing at a 3-month Treasury bill rate of about 4% plus a 0.5 point spread, and
            long-run S&amp;P 500 figures of roughly 10% return and 16% volatility. This is a simulation
            under stated assumptions, not a prediction.
          </p>
          <StatusAlert tone="caution" icon={AlertTriangle} title="Leveraged ETF risk">
            Leveraged ETFs reset their exposure daily. Their prospectuses state that returns over
            periods longer than a day can differ significantly from the stated multiple of the index,
            and that a severe decline can erase most of the investment. Holding one through a deep
            drawdown is a test of behavior as much as of arithmetic.
          </StatusAlert>
        </div>
      </ResultCard>
    </div>
  );
}

export default LeverageResults;
