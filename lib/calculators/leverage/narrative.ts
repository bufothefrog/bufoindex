/**
 * The sentences and derived figures the leverage results print, as pure
 * functions of the result and the inputs that produced it. Moved unchanged
 * from the results component; formatting comes from lib/format.
 */

import type { DcaComparisonInputs, DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { formatCurrency, formatPercent } from '@/lib/format';

const MINUS = '\u2212';

const COMPACT = { compact: true } as const;
const COMPACT_SIGNED = { compact: true, signed: true } as const;
const SIGNED_ONE_DECIMAL = { digits: 1, signed: true } as const;

/** A gap as a share of its base; 0 when the base is not positive. */
export function relativeGap(gap: number, base: number): number {
  return base > 0 ? gap / base : 0;
}

function direction(gap: number): string {
  if (Math.abs(gap) < 0.5) return 'level with';
  return gap > 0 ? 'above' : 'below';
}

/** Gain needed to get back to the prior peak after a fractional drawdown. */
export function recoveryGain(drawdown: number): string {
  if (drawdown >= 0.999) return 'more than 100,000%';
  return formatPercent(1 / (1 - drawdown) - 1, { digits: 0 });
}

/**
 * The parts of the leveraged fund's annual drag the model and caveats list:
 * volatility drag (L^2 - L) / 2 x sigma^2 and financing (L - 1) x rate. The
 * expense ratio and the engine's total (annualDragEstimate) complete it.
 */
export function dragParts(inputs: Pick<DcaComparisonInputs, 'leverageRatio' | 'indexVolatility' | 'financingRate'>): {
  volatilityDrag: number;
  financing: number;
} {
  const lev = inputs.leverageRatio;
  const sigma = Math.max(0, inputs.indexVolatility);
  return {
    volatilityDrag: ((lev * lev - lev) / 2) * sigma * sigma,
    financing: (lev - 1) * inputs.financingRate,
  };
}

/** The horizon in years as the results print it: whole, or to one decimal. */
export function yearsText(months: number): string {
  const years = months / 12;
  return String(years % 1 === 0 ? years : years.toFixed(1));
}

export type NoiseInputs = Pick<DcaComparisonInputs, 'leverageRatio' | 'years' | 'paths'>;

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

export function dcaEffectSentence(result: DcaComparisonResult, L: string, inputs: NoiseInputs): string {
  const { dcaGap, lumpSumGap } = result.dcaEffect;
  if (Math.abs(dcaGap) < 0.5 && Math.abs(lumpSumGap) < 0.5) {
    return `At these settings the ${L} fund and the index fund produce the same balances under both framings.`;
  }
  const dcaRel = relativeGap(dcaGap, result.index.dca.p50);
  const lumpRel = relativeGap(lumpSumGap, result.index.lumpSum.p50);
  const diffPoints = (dcaRel - lumpRel) * 100;
  const pointsText = `${Math.abs(diffPoints).toFixed(1)} percentage points`;
  const noise = relativeGapNoisePoints(inputs);
  const gaps =
    `With monthly contributions the ${L} fund's median ends ${direction(dcaGap)} the index fund's ` +
    `median by ${formatCurrency(Math.abs(dcaGap), COMPACT)} (${formatPercent(dcaRel, SIGNED_ONE_DECIMAL)} of the index median). ` +
    `Investing the same ${formatCurrency(result.totalContributed, COMPACT)} at month 0 gives a gap of ` +
    `${formatCurrency(lumpSumGap, COMPACT_SIGNED)} (${formatPercent(lumpRel, SIGNED_ONE_DECIMAL)}).`;

  if (noise > 0 && Math.abs(diffPoints) < noise) {
    return (
      `${gaps} The two relative gaps differ by ${pointsText}, which is within the sampling error of ` +
      `${inputs.paths} simulated paths, so at these settings this run does not separate the two framings.`
    );
  }
  const sign = diffPoints >= 0 ? '+' : MINUS;
  const noiseNote =
    noise > 0 ? ` With ${inputs.paths} paths that figure still carries sampling error of a few percentage points.` : '';
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
