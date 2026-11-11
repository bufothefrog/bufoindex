import React from 'react';
import { AlertTriangle, Info, LineChart, Scale, TrendingDown } from 'lucide-react';
import { ResultCard, SummaryCard } from '@/components/ui/cards';
import { BreakdownRow } from '@/components/calculators/shared/BreakdownRow';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import {
  horizonMonths,
  type DcaComparisonInputs,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';
import { cn, formatCurrency } from '@/lib/utils';
import { ComparisonTable } from './ComparisonTable';
import { DcaPathChart } from './DcaPathChart';
import {
  formatCompactCurrency,
  formatLeverage,
  formatPct,
  formatSignedCompactCurrency,
  formatSignedPct,
} from './format';

export interface LeverageResultsProps {
  result: DcaComparisonResult;
  inputs: DcaComparisonInputs;
  /** True while a newer set of inputs is still being simulated. */
  isStale?: boolean;
}

function relative(gap: number, base: number): number {
  return base > 0 ? gap / base : 0;
}

function direction(gap: number): string {
  if (Math.abs(gap) < 0.5) return 'level with';
  return gap > 0 ? 'above' : 'below';
}

function GapCell({ gap, base }: { gap: number; base: number }) {
  return (
    <>
      <span className="block">{formatSignedCompactCurrency(gap)}</span>
      <span className="block text-xs text-muted-foreground">{formatSignedPct(relative(gap, base))}</span>
    </>
  );
}

/** Gain needed to get back to the prior peak after a fractional drawdown. */
function formatRecovery(drawdown: number): string {
  if (drawdown >= 0.999) return 'more than 100,000%';
  return formatPct(1 / (1 - drawdown) - 1);
}

type NoiseInputs = Pick<DcaComparisonInputs, 'leverageRatio' | 'years' | 'paths'>;

/**
 * Rough seed-to-seed noise, in percentage points, in the difference between
 * the two relative gaps. Calibrated by rerunning the engine on 30 to 40 seeds
 * at the default assumptions with 500 paths: the standard deviation was about
 * 2.8 points at 2x over 20 years, 1.4 at 1.5x, 5 at 3x, 1.5 over 5 years and
 * 4.3 over 40 years, and about 0.3 at 1x (fees only, nearly deterministic).
 * This returns roughly 1.5 of those standard deviations: 4 points at 2x over
 * 20 years, scaled by the leverage above 1x, the square root of the horizon,
 * and one over the square root of the path count. It only decides whether the
 * copy calls a difference noise; it is not a confidence interval.
 */
export function relativeGapNoisePoints(inputs: NoiseInputs): number {
  const excess = Math.abs(inputs.leverageRatio - 1);
  const years = Math.max(1, inputs.years);
  const paths = Math.max(1, inputs.paths);
  if (!Number.isFinite(excess) || !Number.isFinite(years) || !Number.isFinite(paths)) return 0;
  return 4 * excess * Math.sqrt(years / 20) * Math.sqrt(500 / paths);
}

export function dcaEffectSentence(
  result: DcaComparisonResult,
  L: string,
  inputs: NoiseInputs
): string {
  const { dcaGap, lumpSumGap } = result.dcaEffect;
  if (Math.abs(dcaGap) < 0.5 && Math.abs(lumpSumGap) < 0.5) {
    return `At these settings the ${L} fund and the index fund produce the same balances under both framings.`;
  }
  const dcaRel = relative(dcaGap, result.index.dca.p50);
  const lumpRel = relative(lumpSumGap, result.index.lumpSum.p50);
  const diffPoints = (dcaRel - lumpRel) * 100;
  const pointsText = `${Math.abs(diffPoints).toFixed(1)} percentage points`;
  const noise = relativeGapNoisePoints(inputs);
  const gaps =
    `With monthly contributions the ${L} fund's median ends ${direction(dcaGap)} the index fund's ` +
    `median by ${formatCompactCurrency(Math.abs(dcaGap))} (${formatSignedPct(dcaRel)} of the index median). ` +
    `Investing the same ${formatCompactCurrency(result.totalContributed)} at month 0 gives a gap of ` +
    `${formatSignedCompactCurrency(lumpSumGap)} (${formatSignedPct(lumpRel)}).`;

  if (noise > 0 && Math.abs(diffPoints) < noise) {
    return (
      `${gaps} The two relative gaps differ by ${pointsText}, which is within the sampling error of ` +
      `${inputs.paths} simulated paths, so at these settings this run does not separate the two framings.`
    );
  }
  const sign = diffPoints >= 0 ? '+' : '−';
  const noiseNote =
    noise > 0
      ? ` With ${inputs.paths} paths that figure still carries sampling error of a few percentage points.`
      : '';
  return (
    `${gaps} Both framings use the same simulated markets, so the difference between the two relative ` +
    `gaps (${sign}${pointsText}) comes from how the contribution pattern interacts with the funds' ` +
    `different growth rates.${noiseNote}`
  );
}

/**
 * Compares each fund's lump-sum median with its monthly-contribution median.
 * The direction depends on the inputs: with positive expected returns the lump
 * sum's longer time in the market usually makes it larger, but at low or
 * negative returns (or where volatility drag dominates the leveraged fund) it
 * can be smaller for one fund or both, so the sentence is computed rather
 * than fixed.
 */
export function lumpSumScaleSentence(result: DcaComparisonResult, L: string): string {
  const indexDiff = result.index.lumpSum.p50 - result.index.dca.p50;
  const levDiff = result.leveraged.lumpSum.p50 - result.leveraged.dca.p50;
  const indexDir = direction(indexDiff);
  const levDir = direction(levDiff);
  const tail = 'The relative gap in the table is the like-for-like comparison.';
  if (indexDir === levDir) {
    if (indexDir === 'above') {
      return `The lump sum has more money in the market for longer, and at these settings that makes its median balance larger than the monthly median under both funds. ${tail}`;
    }
    if (indexDir === 'below') {
      return `At these settings the lump sum's median balance is smaller than the monthly median under both funds: when the typical path grows slowly or falls, money that sits in the market longer has more time to lose ground. ${tail}`;
    }
    return `At these settings the lump sum and monthly contributions end at about the same median balance under both funds. ${tail}`;
  }
  return (
    `At these settings the lump sum's median ends ${indexDir} the monthly median for the index fund and ` +
    `${levDir} it for the ${L} fund: the two funds' typical paths grow at different rates, and the lump sum ` +
    `spends longer exposed to that difference. ${tail}`
  );
}

export function LeverageResults({ result, inputs, isStale = false }: LeverageResultsProps) {
  const L = formatLeverage(inputs.leverageRatio);
  const months = horizonMonths(inputs.years);
  const years = months / 12;
  const { index, leveraged } = result;
  const sigma = Math.max(0, inputs.indexVolatility);
  const lev = inputs.leverageRatio;
  const multiple = Number(lev.toFixed(2));
  const decay = ((lev * lev - lev) / 2) * sigma * sigma;
  const financing = (lev - 1) * inputs.financingRate;
  const mddIndex = result.medianMaxDrawdown.index;
  const mddLeveraged = result.medianMaxDrawdown.leveraged;
  const monthsBehind = Math.round(result.medianMonthsBehind);

  return (
    <div
      className={cn('space-y-6 transition-opacity', isStale && 'opacity-60')}
      aria-busy={isStale}
      aria-live="polite"
    >
      {/* 1. Headline */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SummaryCard
          value={formatCurrency(index.dca.p50)}
          label="Index fund, median ending balance"
          secondaryValue={`10th to 90th: ${formatCompactCurrency(index.dca.p10)} to ${formatCompactCurrency(index.dca.p90)}`}
        />
        <SummaryCard
          value={formatCurrency(leveraged.dca.p50)}
          label={`${L} fund, median ending balance`}
          secondaryValue={`10th to 90th: ${formatCompactCurrency(leveraged.dca.p10)} to ${formatCompactCurrency(leveraged.dca.p90)}`}
        />
        <SummaryCard
          className="md:col-span-2"
          value={formatPct(result.probLeveragedBehindDca)}
          label={`of simulated paths where the ${L} fund ends behind the index fund`}
          secondaryValue={`${formatCurrency(result.totalContributed)} contributed to each over ${years % 1 === 0 ? years : years.toFixed(1)} years, ${inputs.paths} paths`}
        />
      </div>

      {/* 2. Balance paths */}
      <ResultCard title="Balance over time" icon={LineChart}>
        <DcaPathChart points={result.medianPath} leverageRatio={inputs.leverageRatio} paths={inputs.paths} />
      </ResultCard>

      {/* 3. Cash flow vs lump sum */}
      <ResultCard title="Cash flow vs lump sum" icon={Scale}>
        <div className="space-y-4">
          <ComparisonTable
            caption={`Median ending balances for the index fund and the ${L} fund under monthly contributions and a lump sum`}
            columns={['Framing', 'Index', L, 'Gap']}
            rows={[
              {
                label: 'Monthly',
                sublabel: `${formatCompactCurrency(inputs.monthlyContribution)}/mo + ${formatCompactCurrency(inputs.startingBalance)} start`,
                values: [
                  formatCompactCurrency(index.dca.p50),
                  formatCompactCurrency(leveraged.dca.p50),
                  <GapCell key="gap" gap={result.dcaEffect.dcaGap} base={index.dca.p50} />,
                ],
              },
              {
                label: 'Lump sum',
                sublabel: `${formatCompactCurrency(result.totalContributed)} at month 0`,
                values: [
                  formatCompactCurrency(index.lumpSum.p50),
                  formatCompactCurrency(leveraged.lumpSum.p50),
                  <GapCell key="gap" gap={result.dcaEffect.lumpSumGap} base={index.lumpSum.p50} />,
                ],
              },
            ]}
          />
          <p className="text-sm text-muted-foreground">{dcaEffectSentence(result, L, inputs)}</p>
          <p className="text-sm text-muted-foreground">
            Paths where the {L} fund ends behind: {formatPct(result.probLeveragedBehindDca)} with
            monthly contributions, {formatPct(result.probLeveragedBehindLumpSum)} as a lump
            sum. {lumpSumScaleSentence(result, L)}
          </p>
        </div>
      </ResultCard>

      {/* 4. Tail and drawdown */}
      <ResultCard title="Tail and drawdown" icon={TrendingDown}>
        <div className="space-y-4">
          <ComparisonTable
            caption={`Drawdown and low-percentile outcomes for the index fund and the ${L} fund`}
            columns={['Measure', 'Index', L]}
            rows={[
              {
                label: 'Median max drawdown',
                sublabel: 'Worst peak-to-trough fall in fund price',
                values: [formatPct(mddIndex), formatPct(mddLeveraged)],
              },
              {
                label: '10th percentile',
                sublabel: 'Ending balance; 1 in 10 paths end lower',
                values: [formatCompactCurrency(index.dca.p10), formatCompactCurrency(leveraged.dca.p10)],
              },
              {
                label: '90th percentile',
                sublabel: 'Ending balance; 1 in 10 paths end higher',
                values: [formatCompactCurrency(index.dca.p90), formatCompactCurrency(leveraged.dca.p90)],
              },
            ]}
          />
          <BreakdownRow
            label={`Months the ${L} balance trailed`}
            subtitle={`Median across paths, out of ${months} months`}
            value={`${monthsBehind} mo`}
          />
          <p className="text-sm text-muted-foreground">
            Recovering from the median {L} drawdown ({formatPct(mddLeveraged)}) needs a gain of{' '}
            {formatRecovery(mddLeveraged)}; for the index fund ({formatPct(mddIndex)}) it needs{' '}
            {formatRecovery(mddIndex)}. With monthly contributions, money added during a drawdown buys
            in at the lower price, which is part of why the cash-flow framing differs from the lump
            sum.
          </p>
        </div>
      </ResultCard>

      {/* 5. Model and caveats */}
      <ResultCard title="Model and caveats" icon={Info}>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Each of the {inputs.paths} paths draws one index return per month from a lognormal
            distribution with a {formatPct(inputs.indexMeanReturn, 1)} expected annual return and{' '}
            {formatPct(sigma, 1)} annual volatility. Both funds, and both the monthly and lump-sum
            framings, use the same draws, so the comparison is not distorted by comparing different
            random markets. With {inputs.paths} paths the summary figures (the share of paths behind,
            the medians, and the gaps between them) can still carry sampling error of a few
            percentage points; a different seed would move them.
          </p>
          <p>
            The {L} fund&apos;s monthly log return is {multiple} times the index&apos;s, minus a
            volatility drag, minus financing on the borrowed exposure, minus its expense ratio. At these
            settings those costs add up to roughly {formatPct(result.annualDragEstimate, 2)} a year
            relative to {multiple} times the index return:
          </p>
          <div className="space-y-2">
            <BreakdownRow
              label="Volatility drag"
              subtitle="(L² − L) / 2 × σ²"
              value={formatPct(decay, 2)}
            />
            <BreakdownRow
              label="Financing"
              subtitle="(L − 1) × financing rate"
              value={formatPct(financing, 2)}
            />
            <BreakdownRow label="Expense ratio" value={formatPct(inputs.expenseRatio, 2)} />
            <BreakdownRow label="Total annual drag" value={formatPct(result.annualDragEstimate, 2)} />
          </div>
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
          <StatusAlert variant="warning" icon={AlertTriangle} title="Leveraged ETF risk">
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
